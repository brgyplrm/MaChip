#!/usr/bin/env python3
"""
MAChip Master QA HTML and PDF Generator (v3.0.0 Comprehensive Dual-Axis Compliance Edition)
Updates and builds docs/qa/MACHIP_MASTER_QA.html and renders docs/qa/MACHIP_MASTER_QA.pdf
Incorporates:
- Maxicare HMO Healthcare Group Module
- Commercial Bank Loans (EastWest Bank) & Company Cash Advances
- Philippine Special Statutory Leaves (Solo Parent RA 8972/11861, VAWC RA 9262, Special Leave for Women RA 9710)
- Negative Net Pay Prevention & Legal Deduction Priority Shortfall Handling
- EXCLUDES Night Shift Differential per user instructions
"""

import os
import sys
import subprocess
import re
from bs4 import BeautifulSoup

def main():
    root_dir = "/home/achyllisss/code/development/School/MaChip"
    html_path = os.path.join(root_dir, "docs", "qa", "MACHIP_MASTER_QA.html")
    pdf_path = os.path.join(root_dir, "docs", "qa", "MACHIP_MASTER_QA.pdf")
    bak_path = html_path + ".bak"

    with open(bak_path, "r", encoding="utf-8") as f:
        original_html = f.read()

    soup = BeautifulSoup(original_html, "html.parser")
    original_pages = soup.find_all("div", class_="page")
    print(f"Loaded {len(original_pages)} original pages from backup.")

    # Helper function to generate standard header
    def make_header(doc_code="MACJ-QA-MAN-2026-V3"):
        return f"""
        <div class="doc-header">
            <div class="header-left">
                <h1>MAChip Master Quality Assurance &amp; Evaluation Manual</h1>
                <h2>MAC-J Int'l Forwarding Ltd., Co. &bull; CTPAT &amp; DOLE Dual-Axis Compliance Evaluation Instrument</h2>
            </div>
            <div class="header-right">
                <div><strong>Doc Code:</strong> {doc_code}</div>
                <div><strong>Standards:</strong> DOLE Labor Code &bull; RA 10173 &bull; RA 7641 &bull; CTPAT &bull; RA 8972 &bull; RA 9262</div>
                <div><strong>QA Group:</strong> MAChip QA &amp; Engineering Team</div>
            </div>
        </div>
        """

    # Helper function to generate standard footer
    def make_footer(page_num, total_pages=22):
        return f"""
        <div class="footer-bar">
            <span>MAChip Capstone System &bull; Academic &amp; Operational Quality Assurance Manual</span>
            <span>Confidential &amp; Proprietary &mdash; MAC-J Int'l Forwarding Ltd., Co.</span>
            <span>Page {page_num} of {total_pages}</span>
        </div>
        """

    new_pages = []

    # =========================================================================
    # PAGE 1: Document Control & System Verification Governance
    # =========================================================================
    p1 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Document Control &amp; System Verification Governance</h2>
            <span class="badge">Executive Governance &amp; Revision Ledger</span>
        </div>
        
        <div class="row">
            <div class="col-8">
                <div class="info-card">
                    <strong>Project Mandate &amp; Enterprise Operational Scope:</strong>
                    <p style="margin-top: 0.6mm;">
                        MAChip (Microchip Attendance &amp; Chip Payroll) is an automated biometric and RFID-based access control, attendance tracking, and batch payroll generation system developed for <strong>MAC-J Int'l Forwarding Ltd., Co.</strong>, an international freight logistics enterprise operating under strict CTPAT supply chain criteria near NAIA, Pasay City.
                    </p>
                    <p style="margin-top: 0.6mm;">
                        This Master Quality Assurance Manual establishes dual-axis verification across both <strong>human role workflows</strong> and <strong>underlying system architecture</strong>, ensuring zero-defect compliance with the Philippine DOLE Labor Code (P.D. 442), RA 10173 (Data Privacy Act of 2012), RA 7641 (Retirement Pay Law), P.D. 851 (13th Month Pay), RA 8972/11861 (Solo Parent Welfare), RA 9262 (Anti-VAWC), and RA 9710 (Magna Carta of Women).
                    </p>
                </div>
            </div>
            <div class="col-4">
                <table class="qa-table" style="margin-bottom: 0;">
                    <tr><th colspan="2">Document Specifications</th></tr>
                    <tr><td><strong>Doc ID:</strong></td><td><code>MACJ-QA-MAN-2026-V3</code></td></tr>
                    <tr><td><strong>Classification:</strong></td><td>Confidential / Enterprise Core</td></tr>
                    <tr><td><strong>Version:</strong></td><td>3.0.0 (Comprehensive Dual-Axis Release)</td></tr>
                    <tr><td><strong>Effective Date:</strong></td><td>October 2026</td></tr>
                    <tr><td><strong>Target Host:</strong></td><td>Fedora Linux (LAN + Port Forward)</td></tr>
                </table>
            </div>
        </div>

        <div class="subsection-title">1.1 Document Control &amp; Revision History</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 9%;">Version</th>
                    <th style="width: 13%;">Release Date</th>
                    <th style="width: 17%;">Author</th>
                    <th style="width: 33%;">Scope &amp; Primary Refinements</th>
                    <th style="width: 28%;">Approval &amp; Milestone</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>1.0.0</code></td>
                    <td>2026-10-09</td>
                    <td>MAChip QA Team</td>
                    <td>Initial 6-page role-based scenario execution manual.</td>
                    <td>Verified prototype routes.</td>
                </tr>
                <tr>
                    <td><code>2.0.0</code></td>
                    <td>2026-10-15</td>
                    <td>MAChip QA Team</td>
                    <td>Migrated to A4 Landscape layout; added hardware loop and math matrix.</td>
                    <td>Structural gap analysis.</td>
                </tr>
                <tr>
                    <td><code>2.5.0</code></td>
                    <td>2026-10-18</td>
                    <td>MAChip QA Team</td>
                    <td>DPA 2012 blind indexing, AES-256-GCM statutory encryption, audit hash-chaining, RFID hashing.</td>
                    <td>Security Baseline.</td>
                </tr>
                <tr>
                    <td><code>3.0.0</code></td>
                    <td>2026-10-25</td>
                    <td>MAChip QA Team</td>
                    <td><strong>Comprehensive Dual-Axis Defense Edition:</strong> Integrated Maxicare HMO Healthcare Group Module, Commercial Bank Loans (EastWest Bank), Company Cash Advances, Philippine Special Statutory Leaves (Solo Parent RA 8972, VAWC RA 9262, Magna Carta RA 9710), and Legal Deduction Priority / Negative Net Pay Shortfall Protection (22-page, 120-case complete audit suite).</td>
                    <td><strong>Official Defense &amp; Commissioning Baseline.</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="subsection-title">1.2 Formal Evaluation &amp; Stakeholder Sign-Off Blocks</div>
        <div class="row">
            <div class="col-4">
                <div class="sign-box">
                    <strong>Submitted By (Quality Assurance)</strong>
                    <div>MAChip Engineering Development Team</div>
                    <div class="sign-line"></div>
                    <div><strong>MAChip Quality Assurance Team</strong></div>
                    <div>Lead QA Engineer &amp; Systems Evaluator</div>
                    <div>Polytechnic University of the Philippines (BSIT 2026)</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
            <div class="col-4">
                <div class="sign-box">
                    <strong>Industry Partner Endorsement</strong>
                    <div>MAC-J Int'l Forwarding Ltd., Co.</div>
                    <div class="sign-line"></div>
                    <div><strong>Operations &amp; Security Directorate</strong></div>
                    <div>CTPAT Cargo Security &amp; Compliance Office</div>
                    <div>MAC-J Int'l Forwarding Ltd., Co.</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
            <div class="col-4">
                <div class="sign-box">
                    <strong>Academic Evaluation &amp; Defense Panel</strong>
                    <div>PUP CCIS Academic Panel</div>
                    <div class="sign-line"></div>
                    <div><strong>Capstone Defense Panel / Lead Evaluator</strong></div>
                    <div>Department of Information Technology</div>
                    <div>Polytechnic University of the Philippines</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
        </div>
        {make_footer(1)}
    </div>
    """
    new_pages.append(p1)

    # =========================================================================
    # PAGES 2 to 5: Keep content, update footer
    # =========================================================================
    for p_idx in [1, 2, 3, 4]:
        raw_p = str(original_pages[p_idx])
        # Update footer page number
        raw_p = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(p_idx + 1), raw_p, flags=re.DOTALL)
        # Update doc code in header
        raw_p = raw_p.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
        new_pages.append(raw_p)

    # =========================================================================
    # PAGE 6: Forms 3.2 & 3.3 (Enhanced with Special Statutory Leaves Validation)
    # =========================================================================
    p6 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 3: Page-by-Page &amp; Field-by-Field Input Validation Matrix (Cont.)</h2>
            <span class="badge">Forms 3.2 &amp; 3.3: User Edit &amp; Request Filing</span>
        </div>

        <div class="subsection-title">Form 3.2: User Edit, Profile SPI Masking &amp; Daily Rate Lock (<code>/users/edit/:id</code> &amp; <code>/profile</code>)</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 14%;">Field Name</th>
                    <th style="width: 10%;">Type</th>
                    <th style="width: 16%;">Format / Pattern</th>
                    <th style="width: 10%;">Bounds</th>
                    <th style="width: 25%;">Fault Injection &amp; Masking Test</th>
                    <th style="width: 17%;">Expected System Behavior</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>dailyRate</code></td>
                    <td>Number</td>
                    <td><code>^\\d+(\\.\\d{{1,2}})?$</code></td>
                    <td>&ge; &#8369;610.00</td>
                    <td>Modify daily rate from &#8369;610.00 to &#8369;650.00 and submit.</td>
                    <td>Prompts confirmation modal; updates <code>User.dailyRate</code>, <code>previousDailyRate</code>, and <code>rateUpdatedAt</code>.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL</td>
                </tr>
                <tr>
                    <td>Profile Masking</td>
                    <td>Text (UI)</td>
                    <td><code>&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;1234</code></td>
                    <td>Masked View</td>
                    <td>Inspect SSS, PhilHealth, Pag-IBIG, and Bank Accounts on <code>/profile</code>.</td>
                    <td>Values render masked with trailing 4 digits; full values never exposed in DOM without toggle authorization.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL</td>
                </tr>
            </tbody>
        </table>

        <div class="subsection-title">Form 3.3: Employee Request Filing (<code>/requests</code> &rarr; File Request Tab &mdash; Including Statutory Leaves)</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 14%;">Field Name</th>
                    <th style="width: 10%;">Type / UI</th>
                    <th style="width: 24%;">Allowed Values / Entitlements</th>
                    <th style="width: 12%;">Bounds</th>
                    <th style="width: 22%;">Negative / Fault Injection Test</th>
                    <th style="width: 12%;">Expected Validation</th>
                    <th style="width: 6%;">Eval</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>request_Type_Id</code></td>
                    <td>Select</td>
                    <td><code>VL(1)|SL(2)|EL(3)|HD(4)|OT(5)|COR(6)|SOLO(10)|VAWC(11)|MCW(12)|LON(14)</code></td>
                    <td>Valid Type</td>
                    <td>Submit with empty selection or undefined ID.</td>
                    <td>"Please select a valid request type."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
                <tr>
                    <td><code>Solo Parent Leave</code></td>
                    <td>Attachment</td>
                    <td>RA 8972 / RA 11861 Entitlement: 7 Days Paid</td>
                    <td>Active Card</td>
                    <td>Select Solo Parent Leave without uploading Solo Parent ID card.</td>
                    <td>"Mandatory: Valid City/Municipal Solo Parent ID required."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
                <tr>
                    <td><code>VAWC Leave</code></td>
                    <td>Attachment</td>
                    <td>RA 9262 Entitlement: 10 Days Paid</td>
                    <td>Legal Order</td>
                    <td>Select VAWC Leave without attaching BPO or Court Certification.</td>
                    <td>"Mandatory: Official Protection Order / Certification required."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
                <tr>
                    <td><code>Special Leave Women</code></td>
                    <td>Attachment</td>
                    <td>RA 9710 Magna Carta of Women: Gynecological Surgery</td>
                    <td>Medical Cert</td>
                    <td>Select MCW Leave without attaching surgical medical certificate.</td>
                    <td>"Mandatory: Physician Gynecological Medical Board Certificate required."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
                <tr>
                    <td><code>start_Date</code></td>
                    <td>Date</td>
                    <td><code>YYYY-MM-DD</code></td>
                    <td>Active Period</td>
                    <td>Select date inside closed/released payroll cutoff.</td>
                    <td>"Cannot file request for a closed or released payroll period."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
                <tr>
                    <td><code>attachment</code></td>
                    <td>File</td>
                    <td>MIME: <code>.pdf, .jpg, .png</code></td>
                    <td>Max 5 MB</td>
                    <td>Upload executable file: <code>"proof.exe"</code> or file &gt; 5 MB.</td>
                    <td>"Invalid file format (only PDF, PNG, JPG allowed; max 5MB)."</td>
                    <td class="eval-cell"><span class="eval-box"></span>P <span class="eval-box"></span>F</td>
                </tr>
            </tbody>
        </table>
        {make_footer(6)}
    </div>
    """
    new_pages.append(p6)

    # =========================================================================
    # PAGE 7: Forms 3.4 to 3.8 (Decisions, Multi-Tier Loans, Maxicare HMO & Settings)
    # =========================================================================
    p7 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 3: Page-by-Page &amp; Field-by-Field Input Validation Matrix (Cont.)</h2>
            <span class="badge">Forms 3.4 to 3.8: Decisions, Multi-Tier Loans, Maxicare &amp; Settings</span>
        </div>

        <div class="subsection-title">Form 3.4: Supervisor Decision &amp; Remarks Modal (<code>/adminRequests</code>)</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 14%;">Action Trigger</th>
                    <th style="width: 14%;">Target Field</th>
                    <th style="width: 32%;">Test Scenario &amp; Negative Input</th>
                    <th style="width: 32%;">Expected System Behavior &amp; Boundary Rule</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Reject Request</td>
                    <td><code>remarks</code> (Textarea)</td>
                    <td>Click Reject with empty remarks field.</td>
                    <td>Submit blocked: "Rejection remarks are mandatory to explain cause to employee."</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
                <tr>
                    <td>Return for Fix</td>
                    <td><code>instructions</code> (Text)</td>
                    <td>Click Return without specific correction instructions.</td>
                    <td>Submit blocked: "Please specify what the employee needs to correct or re-attach."</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
            </tbody>
        </table>

        <div class="subsection-title">Form 3.5: Multi-Tier Loan Enrollment (Gov Loans, EastWest Bank Loans &amp; Cash Advances)</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 18%;">Loan Category / Field</th>
                    <th style="width: 14%;">Format / Type</th>
                    <th style="width: 30%;">Negative / Fault Injection Test</th>
                    <th style="width: 30%;">Expected Validation Rule &amp; Legal Compliance</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Gov Loan Principal</td>
                    <td>Currency / Numeric</td>
                    <td>Enter &#8369;0.00 or negative amount -&#8369;5,000.00.</td>
                    <td>"Total loan principal must be greater than &#8369;0.00."</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
                <tr>
                    <td>EastWest Bank Loan</td>
                    <td>File / Consent</td>
                    <td>Enroll commercial bank loan without verified signed employee consent.</td>
                    <td>Blocked: DOLE DO 195 s.2018 mandate requires verified written deduction authorization.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
                <tr>
                    <td>Company Cash Advance</td>
                    <td>Voucher Number</td>
                    <td>Submit cash advance with duplicate or blank voucher reference.</td>
                    <td>"Valid non-duplicate internal cash advance voucher number required."</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
            </tbody>
        </table>

        <div class="subsection-title">Form 3.8: Maxicare HMO Policy Enrollment &amp; Settings (<code>Maxicare.jsx</code> &amp; Settings)</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 22%;">Component / Setting Key</th>
                    <th style="width: 16%;">Input Target</th>
                    <th style="width: 28%;">Test Scenario &amp; Configuration</th>
                    <th style="width: 26%;">Expected Validation Rule &amp; Persistence</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>maxicareTotalGross</code></td>
                    <td>Annual Pool (&#8369;)</td>
                    <td>Update total gross policy pool to &#8369;26,922.28 (24 cutoffs).</td>
                    <td>Persists in <code>SystemSettings</code>; auto-derives &#8369;1,121.76 gross cutoff base.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
                <tr>
                    <td>Employee Enrollment</td>
                    <td>Member / Dependent</td>
                    <td>Enroll member with 50% employee share (&#8369;560.88/cutoff deduction).</td>
                    <td>Creates record in <code>Maxicare_Enrollment</code>; links to payroll deduction engine.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS <span class="eval-box"></span>FAIL</td>
                </tr>
            </tbody>
        </table>
        {make_footer(7)}
    </div>
    """
    new_pages.append(p7)

    # =========================================================================
    # PAGE 8: Role 1 Admin Manager
    # =========================================================================
    p8_raw = str(original_pages[7])
    p8_raw = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(8), p8_raw, flags=re.DOTALL)
    p8_raw = p8_raw.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
    new_pages.append(p8_raw)

    # =========================================================================
    # PAGE 9: Admin Manager (Cont.) & Role 2 Supervisor Matrix (with SUP-06)
    # =========================================================================
    p9_raw = str(original_pages[8])
    # Add SUP-06 into the Supervisor table
    sup06_row = """
            <tr>
                <td><code>SUP-06</code></td>
                <td><strong>Special Statutory Leave Compliance Review</strong><br>Open <code>/adminRequests</code></td>
                <td>Review pending Solo Parent (RA 8972), VAWC (RA 9262), or MCW (RA 9710) leave request. Click view attached legal certification. Confirm valid document before clicking Approve.</td>
                <td>Supervisor approval writes audit record with verifier ID. Leaves without valid statutory certificates cannot be approved. Balance decrements on final approval.</td>
                <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
            </tr>
    """
    # Insert before the closing tbody of the second table
    p9_raw = p9_raw.replace("</tbody>\n    </table>\n\n    <div class=\"footer-bar\">", f"{sup06_row}\n</tbody>\n    </table>\n\n    <div class=\"footer-bar\">")
    p9_raw = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(9), p9_raw, flags=re.DOTALL)
    p9_raw = p9_raw.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
    new_pages.append(p9_raw)

    # =========================================================================
    # PAGE 10: Supervisor (Cont.) & Employee Matrix (with EMP-09 & EMP-10)
    # =========================================================================
    p10_raw = str(original_pages[9])
    emp_rows = """
            <tr>
                <td><code>EMP-09</code></td>
                <td><strong>Special Statutory Leave Filing &amp; Proof Upload</strong><br>Open <code>/requests</code> &rarr; File Request</td>
                <td>Select Special Statutory Leave (Solo Parent / VAWC / Magna Carta for Women). Attach required legal verification document (PDF/PNG). Submit request.</td>
                <td>Request status marked as Pending Supervisor. Attached document securely stored under encrypted storage root path. DTR flags date as pending leave.</td>
                <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
            </tr>
            <tr>
                <td><code>EMP-10</code></td>
                <td><strong>Employee Maxicare HMO Benefit Card</strong><br>Open URL: <code>/employee/maxicare</code></td>
                <td>Employee opens healthcare benefit tab. Inspect active policy status, covered dependents list, annual policy limit, and semi-monthly employee payroll deduction ledger.</td>
                <td>Renders verified Maxicare card details with active policy dates. Semi-monthly deduction history matches payslip deductions cleanly.</td>
                <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
            </tr>
    """
    p10_raw = p10_raw.replace("</tbody>\n    </table>\n\n    <div class=\"footer-bar\">", f"{emp_rows}\n</tbody>\n    </table>\n\n    <div class=\"footer-bar\">")
    p10_raw = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(10), p10_raw, flags=re.DOTALL)
    p10_raw = p10_raw.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
    new_pages.append(p10_raw)

    # =========================================================================
    # PAGE 11: Employee (Cont.) & Admin Accountant (ACC-01 to ACC-04)
    # Remove Night Diff from ACC-02
    # =========================================================================
    p11_raw = str(original_pages[10])
    p11_raw = p11_raw.replace("Night Diff, ", "")
    p11_raw = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(11), p11_raw, flags=re.DOTALL)
    p11_raw = p11_raw.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
    new_pages.append(p11_raw)

    # =========================================================================
    # PAGE 12: Admin Accountant (Cont.) — Commercial Loans, Cash Advances, Maxicare & Shortfall Hierarchy
    # =========================================================================
    p12 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 4: Closed-Loop Role Matrices &amp; Situational Workflows (Cont.)</h2>
            <span class="badge">Part 4.4: Admin Accountant &mdash; Maxicare HMO, Bank Loans, Advances &amp; Shortfall Priority</span>
        </div>

        <div class="subsection-title">Part 4.4: Admin Accountant (Cont.) &mdash; Commercial Amortizations, HMO &amp; Shortfall Protection</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 8%;">ID</th>
                    <th style="width: 22%;">Action / Test Target</th>
                    <th style="width: 36%;">Expected System Behavior</th>
                    <th style="width: 26%;">Cross-Module Ripple &amp; Notes</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>ACC-08</code></td>
                    <td><strong>Maxicare HMO Healthcare Ledger</strong><br>Open URL: <code>/payroll</code> &rarr; Maxicare Tab</td>
                    <td>Audit group healthcare policy (Gross: &#8369;26,922.28; 24 cutoffs). Enroll employee with &#8369;560.88/cutoff employee share. Generate batch payroll. Confirm HMO deduction posts post-tax without reducing taxable income.</td>
                    <td>Batch release updates <code>Maxicare_History</code> ledger. Employee payslip receipt itemizes exact &#8369;560.88 healthcare deduction.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>ACC-09</code></td>
                    <td><strong>EastWest Bank Loan Ledger &amp; DO 195 Consent</strong><br>Open URL: <code>/payroll</code> &rarr; EastwestLoan Tab</td>
                    <td>Enroll commercial bank loan (Principal: &#8369;24,000; Amortization: &#8369;1,000/cutoff). Verify employee's signed DOLE DO 195 written deduction authorization attachment. Releasing batch decrements remaining balance to &#8369;23,000.</td>
                    <td>AuditLog writes confirmation of signed consent. Amortization posts to <code>Eastwest_Loans</code> ledger independently of government agency loans.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>ACC-10</code></td>
                    <td><strong>Company Cash Advances &amp; Voucher Settlement</strong><br>Open URL: <code>/payroll</code> &rarr; Cashadvances Tab</td>
                    <td>Review approved internal cash advance voucher (&#8369;2,000.00; 4 installments at &#8369;500.00/cutoff). Release payroll batch. Verify &#8369;500.00 installment deducts and advance balance updates to &#8369;1,500.00.</td>
                    <td>Maintains company emergency loan ledger. Generates printable cash voucher settlement receipt.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>ACC-11</code></td>
                    <td><strong>Negative Net Pay Prevention &amp; Shortfall Priority</strong><br>Open URL: <code>/payrollDetails/:id</code></td>
                    <td>Simulate high-absence employee with gross pay &#8369;1,830.00 and scheduled deductions totaling &#8369;3,335.88. Verify legal priority enforcement: Statutory (&#8369;775.00) &rarr; Tax (&#8369;0.00) &rarr; SSS Loan (&#8369;500.00) &rarr; Maxicare partial (&#8369;555.00). Bank loan and cash advance are deferred.</td>
                    <td>Net pay clamps strictly to &#8369;0.00 (NEVER negative). Computation card displays amber Shortfall Warning. Rollover balances log in <code>LoanDeductionHistory</code>.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
            </tbody>
        </table>
        {make_footer(12)}
    </div>
    """
    new_pages.append(p12)

    # =========================================================================
    # PAGE 13: Admin Accountant (Cont. ACC-05 to 07) & Section 5 Baseline Constants
    # Remove Night Differential from Section 5 Constants!
    # =========================================================================
    p13 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 4 (Cont.) &amp; Section 5: Statutory Benefits &amp; Payroll Mathematical Matrix</h2>
            <span class="badge">Part 4.4 (Cont.) &amp; Section 5 Mathematical Formulas</span>
        </div>

        <div class="subsection-title">Part 4.4: Admin Accountant (Cont.) &mdash; Statutory Year-End &amp; Severance Benefits</div>
        <table class="qa-table" style="margin-bottom: 2mm;">
            <thead>
                <tr>
                    <th style="width: 8%;">ID</th>
                    <th style="width: 22%;">Action / Test Target</th>
                    <th style="width: 36%;">Expected System Behavior</th>
                    <th style="width: 26%;">Cross-Module Ripple &amp; Notes</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>ACC-05</code></td>
                    <td><strong>13th Month Pay Accrual</strong><br>Open URL: <code>/thirteenth-month</code></td>
                    <td>Formula: <code>Sum(Basic Salaries) / 12</code>. Displays accrued basic salaries month by month. Excludes OT and non-basic allowances.</td>
                    <td>Presidential Decree No. 851 compliance. Tax-exempt up to &#8369;90,000.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>ACC-06</code></td>
                    <td><strong>Separation Pay (Authorized Cause)</strong><br>Open URL: <code>/separation-pay</code></td>
                    <td>Retrenchment/Closure: 0.5 mo/yr (fraction &ge;6 mos rounds up to 1 yr); Redundancy: 1.0 mo/yr. Leave encashment and prorated 13th added.</td>
                    <td>DOLE Labor Code Art. 298 (283) compliance. Generates final settlement voucher.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>ACC-07</code></td>
                    <td><strong>Retirement Pay (RA 7641)</strong><br>Open URL: <code>/retirement-pay</code></td>
                    <td>Statutory 22.5-day multiplier: <code>(Daily Rate &times; 22.5) &times; Years of Service</code> (15d basic + 5d SIL + 2.5d 13th month).</td>
                    <td>Evaluates senior staff &ge;60 y/o with &ge;5 yrs service. Deducts outstanding loan balances.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
            </tbody>
        </table>

        <div class="section-title-bar" style="margin-top: 1mm;">
            <h2>Section 5: Master Payroll Mathematical Scenarios &mdash; Baseline &amp; Constants</h2>
            <span class="badge">Philippine Peso Centavo-Accurate Mathematical Proofs</span>
        </div>

        <div class="row">
            <div class="col-6">
                <div class="info-card">
                    <strong>Baseline Persona Rate Parameters (Juan Dela Cruz &mdash; MACJ-1003):</strong>
                    <ul style="margin: 0.6mm 0 0 3mm; list-style-type: square; font-size: 6.6pt; line-height: 1.3;">
                        <li><strong>Live Daily Rate:</strong> &#8369;610.00 (NCR Prevailing Daily Minimum Wage Floor)</li>
                        <li><strong>Hourly Rate:</strong> &#8369;610.00 / 8 = &#8369;76.25</li>
                        <li><strong>Minute Rate:</strong> &#8369;76.25 / 60 = &#8369;1.27083</li>
                        <li><strong>Regular Overtime Premium Rate (125%):</strong> 1.25 &times; &#8369;76.25 = &#8369;95.3125 / hr</li>
                        <li><strong>Scheduled Workday Hours:</strong> 8.0 Regular Hours per workday (08:30 &ndash; 17:30)</li>
                    </ul>
                </div>
            </div>
            <div class="col-6">
                <div class="info-card">
                    <strong>Legal Deduction Priority Hierarchy &amp; Net Pay Non-Negativity:</strong>
                    <ol style="margin: 0.6mm 0 0 3mm; font-size: 6.6pt; line-height: 1.3;">
                        <li><strong>Priority 1:</strong> Mandatory Statutory Contributions (SSS, PhilHealth, Pag-IBIG)</li>
                        <li><strong>Priority 2:</strong> Withholding Tax on Compensation (BIR TRAIN Law Table)</li>
                        <li><strong>Priority 3:</strong> Government Agency Loans (SSS Salary/Calamity, Pag-IBIG MPL)</li>
                        <li><strong>Priority 4:</strong> Corporate Healthcare HMO (Maxicare Employee Share)</li>
                        <li><strong>Priority 5:</strong> Commercial Bank Loans (EastWest Bank DO 195 Authorized)</li>
                        <li><strong>Priority 6:</strong> Company Cash Advances &amp; Internal Vouchers</li>
                    </ol>
                    <div style="margin-top: 0.6mm; font-size: 6.3pt; color: #0C4A6E; font-weight: 600;">
                        Rule: Net Pay must NEVER be negative (&ge; &#8369;0.00). Uncollected low-priority debts automatically rollover.
                    </div>
                </div>
            </div>
        </div>
        {make_footer(13)}
    </div>
    """
    new_pages.append(p13)

    # =========================================================================
    # PAGES 14 to 17: SCEN-01 to SCEN-19
    # =========================================================================
    for idx, orig_p_idx in enumerate([12, 13, 14, 15]):
        p_num = 14 + idx
        raw_p = str(original_pages[orig_p_idx])
        raw_p = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(p_num), raw_p, flags=re.DOTALL)
        raw_p = raw_p.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
        new_pages.append(raw_p)

    # =========================================================================
    # PAGE 18: NEW DEDICATED PAGE — SCEN-20 to SCEN-24
    # Special Statutory Leaves, Maxicare HMO, Multi-Loan Stack & Net Pay Shortfall
    # =========================================================================
    p18 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 5: Master Payroll Mathematical Scenarios (Cont.)</h2>
            <span class="badge">Scenarios SCEN-20 to SCEN-24 &mdash; Statutory Leaves, Maxicare, Multi-Loan &amp; Shortfall Priority</span>
        </div>

        <div class="subsection-title">Scenarios SCEN-20 to SCEN-24 &mdash; Special Statutory Leaves, HMO, Multi-Loan Stack &amp; Shortfall Protection</div>
        <table class="qa-table">
            <thead>
                <tr>
                    <th style="width: 7%;">ID</th>
                    <th style="width: 22%;">Scenario &amp; Parameters</th>
                    <th style="width: 37%;">Mathematical Calculation &amp; Expected Result</th>
                    <th style="width: 26%;">DTR Display &amp; Cross-Module Ripple</th>
                    <th style="width: 8%;">Evaluation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>SCEN-20</code></td>
                    <td><strong>Special Statutory Leave (With Pay)</strong><br>Solo Parent (RA 8972) or VAWC Leave (RA 9262) for 1 full workday.</td>
                    <td>1 day Special Leave credits 8.0 payable regular hours. Regular Pay: 1.0 &times; &#8369;610.00 = <strong>&#8369;610.00</strong>. Absence Penalty: &#8369;0.00. Salary docked: &#8369;0.00. Leave balance decrements from 7.0 to 6.0.</td>
                    <td>Status: <code>On Leave</code>. DTR spans 4 columns <code>SPECIAL LEAVE (PAID)</code> with 8h 0m total. Document audit logs verifier ID.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>SCEN-21</code></td>
                    <td><strong>Maxicare HMO Multi-Tier Payroll Deduction</strong><br>Annual Policy: &#8369;26,922.28; 24 Cutoffs. 50% Company / 50% Employee split.</td>
                    <td>Gross Cutoff Premium: &#8369;26,922.28 / 24 = &#8369;1,121.76. Company Subsidy: &#8369;560.88. Employee Cutoff Deduction: <strong>&#8369;560.88</strong>. Post-tax deduction (does NOT reduce taxable base).</td>
                    <td>Payslip displays itemized &#8369;560.88 Maxicare deduction. Amortization history logs to <code>Maxicare_History</code> with policy validity dates.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>SCEN-22</code></td>
                    <td><strong>Multi-Loan Stack Execution</strong><br>Simultaneous deductions: SSS Loan (&#8369;500.00) + EastWest Bank (&#8369;1,000.00) + Cash Advance (&#8369;500.00).</td>
                    <td>Total Loan Deductions: &#8369;500 + &#8369;1,000 + &#8369;500 = <strong>&#8369;2,000.00</strong>. Evaluated post-statutory &amp; post-tax. Ledgers decrement simultaneously upon batch release.</td>
                    <td>Releasing batch decrements balances in <code>LoanDeductionHistory</code>, <code>Eastwest_Loans</code>, and <code>Cash_Advances</code> concurrently with zero collision.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>SCEN-23</code></td>
                    <td><strong>Negative Net Pay Prevention &amp; Shortfall Priority</strong><br>Worked 3 days (Gross: &#8369;1,830.00); 10 days unexcused absence. Scheduled deductions: &#8369;3,335.88.</td>
                    <td>Priority execution: Statutory &#8369;775.00 deducted (Remaining: &#8369;1,055.00) &rarr; Tax &#8369;0.00 &rarr; SSS Loan &#8369;500.00 deducted (Remaining: &#8369;555.00) &rarr; Maxicare &#8369;555.00 partial (Remaining: &#8369;0.00). Bank loan &amp; Cash advance rolled over. Net Pay = <strong>&#8369;0.00</strong>.</td>
                    <td>Net Pay clamps strictly to &#8369;0.00 (NEVER negative). Computation card shows amber Shortfall Warning. Uncollected debts log as <code>ROLLED_OVER</code>.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
                <tr>
                    <td><code>SCEN-24</code></td>
                    <td><strong>Redundancy vs Retrenchment Separation Pay</strong><br>Tenure: 3 Yrs, 7 Mos (Rounds to 4 Yrs). Monthly Basic: &#8369;15,860.00. Cause: Redundancy.</td>
                    <td>DOLE Art. 298 (283) Mandate: Redundancy = 1.0 mo/yr (vs 0.5 mo/yr for Retrenchment). Separation Pay = 4 &times; (1.0 &times; &#8369;15,860.00) = <strong>&#8369;63,440.00</strong>. Leave encashment and pro-rated 13th added.</td>
                    <td>Separation pay voucher displays Redundancy cause multiplier (1.0). Net settlement voucher itemizes severance package without statutory deductions.</td>
                    <td class="eval-cell"><span class="eval-box"></span>PASS<br><span class="eval-box"></span>FAIL<br><span class="defect-line">Notes:</span></td>
                </tr>
            </tbody>
        </table>
        {make_footer(18)}
    </div>
    """
    new_pages.append(p18)

    # =========================================================================
    # PAGES 19 to 20: DevTools & Zero-Trust RBAC (Original Pages 17 & 18)
    # =========================================================================
    for idx, orig_p_idx in enumerate([16, 17]):
        p_num = 19 + idx
        raw_p = str(original_pages[orig_p_idx])
        raw_p = re.sub(r'<div class="footer-bar">.*?</div>', make_footer(p_num), raw_p, flags=re.DOTALL)
        raw_p = raw_p.replace("MACJ-QA-MAN-2026-V2", "MACJ-QA-MAN-2026-V3")
        new_pages.append(raw_p)

    # =========================================================================
    # PAGE 21: Section 7: PostgreSQL Database Integrity & Verification Queries (Enhanced)
    # =========================================================================
    p21 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 7: PostgreSQL Database Integrity &amp; Verification Queries (Cont.)</h2>
            <span class="badge">Exact Executable SQL Audit Scripts &amp; State Assertions</span>
        </div>

        <p class="intro-desc">
            Evaluators must execute the following copy-pasteable SQL queries in <code>psql</code> or pgAdmin to confirm that frontend mutations persist correctly in PostgreSQL without data corruption, cascading deletions, or unhandled debt rollovers.
        </p>

        <div class="row">
            <div class="col-6">
                <div class="subsection-title">7.1 Paranoid Soft Delete &amp; Historical Record Preservation</div>
                <pre class="cli-box"><code><span class="comment">-- 1. Verify user soft delete (deletedAt populated, row preserved):</span>
SELECT id, "first_Name", "last_Name", "deletedAt" FROM "Users" WHERE id = 1003;
<span class="comment">-- Expected: 1 row returned | id: 1003 | deletedAt: NOT NULL</span>

<span class="comment">-- 2. Verify linked records are completely untouched (zero-cascade mandate):</span>
SELECT COUNT(*) FROM "user_logging" WHERE "userId" = 1003;
SELECT COUNT(*) FROM "Payroll" WHERE "userId" = 1003;
<span class="comment">-- Expected: Counts strictly match pre-archive values (&gt; 0).</span></code></pre>

                <div class="subsection-title">7.2 AES-256-GCM Banking &amp; Blind Indexes</div>
                <pre class="cli-box"><code><span class="comment">-- Confirm bank accounts encrypted; blind index populated:</span>
SELECT "userId", "account_Number", "account_Number_bidx" 
FROM "User_Banking" WHERE "userId" = 1003;
<span class="comment">-- Expected: account_Number has format "iv:authTag:ciphertext" (64+ chars).
-- account_Number_bidx contains deterministic 64-character SHA-256 hash.</span></code></pre>

                <div class="subsection-title">7.3 Cryptographic Audit Hash-Chaining Verification</div>
                <pre class="cli-box"><code><span class="comment">-- Verify tamper-evident append-only hash chain:</span>
SELECT id, "actionType", "recordId", "currentHash", "previousHash" 
FROM "AuditLog" ORDER BY id DESC LIMIT 5;
<span class="comment">-- Expected: Every row's previousHash strictly matches predecessor's currentHash.</span></code></pre>
            </div>

            <div class="col-6">
                <div class="subsection-title">7.4 Maxicare HMO Active Enrollment &amp; Deduction Ledger</div>
                <pre class="cli-box"><code><span class="comment">-- Verify active healthcare enrollment and amortization ledger:</span>
SELECT "userId", "policyNumber", "totalGross", "monthlyAmortization", "isActive"
FROM "Maxicare_Enrollment" WHERE "userId" = 1003;
SELECT "userId", "payrollId", "deductedAmount", "remainingBalance"
FROM "Maxicare_History" WHERE "userId" = 1003 ORDER BY id DESC LIMIT 3;
<span class="comment">-- Expected: isActive = true | deductedAmount = 560.88.</span></code></pre>

                <div class="subsection-title">7.5 Commercial Bank Loans (EastWest) &amp; Cash Advances</div>
                <pre class="cli-box"><code><span class="comment">-- Verify EastWest loan balance and Cash Advance tracking:</span>
SELECT "userId", "bankName", "principalAmount", "remainingBalance" 
FROM "Eastwest_Loans" WHERE "userId" = 1003;
SELECT "userId", "voucherNo", "advanceAmount", "status"
FROM "Cash_Advances" WHERE "userId" = 1003;
<span class="comment">-- Expected: Balances decrement cleanly upon payroll batch release.</span></code></pre>

                <div class="subsection-title">7.6 Loan Shortfall &amp; Rollover Status Assertion</div>
                <pre class="cli-box"><code><span class="comment">-- Verify net pay non-negativity and debt rollover logging:</span>
SELECT "userId", "payrollId", "scheduledAmount", "deductedAmount", "status"
FROM "LoanDeductionHistory" WHERE "status" IN ('SHORTFALL', 'ROLLED_OVER');
<span class="comment">-- Expected: Status = 'ROLLED_OVER' for uncollected debt; net pay &gt;= 0.00.</span></code></pre>
            </div>
        </div>
        {make_footer(21)}
    </div>
    """
    new_pages.append(p21)

    # =========================================================================
    # PAGE 22: Section 8: Formal Evaluation Scorecard, Defect Tally & Defense Sign-Off
    # =========================================================================
    p22 = f"""
    <div class="page">
        {make_header()}
        <div class="section-title-bar">
            <h2>Section 8: Formal Evaluation Scorecard, Defect Tally &amp; Defense Sign-Off</h2>
            <span class="badge">Official Capstone Defense Evaluation Rubric</span>
        </div>

        <div class="row">
            <div class="col-8">
                <div class="subsection-title">8.1 Module-by-Module Evaluation Summary Table</div>
                <table class="qa-table" style="margin-bottom: 2mm;">
                    <thead>
                        <tr>
                            <th style="width: 32%;">Evaluation Module</th>
                            <th style="width: 14%;">Total Cases</th>
                            <th style="width: 14%;">Passed [ &radic; ]</th>
                            <th style="width: 14%;">Failed [ X ]</th>
                            <th style="width: 13%;">Blocked [ &minus; ]</th>
                            <th style="width: 13%;">Pass Rate (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><strong>1. Usability &amp; UI/UX Standards</strong></td><td>10</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr><td><strong>2. Form &amp; Input Validation Matrix</strong></td><td>32</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr><td><strong>3. Closed-Loop Role Matrices</strong></td><td>32</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr><td><strong>4. Master Payroll Calculations</strong></td><td>24</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr><td><strong>5. DevTools &amp; API Security</strong></td><td>11</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr><td><strong>6. Database Integrity &amp; ACID Safety</strong></td><td>11</td><td>_____</td><td>_____</td><td>_____</td><td>_____%</td></tr>
                        <tr style="background-color: #E2E8F0; font-weight: 700;">
                            <td><strong>TOTAL SYSTEM EVALUATION:</strong></td><td><strong>120</strong></td><td><strong>_____</strong></td><td><strong>_____</strong></td><td><strong>_____</strong></td><td><strong>_____%</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="col-4">
                <div class="subsection-title">8.2 Defect Severity Classification</div>
                <div class="info-card" style="font-size: 6.6pt; line-height: 1.32;">
                    <strong>Defect Severity Definitions:</strong><br>
                    &bull; <strong>Sev 1 (Blocker):</strong> System crash, data loss, or payroll math corruption.<br>
                    &bull; <strong>Sev 2 (Critical):</strong> Role privilege leak, broken approval workflow.<br>
                    &bull; <strong>Sev 3 (Major):</strong> Validation bypass, formatting distortion.<br>
                    &bull; <strong>Sev 4 (Minor):</strong> UI alignment defect, typo in toast label.<br>
                    &bull; <strong>Sev 5 (Trivial):</strong> Cosmetic enhancement suggestion.
                </div>
            </div>
        </div>

        <div class="subsection-title">8.3 Defect Logging Ledger (Write-in Space)</div>
        <table class="qa-table" style="margin-bottom: 2mm;">
            <thead>
                <tr>
                    <th style="width: 10%;">Defect ID</th>
                    <th style="width: 16%;">Target Section</th>
                    <th style="width: 42%;">Observed Anomaly / Symptom Description</th>
                    <th style="width: 12%;">Severity</th>
                    <th style="width: 20%;">Resolution Sign-off</th>
                </tr>
            </thead>
            <tbody>
                <tr><td><code>DEF-01</code></td><td>________________</td><td>____________________________________________________________________</td><td>Sev: ___</td><td>[ ] Fixed  Date: _______</td></tr>
                <tr><td><code>DEF-02</code></td><td>________________</td><td>____________________________________________________________________</td><td>Sev: ___</td><td>[ ] Fixed  Date: _______</td></tr>
            </tbody>
        </table>

        <div class="subsection-title">8.4 Formal Academic Defense &amp; Operational Commissioning Endorsement</div>
        <div class="row">
            <div class="col-4">
                <div class="sign-box">
                    <strong>Lead Systems Developer / QA Lead</strong>
                    <div>MAChip Quality Assurance Team</div>
                    <div class="sign-line"></div>
                    <div><strong>MAChip QA &amp; Engineering Team</strong></div>
                    <div>Quality Assurance &amp; Technical Audit Group</div>
                    <div>Polytechnic University of the Philippines (BSIT 2026)</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
            <div class="col-4">
                <div class="sign-box">
                    <strong>Project Owner &amp; Logistics Director</strong>
                    <div>MAC-J Int'l Forwarding Ltd., Co.</div>
                    <div class="sign-line"></div>
                    <div><strong>Operations Directorate</strong></div>
                    <div>CTPAT Cargo Security Office</div>
                    <div>MAC-J Int'l Forwarding Ltd., Co.</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
            <div class="col-4">
                <div class="sign-box">
                    <strong>Capstone Defense Lead Evaluator</strong>
                    <div>PUP CCIS Academic Panel</div>
                    <div class="sign-line"></div>
                    <div><strong>Lead Evaluator / Panel Member</strong></div>
                    <div>Department of Information Technology</div>
                    <div>Polytechnic University of the Philippines</div>
                    <div style="margin-top: 0.8mm;">Date: ________________________</div>
                </div>
            </div>
        </div>
        {make_footer(22)}
    </div>
    """
    new_pages.append(p22)

    # Assemble complete HTML
    # Grab head and style from original
    head_content = str(soup.find("head"))
    complete_html = f"""<!DOCTYPE html>
<html lang="en">
{head_content}
<body>
{"".join(new_pages)}
</body>
</html>
"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(complete_html)

    print(f"Successfully wrote updated HTML with {len(new_pages)} pages to: {html_path}")

    # Compile with Puppeteer
    print("Compiling PDF with Puppeteer...")
    render_script = f"""
    const puppeteer = require('{root_dir}/backend/node_modules/puppeteer');
    (async () => {{
      const browser = await puppeteer.launch({{
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }});
      const page = await browser.newPage();
      await page.goto('file://{html_path}', {{ waitUntil: 'networkidle0' }});
      await page.pdf({{
        path: '{pdf_path}',
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true
      }});
      await browser.close();
      console.log('PDF compilation finished.');
    }})();
    """
    proc = subprocess.run(["node", "-e", render_script], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print("Puppeteer Error:", proc.stderr)
        sys.exit(1)
    
    print(proc.stdout)
    file_size_kb = os.path.getsize(pdf_path) / 1024.0
    print(f"Rendered PDF successfully: {pdf_path} ({file_size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
