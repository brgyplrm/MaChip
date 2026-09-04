const nodemailer = require("nodemailer");
const dns = require("dns").promises;
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Validates if the email format is correct.
 * DNS MX lookup is removed to ensure instant registration speed.
 */
exports.validateEmailActive = async (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format.");
  }
  return true;
};

// JSON Queue Path
const QUEUE_FILE = path.join(__dirname, "../../email_queue.json");

/**
 * Enqueues a failed email to a JSON file.
 */
const enqueueEmail = async (data) => {
  try {
    let queue = [];
    if (fs.existsSync(QUEUE_FILE)) {
      const content = fs.readFileSync(QUEUE_FILE, "utf8");
      queue = JSON.parse(content || "[]");
    }
    // Add unique entry (avoid duplicates for the same user/type)
    const exists = queue.find(item => item.email === data.email && item.displayId === data.displayId);
    if (!exists) {
      queue.push({ ...data, attempts: 0, createdAt: new Date() });
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
      console.log(`[EMAIL QUEUE] System is likely OFFLINE. Enqueued welcome email for ${data.email} (ID: ${data.displayId}). It will be sent automatically once online.`);
    }
  } catch (err) {
    console.error("[EMAIL QUEUE ERROR]:", err.message);
  }
};

/**
 * Internal helper to send emails without enqueuing on failure.
 */
const sendEmailInternal = async (mailOptions) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) throw new Error("Email credentials missing.");

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a welcome email with account details.
 */
exports.sendWelcomeEmail = async ({ email, password, name, displayId }) => {
  const { EMAIL_USER } = process.env;
  const mailOptions = {
    from: `"MaChip System" <${EMAIL_USER}>`,
    to: email,
    subject: "Welcome to MaChip - Your Account Details",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Welcome to MaChip, ${name}!</h2>
        <p>Your account has been successfully created. Here are your login details:</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #eee;">
          <p style="margin: 5px 0;"><strong>User ID:</strong> ${displayId}</p>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> <span style="color: #e74c3c;">${password}</span></p>
        </div>
        <p style="margin-top: 20px;">Please login to your account using these credentials.</p>
        <p style="font-size: 0.9em; color: #7f8c8d;"><em>Note: For security reasons, please change your password after your first login.</em></p>
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
  };

  try {
    await sendEmailInternal(mailOptions);
    console.log(`[EMAIL SENT] Welcome email sent to ${email}`);
  } catch (error) {
    console.error("[NODEMAILER ERROR]:", error.message);
    await enqueueEmail({ type: "WELCOME", email, password, name, displayId });
  }
};

/**
 * Periodically processes the email queue.
 */
