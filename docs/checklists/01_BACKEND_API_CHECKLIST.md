# Module Checklist 01: Backend & API Resilience

> **Focus:** Robustness, Data Integrity, Input Sanitization, and Error Feedback

---

## 1. Input Validation & Data Sanitization
- [ ] **Request Body Schema Validation:** Every POST, PUT, and PATCH endpoint enforces a strict schema. Unknown or excess properties are stripped or rejected.
- [ ] **Type Coercion & Boundary Checks:** String, numeric, date, and boolean fields are strictly cast and checked against min/max bounds (e.g. negative numbers rejected for salaries or hours).
- [ ] **Sanitization:** String inputs are trimmed and sanitized against XSS payloads and SQL special characters.
- [ ] **Multipart / File Upload Guards:** File upload endpoints (`multer`) validate MIME type, file magic bytes, and enforce size limits (e.g., maximum 5MB for proof files).

---

## 2. SQL Safety & Database Transactions
- [ ] **Named Replacements in Raw SQL:** Every raw query (`sequelize.query`) uses `:param` syntax. Zero raw string concatenations or template literals in SQL strings.
- [ ] **Transactional Atomicity:** Multi-table operations (e.g. batch payroll generation, request approval + attendance adjustment, loan amortization deduction) execute inside a managed database transaction (`sequelize.transaction()`).
- [ ] **Soft Delete Consistency:** Queries querying tables with paranoid mode (`deletedAt`) ensure soft-deleted records are excluded from active calculations and active masterlists.
- [ ] **Cascade Prevention:** Hard deletion is blocked if associated records exist in `Payroll`, `user_logging`, `emp_Request`, or `employee_Logging_report`.

---

## 3. HTTP Status Codes & Error Formatting
- [ ] **Appropriate HTTP Status Codes:**
  - `200 OK` / `201 Created` for successful requests.
  - `400 Bad Request` for malformed payloads.
  - `401 Unauthorized` for missing or invalid JWT tokens.
  - `403 Forbidden` for role or ownership permission violations.
  - `404 Not Found` for non-existent entities.
  - `409 Conflict` for duplicate entries (e.g., duplicate email, duplicate RFID UID, duplicate cutoff batch).
  - `422 Unprocessable Entity` for semantic business rule violations (e.g. insufficient leave balance).
  - `500 Internal Server Error` for unhandled runtime exceptions.
- [ ] **Standardized Error Response Shape:**
  ```json
  {
    "success": false,
    "message": "Human-readable explanation of error.",
    "errorCode": "ERR_INSUFFICIENT_LEAVE_BALANCE",
    "errors": []
  }
  ```
- [ ] **Information Disclosure Prevention:** Stack traces, internal file paths, and database query error dumps are logged internally to file/console and stripped from API client responses.

---

## 4. Rate Limiting & Denial of Service Protection
- [ ] **Global Rate Limiting:** Global limiter prevents brute-force attempts on API endpoints.
- [ ] **Authentication Rate Limiting:** Strict threshold applied to `/api/auth/login` (e.g., maximum 5 failed attempts per 15-minute window).
- [ ] **Hardware Ingestion Throttling:** Hardware punch endpoints throttle rapid-fire retry bursts from reader devices.
