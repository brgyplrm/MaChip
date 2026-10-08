# MAChip: Module Working Checklist

Run after each approved change and report pass/fail with evidence.

## Backend and API
- [ ] Routes return correct status codes; validation rejects bad input
- [ ] Role x endpoint matrix passes; employee cannot read another employee's data
- [ ] Rate limits and file upload checks verified

## Database
- [ ] Fresh DB builds from migrations; latest migration rolls back cleanly
- [ ] Seeders idempotent; 2026 statutory tables present and effective-dated
- [ ] Money columns NUMERIC with constraints; backup restores

## Payroll and Loans
- [ ] Golden payslips match expected values at bracket boundaries
- [ ] State machine blocks illegal transitions; released payslip hash recomputes
- [ ] Loan ledger posts once per cycle; overload case blocked or partially deducted per policy
- [ ] Written authorization stored for bank/company loans

## Access Control Hardware
- [ ] Card + fingerprint opens; card only denied; unknown card denied; all logged
- [ ] Replay and forged device requests rejected
- [ ] Offline behavior matches the documented policy; events replay once
- [ ] Solenoid and regulator soak test passes

## Security
- [ ] `npm audit`, Semgrep/CodeQL, and secret scan clean of high findings
- [ ] CORS, helmet, HTTPS/HSTS verified; debug routes removed
- [ ] Audit log tamper test detected

## Frontend
- [ ] Loading, empty, and error states on every screen
- [ ] Playwright E2E: login, payroll run, loan filing, payslip view
- [ ] Websocket reconnect works after server restart

## Docs and Ops
- [ ] CONTEXT.md and ADRs match the current build
- [ ] Services restart after reboot; restore drill timed
- [ ] Diagrams, ERD, and presentation scripts match the current build
