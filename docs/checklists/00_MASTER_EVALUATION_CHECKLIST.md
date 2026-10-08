# MAChip Master System Evaluation & Compliance Framework

> **Evaluation Standard:** Capstone Defense Ready & Enterprise CTPAT/DOLE/DPA Auditable  
> **Applicability:** Generalized for Backend, Frontend, Hardware (ESP32), Security, and Statutory Compliance.

---

## 🏛️ Executive Evaluation Matrix

### Phase 1: 100% Core Business Verification (Must Pass)
- [ ] **1.1 Business Need Coverage:** System contains all core modules (User Management, Access Control/Timekeeping, Request Management, Batch Payroll, and System Settings) that resolve the logistics facility's operational bottlenecks.
- [ ] **1.2 Nominal Business Workflow Execution:**
  - Employee records are enrolled and assigned credentials.
  - Daily attendance punches (In/Out) are recorded and mapped to DTR without loss.
  - Leave / Overtime requests follow hierarchical supervisor/admin approvals.
  - Cutoff payroll batch generates correctly for the 10th-15th and 25th-30th/31st cycles.
  - Payslips are generated, locked, and released to employees.

---

### Phase 2: 60% Extended, Alternative, and Resilience Verification
- [ ] **2.1 Alternative Courses of Action (Off-Nominal Flows):**
  - Handles missing morning punch or forgotten afternoon punch without corrupting the DTR.
  - Gracefully handles leave cancellation, rejected requests, and disputed overtime hours.
  - Prevents negative net pay when deductions exceed gross earnings (partial deduction / rollover priority).
  - Handles hardware offline mode when server connectivity is interrupted.
- [ ] **2.2 Computational & Monetary Precision:**
  - Zero floating-point rounding errors (`NUMERIC` / decimal strings throughout payroll math).
  - Effective-dated contribution bracket lookups (SSS, PhilHealth, Pag-IBIG) return exact table values.
  - Historical daily rate snapshots remain immutable in finalized payroll rows.
- [ ] **2.3 Error Detection & User Notification:**
  - Comprehensive client-side form validation and clear server validation feedback.
  - User-friendly error messages (no raw database errors or stack traces leaked to users).
  - Visual and auditory feedback on hardware punch attempts (success vs. denied).
- [ ] **2.4 End-to-End User Experience:**
  - Responsive across resolutions (Desktop, Tablet, Mobile for requests).
  - Loading skeletons, empty states, and optimistic UI updates.
  - Session auto-expiry warning and graceful re-authentication.
- [ ] **2.5 Multi-Tier Role-Based Access Control (RBAC):**
  - Zero-trust route validation: Server validates session ownership on all `:id` endpoints.
  - Role hierarchy strictly enforced: Employee cannot view colleagues' DTR, payslips, or admin dashboards.
- [ ] **2.6 Statutory & Analytical Reporting:**
  - Comprehensive exportable DTR reports (PDF/Excel) meeting DOLE inspection standards.
  - Itemized payslips with complete statutory breakdowns.
  - Append-only audit trail logs for all sensitive transactions.

---

## 📋 Standardized Defect & Finding Template

When conducting reviews or audits, record every identified gap or bug using this standardized template:

```markdown
### 🐞 Defect ID: [MOD-XXX] - [Brief Title]

- **Layer / Module:** [Backend | Frontend | Hardware | Security | Legal / Compliance]
- **Severity Level:** [Critical | High | Medium | Low]
- **Compliance Reference:** [DOLE Art. 113 | RA 10173 DPA | CTPAT MSC | ISO/IEC 25010]

#### 1. Descriptions
- **Non-Technical Description:**
  *(Explain what happens from a user/business perspective so panel members and managers understand)*
  > *Example: The employee can still see an 'Approve' button even though they only have standard employee permissions.*
- **Technical Description:**
  *(Explain the exact technical failure, endpoint, method, payload, status code, and stack trace)*
  > *Example: `PUT /api/requests/:id/status` does not check `req.user.role === 'supervisor' || 'admin'`. Client sends `{"status": 2}` and server returns `200 OK`.*

#### 2. Root Cause / Systemic Lack
- **Identified Gap:** *(Missing middleware, schema constraint omission, lack of validation, unhandled exception)*

#### 3. Proposed Remediation
- **Required Modification:**
  *(Code, schema, or config change needed)*
  ```javascript
  // Example fix code snippet
  ```

#### 4. Expected Output & Verification Evidence
- **Expected Result:** *(What the system must return/display after the fix)*
- **Verification Evidence:** *(Status code, test log, screenshot, or assertion)*
```

---

## 📑 Modular Checklist Index

Use the specialized checklists below for dedicated module testing:
1. [`01_BACKEND_API_CHECKLIST.md`](./01_BACKEND_API_CHECKLIST.md) — API resilience, raw SQL safety, schema integrity, error handling.
2. [`02_FRONTEND_UX_CHECKLIST.md`](./02_FRONTEND_UX_CHECKLIST.md) — User experience, feedback states, session timeout, validation.
3. [`03_SECURITY_RBAC_CHECKLIST.md`](./03_SECURITY_RBAC_CHECKLIST.md) — Zero-trust authorization, CTPAT access control, cryptographic hygiene.
4. [`04_HARDWARE_IOT_ESP32_CHECKLIST.md`](./04_HARDWARE_IOT_ESP32_CHECKLIST.md) — ESP32 reader, RFID/biometrics, offline door policy, watchdog.
5. [`05_LEGAL_STATUTORY_COMPLIANCE_CHECKLIST.md`](./05_LEGAL_STATUTORY_COMPLIANCE_CHECKLIST.md) — Philippine DOLE, RA 10173 DPA, GDPR alignment, CTPAT.
6. [`06_PAYROLL_MONETARY_MATH_CHECKLIST.md`](./06_PAYROLL_MONETARY_MATH_CHECKLIST.md) — Monetary calculations, loan ledgers, bracket lookups.
