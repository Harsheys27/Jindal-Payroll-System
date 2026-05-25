const express = require('express');
const connection = require('../db');

const router = express.Router();

// GET /api/employees - Fetch all employees
router.get('/', (req, res) => {
  const query = `
    SELECT
      \`Emp Code\` AS empCode,
      SUBSTRING_INDEX(\`Name\`, ' ', 1) AS firstName,
      CASE WHEN LOCATE(' ', \`Name\`) > 0 THEN SUBSTRING_INDEX(\`Name\`, ' ', -1) ELSE '' END AS lastName,
      \`Department\` AS department,
      \`Bank Acc. No.\` AS bankAccount,
      \`IFSC\` AS ifsc,
      \`PAN\` AS pan,
      \`Aadhar\` AS aadhar,
      \`Bank Name\` AS branch,
      \`Phone\` AS phone,
      \`Email\` AS email,
      \`Designation\` AS designation,
      \`Category\` AS category,
      \`Joining Date\` AS joiningDate,
      \`Status\` AS status,
      \`Rates\` AS rates
    FROM employee_details
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }
    res.json(results);
  });
});

// POST /api/employees - Add a new employee
router.post('/', (req, res) => {
  const {
    empCode,
    name,
    department,
    bankAccount,
    ifsc,
    pan,
    aadhar,
    branch,
    phone,
    email,
    designation,
    category,
    rates,
    joiningDate,
    status
  } = req.body;

  const query = `
    INSERT INTO employee_details (
      \`Emp Code\`, \`Name\`, \`Department\`, \`Bank Acc. No.\`, \`IFSC\`, \`PAN\`, \`Aadhar\`,
      \`Bank Name\`, \`Phone\`, \`Email\`, \`Designation\`, \`Category\`, \`Joining Date\`, \`Status\`, \`Rates\`
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    empCode, name, department, bankAccount, ifsc, pan, aadhar,
    branch, phone, email, designation, category, joiningDate, status, rates
  ];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error adding employee:', err);
      return res.status(500).json({ error: 'Failed to add employee' });
    }
    res.status(201).json({ message: 'Employee added successfully', id: result.insertId });
  });
});

// DELETE /api/employees/:empCode - Delete an employee by Emp Code
router.delete('/:empCode', (req, res) => {
  const { empCode } = req.params;

  const query = 'DELETE FROM employee_details WHERE `Emp Code` = ?';
  connection.query(query, [empCode], (err, result) => {
    if (err) {
      console.error('Error deleting employee:', err);
      return res.status(500).json({ error: 'Failed to delete employee' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  });
});

// PUT /api/employees/:empCode - Update an employee by Emp Code
router.put('/:empCode', (req, res) => {
  const { empCode } = req.params;
  const {
    firstName,
    lastName,
    department,
    bankAccount,
    ifsc,
    pan,
    aadhar,
    branch,
    phone,
    email,
    designation,
    category,
    rates,
    joiningDate,
    status
  } = req.body;

  const name = `${firstName} ${lastName}`.trim();

  const query = `
    UPDATE employee_details SET
      \`Name\` = ?,
      \`Department\` = ?,
      \`Bank Acc. No.\` = ?,
      \`IFSC\` = ?,
      \`PAN\` = ?,
      \`Aadhar\` = ?,
      \`Bank Name\` = ?,
      \`Phone\` = ?,
      \`Email\` = ?,
      \`Designation\` = ?,
      \`Category\` = ?,
      \`Joining Date\` = ?,
      \`Status\` = ?,
      \`Rates\` = ?
    WHERE \`Emp Code\` = ?
  `;

  const values = [
    name, department, bankAccount, ifsc, pan, aadhar,
    branch, phone, email, designation, category, joiningDate, status, rates, empCode
  ];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error updating employee:', err);
      return res.status(500).json({ error: 'Failed to update employee' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee updated successfully' });
  });
});

module.exports = router;
