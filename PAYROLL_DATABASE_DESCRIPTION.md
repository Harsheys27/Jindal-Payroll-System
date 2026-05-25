# Payroll Management System - Database Design Description

## 1. Project Title and Overview

**Project Title:** Power Payroll Management System

**Project Overview:**
This is a comprehensive payroll management system designed for a company called "Power" to manage employee data and generate monthly salary slips. The system handles three categories of employees (H&F, SKS, and Apprentice), allowing administrators to manage employee records, track attendance, calculate allowances and deductions, and generate payslips for any given period.

**Key Features:**
- Employee master data management (CRUD operations)
- Employee categorization (H&F, SKS, Apprentice)
- Monthly attendance tracking
- Allowances management (CEA, CHA, HRA, OTHALLOW, SPA, UMA)
- Deductions management (CLUB, CUTIE_CLUB_DED, DISH, ELECTRICITY, EMP_COP_SALARY, ESIC, FUELDED, JPOCSALON, MEDICAL_RECOVERY, MILKDED, OTHERDED1, PF, SCHOOLFEE, TDS, TRANSPORT_DED, WF)
- Salary generation and calculation
- Payslip generation (PDF export)
- Report generation (CSV export)
- Data deletion for payroll periods

---

## 2. List of All Entities (Tables)

The database consists of two main types of entities:

1. **Static Master Table:**
   - `employee_details` - Stores employee master data

2. **Dynamic Salary Tables:**
   - `salary_MMYY_category` - One table per month-year-category combination (e.g., `salary_1225_hf`, `salary_1225_sks`, `salary_1225_apprentice`)

---

## 3. Entity Details

### 3.1 Table: employee_details

**Purpose:** Stores all permanent employee master data.

**Primary Key:** `Emp Code` (VARCHAR)

**Attributes:**

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| `Emp Code` | VARCHAR(20) | Unique employee identifier (Primary Key) |
| `Name` | VARCHAR(255) | Full name of the employee |
| `Department` | VARCHAR(100) | Department name |
| `Bank Acc. No.` | VARCHAR(50) | Bank account number |
| `IFSC` | VARCHAR(20) | Bank IFSC code |
| `PAN` | VARCHAR(20) | PAN number |
| `Aadhar` | VARCHAR(20) | Aadhar number |
| `Bank Name` | VARCHAR(100) | Bank branch name |
| `Phone` | VARCHAR(20) | Phone number |
| `Email` | VARCHAR(100) | Email address |
| `Designation` | VARCHAR(100) | Job designation |
| `Category` | VARCHAR(50) | Employee category (H&F, SKS, Apprentice) |
| `Joining Date` | DATE | Date of joining |
| `Status` | VARCHAR(20) | Employment status (Active/Inactive) |
| `Rates` | DECIMAL(12,2) | Monthly rate/salary |

---

### 3.2 Table: salary_MMYY_category

**Purpose:** Stores salary records for a specific period and employee category.

**Naming Convention:** `salary_[MM][YY]_[category]`
- MM = Month number (01-12)
- YY = Last 2 digits of year
- category = hf, sks, or apprentice

**Examples:**
- `salary_1225_hf` - December 2025, H&F category
- `salary_1225_sks` - December 2025, SKS category
- `salary_1225_apprentice` - December 2025, Apprentice category

**Primary Key:** `id` (INT AUTO_INCREMENT)

**Composite Unique Key:** `(emp_code, period)` - Ensures one salary record per employee per period

