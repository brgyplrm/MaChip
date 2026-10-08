# Module Checklist 02: Frontend & User Experience (UX)

> **Focus:** State Handling, Form Validation, User Feedback, and Client Resilience

---

## 1. UI State Management (The "Three States" Rule)
- [ ] **Loading States:** Every asynchronous action (fetching masterlist, submitting request, calculating payroll) renders visual feedback (spinners, skeletons, or disabled buttons with progress text).
- [ ] **Empty States:** When lists or tables have zero records (e.g. no pending requests, no loan deductions), a user-friendly illustration or empty state message is shown rather than a blank screen.
- [ ] **Error States & Boundaries:** Network failures, 500 errors, or failed calculations trigger informative error banners or toast notifications with retry options. React Error Boundaries catch component crashes without white-screening the entire app.

---

## 2. Form Usability & Inline Validation
- [ ] **Immediate Validation Feedback:** Forms highlight invalid inputs in real-time or on blur (e.g. invalid email format, missing required fields, non-matching passwords).
- [ ] **Duplicate Submission Prevention:** Submit buttons are disabled immediately upon click (`disabled={loading}`) to prevent accidental double-submits.
- [ ] **Numeric Input Formatting:** Monetary inputs enforce decimal constraints and format currency (`₱ 0.00`) clearly.
- [ ] **Accessible Password Fields:** Password inputs include visibility toggle buttons with proper `aria-label` tags.

---

## 3. Session & Security UX
- [ ] **Idle Session Management:** System tracks user inactivity; alerts the user before the 15-minute idle cutoff and automatically clears stored session tokens upon timeout.
- [ ] **Graceful Re-Authentication:** If a JWT expires while a user is active, they are redirected to `/login` with an informational message rather than silent failure.
- [ ] **Stored Credentials Sanitation:** No plaintext passwords or unmasked sensitive tokens stored in `localStorage` or `sessionStorage`.

---

## 4. Real-Time Communication & Responsiveness
- [ ] **WebSocket Connection Indicators:** Live attendance / notification badges indicate connection health; handles automatic reconnection when the server reboots.
- [ ] **Multi-Resolution Layout:** Layout adapts cleanly across Desktop (1920x1080), Laptop (1366x768), Tablet (1024x768), and Mobile (375px+ for employee self-service).