exports.processEmailQueue = async () => {
  if (!fs.existsSync(QUEUE_FILE)) return;

  try {
    const content = fs.readFileSync(QUEUE_FILE, "utf8");
    let queue = JSON.parse(content || "[]");
    if (queue.length === 0) return;

    console.log(`[EMAIL QUEUE] Processing ${queue.length} pending emails...`);
    const remaining = [];
    const { EMAIL_USER } = process.env;

    for (const item of queue) {
      try {
        if (item.type === "WELCOME") {
          const mailOptions = {
            from: `"MaChip System" <${EMAIL_USER}>`,
            to: item.email,
            subject: "Welcome to MaChip - Your Account Details",
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #2c3e50;">Welcome to MaChip, ${item.name}!</h2>
                <p>Your account has been successfully created. Here are your login details:</p>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #eee;">
                  <p style="margin: 5px 0;"><strong>User ID:</strong> ${item.displayId}</p>
                  <p style="margin: 5px 0;"><strong>Name:</strong> ${item.name}</p>
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${item.email}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> <span style="color: #e74c3c;">${item.password}</span></p>
                </div>
                <p style="margin-top: 20px;">Please login to your account using these credentials.</p>
                <p style="font-size: 0.9em; color: #7f8c8d;"><em>Note: For security reasons, please change your password after your first login.</em></p>
                <br/>
                <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
              </div>
            `,
          };
          await sendEmailInternal(mailOptions);
          console.log(`[EMAIL QUEUE] Successfully sent pending email to ${item.email}`);
        }
      } catch (err) {
        console.error(`[EMAIL QUEUE] Failed to send to ${item.email}: ${err.message}`);
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts < 10) {
          remaining.push(item);
        } else {
          console.error(`[EMAIL QUEUE] Abandoning email for ${item.email} after 10 attempts.`);
        }
      }
    }

    if (remaining.length !== queue.length) {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(remaining, null, 2));
    }
  } catch (err) {
    console.error("[EMAIL QUEUE PROCESS ERROR]:", err.message);
  }
};

/**
 * Sends a payroll notification email with optional attachments.
 * @param {Object} payrollData
 * @param {string} payrollData.email
 * @param {string} payrollData.name
 * @param {string} payrollData.period
 * @param {number} payrollData.netPay
 * @param {Array}  payrollData.attachments
 */
exports.sendPayrollEmail = async ({ email, name, period, netPay, attachments = [] }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing EMAIL_USER or EMAIL_PASS in .env file.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const targetRecipient = (email && !email.endsWith('@machip.com') && email.includes('@')) ? email : EMAIL_USER;

  const mailOptions = {
    from: `"MaChip Payroll" <${EMAIL_USER}>`,
    to: targetRecipient,
    subject: `Payroll Summary for Period: ${period} (${name})`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Payroll Notification</h2>
        <p>Hello ${name},</p>
        <p>This is your net pay for this period (<strong>${period}</strong>):</p>
        <div style="background: #eef9f1; padding: 20px; border-radius: 8px; border: 1px solid #c3e6cb; display: inline-block;">
          <span style="font-size: 24px; font-weight: bold; color: #28a745;">₱${parseFloat(netPay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <p style="margin-top: 20px;">For your security, your attached payslips are <strong>password-protected</strong>. To open the files, please use the following password format:</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeeba; margin-bottom: 20px;">
          <p style="margin: 5px 0; color: #856404;"><strong>Password Format:</strong> [PeriodDigits][Month][LastName][PaddedID]</p>
          <p style="margin: 5px 0; color: #856404; font-size: 0.9em;">Example: If the period is May 1-15, name is <strong>Rodrigo</strong>, and ID is <strong>MACJ-001</strong>, your password is: <strong>0115MayRodrigo001</strong></p>
        </div>
        <p>Attached are your official payroll documents:</p>
        <ul>
          <li><strong>Standard Compliance Payslip</strong> (Summary view)</li>
          <li><strong>Detailed Computation Payslip</strong> (Full breakdown of metrics, allowances, & deductions)</li>
          <li><strong>Daily Time Record (DTR)</strong></li>
        </ul>
        <p>You can also view and download your full records anytime by logging into the MaChip employee portal.</p>
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
    attachments: attachments
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[PAYROLL EMAIL SENT] to ${email} for period ${period}`);
  } catch (error) {
    console.error(`[PAYROLL EMAIL ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends an Onfield Work assignment notification.
 * @param {Object} data 
 * @param {string} data.email
 * @param {string} data.name
 * @param {string} data.date
 * @param {string} data.destination
 * @param {number} data.noHrs
 */
exports.sendOnfieldEmail = async ({ email, name, date, destination, noHrs }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing credentials.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const mailOptions = {
    from: `"MaChip Assignments" <${EMAIL_USER}>`,
    to: email,
    subject: `Onfield Work Assignment - ${date}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Onfield Work Assignment</h2>
        <p>Hello ${name},</p>
        <p>You have been assigned to an onfield work on <strong>${date}</strong>.</p>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; border: 1px solid #cce5ff;">
          <p style="margin: 5px 0;"><strong>Destination:</strong> ${destination}</p>
          <p style="margin: 5px 0;"><strong>Estimated Hours:</strong> ${noHrs} hrs</p>
        </div>
        <p style="margin-top: 20px;">Please ensure to log your attendance accordingly and provide any required documentation upon completion.</p>
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[ONFIELD EMAIL SENT] to ${email}`);
  } catch (error) {
    console.error(`[ONFIELD EMAIL ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends a notification email when an admin updates a user's password.
 */
exports.sendPasswordUpdateEmail = async ({ email, newPassword, name }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing credentials.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const mailOptions = {
    from: `"MaChip Support" <${EMAIL_USER}>`,
    to: email,
    subject: "Security Alert: Password Updated",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Password Updated</h2>
        <p>Hello ${name},</p>
        <p>Your password has been updated by an administrator as per your request or for security purposes.</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeeba; color: #856404;">
          <p style="margin: 5px 0;"><strong>New Password:</strong> <span style="font-family: monospace; font-size: 1.2em;">${newPassword}</span></p>
        </div>
        <p style="margin-top: 20px;">If you did not expect this change, please contact the IT department immediately.</p>
        <p>Please login to your account using your new password.</p>
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[PASSWORD UPDATE EMAIL SENT] to ${email}`);
  } catch (error) {
    console.error(`[PASSWORD UPDATE EMAIL ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends a notification email when a request status is updated (Approved/Rejected/Returned).
 */
exports.sendRequestStatusEmail = async ({ email, name, requestType, status, dateStr, reason, withPayName }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing credentials.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  let statusColor = "#333";
  if (status.toLowerCase().includes("approve")) statusColor = "#28a745";
  else if (status.toLowerCase().includes("reject")) statusColor = "#dc3545";
  else if (status.toLowerCase().includes("return")) statusColor = "#fd7e14";

  const mailOptions = {
    from: `"MaChip System" <${EMAIL_USER}>`,
    to: email,
    subject: `Request Update: ${requestType} - ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Request Status Updated</h2>
        <p>Hello ${name},</p>
        <p>Your request for <strong>${requestType}</strong> has been updated to:</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0; border-left: 5px solid ${statusColor};">
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; font-size: 1.1em;">${status}</span></p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
          ${withPayName ? `<p style="margin: 5px 0;"><strong>Payment Status:</strong> ${withPayName}</p>` : ''}
          ${reason ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccc;"><strong>Admin Note:</strong><br/><em>"${reason}"</em></div>` : ''}
        </div>
        <p style="margin-top: 20px;">You can view the full details and history by logging into the MaChip portal.</p>
        ${status.toLowerCase().includes("return") ? '<p style="color: #fd7e14; font-weight: bold;">Please update the request as requested and resubmit for review.</p>' : ''}
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[STATUS EMAIL SENT] to ${email} - ${status}`);
  } catch (error) {
    console.error(`[STATUS EMAIL ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends a notification email to approvers for a new request.
 */
exports.sendRequestNotificationEmail = async ({ toEmail, approverName, requesterName, requestType, dateStr, duration, isEscalation = false }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing credentials.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const subject = isEscalation 
    ? `Escalation Notice: ${requestType} Pending Review - ${requesterName}`
    : `New Request for Review: ${requestType} - ${requesterName}`;

  const mailOptions = {
    from: `"MaChip System" <${EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">${isEscalation ? "Request Escalation Notice" : "New Request for Review"}</h2>
        <p>Hello ${approverName},</p>
        <p><strong>${requesterName}</strong> has submitted a <strong>${requestType}</strong> request that requires your attention.</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0; border-left: 5px solid #3498db;">
          <p style="margin: 5px 0;"><strong>Request Type:</strong> ${requestType}</p>
          <p style="margin: 5px 0;"><strong>Requester:</strong> ${requesterName}</p>
          <p style="margin: 5px 0;"><strong>Date/Period:</strong> ${dateStr}</p>
          ${duration ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${duration}</p>` : ''}
        </div>
        <p style="margin-top: 20px;">Please login to the MaChip portal to review and take action on this request.</p>
        <br/>
        <p>Best Regards,<br/><strong>MaChip Administration</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[NOTIFICATION EMAIL SENT] to ${toEmail} for ${requestType}`);
  } catch (error) {
    console.error(`[NOTIFICATION EMAIL ERROR] for ${toEmail}:`, error.message);
  }
};

/**
 * Sends a Notice of Termination email.
 */
exports.sendTerminationNoticeEmail = async ({ email, name, separationDate, cause, message }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return;

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const mailOptions = {
    from: `"MaChip HR" <${EMAIL_USER}>`,
    to: email,
    subject: "Notice of Termination of Employment",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #c0392b;">Notice of Termination</h2>
        <p>Dear ${name},</p>
        <p>We regret to inform you that your employment with MAC-J Int'l Forwarding Ltd., Co. will be terminated effective <strong>${separationDate}</strong>.</p>
        <div style="background: #fdf2f2; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Authorized Cause:</strong> ${cause}</p>
          <p style="margin: 5px 0;"><strong>Effective Date:</strong> ${separationDate}</p>
        </div>
        <p>${message || "Please coordinate with the HR department regarding your clearance and final settlement. As per DOLE guidelines, your final pay will be released within 30 days of your separation date, provided clearance is completed."}</p>
        <br/>
        <p>Best Regards,<br/><strong>HR Department</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[TERMINATION NOTICE SENT] to ${email}`);
  } catch (error) {
    console.error(`[TERMINATION NOTICE ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends a Notice of Rescission (Cancellation of Termination).
 */
exports.sendTerminationRescissionEmail = async ({ email, name }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return;

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const mailOptions = {
    from: `"MaChip HR" <${EMAIL_USER}>`,
    to: email,
    subject: "Notice of Rescission of Termination",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #27ae60;">Rescission of Termination Notice</h2>
        <p>Dear ${name},</p>
        <p>We are pleased to inform you that the previous notice of termination served to you has been <strong>rescinded</strong>. Your employment status remains <strong>Active</strong>.</p>
        <p>We look forward to your continued service with the company. If you have any questions, please contact the HR department.</p>
        <br/>
        <p>Best Regards,<br/><strong>HR Department</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[RESCISSION NOTICE SENT] to ${email}`);
  } catch (error) {
    console.error(`[RESCISSION NOTICE ERROR] for ${email}:`, error.message);
  }
};

/**
 * Sends a self-service password reset email with a secure time-limited link.
 */
exports.sendPasswordResetEmail = async ({ email, name, resetLink, expiresMinutes = 60 }) => {
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR]: Missing credentials in .env.");
    throw new Error("Email service is not configured.");
  }

  const cleanPass = (EMAIL_PASS || '').replace(/["']/g, '');

  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE || "gmail",
    auth: {
      user: EMAIL_USER,
      pass: cleanPass,
    },
  });

  const mailOptions = {
    from: `"MaChip Security" <${EMAIL_USER}>`,
    to: email,
    subject: "MaChip - Password Reset Request",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #2A174E; padding: 28px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">MAChip System</h1>
          <p style="color: #d8b4fe; margin: 6px 0 0 0; font-size: 13px;">Microchip Attendance & Chip Payroll</p>
        </div>
        
        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px 0;">Password Reset Request</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px;">Hello <strong>${name || 'Employee'}</strong>,</p>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">
            We received a request to reset the password for your MAChip portal account. Click the button below to set a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2A174E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 6px rgba(42, 23, 78, 0.3);">
              Reset My Password
            </a>
          </div>
          
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
            If the button above does not work, copy and paste the following link into your web browser:
          </p>
          <p style="margin: 0 0 24px 0; word-break: break-all; font-size: 11px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; color: #475569;">
            <a href="${resetLink}" style="color: #6366f1; text-decoration: underline;">${resetLink}</a>
          </p>
          
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
              <strong>Security Notice:</strong> This reset link will expire in <strong>${expiresMinutes} minutes</strong>. If you did not make this request, your account is still secure and you can ignore this email.
            </p>
          </div>
          
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            Best Regards,<br/>
            <strong>MAChip Administration & Security Team</strong>
          </p>
        </div>
        
        <div style="background: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">
            MAC-J Int'l Forwarding Ltd., Co. &bull; CTPAT Compliant System
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[PASSWORD RESET EMAIL SENT] to ${email}`);
};



