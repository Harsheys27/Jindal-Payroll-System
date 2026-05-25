import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import powerLogo from '../../assets/power.png';

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [totalPayout, setTotalPayout] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Refs for logo handling
  const logoImgRef = useRef(null);       // stores HTMLImageElement if loaded
  const logoDataUrlRef = useRef(null);   // stores base64 data URL for jsPDF
  const [logoReady, setLogoReady] = useState(false);

  // ---------- Preload & convert logo to data URL ----------
  // Using imported image from src/assets
  useEffect(() => {
    const img = new Image();
    img.src = powerLogo;

    img.onload = () => {
      logoImgRef.current = img;
      try {
        // Convert to dataURL via canvas so jsPDF always accepts it
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        // Fill white background to preserve logo visibility (prevents transparency issues)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png'); // base64 PNG
        logoDataUrlRef.current = dataUrl;
        setLogoReady(true);
      } catch (e) {
        // If conversion fails (tainted canvas due to CORS), fallback to using HTMLImageElement
        console.warn('Logo conversion to data URL failed (CORS?). Falling back to HTMLImageElement.', e);
        logoDataUrlRef.current = null;
        setLogoReady(true); // still allow generating PDFs; we'll try addImage with the element
      }
    };

    img.onerror = (err) => {
      console.error('Failed to load logo image:', powerLogo, err);
      // mark as not ready - user will see alert if they try to download payslip
      setLogoReady(false);
    };

    // cleanup
    return () => {
      logoImgRef.current = null;
      logoDataUrlRef.current = null;
    };
  }, []);

  // ---------- Static data ----------
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'Apprentice', label: 'Apprentice' },
    { value: 'SKS', label: 'SKS' },
    { value: 'H&F', label: 'H&F' }
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear; year >= currentYear - 5; year--) {
    yearOptions.push({ value: year.toString(), label: year.toString() });
  }

  const monthOptions = months.map((month, index) => ({
    value: month,
    label: month,
    monthNumber: index + 1
  }));

  const API_BASE_URL = 'http://localhost:5000';

  // ---------- Fetch salaries ----------
  useEffect(() => {
    const fetchSalaries = async () => {
      if (!selectedMonth || !selectedYear) return;

      try {
        setLoading(true);
        setError('');

        const monthIndex = months.findIndex(m => m === selectedMonth) + 1;
        const period = `${monthIndex.toString().padStart(2, '0')}${selectedYear.toString().slice(-2)}`;

        const response = await axios.get(`${API_BASE_URL}/api/salaries/period/${period}`, {
          params: { category: selectedCategory === 'all' ? '' : selectedCategory }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
          setReportData(response.data);
          setEmployees(response.data.data);
        } else {
          const categoryDisplay = selectedCategory === 'all' ? 'selected categories' : `${selectedCategory} category`;
          setError(`The salary for ${categoryDisplay} of ${selectedMonth} ${selectedYear} has not been generated or does not exist.`);
          setReportData(null);
          setEmployees([]);
        }
      } catch (err) {
        console.error('Error fetching salaries:', err);
        if (err.response && err.response.status === 404) {
          const categoryDisplay = selectedCategory === 'all' ? 'selected categories' : `${selectedCategory} category`;
          setError(`The salary for ${categoryDisplay} of ${selectedMonth} ${selectedYear} has not been generated or does not exist.`);
        } else {
          setError('Failed to load salary data. Please try again later.');
        }
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSalaries();
  }, [selectedMonth, selectedYear, selectedCategory]);

  // ---------- Handlers ----------
  const handleMonthChange = (e) => setSelectedMonth(e.target.value);
  const handleYearChange = (e) => setSelectedYear(e.target.value);
  const handleCategoryChange = (e) => setSelectedCategory(e.target.value);

  const formatCurrency = (amount, includeSymbol = true) => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: includeSymbol ? 'currency' : 'decimal',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num || 0).replace(/,/g, ''); // remove commas for CSV compatibility
  };

  const handleViewPayslip = (employee) => {
    setSelectedEmployee(employee);
    setShowModal(true);
  };

  const handleDownloadPayslip = (employee) => {
    // If you want to require logo for PDFs, keep this; otherwise you can proceed without logo.
    if (!logoReady) {
      alert('Logo is still loading. Please try again in a moment.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Add logo (try dataUrl first, else fallback to HTMLImageElement)
    const logoWidth = 30;
    let logoHeight = 0;
    try {
      const logoSource = logoDataUrlRef.current || logoImgRef.current;
      if (logoSource) {
        // calculate aspect ratio from loaded image when possible
        let aspectRatio = 1;
        if (logoImgRef.current && logoImgRef.current.naturalWidth && logoImgRef.current.naturalHeight) {
          aspectRatio = logoImgRef.current.naturalHeight / logoImgRef.current.naturalWidth;
        } else if (logoImgRef.current && logoImgRef.current.width && logoImgRef.current.height) {
          aspectRatio = logoImgRef.current.height / logoImgRef.current.width;
        }
        logoHeight = logoWidth * aspectRatio;
        // doc.addImage accepts either dataURL string or HTMLImageElement
        doc.addImage(logoSource, 'PNG', margin, yPos, logoWidth, logoHeight);
      }
    } catch (err) {
      console.warn('Failed to add logo to PDF — continuing without it.', err);
      logoHeight = 0;
    }

    // Header text
    const categoryHeading = `Payslip for ${selectedMonth} ${selectedYear}`;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const headingWidth = doc.getTextWidth(categoryHeading);
    doc.text(categoryHeading, (pageWidth - headingWidth) / 2, yPos + (logoHeight ? 12 : 8));

    // Category badge top-right
    if (employee.category) {
      const categoryText = employee.category.toUpperCase();
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const categoryWidth = doc.getTextWidth(categoryText);
      doc.text(categoryText, pageWidth - margin - categoryWidth, yPos + (logoHeight ? 12 : 8));
    }

    // Horizontal line separator
    yPos += (logoHeight || 0) + 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    // Employee information
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Information', margin, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const col1X = margin;
    const col2X = pageWidth / 2;
    const lineHeight = 6;

    doc.text(`Name: ${employee.name || 'N/A'}`, col1X, yPos);
    doc.text(`Employee Code: ${employee.emp_code || 'N/A'}`, col2X, yPos);
    yPos += lineHeight;

    doc.text(`Department: ${employee.department || 'N/A'}`, col1X, yPos);
    doc.text(`Category: ${employee.category || 'N/A'}`, col2X, yPos);
    yPos += lineHeight;

    doc.text(`Bank Account: ${employee.bank_account || 'N/A'}`, col1X, yPos);
    yPos += lineHeight;

    doc.text(`Pay Mode: Bank Transfer`, col1X, yPos);
    doc.text(`Paid Days: ${employee.attendance || 'N/A'}`, col2X, yPos);
    yPos += 12;

    // Prepare earnings and deductions arrays (filter zero)
    const earningsData = [
      ['Basic Salary', formatCurrency(employee.basic_salary, false)],
      ['Children Education Allowance (CEA)', formatCurrency(employee.CEA, false)],
      ['City House Allowance (CHA)', formatCurrency(employee.CHA, false)],
      ['House Rent Allowance (HRA)', formatCurrency(employee.HRA, false)],
      ['Other Allowance', formatCurrency(employee.OTHALLOW, false)],
      ['Special Allowance (SPA)', formatCurrency(employee.SPA, false)],
      ['Uniform Allowance (UMA)', formatCurrency(employee.UMA, false)]
    ].filter(item => parseFloat(item[1]) !== 0);

    const deductionsData = [
      ['Club', formatCurrency(employee.CLUB, false)],
      ['Cutie Club Deduction', formatCurrency(employee.CUTIE_CLUB_DED, false)],
      ['Dish', formatCurrency(employee.DISH, false)],
      ['Electricity', formatCurrency(employee.ELECTRICITY, false)],
      ['Employee Cooperative Salary', formatCurrency(employee.EMP_COP_SALARY, false)],
      ['ESIC', formatCurrency(employee.ESIC, false)],
      ['Fuel Deduction', formatCurrency(employee.FUELDED, false)],
      ['JPOC Salon', formatCurrency(employee.JPOCSALON, false)],
      ['Medical Recovery', formatCurrency(employee.MEDICAL_RECOVERY, false)],
      ['Milk Deduction', formatCurrency(employee.MILKDED, false)],
      ['Other Deduction', formatCurrency(employee.OTHERDED1, false)],
      ['Provident Fund (PF)', formatCurrency(employee.PF, false)],
      ['School Fee', formatCurrency(employee.SCHOOLFEE, false)],
      ['TDS', formatCurrency(employee.TDS, false)],
      ['Transport Deduction', formatCurrency(employee.TRANSPORT_DED, false)],
      ['Welfare Fund (WF)', formatCurrency(employee.WF, false)]
    ].filter(item => parseFloat(item[1]) !== 0);

    // Earnings table (left)
    autoTable(doc, {
      startY: yPos,
      head: [['Earnings', 'Amount (Rs.)']],
      body: earningsData,
      foot: [['Total Earnings', formatCurrency(employee.total_allowance, false)]],
      margin: { left: margin, right: pageWidth / 2 + 5 },
      theme: 'grid',
      headStyles: { fontStyle: 'bold', fontSize: 10 },
      footStyles: { fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 35, halign: 'right' } }
    });

    // Deductions table (right)
    autoTable(doc, {
      startY: yPos,
      head: [['Deductions', 'Amount (Rs.)']],
      body: deductionsData,
      foot: [['Total Deductions', formatCurrency(employee.total_deduction, false)]],
      margin: { left: pageWidth / 2 + 5, right: margin },
      theme: 'grid',
      headStyles: { fontStyle: 'bold', fontSize: 10 },
      footStyles: { fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 35, halign: 'right' } }
    });

    // Net pay box
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : yPos + 60;
    // doc.setFillColor(46, 204, 113);
    doc.rect(margin, finalY, pageWidth - 2 * margin, 15, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    // doc.setTextColor(255, 255, 255);
    doc.text('Net Payable:', margin + 5, finalY + 10);

    const netPayText = `Rs. ${formatCurrency(employee.net_salary, false)}`;
    const netPayWidth = doc.getTextWidth(netPayText);
    doc.text(netPayText, pageWidth - margin - netPayWidth - 5, finalY + 10);

    doc.setTextColor(0, 0, 0);

    // Footer with leave balance and note
    const footerY = finalY + 25;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const leaveBalance = `Leave Balance:  CL=${employee.cl_balance || 0}  SL=${employee.sl_balance || 0}  EL=${employee.el_balance || 0}`;
    doc.text(leaveBalance, margin, footerY);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY + 5, pageWidth - margin, footerY + 5);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('This is a computer-generated payslip and does not require a signature.', margin, pageHeight - 15);

    // Filename and download
    const sanitizedName = (employee.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedCategory = (employee.category || 'Category').replace(/[^a-zA-Z0-9]/g, '_');
    const monthIndex = months.findIndex(m => m === selectedMonth) + 1;
    const period = `${selectedYear}-${monthIndex.toString().padStart(2, '0')}`;
    const filename = `Payslip_${sanitizedName}_${sanitizedCategory}_${period}.pdf`;

    doc.save(filename);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
  };

  const handleDeleteData = async () => {
    if (!selectedMonth || !selectedYear) return;

    try {
      setDeleteLoading(true);
      const monthIndex = months.findIndex(m => m === selectedMonth) + 1;
      const period = `${monthIndex.toString().padStart(2, '0')}${selectedYear.toString().slice(-2)}`;

      const deleteUrl = selectedCategory === 'all'
        ? `${API_BASE_URL}/api/salaries/period/${period}`
        : `${API_BASE_URL}/api/salaries/period/${period}?category=${selectedCategory}`;

      const response = await axios.delete(deleteUrl);

      if (response.data && response.data.success) {
        setEmployees([]);
        setReportData(null);
        setShowDeleteModal(false);
        const categoryDisplay = selectedCategory === 'all' ? 'all categories' : `${selectedCategory} category`;
        alert(`Successfully deleted salary data for ${categoryDisplay} of ${selectedMonth} ${selectedYear}`);
      } else {
        alert('Delete request did not return success.');
      }
    } catch (err) {
      console.error('Error deleting salary data:', err);
      if (err.response && err.response.status === 404) {
        alert('No salary data found to delete for the selected period and category.');
      } else {
        alert('Failed to delete salary data. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExportReport = () => {
    if (!selectedMonth || employees.length === 0) return;

    const headers = [
      'Employee Code', 'Name', 'Department', 'Category', 'Rate', 'Attendance',
      'Basic Salary', 'CEA', 'CHA', 'HRA', 'OTHALLOW', 'SPA', 'UMA',
      'Total Allowance', 'CLUB', 'CUTIE CLUB DED', 'DISH', 'ELECTRICITY', 'EMP COP SALARY',
      'ESIC', 'FUEL DED', 'JPOC SALON', 'MEDICAL RECOVERY', 'MILK DED', 'OTHER DED 1',
      'PF', 'SCHOOL FEE', 'TDS', 'TRANSPORT DED', 'WF', 'Total Deduction', 'Net Salary',
      'Month', 'Year', 'Period', 'Created At', 'Updated At'
    ];

    const rows = employees.map(emp => [
      `"${emp.emp_code || ''}"`,
      `"${emp.name || ''}"`,
      `"${emp.department || ''}"`,
      `"${emp.category || ''}"`,
      `"${emp.rate || 0}"`,
      `"${emp.attendance || 0}"`,
      `"${formatCurrency(emp.basic_salary || 0, false)}"`,
      `"${formatCurrency(emp.CEA || 0, false)}"`,
      `"${formatCurrency(emp.CHA || 0, false)}"`,
      `"${formatCurrency(emp.HRA || 0, false)}"`,
      `"${formatCurrency(emp.OTHALLOW || 0, false)}"`,
      `"${formatCurrency(emp.SPA || 0, false)}"`,
      `"${formatCurrency(emp.UMA || 0, false)}"`,
      `"${formatCurrency(emp.total_allowance || 0, false)}"`,
      `"${formatCurrency(emp.CLUB || 0, false)}"`,
      `"${formatCurrency(emp.CUTIE_CLUB_DED || 0, false)}"`,
      `"${formatCurrency(emp.DISH || 0, false)}"`,
      `"${formatCurrency(emp.ELECTRICITY || 0, false)}"`,
      `"${formatCurrency(emp.EMP_COP_SALARY || 0, false)}"`,
      `"${formatCurrency(emp.ESIC || 0, false)}"`,
      `"${formatCurrency(emp.FUELDED || 0, false)}"`,
      `"${formatCurrency(emp.JPOCSALON || 0, false)}"`,
      `"${formatCurrency(emp.MEDICAL_RECOVERY || 0, false)}"`,
      `"${formatCurrency(emp.MILKDED || 0, false)}"`,
      `"${formatCurrency(emp.OTHERDED1 || 0, false)}"`,
      `"${formatCurrency(emp.PF || 0, false)}"`,
      `"${formatCurrency(emp.SCHOOLFEE || 0, false)}"`,
      `"${formatCurrency(emp.TDS || 0, false)}"`,
      `"${formatCurrency(emp.TRANSPORT_DED || 0, false)}"`,
      `"${formatCurrency(emp.WF || 0, false)}"`,
      `"${formatCurrency(emp.total_deduction || 0, false)}"`,
      `"${formatCurrency(emp.net_salary || 0, false)}"`,
      `"${emp.month || ''}"`,
      `"${emp.year || ''}"`,
      `"${emp.period || ''}"`,
      `"${emp.created_at || ''}"`,
      `"${emp.updated_at || ''}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const monthIndex = months.findIndex(m => m === selectedMonth) + 1;
    const period = `${selectedYear}-${monthIndex.toString().padStart(2, '0')}`;
    const categorySuffix = selectedCategory !== 'all' ? `_${selectedCategory.toLowerCase()}` : '';
    link.download = `salary_report_${period}${categorySuffix}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="section" id="reports">
      <div className="section-header">
        <h2>Payroll Reports</h2>
        <div className="report-actions" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '150px', marginRight: '10px' }}>
            <div className="form-group">
              <label htmlFor="month-select">Month:</label>
              <select
                id="month-select"
                className="form-control"
                value={selectedMonth}
                onChange={handleMonthChange}
                style={{ width: '100%' }}
                disabled={loading}
              >
                <option value="">-- Select Month --</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flex: '1', minWidth: '120px', marginRight: '10px' }}>
            <div className="form-group">
              <label htmlFor="year-select">Year:</label>
              <select
                id="year-select"
                className="form-control"
                value={selectedYear}
                onChange={handleYearChange}
                style={{ width: '100%' }}
                disabled={loading}
              >
                {yearOptions.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flex: '1', minWidth: '250px' }}>
            <div className="form-group">
              <label htmlFor="category-select">Select Category:</label>
              <select
                id="category-select"
                className="form-control"
                value={selectedCategory}
                onChange={handleCategoryChange}
                disabled={!selectedMonth || !selectedYear || loading}
                style={{ width: '100%' }}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flexBasis: '100%', marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {selectedMonth && selectedYear && employees.length > 0 && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleExportReport}
                  disabled={loading}
                >
                  {loading ? (
                    <span><i className="fas fa-spinner fa-spin"></i> Loading...</span>
                  ) : (
                    <span><i className="fas fa-download"></i> Export Report</span>
                  )}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  style={{
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545',
                    color: 'white'
                  }}
                >
                  <span><i className="fas fa-trash"></i> Delete Data</span>
                </button>
              </>
            )}
            {error && (
              <div className="alert alert-danger" style={{ marginTop: '10px' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedMonth && (
        <div className="report-container">
          <div className="report-header">
            <h3>
              Payroll Report - {selectedMonth} {selectedYear}
              {selectedCategory !== 'all' && ` (${selectedCategory})`}
            </h3>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading salary data...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger">
                {error}
              </div>
            ) : employees.length === 0 ? (
              <div className="alert alert-info">
                No salary data found for the selected period and category.
              </div>
            ) : (
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Employees: {employees.length}</span>
                </div>
                {reportData && (
                  <div className="summary-item">
                    {/* extra summary info if needed */}
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && employees.length > 0 && (
            <div className="table-responsive">
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Emp Code</th>
                    <th>Name</th>
                    <th>Bank Account</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Basic Salary</th>
                    <th>Allowances</th>
                    <th>Deductions</th>
                    <th>Net Pay</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.emp_code}>
                      <td>{employee.emp_code || 'N/A'}</td>
                      <td>{employee.name || 'N/A'}</td>
                      <td>{employee.bank_account || 'N/A'}</td>
                      <td>{employee.department || 'N/A'}</td>
                      <td>{employee.category || 'N/A'}</td>
                      <td>{formatCurrency(employee.basic_salary)}</td>
                      <td>{formatCurrency(employee.total_allowance)}</td>
                      <td>{formatCurrency(employee.total_deduction)}</td>
                      <td>{formatCurrency(employee.net_salary)}</td>
                      <td>
                        <span className={`status-badge ${(employee.status || 'paid').toLowerCase()}`}>
                          {employee.status || 'Paid'}
                        </span>
                      </td>
                      <td className="action-buttons">
                        <button
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPayslip(employee);
                          }}
                          title="View Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDownloadPayslip(employee)}
                          title="Download Payslip"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button
                className="close-btn"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '3rem', color: '#dc3545', marginBottom: '15px' }}></i>
                <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>
                  Are you sure you want to delete the salary data?
                </p>
                <p style={{ fontWeight: 'bold', color: '#dc3545' }}>
                  {selectedCategory === 'all'
                    ? `This will delete ALL salary data for ${selectedMonth} ${selectedYear}`
                    : `This will delete salary data for ${selectedCategory} category of ${selectedMonth} ${selectedYear}`
                  }
                </p>
                <p style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '10px' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteData}
                disabled={deleteLoading}
                style={{
                  backgroundColor: '#dc3545',
                  borderColor: '#dc3545',
                  color: 'white'
                }}
              >
                {deleteLoading ? (
                  <span><i className="fas fa-spinner fa-spin"></i> Deleting...</span>
                ) : (
                  <span><i className="fas fa-trash"></i> Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showModal && selectedEmployee && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Employee Salary Details</h3>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="employee-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Employee Code:</span>
                  <span className="detail-value">{selectedEmployee.emp_code || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{selectedEmployee.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department:</span>
                  <span className="detail-value">{selectedEmployee.department || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{selectedEmployee.category || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Rate:</span>
                  <span className="detail-value">{selectedEmployee.rate || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Attendance:</span>
                  <span className="detail-value">{selectedEmployee.attendance || 'N/A'}</span>
                </div>

                <div className="section-header">Earnings</div>
                <div className="detail-item">
                  <span className="detail-label">Basic Salary:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.basic_salary)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">CEA:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.CEA)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">CHA:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.CHA)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">HRA:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.HRA)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">OTHALLOW:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.OTHALLOW)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">SPA:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.SPA)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">UMA:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.UMA)}</span>
                </div>
                <div className="detail-item total">
                  <span className="detail-label">Total Allowance:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.total_allowance)}</span>
                </div>

                <div className="section-header">Deductions</div>
                <div className="detail-item">
                  <span className="detail-label">CLUB:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.CLUB)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">CUTIE CLUB DED:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.CUTIE_CLUB_DED)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">DISH:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.DISH)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">ELECTRICITY:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.ELECTRICITY)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">EMP COP SALARY:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.EMP_COP_SALARY)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">ESIC:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.ESIC)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">FUEL DED:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.FUELDED)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">JPOC SALON:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.JPOCSALON)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">MEDICAL RECOVERY:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.MEDICAL_RECOVERY)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">MILK DED:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.MILKDED)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">OTHER DED 1:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.OTHERDED1)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">PF:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.PF)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">SCHOOL FEE:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.SCHOOLFEE)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">TDS:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.TDS)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">TRANSPORT DED:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.TRANSPORT_DED)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">WF:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.WF)}</span>
                </div>
                <div className="detail-item total">
                  <span className="detail-label">Total Deductions:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.total_deduction)}</span>
                </div>

                <div className="section-header">Summary</div>
                <div className="detail-item grand-total">
                  <span className="detail-label">Net Salary:</span>
                  <span className="detail-value">{formatCurrency(selectedEmployee.net_salary)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Period:</span>
                  <span className="detail-value">{selectedEmployee.period || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Month/Year:</span>
                  <span className="detail-value">{selectedEmployee.month || 'N/A'} {selectedEmployee.year || ''}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Styles (kept inline as in original) */}
      <style jsx="true">{`
        .delete-modal { max-width: 500px; }
        .delete-warning { text-align: center; padding: 20px; }
        .btn-danger { background-color: #dc3545; border-color: #dc3545; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
        .btn-danger:hover:not(:disabled) { background-color: #c82333; border-color: #bd2130; }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background-color: rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:1050; backdrop-filter: blur(3px); transition: all 0.3s ease; }
        .modal-content { background:#fff; padding:25px 30px; border-radius:12px; width:90%; max-width:900px; max-height:90vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.1); transform: translateY(20px); opacity:0; animation: modalEnter 0.3s ease-out forwards; }
        @keyframes modalEnter { to { transform: translateY(0); opacity:1; } }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #f0f0f0; }
        .modal-header h3 { margin:0; color:#2c3e50; font-size:1.5rem; font-weight:600; }
        .close-btn { background:#f8f9fa; border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6c757d; font-size:1.2rem; transition: all 0.2s ease; }
        .close-btn:hover { background:#e9ecef; color:#495057; }
        .employee-details-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:15px; }
        .section-header { grid-column: 1 / -1; font-weight:600; margin:20px 0 10px; padding:8px 0; border-bottom:2px solid #f0f0f0; color:#2c3e50; font-size:1.1rem; letter-spacing:0.5px; text-transform:uppercase; }
        .detail-item { display:flex; justify-content:space-between; padding:10px 12px; border-radius:6px; background:#fff; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.03); border:1px solid #f0f0f0; }
        .detail-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .detail-label { font-weight:500; color:#6c757d; font-size:0.9rem; }
        .detail-value { font-weight:500; color:#2c3e50; text-align:right; max-width:60%; word-break:break-word; }
        .total { background-color:#f8f9fa; margin-top:5px; padding:12px 15px; border-radius:8px; font-weight:600; border-left:3px solid #6c757d; }
        .grand-total { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); margin:15px 0; padding:15px; border-radius:8px; font-size:1.1em; border:1px solid #e9ecef; box-shadow:0 2px 4px rgba(0,0,0,0.05); }
        .modal-footer { margin-top:25px; display:flex; justify-content:flex-end; padding-top:20px; border-top:1px solid #f0f0f0; }
        .modal-footer .btn { padding:8px 20px; border-radius:6px; font-weight:500; transition: all 0.2s ease; }
        .modal-footer .btn-secondary { background:#f8f9fa; border:1px solid #dee2e6; color:#495057; }
        .modal-footer .btn-secondary:hover { background:#e9ecef; border-color:#ced4da; }
        @media (max-width: 768px) {
          .employee-details-grid { grid-template-columns: 1fr; }
          .modal-content { width:95%; padding:20px 15px; }
          .modal-header h3 { font-size:1.3rem; }
          .section-header { font-size:1rem; }
        }
      `}</style>
    </section>
  );
};

export default Reports;

/*
Notes:
1) Ensure `public/power.png` exists (path: public/power.png). The code preloads from `${process.env.PUBLIC_URL || ''}/power.png`.
2) If you prefer keeping the image inside src (e.g. src/assets/power.png), instead:
   - import powerLogo from '../assets/power.png';
   - and in the preload useEffect set: logoDataUrlRef.current = powerLogo; logoReady = true;
   This avoids CORS issues because the dev server serves the asset from same origin.
3) If the canvas conversion throws "Tainted canvases may not be exported", that's a CORS issue. Put the image in public/ or enable CORS on the server hosting the image.
*/
