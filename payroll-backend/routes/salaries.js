const express = require('express');
const connection = require('../db');

const router = express.Router();

// Function to check if salary exists for a period and category
const salaryExistsForPeriod = async (period, category) => {
  try {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tableName = `salary_${period}_${normalizedCategory}`;
    
    // Check if the table exists
    const [tables] = await connection.promise().query(
      'SHOW TABLES LIKE ?',
      [tableName]
    );
    
    if (tables.length === 0) {
      return false; // Table doesn't exist, so no salary data
    }
    
    // Check if there are any entries for this period
    const [rows] = await connection.promise().query(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE period = ?`,
      [period]
    );
    
    return rows[0].count > 0;
    
  } catch (error) {
    console.error('Error checking for existing salary data:', error);
    throw error;
  }
};

// Function to create a salary table for a specific period and category
const createSalaryTableForPeriod = async (period, category) => {
  // Normalize category for table name (lowercase, no special chars)
  const normalizedCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tableName = `salary_${period}_${normalizedCategory}`;
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_code VARCHAR(20) NOT NULL,
      name VARCHAR(100) NOT NULL,
      bank_account VARCHAR(50) DEFAULT NULL,
      department VARCHAR(50),
      category VARCHAR(50) NOT NULL,
      rate DECIMAL(12, 2) NOT NULL,
      attendance INT DEFAULT 0,
      basic_salary DECIMAL(12, 2) NOT NULL,
      CEA DECIMAL(12, 2) DEFAULT 0,
      CHA DECIMAL(12, 2) DEFAULT 0,
      HRA DECIMAL(12, 2) DEFAULT 0,
      OTHALLOW DECIMAL(12, 2) DEFAULT 0,
      SPA DECIMAL(12, 2) DEFAULT 0,
      UMA DECIMAL(12, 2) DEFAULT 0,
      total_allowance DECIMAL(12, 2) DEFAULT 0,
      CLUB DECIMAL(12, 2) DEFAULT 0,
      CUTIE_CLUB_DED DECIMAL(12, 2) DEFAULT 0,
      DISH DECIMAL(12, 2) DEFAULT 0,
      ELECTRICITY DECIMAL(12, 2) DEFAULT 0,
      EMP_COP_SALARY DECIMAL(12, 2) DEFAULT 0,
      ESIC DECIMAL(12, 2) DEFAULT 0,
      FUELDED DECIMAL(12, 2) DEFAULT 0,
      JPOCSALON DECIMAL(12, 2) DEFAULT 0,
      MEDICAL_RECOVERY DECIMAL(12, 2) DEFAULT 0,
      MILKDED DECIMAL(12, 2) DEFAULT 0,
      OTHERDED1 DECIMAL(12, 2) DEFAULT 0,
      PF DECIMAL(12, 2) DEFAULT 0,
      SCHOOLFEE DECIMAL(12, 2) DEFAULT 0,
      TDS DECIMAL(12, 2) DEFAULT 0,
      TRANSPORT_DED DECIMAL(12, 2) DEFAULT 0,
      WF DECIMAL(12, 2) DEFAULT 0,
      total_deduction DECIMAL(12, 2) DEFAULT 0,
      net_salary DECIMAL(12, 2) NOT NULL,
      month VARCHAR(20) NOT NULL,
      year INT NOT NULL,
      period VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_emp (emp_code, period)
    ) COMMENT='Salary data for ${category} employees - ${period}';
  `;

  try {
    await connection.promise().query(createTableSQL);
    console.log(`Table ${tableName} is ready`);
    return tableName;
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    throw error;
  }
};

// Function to get all salary tables with period and category info
const getSalaryTables = async () => {
  try {
    const [tables] = await connection.promise().query(
      "SHOW TABLES LIKE 'salary_%'"
    );
    
    const tableInfo = [];
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    for (const tableName of tableNames) {
      // Extract period and category from table name (format: salary_MMyy_category)
      const match = tableName.match(/^salary_(\d{4})_(\w+)$/);
      if (match) {
        const [, period, category] = match;
        const month = new Date(
          2000 + parseInt(period.slice(2), 10),
          parseInt(period.slice(0, 2)) - 1,
          1
        ).toLocaleString('default', { month: 'long' });
        
        // Handle H&F category consistently
        let displayCategory = category.toUpperCase();
        if (category === 'hf') {
          displayCategory = 'H&F';
        }
        
        tableInfo.push({
          tableName,
          period,
          category: displayCategory,
          month,
          year: 2000 + parseInt(period.slice(2), 10)
        });
      }
    }
    
    // Sort by year, then month, then category
    tableInfo.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.period !== b.period) return b.period.localeCompare(a.period);
      return a.category.localeCompare(b.category);
    });
    
    return tableInfo;
  } catch (error) {
    console.error('Error fetching salary tables:', error);
    throw error;
  }
};

