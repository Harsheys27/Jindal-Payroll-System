import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const Employees = () => {
  const [employeeType, setEmployeeType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newEmployee, setNewEmployee] = useState({
    empCode: '',
    name: '',
    department: '',
    bankAccount: '',
    ifsc: '',
    pan: '',
    aadhar: '',
    branch: '',
    phone: '',
    email: '',
    designation: '',
    category: 'Permanent',
    joiningDate: '',
    status: 'Active',
    rates: ''
  });

  // Fetch employees from the backend
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/employees');
        setEmployees(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to fetch employees. Please try again later.');
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Filter employees based on type and search term
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesType = employeeType === 'ALL' || emp.category === employeeType;
      const matchesSearch = 
        (emp.name && emp.name.toLowerCase().includes(searchTermLower)) ||
        (emp.empCode && emp.empCode.toString().toLowerCase().includes(searchTermLower)) ||
        (emp.department && emp.department.toLowerCase().includes(searchTermLower)) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchTermLower));
      
      return matchesType && (searchTerm === '' || matchesSearch);
    });
  }, [employeeType, searchTerm, employees]);

  const handleEmployeeTypeChange = (e) => {
    setEmployeeType(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/employees', newEmployee);
      setShowAddModal(false);
      setNewEmployee({
        empCode: '',
        name: '',
        department: '',
        bankAccount: '',
        ifsc: '',
        pan: '',
        aadhar: '',
        branch: '',
        phone: '',
        email: '',
        designation: '',
        category: 'Permanent',
        joiningDate: '',
        status: 'Active',
        rates: ''
      });
      // Refresh employees list
      const response = await axios.get('http://localhost:5000/api/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error('Error adding employee:', err);
      alert('Failed to add employee. Please try again.');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await axios.delete(`http://localhost:5000/api/employees/${id}`);
        // Refresh employees list
        const response = await axios.get('http://localhost:5000/api/employees');
        setEmployees(response.data);
        alert('Employee deleted successfully');
      } catch (err) {
        console.error('Error deleting employee:', err);
        alert('Failed to delete employee. Please try again.');
      }
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/employees/${selectedEmployee.empCode}`, selectedEmployee);
      setShowEditModal(false);
      // Refresh employees list
      const response = await axios.get('http://localhost:5000/api/employees');
      setEmployees(response.data);
      alert('Employee updated successfully');
    } catch (err) {
      console.error('Error updating employee:', err);
      alert('Failed to update employee. Please try again.');
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setSelectedEmployee(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNewEmployeeChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <section className="section" id="employees">
      <div className="section-header">
        <h2>Employee Management</h2>
        <div className="employee-actions">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> Add Employee
          </button>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
            <i className="fas fa-search search-icon"></i>
          </div>
          <div className="employee-filter">
            <label htmlFor="employee-type" className="filter-label">Filter by Type:</label>
            <select
              id="employee-type"
              value={employeeType}
              onChange={handleEmployeeTypeChange}
              className="filter-select"
            >
              <option value="ALL">ALL</option>
              <option value="Apprentice">Apprentice</option>
              <option value="SKS">SKS</option>
              <option value="H&F">H&F</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="employee-table-container">
        <div className="table-responsive">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Bank Acc. No.</th>
                <th>IFSC</th>
                <th>PAN</th>
                <th>Aadhar</th>
                <th>Branch</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Category</th>
                <th>Rates</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <tr key={emp.empCode} className={emp.status?.toLowerCase()}>
                    <td>{emp.empCode}</td>
                    <td>{`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}</td>
                    <td>{emp.department}</td>
                    <td>{emp.bankAccount}</td>
                    <td>{emp.ifsc}</td>
                    <td>{emp.pan}</td>
                    <td>{emp.aadhar}</td>
                    <td>{emp.branch}</td>
                    <td>{emp.phone}</td>
                    <td className="email-cell">{emp.email}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.category}</td>
                    <td>{emp.rates}</td>
                    <td>{new Date(emp.joiningDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${emp.status?.toLowerCase()}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => handleEditEmployee(emp)}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        title="Delete"
                        onClick={() => handleDeleteEmployee(emp.empCode)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="no-data">
                    No employees found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="table-footer">
          <div className="table-info">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        </div>
      </div>
      
      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Employee</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="modal-form">
              <div className="form-grid">
                {/* Column 1 - Basic Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Employee Code*</label>
                    <input
                      type="text"
                      name="empCode"
                      value={newEmployee.empCode}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Full Name*</label>
                    <input
                      type="text"
                      name="name"
                      value={newEmployee.name}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Department*</label>
                    <input
                      type="text"
                      name="department"
                      value={newEmployee.department}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation*</label>
                    <input
                      type="text"
                      name="designation"
                      value={newEmployee.designation}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                </div>

                {/* Column 2 - Contact Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Email*</label>
                    <input
                      type="email"
                      name="email"
                      value={newEmployee.email}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone*</label>
                    <input
                      type="tel"
                      name="phone"
                      value={newEmployee.phone}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category*</label>
                    <select
                      name="category"
                      value={newEmployee.category}
                      onChange={handleNewEmployeeChange}
                      required
                    >
                      <option value="H&F">H&F</option>
                      <option value="Apprentice">Apprentice</option>
                      <option value="SKS">SKS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status*</label>
                    <select
                      name="status"
                      value={newEmployee.status}
                      onChange={handleNewEmployeeChange}
                      required
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Column 3 - Bank Details */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Bank Account Number*</label>
                    <input
                      type="text"
                      name="bankAccount"
                      value={newEmployee.bankAccount}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code*</label>
                    <input
                      type="text"
                      name="ifsc"
                      value={newEmployee.ifsc}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Bank Branch</label>
                    <input
                      type="text"
                      name="branch"
                      value={newEmployee.branch}
                      onChange={handleNewEmployeeChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Rates</label>
                    <input
                      type="number"
                      name="rates"
                      value={newEmployee.rates}
                      onChange={handleNewEmployeeChange}
                      placeholder="Enter rate"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Column 4 - Additional Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      name="pan"
                      value={newEmployee.pan}
                      onChange={handleNewEmployeeChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Aadhar Number</label>
                    <input
                      type="text"
                      name="aadhar"
                      value={newEmployee.aadhar}
                      onChange={handleNewEmployeeChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Joining Date*</label>
                    <input
                      type="date"
                      name="joiningDate"
                      value={newEmployee.joiningDate}
                      onChange={handleNewEmployeeChange}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Employee</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="modal-form">
              <div className="form-grid">
                {/* Column 1 - Basic Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Employee Code*</label>
                    <input
                      type="text"
                      name="empCode"
                      value={selectedEmployee.empCode || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Full Name*</label>
                    <input
                      type="text"
                      name="name"
                      value={selectedEmployee.firstName ? `${selectedEmployee.firstName} ${selectedEmployee.lastName || ''}`.trim() : ''}
                      onChange={(e) => {
                        const names = e.target.value.split(' ');
                        handleEditChange({
                          target: {
                            name: 'firstName',
                            value: names[0] || ''
                          }
                        });
                        handleEditChange({
                          target: {
                            name: 'lastName',
                            value: names.slice(1).join(' ') || ''
                          }
                        });
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Department*</label>
                    <input
                      type="text"
                      name="department"
                      value={selectedEmployee.department || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation*</label>
                    <input
                      type="text"
                      name="designation"
                      value={selectedEmployee.designation || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                </div>

                {/* Column 2 - Contact Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Email*</label>
                    <input
                      type="email"
                      name="email"
                      value={selectedEmployee.email || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone*</label>
                    <input
                      type="tel"
                      name="phone"
                      value={selectedEmployee.phone || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category*</label>
                    <select
                      name="category"
                      value={selectedEmployee.category}
                      onChange={handleEditChange}
                      required
                    >
                    
                      <option value="H&F">H&F</option>
                      <option value="Apprentice">Apprentice</option>
                      <option value="SKS">SKS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status*</label>
                    <select
                      name="status"
                      value={selectedEmployee.status || 'Active'}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Column 3 - Bank Details */}
                <div className="form-column">
                  <div className="form-group">
                    <label>Bank Account Number*</label>
                    <input
                      type="text"
                      name="bankAccount"
                      value={selectedEmployee.bankAccount || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code*</label>
                    <input
                      type="text"
                      name="ifsc"
                      value={selectedEmployee.ifsc || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Bank Branch</label>
                    <input
                      type="text"
                      name="branch"
                      value={selectedEmployee.branch || ''}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Rates</label>
                    <input
                      type="number"
                      name="rates"
                      value={selectedEmployee.rates || ''}
                      onChange={handleEditChange}
                      placeholder="Enter rate"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Column 4 - Additional Info */}
                <div className="form-column">
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      name="pan"
                      value={selectedEmployee.pan || ''}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Aadhar Number</label>
                    <input
                      type="text"
                      name="aadhar"
                      value={selectedEmployee.aadhar || ''}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Joining Date*</label>
                    <input
                      type="date"
                      name="joiningDate"
                      value={selectedEmployee.joiningDate || ''}
                      onChange={handleEditChange}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Employees;