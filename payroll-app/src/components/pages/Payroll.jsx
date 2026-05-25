import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Default attendance data structure
const getDefaultAttendanceData = (employees, month, year) => {
  console.log('Processing employees in getDefaultAttendanceData:', employees);
  return employees.map(emp => {
    const employeeData = {
      id: emp.empCode,
      empCode: emp.empCode,
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
      department: emp.department || 'N/A',
      bankAccount: emp.bankAccount || '',
      category: emp.category || 'N/A',
      rate: emp.rates || 0,
      attendance: 0,
      basicSalary: 0,
      month: month,
      year: year
    };
    console.log('Processed employee:', employeeData);
    return employeeData;
  });
};

// Tab components
const AttendanceTab = ({ attendanceData = [], onAttendanceUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { month, year } = getCurrentMonthYear();
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  // Filter employees based on search term
  const filteredData = attendanceData.filter(emp => {
    if (!emp) return false;
    const searchTermLower = (searchTerm || '').toLowerCase();
    const empCode = String(emp.empCode || '').toLowerCase();
    const name = String(emp.name || '').toLowerCase();
    const department = String(emp.department || '').toLowerCase();
    
    return (
      empCode.includes(searchTermLower) ||
      name.includes(searchTermLower) ||
      department.includes(searchTermLower)
    );
  });

  // Handle attendance change
  const handleAttendanceChange = (empId, days) => {
    const newData = attendanceData.map(item => 
      item.id === empId 
        ? { 
            ...item, 
            attendance: parseInt(days) || 0,
            basicSalary: calculateSalary(parseInt(days) || 0, item.rate || 0, item.month || month, item.year || year)
          } 
        : item
    );
    onAttendanceUpdate(newData);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('File read successfully, processing...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        console.log('Sheet name:', firstSheetName);
        
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Parsed data from file:', jsonData);
        if (jsonData.length === 0) {
          throw new Error('The file is empty or could not be read properly.');
        }

        // Process the uploaded data and update attendance
        processAttendanceData(jsonData);
      } catch (error) {
        console.error('Error processing file:', error);
        setUploadStatus({ 
          type: 'error', 
          message: error.message || 'Error processing file. Please check the file format and try again.' 
        });
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setUploadStatus({ 
        type: 'error', 
        message: 'Error reading file. Please try again.' 
      });
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Process the uploaded attendance data and update the state
  const processAttendanceData = (uploadedData) => {
    try {
      console.log('Processing attendance data...');
      console.log('Sample row from file:', uploadedData[0]);
      
      // Create a map of employee code to attendance days
      const attendanceMap = new Map();
      let foundColumns = {
        empCode: null,
        days: null
      };
      
      // First, try to detect column names (case-insensitive and space-insensitive)
      if (uploadedData.length > 0) {
        const firstRow = uploadedData[0];
        const availableColumns = Object.keys(firstRow).filter(k => k !== '__rowNum__');
        console.log('Available columns in file:', availableColumns);
        
        // Function to normalize column names for comparison
        const normalizeColName = (name) => {
          return name.toLowerCase().replace(/\s+/g, '');
        };
        
        // Create a map of normalized column names to original names
        const columnMap = {};
        availableColumns.forEach(col => {
          columnMap[normalizeColName(col)] = col;
        });
        
        console.log('Normalized column map:', columnMap);
        
        // Try to find matching columns with various possible names
        const possibleEmpCodeCols = ['empcode', 'employeecode', 'employeeid', 'empid', 'id'];
        const possibleDaysCols = ['dayspresent', 'days', 'presentdays', 'attendance', 'daysworked'];
        
        // Find the first matching column name (case and space insensitive)
        for (const col of possibleEmpCodeCols) {
          if (columnMap[col]) {
            foundColumns.empCode = columnMap[col];
            break;
          }
        }
        
        for (const col of possibleDaysCols) {
          if (columnMap[col]) {
            foundColumns.days = columnMap[col];
            break;
          }
        }
        
        console.log('Detected columns (original case):', foundColumns);
      }
      
      if (!foundColumns.empCode || !foundColumns.days) {
        console.warn('Could not detect required columns. Available columns:', 
          uploadedData.length > 0 ? Object.keys(uploadedData[0]) : 'No data');
        throw new Error('Could not detect required columns in the file. Please ensure your file has columns for employee code and days present.');
      }

      // Process each row
      uploadedData.forEach((row, index) => {
        const empCode = row[foundColumns.empCode];
        const days = row[foundColumns.days];
        
        if (empCode && !isNaN(parseFloat(days))) {
          const code = String(empCode).trim();
          const daysValue = parseFloat(days);
          attendanceMap.set(code, daysValue);
          console.log(`Row ${index + 1}: Mapped ${code} -> ${daysValue} days`);
        } else if (empCode) {
          console.warn(`Skipping row ${index + 1}: Invalid days value for ${empCode}:`, days);
        }
      });

      console.log('Attendance map:', Array.from(attendanceMap.entries()));
      console.log('Current employee codes in system:', attendanceData.map(e => e.empCode));

      // Update attendance data
      const updatedData = attendanceData.map(emp => {
        const empCode = String(emp.empCode).trim();
        if (attendanceMap.has(empCode)) {
          const days = attendanceMap.get(empCode);
          console.log(`Updating ${empCode}: ${emp.name} - ${days} days`);
          return {
            ...emp,
            attendance: days,
            basicSalary: (days || 0) * (emp.rate || 0)
          };
        }
        return emp;
      });

      console.log('Updated data:', updatedData);
      onAttendanceUpdate(updatedData);
      
      const updatedCount = updatedData.filter(emp => attendanceMap.has(String(emp.empCode).trim())).length;
      setUploadStatus({ 
        type: 'success', 
        message: `Updated attendance for ${updatedCount} out of ${attendanceMap.size} employees in the file.` 
      });
      
    } catch (error) {
      console.error('Error processing attendance data:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Error processing attendance data. Please check the file format and try again.' 
      });
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Attendance Management</h3>
        <div className="header-actions">
          <div className="file-upload-container" style={{ marginRight: '15px' }}>
            <label className="btn btn-secondary" style={{ marginRight: '10px' }}>
              <i className="fas fa-upload"></i> Upload Attendance
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
            </label>
            {isUploading && <span className="upload-status">Processing file...</span>}
            {uploadStatus.message && (
              <span className={`status-message ${uploadStatus.type}`}>
                {uploadStatus.message}
              </span>
            )}
          </div>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Emp Code</th>
              <th>Name</th>
              <th>Department</th>
              <th>Category</th>
              <th>Monthly Rate (₹)</th>
              <th>Daily Rate (₹)</th>
              <th>Attendance (days)</th>
              <th>Basic Salary (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((emp) => (
                <tr key={emp.id || emp.empCode}>
                  <td>{emp.empCode || 'N/A'}</td>
                  <td>{emp.name || 'N/A'}</td>
                  <td>{emp.department || 'N/A'}</td>
                  <td>{emp.category || 'N/A'}</td>
                  <td className="text-right">₹{(emp.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-right">
                    {emp.rate && emp.month && emp.year 
                      ? `₹${calculateDailyRate(emp.rate, emp.month, emp.year).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '₹0.00'}
                  </td>
                  <td>
                    <div className="attendance-cell">
                      <input 
                        type="number" 
                        min="0" 
                        max="31" 
                        value={emp.attendance || 0} 
                        onChange={(e) => handleAttendanceChange(emp.id || emp.empCode, e.target.value)}
                        className="attendance-input"
                      />
                      <span>days</span>
                    </div>
                  </td>
                  <td className="text-right">₹{(emp.basicSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  {searchTerm ? 'No matching employees found' : 'No employee data available'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="tab-footer">
        <div className="summary">
          <div className="summary-item">
            <span>Total Employees:</span>
            <span className="value">{filteredData.length}</span>
          </div>
          <div className="summary-item">
            <span>Total Salary:</span>
            <span className="value">
              ₹{filteredData.reduce((sum, emp) => sum + (emp.basicSalary || 0), 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AllowanceTab = ({ attendanceData = [], onAllowanceUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);
  
  const handleAllowanceChange = (empId, field, value) => {
    if (onAllowanceUpdate) {
      onAllowanceUpdate(empId, field, parseInt(value) || 0);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('File read successfully, processing...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        console.log('Sheet name:', firstSheetName);
        
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Parsed data from file:', jsonData);
        if (jsonData.length === 0) {
          throw new Error('The file is empty or could not be read properly.');
        }

        // Process the uploaded data and update allowances
        processAllowanceData(jsonData);
      } catch (error) {
        console.error('Error processing file:', error);
        setUploadStatus({ 
          type: 'error', 
          message: error.message || 'Error processing file. Please check the file format and try again.' 
        });
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      setUploadStatus({ 
        type: 'error', 
        message: 'Error reading the file. Please try again.' 
      });
      setIsUploading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const processAllowanceData = (uploadedData) => {
    try {
      console.log('Processing allowance data...');
      console.log('Sample row from file:', uploadedData[0]);
      
      if (uploadedData.length === 0) {
        throw new Error('No data found in the uploaded file.');
      }

      // Create a map of employee code to allowance data
      const allowanceMap = new Map();
      let foundColumns = {
        empCode: null,
        cea: null,
        cha: null,
        hra: null,
        othallow: null,
        spa: null,
        uma: null
      };
      
      // First, try to detect column names (case-insensitive and space-insensitive)
      if (uploadedData.length > 0) {
        const firstRow = uploadedData[0];
        const availableColumns = Object.keys(firstRow).filter(k => k !== '__rowNum__');
        console.log('Available columns in file:', availableColumns);
        
        // Function to normalize column names for comparison
        const normalizeColName = (name) => {
          return name.toLowerCase().replace(/[^a-z0-9]/g, '');
        };
        
        // Create a map of normalized column names to original names
        const columnMap = {};
        availableColumns.forEach(col => {
          columnMap[normalizeColName(col)] = col;
        });
        
        console.log('Normalized column map:', columnMap);
        
        // Define possible column name variations for each field
        const columnMappings = {
          empCode: ['empcode', 'employeecode', 'employeeid', 'empid', 'id', 'emp'],
          cea: ['cea'],
          cha: ['cha'],
          hra: ['hra'],
          othallow: ['othallow', 'oth', 'otherallowance', 'other'],
          spa: ['spa'],
          uma: ['uma']
        };
        
        // Find matching columns for each field
        Object.entries(columnMappings).forEach(([field, possibleNames]) => {
          for (const name of possibleNames) {
            if (columnMap[name]) {
              foundColumns[field] = columnMap[name];
              console.log(`Matched column '${columnMap[name]}' to ${field}`);
              break;
            }
          }
        });
        
        console.log('Detected columns (original case):', foundColumns);
      }
      
      // Check if we found all required columns
      const requiredColumns = ['empCode'];
      const missingColumns = requiredColumns.filter(col => !foundColumns[col]);
      
      if (missingColumns.length > 0) {
        throw new Error(`Could not detect required columns in the file. Please ensure your file has a column for employee code.`);
      }

      // Process each row in the uploaded data
      uploadedData.forEach((row, index) => {
        const empCode = String(row[foundColumns.empCode] || '').trim();
        
        if (!empCode) {
          console.warn(`Skipping row ${index + 1}: Missing employee code`);
          return;
        }
        
        const allowanceData = {
          empCode,
          cea: parseFloat(row[foundColumns.cea] || 0) || 0,
          cha: parseFloat(row[foundColumns.cha] || 0) || 0,
          hra: parseFloat(row[foundColumns.hra] || 0) || 0,
          othallow: parseFloat(row[foundColumns.othallow] || 0) || 0,
          spa: parseFloat(row[foundColumns.spa] || 0) || 0,
          uma: parseFloat(row[foundColumns.uma] || 0) || 0
        };
        
        allowanceMap.set(empCode, allowanceData);
        console.log(`Row ${index + 1}: Mapped ${empCode}`, allowanceData);
      });

      console.log('Allowance map:', Array.from(allowanceMap.entries()));
      console.log('Current employee codes in system:', attendanceData.map(e => e.empCode));

      // Update attendance data with the new allowance values
      let updatedCount = 0;
      
      attendanceData.forEach(emp => {
        const empCode = String(emp.empCode).trim();
        if (allowanceMap.has(empCode)) {
          const allowances = allowanceMap.get(empCode);
          let employeeUpdated = false;
          
          // Update each allowance field if it exists in the uploaded data
          Object.entries(allowances).forEach(([field, value]) => {
            if (field !== 'empCode' && value !== undefined && !isNaN(value)) {
              if (onAllowanceUpdate) {
                onAllowanceUpdate(emp.id, field, value);
                employeeUpdated = true;
              }
            }
          });
          
          if (employeeUpdated) {
            updatedCount++;
          }
          
          console.log(`Updated allowances for ${empCode}: ${emp.name}`, allowances);
        }
      });
      
      setUploadStatus({ 
        type: 'success', 
        message: `Successfully updated allowances for ${updatedCount} employees.` 
      });
      
    } catch (error) {
      console.error('Error processing allowance data:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Error processing allowance data. Please check the file format and try again.' 
      });
    }
  };

  // Calculate total allowance from all allowance fields
  const calculateTotalAllowance = (emp) => {
    const allowances = [
      'cea', 'cha', 'hra', 'othallow', 'spa', 'uma'
    ];
    
    return allowances.reduce((total, field) => {
      return total + (emp[field] || 0);
    }, 0);
  };

  return (
    <div className="tab-content">
      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h3>Allowance Management</h3>
        <div className="file-upload-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="btn btn-secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fas fa-upload"></i> Upload Allowance Data
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </label>
          {isUploading && <span className="upload-status">Processing file...</span>}
          {uploadStatus.message && (
            <span className={`status-message ${uploadStatus.type}`}>
              {uploadStatus.message}
            </span>
          )}
        </div>
      </div>
      <div className="table-responsive" style={{ overflowX: 'auto' }}>
        {attendanceData.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Basic (₹)</th>
                <th>CEA (₹)</th>
                <th>CHA (₹)</th>
                <th>HRA (₹)</th>
                <th>OTHALLOW (₹)</th>
                <th>SPA (₹)</th>
                <th>UMA (₹)</th>
                <th>Total Allowance (₹)</th>
                <th>Gross (₹)</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((emp) => {
                const totalAllowance = calculateTotalAllowance(emp);
                const grossSalary = (emp.basicSalary || 0) + totalAllowance;
                
                return (
                  <tr key={emp.id}>
                    <td>{emp.empCode}</td>
                    <td>{emp.name}</td>
                    <td>{emp.department}</td>
                    <td>₹{emp.basicSalary?.toLocaleString('en-IN') || '0'}</td>
                    
                    {/* CEA */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.cea || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'cea', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    {/* CHA */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.cha || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'cha', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    {/* HRA */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.hra || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'hra', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    {/* OTHALLOW */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.othallow || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'othallow', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    {/* SPA */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.spa || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'spa', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    {/* UMA */}
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        value={emp.uma || 0} 
                        onChange={(e) => handleAllowanceChange(emp.id, 'uma', e.target.value)}
                        className="allowance-input"
                        style={{ width: '80px' }}
                      />
                    </td>
                    
                    <td>₹{totalAllowance.toLocaleString('en-IN')}</td>
                    <td>₹{grossSalary.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center">
            No attendance data available. Please fill attendance first.
          </div>
        )}
      </div>
    </div>
  );
};

const DeductionTab = ({ attendanceData = [], onDeductionUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);
  
  const handleDeductionChange = (empId, field, value) => {
    if (onDeductionUpdate) {
      onDeductionUpdate(empId, field, parseInt(value) || 0);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('File read successfully, processing...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        console.log('Sheet name:', firstSheetName);
        
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Parsed data from file:', jsonData);
        if (jsonData.length === 0) {
          throw new Error('The file is empty or could not be read properly.');
        }

        // Process the uploaded data and update deductions
        processDeductionData(jsonData);
      } catch (error) {
        console.error('Error processing file:', error);
        setUploadStatus({ 
          type: 'error', 
          message: error.message || 'Error processing file. Please check the file format and try again.' 
        });
      } finally {
        setIsUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      setUploadStatus({ 
        type: 'error', 
        message: 'Error reading the file. Please try again.' 
      });
      setIsUploading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const processDeductionData = (uploadedData) => {
    try {
      console.log('Processing deduction data...');
      console.log('Sample row from file:', uploadedData[0]);
      
      if (uploadedData.length === 0) {
        throw new Error('No data found in the uploaded file.');
      }

      // Create a map of employee code to deduction data
      const deductionMap = new Map();
      let foundColumns = {
        empCode: null,
        club: null,
        cutieClubDed: null,
        dish: null,
        electricity: null,
        empCopSalary: null,
        // Removed: esic
        fuelDed: null,
        jpocSalon: null,
        medicalRecovery: null,
        milkDed: null,
        otherDed1: null,
        otherDed2: null,
        // Removed: pf
        schoolFee: null,
        tds: null,
        transportDed: null
        // Removed: wf
      };
      
      // First, try to detect column names (case-insensitive and space-insensitive)
      if (uploadedData.length > 0) {
        const firstRow = uploadedData[0];
        const availableColumns = Object.keys(firstRow).filter(k => k !== '__rowNum__');
        console.log('Available columns in file:', availableColumns);
        
        // Function to normalize column names for comparison
        const normalizeColName = (name) => {
          return name.toLowerCase().replace(/[^a-z0-9]/g, '');
        };
        
        // Create a map of normalized column names to original names
        const columnMap = {};
        availableColumns.forEach(col => {
          columnMap[normalizeColName(col)] = col;
        });
        
        console.log('Normalized column map:', columnMap);
        
        // Define possible column name variations for each field
        // Note: Removed PF, ESIC, and WF as requested
        const columnMappings = {
          empCode: ['empcode', 'employeecode', 'employeeid', 'empid', 'id', 'emp'],
          club: ['club'],
          cutieClubDed: ['cutieclubded', 'cutieclub', 'cuteded', 'cutie'],
          dish: ['dish'],
          electricity: ['electricity', 'elec'],
          empCopSalary: ['empcorpsalary', 'empcopsalary', 'empcop', 'corpsalary', 'empsalary'],
          // Removed: esic
          fuelDed: ['fuelded', 'fuel', 'fueldeduction'],
          jpocSalon: ['jpocsalon', 'jpoc', 'salon'],
          medicalRecovery: ['medicalrecovery', 'medical', 'medrecovery', 'medrec'],
          milkDed: ['milkded', 'milk', 'milkdeduction'],
          otherDed1: ['otherded1', 'other1', 'deduction1', 'otherdeduction1'],
          otherDed2: ['otherded2', 'other2', 'deduction2', 'otherdeduction2'],
          // Removed: pf
          schoolFee: ['schoolfee', 'school', 'fees', 'schoolfees'],
          tds: ['tds', 'taxdeductedatsource'],
          transportDed: ['transportded', 'transport', 'transportation', 'transportdeduction']
          // Removed: wf
        };
        
        // Find matching columns for each field
        Object.entries(columnMappings).forEach(([field, possibleNames]) => {
          for (const name of possibleNames) {
            if (columnMap[name]) {
              foundColumns[field] = columnMap[name];
              console.log(`Matched column '${columnMap[name]}' to ${field}`);
              break;
            }
          }
        });
        
        console.log('Detected columns (original case):', foundColumns);
      }
      
      // Check if we found all required columns
      const requiredColumns = ['empCode'];
      const missingColumns = requiredColumns.filter(col => !foundColumns[col]);
      
      if (missingColumns.length > 0) {
        throw new Error(`Could not detect required columns in the file. Please ensure your file has a column for employee code.`);
      }

      // Process each row in the uploaded data
      uploadedData.forEach((row, index) => {
        const empCode = String(row[foundColumns.empCode] || '').trim();
        
        if (!empCode) {
          console.warn(`Skipping row ${index + 1}: Missing employee code`);
          return;
        }
        
        const deductionData = {
          empCode,
          club: parseFloat(row[foundColumns.club] || 0) || 0,
          cutieClubDed: parseFloat(row[foundColumns.cutieClubDed] || 0) || 0,
          dish: parseFloat(row[foundColumns.dish] || 0) || 0,
          electricity: parseFloat(row[foundColumns.electricity] || 0) || 0,
          empCopSalary: parseFloat(row[foundColumns.empCopSalary] || 0) || 0,
          // Removed: esic
          fuelDed: parseFloat(row[foundColumns.fuelDed] || 0) || 0,
          jpocSalon: parseFloat(row[foundColumns.jpocSalon] || 0) || 0,
          medicalRecovery: parseFloat(row[foundColumns.medicalRecovery] || 0) || 0,
          milkDed: parseFloat(row[foundColumns.milkDed] || 0) || 0,
          otherDed1: parseFloat(row[foundColumns.otherDed1] || 0) || 0,
          otherDed2: parseFloat(row[foundColumns.otherDed2] || 0) || 0,
          // Removed: pf
          schoolFee: parseFloat(row[foundColumns.schoolFee] || 0) || 0,
          tds: parseFloat(row[foundColumns.tds] || 0) || 0,
          transportDed: parseFloat(row[foundColumns.transportDed] || 0) || 0
          // Removed: wf
        };
        
        deductionMap.set(empCode, deductionData);
        console.log(`Row ${index + 1}: Mapped ${empCode}`, deductionData);
      });

      console.log('Deduction map:', Array.from(deductionMap.entries()));
      console.log('Current employee codes in system:', attendanceData.map(e => e.empCode));

      // Update attendance data with the new deduction values
      let updatedCount = 0;
      
      attendanceData.forEach(emp => {
        const empCode = String(emp.empCode).trim();
        if (deductionMap.has(empCode)) {
          const deductions = deductionMap.get(empCode);
          let employeeUpdated = false;
          
          // Update each deduction field if it exists in the uploaded data
          Object.entries(deductions).forEach(([field, value]) => {
            if (field !== 'empCode' && value !== undefined && !isNaN(value)) {
              if (onDeductionUpdate) {
                onDeductionUpdate(emp.id, field, value);
                employeeUpdated = true;
              }
            }
          });
          
          if (employeeUpdated) {
            updatedCount++;
          }
          
          console.log(`Updated deductions for ${empCode}: ${emp.name}`, deductions);
        }
      });
      
      setUploadStatus({ 
        type: 'success', 
        message: `Successfully updated deductions for ${updatedCount} employees.` 
      });
      
    } catch (error) {
      console.error('Error processing deduction data:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Error processing deduction data. Please check the file format and try again.' 
      });
    }
  };

  // Calculate total deductions from all deduction fields
  const calculateTotalDeductions = (emp) => {
    const deductions = [
      'club', 'cutieClubDed', 'dish', 'electricity', 'empCopSalary',
      /* Removed: 'esic', */ 'fuelDed', 'jpocSalon', 'medicalRecovery', 'milkDed',
      'otherDed1', 'otherDed2', /* Removed: 'pf', */ 'schoolFee', 'tds', 'transportDed'
      /* Removed: 'wf' */
    ];
    
    return deductions.reduce((total, field) => {
      return total + (emp[field] || 0);
    }, 0);
  };

  // Calculate gross salary after all deductions
  const calculateGrossSalary = (emp) => {
    const totalSalary = (emp.basicSalary || 0) + calculateTotalAllowance(emp);
    const totalDeductions = calculateTotalDeductions(emp);
    return Math.max(0, totalSalary - totalDeductions);
  };

  // Calculate total allowance (reused from AllowanceTab)
  const calculateTotalAllowance = (emp) => {
    const allowances = ['cea', 'cha', 'hra', 'othallow', 'spa', 'uma'];
    return allowances.reduce((total, field) => total + (emp[field] || 0), 0);
  };

  return (
    <div className="tab-content">
      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h3>Deduction Management</h3>
        <div className="file-upload-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="btn btn-secondary" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fas fa-upload"></i> Upload Deduction Data
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </label>
          {isUploading && <span className="upload-status">Processing file...</span>}
          {uploadStatus.message && (
            <span className={`status-message ${uploadStatus.type}`}>
              {uploadStatus.message}
            </span>
          )}
        </div>
      </div>
      <div className="table-responsive" style={{ overflowX: 'auto' }}>
        {attendanceData.length > 0 ? (
          <table className="data-table">
            <colgroup>
              <col style={{ width: '100px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
              {['CLUB', 'CUTIE CLUB', 'DISH', 'ELECTRICITY', 'EMP COP. SALARY', 'ESIC', 'FUELDED', 'JPOCSALON', 
                'MEDICAL', 'MILKDED', 'OTHERDED1', 'OTHERDED2', 'PF', 'SCHOOLFEE', 'TDS', 'TRANSPORT', 'WF'].map((_, index) => (
                <col key={index} style={{ width: '80px' }} />
              ))}
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Basic (₹)</th>
                <th>Total Allowance (₹)</th>
                <th>CLUB</th>
                <th>CUTIE CLUB DED.</th>
                <th>DISH</th>
                <th>ELECTRICITY</th>
                <th>EMP COP. SALARY</th>
                <th>ESIC</th>
                <th>FUELDED</th>
                <th>JPOCSALON</th>
                <th>MEDICAL-RECOVERY</th>
                <th>MILKDED</th>
                <th>OTHERDED1</th>
                <th>OTHERDED2</th>
                <th>PF</th>
                <th>SCHOOLFEE</th>
                <th>TDS</th>
                <th>TRANSPORT-DED</th>
                <th>WF</th>
                <th>Total Ded. (₹)</th>
                <th>Net Salary (₹)</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((emp) => {
                const totalSalary = (emp.basicSalary || 0) + calculateTotalAllowance(emp);
                const totalDeductions = calculateTotalDeductions(emp);
                const grossSalary = calculateGrossSalary(emp);
                
                // Function to render deduction input
                const renderDeductionInput = (field) => (
                  <input 
                    type="number" 
                    min="0" 
                    max={totalSalary}
                    value={emp[field] || 0} 
                    onChange={(e) => handleDeductionChange(emp.id, field, e.target.value)}
                    className="deduction-input"
                    style={{ width: '70px' }}
                  />
                );
                
                return (
                  <tr key={emp.id}>
                    <td>{emp.empCode}</td>
                    <td>{emp.name}</td>
                    <td>{emp.department}</td>
                    <td>₹{emp.basicSalary?.toLocaleString('en-IN') || '0'}</td>
                    <td>₹{calculateTotalAllowance(emp).toLocaleString('en-IN')}</td>
                    
                    {/* Deduction Inputs */}
                    <td>{renderDeductionInput('club')}</td>
                    <td>{renderDeductionInput('cutieClubDed')}</td>
                    <td>{renderDeductionInput('dish')}</td>
                    <td>{renderDeductionInput('electricity')}</td>
                    <td>{renderDeductionInput('empCopSalary')}</td>
                    <td>{renderDeductionInput('esic')}</td>
                    <td>{renderDeductionInput('fuelDed')}</td>
                    <td>{renderDeductionInput('jpocSalon')}</td>
                    <td>{renderDeductionInput('medicalRecovery')}</td>
                    <td>{renderDeductionInput('milkDed')}</td>
                    <td>{renderDeductionInput('otherDed1')}</td>
                    <td>{renderDeductionInput('otherDed2')}</td>
                    <td>{renderDeductionInput('pf')}</td>
                    <td>{renderDeductionInput('schoolFee')}</td>
                    <td>{renderDeductionInput('tds')}</td>
                    <td>{renderDeductionInput('transportDed')}</td>
                    <td>{renderDeductionInput('wf')}</td>
                    
                    <td>₹{totalDeductions.toLocaleString('en-IN')}</td>
                    <td>₹{grossSalary.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center">
            No employee data available. Please fill attendance and allowance first.
          </div>
        )}
      </div>
    </div>
  );
};

const SalaryTab = ({ 
  attendanceData = [], 
  selectedMonth, 
  selectedYear,
  status,
  setStatus,
  isGenerating,
  setIsGenerating
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate total allowance for an employee
  const calculateTotalAllowance = (emp) => {
    if (!emp) return 0;
    
    // List of all possible allowance fields
    const allowanceFields = [
      'CEA', 'CHA', 'HRA', 'OTHALLOW', 'SPA', 'UMA',
      'cea', 'cha', 'hra', 'othallow', 'spa', 'uma'  // Include lowercase variants for backward compatibility
    ];
    
    // Sum up all allowance fields that exist in the employee object
    return allowanceFields.reduce((total, field) => {
      const value = parseFloat(emp[field]) || 0;
      return total + value;
    }, 0);
  };

  // Calculate total deduction for an employee
  const calculateTotalDeduction = (emp) => {
    const deductions = [
      'club', 'cutieClubDed', 'dish', 'electricity', 'empCopSalary',
      'fuelDed', 'jpocSalon', 'medicalRecovery', 'milkDed',
      'otherDed1', 'otherDed2', 'schoolFee', 'tds', 'transportDed'
    ];
    return deductions.reduce((total, field) => total + (emp[field] || 0), 0);
  };

  // Calculate net salary
  const calculateNetSalary = (emp) => {
    const basicSalary = parseFloat(emp.basicSalary) || 0;
    const totalAllowance = calculateTotalAllowance(emp);
    const totalDeduction = calculateTotalDeduction(emp);
    return (basicSalary + totalAllowance) - totalDeduction;
  };

  // Format date to MMyy (e.g., 1225 for December 2025)
  const formatMonthYear = (month, year) => {
    const monthIndex = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ].indexOf(month.toLowerCase());
    
    if (monthIndex === -1) return '';
    
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const yearStr = String(year).slice(-2);
    return `${monthStr}${yearStr}`;
  };

  // Generate and save salary data
  const handleGenerateSalary = async () => {
    if (!selectedMonth || !selectedYear) {
      setStatus({ type: 'error', message: 'Please select both month and year' });
      return;
    }

    setIsGenerating(true);
    setStatus({ type: 'info', message: 'Generating salary data...' });

    try {
      const salaryData = attendanceData.map(emp => {
        // Get all allowance and deduction values, using the correct case from the employee object
        const allowanceFields = ['CEA', 'CHA', 'HRA', 'OTHALLOW', 'SPA', 'UMA'];
        const deductionFields = [
          'CLUB', 'CUTIE_CLUB_DED', 'DISH', 'ELECTRICITY', 'EMP_COP_SALARY', 
          'ESIC', 'FUELDED', 'JPOCSALON', 'MEDICAL_RECOVERY', 'MILKDED', 
          'OTHERDED1', 'PF', 'SCHOOLFEE', 'TDS', 'TRANSPORT_DED', 'WF'
        ];

        // Create an object with all fields
        const salaryRecord = {
          empCode: emp.empCode,
          name: emp.name,
          bankAccount: emp.bankAccount || '',
          department: emp.department,
          category: emp.category,
          // Store daily rate instead of monthly rate
          rate: emp.rate && emp.month && emp.year 
            ? calculateDailyRate(parseFloat(emp.rate), emp.month, emp.year)
            : 0,
          attendance: emp.attendance || 0,
          basicSalary: parseFloat(emp.basicSalary) || 0,
          month: selectedMonth,
          year: selectedYear
        };

        // Add allowance fields with case-insensitive lookup
        allowanceFields.forEach(field => {
          // Try to find the field with any case in the employee object
          const fieldKey = Object.keys(emp).find(
            key => key.toUpperCase() === field
          ) || field;
          salaryRecord[field] = parseFloat(emp[fieldKey] || emp[field.toLowerCase()] || 0) || 0;
        });

        // Add deduction fields with case-insensitive lookup
        deductionFields.forEach(field => {
          // Try to find the field with any case in the employee object
          const fieldKey = Object.keys(emp).find(
            key => key.toUpperCase() === field
          ) || field;
          salaryRecord[field] = parseFloat(emp[fieldKey] || emp[field.toLowerCase()] || 0) || 0;
        });

        // Calculate totals
        salaryRecord.totalAllowance = calculateTotalAllowance(emp);
        salaryRecord.totalDeduction = calculateTotalDeduction(emp);
        salaryRecord.netSalary = calculateNetSalary(emp);

        return salaryRecord;
      });

      const period = formatMonthYear(selectedMonth, selectedYear);
      
      // Log the data being sent to the backend
      console.log('Sending salary data to backend:', {
        period,
        month: selectedMonth,
        year: selectedYear,
        data: salaryData.map(emp => ({
          empCode: emp.empCode,
          name: emp.name,
          bankAccount: emp.bankAccount,
          department: emp.department,
          category: emp.category,
          // Add other fields as needed
        }))
      });
      
      const response = await axios.post(`${API_BASE_URL}/salaries/generate`, {
        period,
        month: selectedMonth,
        year: selectedYear,
        data: salaryData
      });

      // Get unique categories from the data
      const categories = [...new Set(attendanceData.map(emp => emp.category))];
      const categoryText = categories.length === 1 
        ? categories[0] 
        : `${categories.length} categories`;
        
      setStatus({ 
        type: 'success', 
        message: `Successfully generated salary for ${categoryText} in ${selectedMonth} ${selectedYear}`,
        show: true
      });
      
      // Auto-hide the success message after 5 seconds
      setTimeout(() => {
        setStatus(prev => ({ ...prev, show: false }));
      }, 5000);
    } catch (error) {
      console.error('Error generating salary:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.message || 'Failed to generate salary. Please try again.',
        show: true 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter employees based on search term
  const filteredData = attendanceData.filter(emp => 
    String(emp.empCode).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (emp.category && emp.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="tab-content">
      <div className="tab-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3>Salary Summary</h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button 
            onClick={handleGenerateSalary} 
            disabled={isGenerating || attendanceData.length === 0}
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            {isGenerating ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Generating...
              </>
            ) : (
              <>
                <i className="fas fa-file-export"></i> Generate Salary
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="table-responsive" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Emp Code</th>
              <th>Name</th>
              <th>Bank Account</th>
              <th>Department</th>
              <th>Category</th>
              <th>Daily Rate (₹)</th>
              <th>Attendance (days)</th>
              <th>Basic Salary (₹)</th>
              <th>Total Allowance (₹)</th>
              <th>Total Deduction (₹)</th>
              <th>Net Salary (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((emp, index) => {
                const totalAllowance = calculateTotalAllowance(emp);
                const totalDeduction = calculateTotalDeduction(emp);
                const netSalary = calculateNetSalary(emp);
                
                return (
                  <tr key={index}>
                    <td>{emp.empCode || '-'}</td>
                    <td>{emp.name || '-'}</td>
                    <td>{emp.bankAccount || '-'}</td>
                    <td>{emp.department || 'N/A'}</td>
                    <td>{emp.category || 'N/A'}</td>
                    <td className="text-right">
                      {emp.rate && emp.month && emp.year 
                        ? calculateDailyRate(emp.rate, emp.month, emp.year).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0.00'}
                    </td>
                    <td className="text-center">{emp.attendance || '0'}</td>
                    <td className="text-right">{(emp.basicSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{totalAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      {netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="text-center">No matching records found</td>
              </tr>
            )}
          </tbody>
          {filteredData.length > 0 && (
            <tfoot>
              <tr>
                <th colSpan="6" className="text-right">Total:</th>
                <th className="text-right">
                  {filteredData.reduce((sum, emp) => sum + (parseFloat(emp.basicSalary) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </th>
                <th className="text-center">
                  {filteredData.reduce((sum, emp) => sum + (parseInt(emp.attendance) || 0), 0)}
                </th>
                <th className="text-right">
                  {filteredData.reduce((sum, emp) => sum + calculateTotalAllowance(emp), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </th>
                <th className="text-right">
                  {filteredData.reduce((sum, emp) => sum + calculateTotalDeduction(emp), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </th>
                <th className="text-right">
                  {filteredData.reduce((sum, emp) => sum + calculateNetSalary(emp), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </th>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// Get current date for default month selection
const getCurrentMonthYear = () => {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  return { month, year };
};

// Calculate days in month for a given year and month name
const getDaysInMonth = (month, year) => {
  const monthIndex = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ].indexOf(month.toLowerCase());
  
  if (monthIndex === -1) return 30; // Default to 30 days if month is invalid
  
  // Note: month is 0-indexed in JavaScript Date
  return new Date(year, monthIndex + 1, 0).getDate();
};

// Calculate salary based on attendance and rate
const calculateSalary = (attendance, rate, month, year) => {
  const daysInMonth = getDaysInMonth(month, year);
  const dailyRate = rate / daysInMonth; // Calculate daily rate based on days in month
  return attendance * dailyRate;
};

// Calculate daily rate from monthly rate based on actual days in month
const calculateDailyRate = (monthlyRate, month, year) => {
  const daysInMonth = getDaysInMonth(month, year);
  return monthlyRate / daysInMonth;
};

const Payroll = () => {
  const [activeTab, setActiveTab] = useState('attendance');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState({ type: '', message: '', show: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPayrollStarted, setIsPayrollStarted] = useState(false);

  // Fetch employees from the backend
  const fetchEmployees = async (month, year, category = 'all') => {
    try {
      setLoading(true);
      console.log('Fetching employees with category:', category);
      
      // Fetch all employees first
      const response = await axios.get(`${API_BASE_URL}/employees`);
      let employees = response.data || [];
      
      // Filter employees by category if specified
      if (category && category !== 'all') {
        employees = employees.filter(emp => emp.category === category);
      }
      
      if (employees.length === 0) {
        console.log('No employees found for the selected category');
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      // Try to fetch attendance data for the selected month and year
      try {
        const attendanceResponse = await axios.get(`${API_BASE_URL}/attendance`, {
          params: { month, year }
        });
        
        // Create a map of attendance data by employee code
        const attendanceMap = new Map(
          (attendanceResponse.data || []).map(item => [item.empCode, item])
        );
        
        // Merge employee data with attendance data
        const mergedData = employees.map(emp => {
          const attendance = attendanceMap.get(emp.empCode) || { attendance: 0 };
          return {
            id: emp.empCode,
            empCode: emp.empCode,
            name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
            bankAccount: emp.bankAccount || '',
            department: emp.department || 'N/A',
            category: emp.category || 'N/A',
            rate: emp.rates || 0,
            attendance: attendance.attendance || 0,
            basicSalary: calculateSalary(attendance.attendance || 0, emp.rates || 0, month, year),
            month,
            year
          };
        });
        
        setAttendanceData(mergedData);
      } catch (attendanceError) {
        console.warn('Could not fetch attendance data, using default:', attendanceError);
        // If attendance fetch fails, use default data
        const defaultAttendanceData = getDefaultAttendanceData(employees, month, year);
        setAttendanceData(defaultAttendanceData);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employee data. Please try again later.');
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEmployees(selectedMonth, selectedYear, selectedCategory);
  }, []);
  
  // Initialize with current month and year
  useEffect(() => {
    const { month, year } = getCurrentMonthYear();
    setSelectedMonth(month);
    setSelectedYear(year);
    // No need to fetch here as the other useEffect will handle it
  }, []);
  
  // Handle allowance update - mark payroll as started when any allowance is modified
  const handleAllowanceUpdate = (empId, field, value) => {
    if (!isPayrollStarted) {
      setIsPayrollStarted(true);
    }
    setAttendanceData(prevData => 
      prevData.map(emp => 
        emp.id === empId || emp.empCode === empId ? { 
          ...emp, 
          [field]: typeof value === 'number' ? value : parseFloat(value) || 0 
        } : emp
      )
    );
  };

  // Handle deduction update - mark payroll as started when any deduction is modified
  const handleDeductionUpdate = (empId, field, value) => {
    if (!isPayrollStarted) {
      setIsPayrollStarted(true);
    }
    setAttendanceData(prevData => 
      prevData.map(emp => 
        emp.id === empId ? { ...emp, [field]: value } : emp
      )
    );
  };

  // Initialize months and years for dropdowns
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Categories for filtering
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'Apprentice', label: 'Apprentice' },
    { value: 'SKS', label: 'SKS' },
    { value: 'H&F', label: 'H&F' },
  ];


  const handleMonthChange = (e) => {
    if (isPayrollStarted) {
      alert('Cannot change month after payroll process has started. Please complete or reset the current payroll.');
      return;
    }
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchEmployees(newMonth, selectedYear, selectedCategory);
  };
  
  const handleYearChange = (e) => {
    if (isPayrollStarted) {
      alert('Cannot change year after payroll process has started. Please complete or reset the current payroll.');
      return;
    }
    const newYear = parseInt(e.target.value);
    setSelectedYear(newYear);
    fetchEmployees(selectedMonth, newYear, selectedCategory);
  };

  const handleCategoryChange = (e) => {
    if (isPayrollStarted) {
      alert('Cannot change category after payroll process has started. Please complete or reset the current payroll.');
      return;
    }
    const category = e.target.value;
    setSelectedCategory(category);
    fetchEmployees(selectedMonth, selectedYear, category);
  };
  
  // Mark payroll as started when any data is modified
  const handleAttendanceUpdate = (newAttendanceData) => {
    if (!isPayrollStarted) {
      setIsPayrollStarted(true);
    }
    // Rest of the function remains the same
    const updatedData = newAttendanceData.map(emp => ({
      ...emp,
      basicSalary: calculateSalary(emp.attendance, emp.rate, selectedMonth, selectedYear),
      month: selectedMonth,
      year: selectedYear
    }));
    
    // Save to backend
    const saveAttendance = async () => {
      try {
        await axios.post(`${API_BASE_URL}/attendance/save`, {
          month: selectedMonth,
          year: selectedYear,
          data: updatedData.map(({ id, empCode, attendance }) => ({
            empCode,
            attendance,
            month: selectedMonth,
            year: selectedYear
          }))
        });
        console.log('Attendance data saved successfully');
      } catch (error) {
        console.error('Error saving attendance:', error);
      }
    };
    
    saveAttendance();
    setAttendanceData(updatedData);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <section className="section payroll-section" id="payroll">
      <div className="section-header">
        <div className="header-content">
          <h2 style={{ fontWeight: 'bold', color: 'var(--primary-color)'}}>Payroll Management</h2>
          <div className="month-year-selector">
            <div className="form-group">
              <label htmlFor="month">Month:</label>
              <select 
                id="month" 
                value={selectedMonth} 
                onChange={handleMonthChange}
                className="form-control"
                disabled={isPayrollStarted}
                title={isPayrollStarted ? 'Cannot change month after payroll has started' : ''}
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="year">Year:</label>
              <select 
                id="year" 
                value={selectedYear} 
                onChange={handleYearChange}
                className="form-control"
                disabled={isPayrollStarted}
                title={isPayrollStarted ? 'Cannot change year after payroll has started' : ''}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="category">Category:</label>
              <select 
                id="category" 
                value={selectedCategory} 
                onChange={handleCategoryChange}
                className="form-control"
                disabled={isPayrollStarted}
                title={isPayrollStarted ? 'Cannot change category after payroll has started' : ''}
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="current-period">
              <i className="fas fa-calendar-alt"></i>
              <span>Payroll for: <strong>{selectedMonth} {selectedYear}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <i className="fas fa-calendar-check"></i> Attendance
        </button>
        <button
          className={`tab-btn ${activeTab === 'allowance' ? 'active' : ''}`}
          onClick={() => handleTabChange('allowance')}
        >
          <i className="fas fa-hand-holding-usd"></i> Allowance
        </button>
        <button
          className={`tab-btn ${activeTab === 'deduction' ? 'active' : ''}`}
          onClick={() => handleTabChange('deduction')}
        >
          <i className="fas fa-file-invoice-dollar"></i> Deduction
        </button>
        <button
          className={`tab-btn ${activeTab === 'salary' ? 'active' : ''}`}
          onClick={() => setActiveTab('salary')}
        >
          <i className="fas fa-calculator"></i> Salary
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading employee data...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'attendance' && (
              <AttendanceTab 
                attendanceData={attendanceData} 
                onAttendanceUpdate={handleAttendanceUpdate} 
              />
            )}
            {activeTab === 'allowance' && (
              <AllowanceTab 
                attendanceData={attendanceData} 
                onAllowanceUpdate={handleAllowanceUpdate} 
              />
            )}
            {activeTab === 'deduction' && (
              <DeductionTab 
                attendanceData={attendanceData} 
                onDeductionUpdate={handleDeductionUpdate} 
              />
            )}
            {activeTab === 'salary' && (
              <>
                {status.show && (
                  <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`} 
                       style={{ 
                         marginBottom: '20px',
                         padding: '10px 15px',
                         borderRadius: '4px',
                         backgroundColor: status.type === 'success' ? '#d4edda' : '#f8d7da',
                         color: status.type === 'success' ? '#155724' : '#721c24',
                         border: `1px solid ${status.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                         display: 'flex',
                         justifyContent: 'space-between',
                         alignItems: 'center'
                       }}>
                    <span>{status.message}</span>
                    <button 
                      onClick={() => setStatus(prev => ({ ...prev, show: false }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: 'inherit',
                        padding: '0 5px'
                      }}
                    >
                      &times;
                    </button>
                  </div>
                )}
                <SalaryTab 
                  attendanceData={attendanceData} 
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  status={status}
                  setStatus={setStatus}
                  isGenerating={isGenerating}
                  setIsGenerating={setIsGenerating}
                />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Payroll;