// POST /api/salaries/generate - Generate and save salaries for a period
router.post('/generate', async (req, res) => {
  const { period, month, year, data } = req.body;

  if (!period || !month || !year || !Array.isArray(data)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid request data. Period, month, year, and data array are required.' 
    });
  }
  
  // Group data by category first to check for duplicates
  const dataByCategory = {};
  data.forEach(emp => {
    const category = emp.category.toLowerCase().includes('apprentice') ? 'apprentice' : 
                    emp.category.toLowerCase().includes('sks') ? 'sks' : 'hf';
    if (!dataByCategory[category]) {
      dataByCategory[category] = [];
    }
    dataByCategory[category].push(emp);
  });
  
  // Check for existing salary data before proceeding
  try {
    for (const category of Object.keys(dataByCategory)) {
      const exists = await salaryExistsForPeriod(period, category);
      if (exists) {
        return res.status(400).json({
          success: false,
          message: `Salary already generated for ${category} category of ${month} ${year}`
        });
      }
    }
  } catch (error) {
    console.error('Error checking for existing salary data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking for existing salary data',
      error: error.message
    });
  }

  const connection = await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    await connection.beginTransaction();
    let totalRecordsInserted = 0;
    const savedTables = [];

    // Process each category
    for (const [category, categoryData] of Object.entries(dataByCategory)) {
      if (categoryData.length === 0) continue;

      // Create table for this category if it doesn't exist
      const tableName = await createSalaryTableForPeriod(period, category);
      savedTables.push(tableName);

      // Clear existing data for this period and category
      await connection.query(`DELETE FROM ${tableName} WHERE period = ?`, [period]);

      // Prepare the insert query with all required fields
      const columns = [
        'emp_code', 'name', 'bank_account', 'department', 'category', 'rate', 'attendance',
        'basic_salary', 'CEA', 'CHA', 'HRA', 'OTHALLOW', 'SPA', 'UMA', 'total_allowance',
        'CLUB', 'CUTIE_CLUB_DED', 'DISH', 'ELECTRICITY', 'EMP_COP_SALARY', 'ESIC',
        'FUELDED', 'JPOCSALON', 'MEDICAL_RECOVERY', 'MILKDED', 'OTHERDED1', 'PF',
        'SCHOOLFEE', 'TDS', 'TRANSPORT_DED', 'WF', 'total_deduction', 'net_salary',
        'month', 'year', 'period'
      ];
      
      const placeholders = categoryData.map(() => `(${Array(columns.length).fill('?').join(', ')})`).join(',');
      const insertQuery = `
        INSERT INTO ${tableName} (
          ${columns.join(', ')}
        ) VALUES ${placeholders}
      `;

      // Flatten the values array with all required fields
      const values = [];
      console.log('Processing category data:', JSON.stringify(categoryData, null, 2));
      categoryData.forEach(emp => {
        values.push(
          emp.empCode,
          emp.name,
          emp.bankAccount || '',
          emp.department || '',
          emp.category,
          emp.rate || 0,
          emp.attendance || 0,
          emp.basicSalary || 0,
          emp.CEA || 0,
          emp.CHA || 0,
          emp.HRA || 0,
          emp.OTHALLOW || 0,
          emp.SPA || 0,
          emp.UMA || 0,
          emp.totalAllowance || 0,
          emp.CLUB || 0,
          emp.CUTIE_CLUB_DED || 0,
          emp.DISH || 0,
          emp.ELECTRICITY || 0,
          emp.EMP_COP_SALARY || 0,
          emp.ESIC || 0,
          emp.FUELDED || 0,
          emp.JPOCSALON || 0,
          emp.MEDICAL_RECOVERY || 0,
          emp.MILKDED || 0,
          emp.OTHERDED1 || 0,
          emp.PF || 0,
          emp.SCHOOLFEE || 0,
          emp.TDS || 0,
          emp.TRANSPORT_DED || 0,
          emp.WF || 0,
          emp.totalDeduction || 0,
          emp.netSalary || 0,
          month,
          year,
          period
        );
      });

      // Execute the insert query
      const [result] = await connection.query(insertQuery, values);
      totalRecordsInserted += result.affectedRows;
    }

    await connection.commit();
    
    const categoryList = Object.keys(dataByCategory).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
    res.json({
      success: true,
      message: `Salary successfully generated for ${month} ${year} (${categoryList})`,
      details: {
        period: period,
        month: month,
        year: year,
        categories: Object.keys(dataByCategory),
        recordsInserted: totalRecordsInserted,
        tablesCreated: savedTables
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error generating salaries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate salaries',
      error: error.message
    });
  } finally {
    await connection.end();
  }
});

