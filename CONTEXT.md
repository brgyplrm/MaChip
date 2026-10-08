# MAChip: shared language

## Organization
- MAC-J: client, MAC-J Int'l Forwarding Ltd., logistics/air-cargo warehouse.
- CTPAT: security program driving audit-trail integrity requirements.

## People and roles
- Employee, Supervisor, Admin / Payroll Manager: system roles. Supervisor approves employee requests; Admin approves supervisor requests (draft, confirm).
- Employee profile: HR data split across Employee_Profile, User_Hardware, User_Banking, User_Deduction_Profile.

## Payroll
- Payroll cycle: a pay period with cutoffs and a status.
- Payroll status: draft, processing, pending_approval, approved, released, archived.
- Released: the only status in which an employee can see a payslip.
- Payslip hash: SHA-256 of the finalized payslip payload, stored in the audit log for tamper evidence.
- Statutory contributions: SSS, PhilHealth, Pag-IBIG deductions from seeded, effective-dated tables.
- MSC: SSS Monthly Salary Credit bracket value, not the exact salary. [VERIFY 2026 range 5,000 to 35,000]
- EC: Employees' Compensation, employer-only add-on to SSS.
- MPF/WISP: SSS provident fund portion on MSC above 20,000. [VERIFY]
- Fund salary: Pag-IBIG base, capped. [VERIFY 10,000]

## Loans
- Loan reference number: identifier on the lender's notice. Not the employee's SSN.
- Principal: amount borrowed.
- Total payable: sum of all amortizations, including interest.
- Remaining balance: derived from principal/total payable minus ledger deductions (define one meaning during grilling).
- Monthly amortization: fixed deduction per cycle, taken from the lender's notice for SSS/Pag-IBIG.
- Effectivity date / first deduction month: when deductions begin.
- Grace months: months between approval and first deduction, per loan type, kept in config.
- Deduction authorization: employee's signed written consent to deduct for a non-statutory loan (Labor Code Art. 113, DO 195 s.2018). [VERIFY wording]
- Deduction priority: order applied when pay is insufficient (draft: statutory, tax, government loans, bank, company).
- Loan ledger (LoanDeductionHistory): append-only record of each deduction and balance after.
- PRN: SSS payment reference number for remittance. [VERIFY]
- Remittance: employer paying collected deductions to the agency.

## Access control
- Card UID: RFID identifier; assumed clonable.
- Slot ID: fingerprint template position on the R307 sensor; template never leaves the device.
- Punch: a card + fingerprint attendance/door event.
- Device request signature: HMAC over body, timestamp, and nonce, proving the request came from a registered device. (planned)
- Offline policy: what the door does when the server is unreachable. (to decide)
- Anomaly flag: server rule hit (impossible travel, duplicate UID, odd hours, retry burst).

## Audit
- AuditLog: append-only record of sensitive actions.
- Hash chain: each row stores the previous row's hash so edits or deletions are detectable. (planned)