**Attributes:**

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `emp_code` | VARCHAR(20) | Employee code (links to employee_details.Emp Code) |
| `name` | VARCHAR(100) | Employee name |
| `bank_account` | VARCHAR(50) | Bank account number |
| `department` | VARCHAR(50) | Department name |
| `category` | VARCHAR(50) | Employee category |
| `rate` | DECIMAL(12,2) | Daily rate (calculated from monthly rate) |
| `attendance` | INT | Number of days attended |
| `basic_salary` | DECIMAL(12,2) | Basic salary (attendance × daily rate) |
| `CEA` | DECIMAL(12,2) | Children Education Allowance |
| `CHA` | DECIMAL(12,2) | City House Allowance |
| `HRA` | DECIMAL(12,2) | House Rent Allowance |
| `OTHALLOW` | DECIMAL(12,2) | Other Allowance |
| `SPA` | DECIMAL(12,2) | Special Allowance |
| `UMA` | DECIMAL(12,2) | Uniform Allowance |
| `total_allowance` | DECIMAL(12,2) | Sum of all allowances |
| `CLUB` | DECIMAL(12,2) | Club deduction |
| `CUTIE_CLUB_DED` | DECIMAL(12,2) | Cutie Club Deduction |
| `DISH` | DECIMAL(12,2) | Dish deduction |
| `ELECTRICITY` | DECIMAL(12,2) | Electricity deduction |
| `EMP_COP_SALARY` | DECIMAL(12,2) | Employee Cooperative Salary deduction |
| `ESIC` | DECIMAL(12,2) | ESIC deduction |
| `FUELDED` | DECIMAL(12,2) | Fuel Deduction |
| `JPOCSALON` | DECIMAL(12,2) | JPOC Salon deduction |
| `MEDICAL_RECOVERY` | DECIMAL(12,2) | Medical Recovery deduction |
| `MILKDED` | DECIMAL(12,2) | Milk Deduction |
| `OTHERDED1` | DECIMAL(12,2) | Other Deduction 1 |
| `PF` | DECIMAL(12,2) | Provident Fund deduction |
| `SCHOOLFEE` | DECIMAL(12,2) | School Fee deduction |
| `TDS` | DECIMAL(12,2) | Tax Deducted at Source |
| `TRANSPORT_DED` | DECIMAL(12,2) | Transport Deduction |
| `WF` | DECIMAL(12,2) | Welfare Fund deduction |
| `total_deduction` | DECIMAL(12,2) | Sum of all deductions |
| `net_salary` | DECIMAL(12,2) | Net salary (basic + allowances - deductions) |
| `month` | VARCHAR(20) | Month name (e.g., "December") |
| `year` | INT | Year (e.g., 2025) |
| `period` | VARCHAR(10) | Period code (e.g., "1225" for December 2025) |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

---

## 4. Relationships Between Entities

### 4.1 One-to-Many Relationship

**employee_details (1) ──────► (N) salary_MMYY_category**

- **Cardinality:** One employee can have multiple salary records across different periods
- **Relationship:** One-to-Many
- **Linking Columns:**
  - Parent: `employee_details`.`Emp Code`
  - Child: `salary_MMYY_category`.`emp_code`

**Explanation:**
- Each employee in the `employee_details` table can have one or more salary records in the salary tables
- Each salary record belongs to exactly one employee
- Salary records are further partitioned by time period (month) and employee category
- This partitioning allows the system to maintain salary history and generate reports for any period

**Visual Representation:**

```
┌─────────────────────┐         ┌─────────────────────────┐
│   employee_details   │         │   salary_MMYY_category  │
├─────────────────────┤         ├─────────────────────────┤
│ PK: Emp Code        │ 1    N  │ PK: id                  │
│ Name                │─────────│ FK: emp_code            │
│ Department          │         │ period (composite UK)   │
│ Category            │         │ basic_salary            │
│ Rates               │         │ total_allowance         │
│ ...                 │         │ total_deduction         │
└─────────────────────┘         │ net_salary              │
                                │ ...                     │
                                └─────────────────────────┘
```

---

## 5. Important Constraints

### 5.1 Primary Key Constraints

| Table | Primary Key Column(s) |
|-------|----------------------|
| `employee_details` | `Emp Code` |
| `salary_MMYY_category` | `id` |

### 5.2 Unique Key Constraints

| Table | Unique Key Columns | Description |
|-------|-------------------|-------------|
| `salary_MMYY_category` | `(emp_code, period)` | Ensures one salary record per employee per period |

### 5.3 NOT NULL Constraints

**employee_details:**
- `Emp Code` - Required (Primary Key)
- `Name` - Required
- `Bank Acc. No.` - Required
- `IFSC` - Required
- `Phone` - Required
- `Email` - Required
- `Designation` - Required
- `Category` - Required
- `Joining Date` - Required
- `Status` - Required