// GET /api/salaries/periods - Get list of all salary periods
router.get('/periods', async (req, res) => {
  try {
    const tables = await getSalaryTables();
    const periods = [];
    
    // Extract period from table names (format: salary_MMyy)
    for (const table of tables) {
      const period = table.replace('salary_', '');
      // Convert period to month and year
      const month = new Date(
        2000 + parseInt(period.slice(2), 10), // year
        parseInt(period.slice(0, 2)) - 1,     // month (0-indexed)
        1
      ).toLocaleString('default', { month: 'long' });
      
      periods.push({
        period: period,
        month: month,
        year: 2000 + parseInt(period.slice(2), 10)
      });
    }
    
    // Sort by year and month (newest first)
    periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.period.localeCompare(a.period);
    });
    
    res.json(periods);
  } catch (error) {
    console.error('Error fetching salary periods:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch salary periods',
      error: error.message
    });
  }
});

// GET /api/salaries/period/:period - Get salaries for a specific period and optional category
router.get('/period/:period', async (req, res) => {
  const { period } = req.params;
  const { category } = req.query;
  
  try {
    let tables = await getSalaryTables();
    
    // Normalize category for comparison
    const normalizedCategory = category ? category.toUpperCase() : null;
    
    // Filter tables for the requested period and optional category
    tables = tables.filter(t => {
      const isPeriodMatch = t.period === period;
      if (!category) return isPeriodMatch;
      
      // Special handling for H&F category
      if (normalizedCategory === 'H&F') {
        return isPeriodMatch && (t.category === 'H&F' || t.category === 'HF');
      }
      
      return isPeriodMatch && t.category.toUpperCase() === normalizedCategory;
    });
    
    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No salary data found ${category ? 'for the specified category ' : ''}in period ${period}`
      });
    }
    
    // Get data from all matching tables
    let allSalaries = [];
    for (const table of tables) {
      const [salaries] = await connection.promise().query(
        `SELECT * FROM ${table.tableName} WHERE period = ? ORDER BY name`,
        [period]
      );
      allSalaries = [...allSalaries, ...salaries];
    }
    
    res.json({
      success: true,
      period: period,
      month: tables[0].month,
      year: tables[0].year,
      category: category || 'all',
      data: allSalaries
    });
    
  } catch (error) {
    console.error(`Error fetching salaries for period ${period}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch salary data',
      error: error.message
    });
  }
});

// DELETE /api/salaries/period/:period - Delete a salary period
router.delete('/period/:period', async (req, res) => {
  const { period } = req.params;
  const { category } = req.query;
  
  try {
    let tables = await getSalaryTables();
    
    // Filter tables for the requested period and optional category
    tables = tables.filter(t => t.period === period && 
      (!category || t.category.toLowerCase() === category.toLowerCase()));
    
    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No salary data found ${category ? 'for the specified category ' : ''}in period ${period}`
      });
    }
    
    // Drop all matching tables
    for (const table of tables) {
      await connection.promise().query(`DROP TABLE ${table.tableName}`);
    }
    
    res.json({
      success: true,
      message: `Successfully deleted ${tables.length} salary table(s) for period ${period}${category ? ` (${category})` : ''}`
    });
    
  } catch (error) {
    console.error(`Error deleting salary period ${period}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete salary data',
      error: error.message
    });
  }
});

module.exports = router;
