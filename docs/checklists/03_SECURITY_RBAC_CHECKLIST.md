# Module Checklist 03: Security & Zero-Trust RBAC

> **Focus:** Access Control, CTPAT Physical/Digital Boundaries, Cryptographic Integrity, and Audit Trails

---

## 1. Zero-Trust Authorization & Ownership
- [ ] **Server-Side Identity Enforcement:** Endpoints extract user identity (`userId`, `role`, `department`) exclusively from the verified JWT token (`req.user`), never from request bodies or headers.
- [ ] **Object Ownership Checks on `:id` Routes:**
  - An employee accessing `/api/users/:id/attendance` or `/api/payroll/:id/payslip` must match `:id === req.user.id` unless their role explicitly grants managerial access.
  - Cross-tenant / cross-employee data leakage is strictly blocked with `403 Forbidden`.
- [ ] **Hierarchical Request Approval Separation:**
  - Supervisors can only approve requests from employees within their designated department.
  - Supervisors cannot approve their own leave or overtime requests.
  - Administrative accounts review and approve supervisor requests.

---

## 2. Authentication & Token Management
- [ ] **Password Hashing:** Passwords hashed with BCrypt using an appropriate work factor (salt rounds >= 10).
- [ ] **Token Expiry & Scope:** JWT access tokens have a finite lifetime (e.g., 8–24 hours maximum for mobile/self-service; 15-minute idle invalidation on terminal).
- [ ] **Immediate Access Revocation (CTPAT Requirement):** Deactivating or soft-deleting an employee immediately revokes their active sessions, web access, and door reader punch privileges.

---

## 3. Network Hardening & Headers
- [ ] **Security Headers (Helmet):** Response headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`.
- [ ] **Strict CORS Whitelisting:** Access restricted to trusted origins (specific LAN IPs / designated domain), rejecting wildcard `*` origins when credentials are exchanged.
- [ ] **Payload Sanitization & Method Whitelisting:** Disallowed HTTP methods are rejected.

---

## 4. Tamper-Evident Audit Logging
- [ ] **Append-Only AuditLog Implementation:** Every sensitive operation (user creation, credential update, rate change, payroll finalization, role modification) writes a row to `AuditLog`.
- [ ] **Immutability Protection:** The `AuditLog` table allows `INSERT` only; `UPDATE` and `DELETE` operations are strictly blocked by triggers or ORM constraints.
- [ ] **Payslip Integrity Verification:** Released payslips store a SHA-256 payload hash in the audit record for tamper-evidence during labor or court inspections.
