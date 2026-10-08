# Module Checklist 05: Legal & Statutory Compliance

> **Jurisdiction:** Philippines (DOLE, SSS, PhilHealth, Pag-IBIG, BIR, NPC RA 10173) & International Standards (CTPAT, GDPR Principles)

---

## 1. Philippine Labor Standards (DOLE) Compliance
- [ ] **Three-Year Mandatory Record Retention:** System permanently archives all Daily Time Records (DTRs), payroll registers, released payslips, and loan deductions for at least 3 years to comply with DOLE inspection rules.
- [ ] **Itemized Payslip Transparency:** Every generated payslip explicitly itemizes:
  - Basic pay & regular hours worked.
  - Overtime (regular day, rest day, special non-working, regular holiday).
  - Night Shift Differential (10% premium between 10:00 PM and 6:00 AM).
  - Tardy / Undertime deductions.
  - Itemized statutory contributions (SSS EE share, PhilHealth EE share, Pag-IBIG EE share).
  - Withholding tax (BIR TRAIN law schedule).
  - Authorized non-statutory deductions.
- [ ] **Written Deduction Authorization (Labor Code Art. 113 & DO 195):** Non-mandatory deductions (company loans, salary advances, uniform fees) require a verified, signed employee consent record before deductions can execute.
- [ ] **Regional Tripartite Wages (RTWPB):** Base pay rates comply with prevailing NCR / regional daily minimum wage floors.
- [ ] **Mandatory Benefits Accounting:** System correctly computes 13th-month pay accrual, Service Incentive Leave (SIL, 5 days), and holiday premiums.

---

## 2. Data Privacy Act of 2012 (RA 10173) & GDPR Principles
- [ ] **Biometric Necessity & Proportionality (NPC Circular 2023-06):**
  - Collection is proportionate to timekeeping and access control needs.
  - Raw biometric data (fingerprint images/templates) is not exposed to web clients, external databases, or third parties.
- [ ] **Employee Privacy Notice & Transparency:** Employees are informed during onboarding regarding how their attendance and payroll data is collected, stored, and audited.
- [ ] **Data Subject Rights Implementation:**
  - Employees have read access to their complete historical DTR logs and released payslips.
  - Employees can file dispute/adjustment requests if attendance logs are inaccurate.
- [ ] **Retention & Disposal (Sequelize Paranoid Mode):**
  - Departing employees are soft-deleted (`deletedAt`) to preserve audit history while revoking active access.
  - Hard deletion is prevented if financial or attendance audit dependencies exist.

---

## 3. CTPAT Supply Chain Security (Customs-Trade Partnership)
- [ ] **Positive Identity Verification:** Only enrolled, authorized logistics personnel can unlock restricted cargo staging areas.
- [ ] **Immediate Access De-provisioning:** Personnel termination immediately revokes RFID cards, sensor slot access, and web login.
- [ ] **Audit Trail Tamper-Evidence:** Security personnel can produce timestamped entry/exit logs during CBP validations.