**salary_MMYY_category:**
- `emp_code` - Required (Foreign Key reference)
- `name` - Required
- `category` - Required
- `rate` - Required
- `basic_salary` - Required
- `net_salary` - Required
- `month` - Required
- `year` - Required
- `period` - Required

### 5.4 Default Values

**salary_MMYY_category:**
- `attendance`: DEFAULT 0
- All allowance fields (CEA, CHA, HRA, OTHALLOW, SPA, UMA): DEFAULT 0
- All deduction fields (CLUB, CUTIE_CLUB_DED, etc.): DEFAULT 0
- `total_allowance`: DEFAULT 0
- `total_deduction`: DEFAULT 0
- `created_at`: DEFAULT CURRENT_TIMESTAMP
- `updated_at`: DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### 5.5 Foreign Key Constraints

| Child Table | Foreign Key Column | References | Parent Table Column |
|-------------|-------------------|------------|-------------------|
| `salary_MMYY_category` | `emp_code` | `employee_details` | `Emp Code` |

*Note: The foreign key relationship is enforced at the application level through the API, not at the database level.*

---

## 6. Assumptions Explicitly Stated in the Project

The following assumptions are embedded in the codebase:

### 6.1 Employee Categories
- Only three employee categories exist: **H&F**, **SKS**, and **Apprentice**
- These categories are hardcoded in the frontend UI dropdowns
- Salary tables are created using lowercase category names without special characters (e.g., "H&F" becomes "hf")

### 6.2 Period Format
- Periods are stored in MMYY format (e.g., "1225" for December 2025)
- The period format is validated in the backend salary generation API

### 6.3 Salary Calculation Logic
- Basic Salary = Attendance × Daily Rate
- Daily Rate = Monthly Rate ÷ Days in Month
- Days in Month is calculated based on the actual calendar days

### 6.4 Salary Table Creation
- Salary tables are created dynamically only when salary data is generated
- The system checks if a salary table exists before creating it (CREATE TABLE IF NOT EXISTS)
- No salary records can be generated twice for the same period and category (duplicate check)

### 6.5 Bank Transfer Only
- The payslip PDF shows "Pay Mode: Bank Transfer" as the only payment method

### 6.6 Leave Balance Display
- Payslips display leave balances with default values if not explicitly set:
  - CL (Casual Leave) = 0
  - SL (Sick Leave) = 0
  - EL (Earned Leave) = 0

### 6.7 Computer-Generated Payslip
- All payslips include a footer note: "This is a computer-generated payslip and does not require a signature."

### 6.8 Single Monthly Rate
- Employees have a single monthly rate stored in the `Rates` column
- The daily rate is calculated dynamically based on the number of days in the selected month

### 6.9 Data Export Format
- CSV exports use pipe-free formatting (commas are removed from currency formatting for CSV compatibility)

### 6.10 No Update on Delete
- Salary data cannot be modified after generation; it can only be deleted and regenerated
- Once payroll process is started in the UI, month/year/category cannot be changed

---

## 7. Database Technology Stack

- **Database Management System:** MySQL
- **Connection Library:** mysql2 (Node.js MySQL driver)
- **Backend Framework:** Express.js
- **Frontend:** React.js

---

## 8. API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/employees` | GET | Fetch all employees |
| `/api/employees` | POST | Add new employee |
| `/api/employees/:empCode` | PUT | Update employee |
| `/api/employees/:empCode` | DELETE | Delete employee |
| `/api/salaries/generate` | POST | Generate salary for a period |
| `/api/salaries/periods` | GET | Get list of all salary periods |
| `/api/salaries/period/:period` | GET | Get salaries for a specific period |
| `/api/salaries/period/:period` | DELETE | Delete salary for a period |

---

## 9. ER Diagram Summary

**Entities:**
1. `employee_details` - Employee master table
2. `salary_MMYY_category` - Dynamic salary tables (one per period-category)

**Relationships:**
- One-to-Many: One employee → Many salary records
- Partitioned by: Period (month-year) and Category

**Key Characteristics:**
- No direct foreign key constraints in database (enforced at application level)
- Soft delete not implemented (hard delete only)
- No audit trail for employee_changes (only salary record timestamps)

