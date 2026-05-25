# Power Payroll Management System

A full-stack payroll management system for maintaining employee master data and generating monthly salary calculations, payslip data, and period-wise salary history.

## Features

- **Employee Management (CRUD)**
  - Add, update, list, and delete employees
  - Employee details stored in `employee_details`

- **Payroll Generation**
  - Generate salary for a selected **MMYY period**
  - Supports employee categories: **H&F**, **SKS**, **Apprentice**
  - Creates salary tables dynamically per **period + category** (e.g., `salary_1225_hf`)
  - Blocks duplicate generation for the same period/category

- **Salary Calculation Components**
  - Basic salary based on attendance and calculated daily rate
  - Allowances: CEA, CHA, HRA, OTHALLOW, SPA, UMA (+ totals)
  - Deductions: CLUB, PF, TDS, ESIC, transport/medical/etc. (+ totals)
  - Computes **Net Salary** = Basic + Total Allowance − Total Deduction

- **Payroll Period Operations**
  - List all generated payroll periods
  - Fetch salary data for a period (optionally filter by category)
  - Delete generated salary for a period (drops the corresponding tables)

## Tech Stack

- **Frontend:** React (Create React App)
- **Backend:** Node.js + Express
- **Database:** MySQL
  - Uses dynamic salary tables named by period and category

## Backend API (High-Level)

- **Employees**
  - `GET /api/employees`
  - `POST /api/employees`
  - `PUT /api/employees/:empCode`
  - `DELETE /api/employees/:empCode`

- **Salaries**
  - `POST /api/salaries/generate` (generate payroll for a period)
  - `GET /api/salaries/periods` (list available periods)
  - `GET /api/salaries/period/:period` (fetch salaries for a period)
  - `DELETE /api/salaries/period/:period` (delete salaries for a period)

## Database Design Notes

Refer to **PAYROLL_DATABASE_DESCRIPTION.md** for the full schema and design explanation, including:
- `employee_details` table definition
- Dynamic `salary_MMYY_category` table structure
- Salary/allowance/deduction fields
- Period/category naming conventions

## Getting Started

1. Set up the MySQL database and configure environment variables for the backend.
2. Start the backend server.
3. Start the React frontend.
4. Use the UI to add employees and generate monthly payroll.
