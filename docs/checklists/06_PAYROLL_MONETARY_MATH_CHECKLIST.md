# Module Checklist 06: Payroll & Monetary Precision

> **Focus:** Computational Accuracy, Monetary String/Numeric Handling, Bracket Boundaries, and Loan Ledgers

---

## 1. Monetary Precision & Rounding Rules
- [ ] **Strict Decimal Representation:** All monetary columns in PostgreSQL use `NUMERIC(12, 2)`.
- [ ] **Zero Float Arithmetic in Payroll Logic:** Payroll calculation routines do not use floating-point `parseFloat()` or binary float math for financial math (uses decimal-safe arithmetic or integer centavos).
- [ ] **Immutable Historical Snapshots:**
  - `Payroll.dailyRate` is permanently locked when payroll is generated.
  - Updating an employee's live `User.dailyRate` does not recalculate or alter past finalized payroll runs.

---

## 2. Seeded & Effective-Dated Statutory Tables
- [ ] **Externalized Contribution Tables:** Contribution brackets for SSS, PhilHealth, and Pag-IBIG live in database tables with effective start/end dates, never hardcoded inside JavaScript `if-else` or `switch` statements.
- [ ] **Bracket Boundary Testing:**
  - Tests verify exact matches at lower bracket boundaries.
  - Tests verify exact matches at upper bracket boundaries.
  - SSS MSC caps and WISP/MPF thresholds apply correctly to salaries above ₱20,000.
  - Pag-IBIG maximum fund salary base applies correctly.

---

## 3. Loan Amortization & Deduction Priority
- [ ] **Append-Only Deduction Ledger:** Every loan deduction posts an immutable entry to `LoanDeductionHistory` with timestamp, payroll run ID, deducted amount, and remaining balance.
- [ ] **Deduction Priority Hierarchy:** If an employee's net earnings are insufficient to cover all scheduled deductions, deductions are applied in legal priority:
  1. Mandatory Statutory Contributions (SSS, PhilHealth, Pag-IBIG)
  2. Withholding Tax (BIR)
  3. Government Agency Loans (SSS Salary/Calamity, Pag-IBIG Multi-Purpose)
  4. Company / Bank Loans & Salary Advances
- [ ] **Net Pay Underflow Protection:** System strictly prevents negative net pay; flags exceptions for accountant review.

---

## 4. Holiday & Overtime Premium Multipliers
- [ ] **Nager.Date API & Proclaimed Holidays:** Official regular holidays (200%), special non-working days (130%), and rest-day premiums calculate accurately.
- [ ] **Night Shift Differential (NSD):** Automatically calculates the 10% premium for qualifying hours between 22:00 and 06:00.
- [ ] **Overtime Rates:** Regular overtime (125% of hourly rate) and holiday overtime calculate strictly from the employee's daily rate converted to hourly base (`dailyRate / 8`).
