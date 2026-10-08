# ==============================================================================
# Generate Internal Audit & Defect Report (PowerShell)
# Automatically excluded by .gitignore to prevent leaking internal bug lists
#
# Usage:
#   .\scripts\generate-audit-report.ps1 [module_name]
# ==============================================================================

param(
    [string]$Module = "FULL_SYSTEM"
)

$dateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$targetDir = "docs/checklists"
$reportFile = "$targetDir/${Module}_AUDIT_REPORT_${dateStr}.md"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$branch = git rev-parse --abbrev-ref HEAD 2>$null
$commit = git rev-parse --short HEAD 2>$null
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$template = @"
# Internal System Evaluation & Defect Report: $Module

- **Date:** $now
- **Auditor / Evaluator:** $env:USERNAME
- **Status:** In Progress
- **Git Branch:** $branch
- **Commit:** $commit

---

## 🎯 100% Core Business Objectives
- [ ] System addresses core business operations (attendance, batch payroll, loan tracking).
- [ ] Nominal daily operations flow smoothly from clock-in to released payslips.

## 🛡️ 60% Extended & Resilience Objectives
- [ ] Handles alternative course of actions (disputes, missing punches, offline door).
- [ ] Computational and monetary precision is 100% verified (no float roundoffs).
- [ ] Catches and notifies user errors gracefully (validation, toasts, HTTP 4xx).
- [ ] End-to-end user experience is seamless across roles and screen sizes.
- [ ] Role-Based Access Control (RBAC) enforces zero-trust boundaries on all endpoints.
- [ ] Reports (DTR, payslip, audit logs) display accurate, audit-ready data.

---

## 🐞 Identified Defects & Systemic Gaps

### Defect 1: [Short Title]
- **Module:** $Module
- **Severity:** [Critical | High | Medium | Low]
- **Compliance Standard:** [DOLE | RA 10173 DPA | CTPAT | ISO 25010]

#### Descriptions
- **Non-Technical Description:**
  > (What happens from a non-technical or management perspective)

- **Technical Description:**
  > (Endpoint, HTTP method, payload, status code, SQL query, or component stack trace)

#### Root Cause
- **Identified Lack:**
  > (Why this happens in the codebase)

#### Proposed Remediation
- **Possible Change:**
  ```javascript
  // Proposed code or schema adjustment
  ```

- **Possible Output:**
  > (Expected result, status code, or UI state after fix)

"@

Set-Content -Path $reportFile -Value $template -Encoding UTF8

Write-Host "Created audit report template: $reportFile" -ForegroundColor Green
Write-Host "Note: This file is ignored by .gitignore to prevent leaking internal bug logs to GitHub." -ForegroundColor Yellow
