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
      console.log(`[EMAIL QUEUE] Enqueued email for ${data.email}`);
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

  const mailOptions = {
    from: `"MaChip Payroll" <${EMAIL_USER}>`,
    to: email,
    subject: `Payroll Summary for Period: ${period}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">Payroll Notification</h2>
        <p>Hello ${name},</p>
        <p>This is your net pay for this period (<strong>${period}</strong>):</p>
        <div style="background: #eef9f1; padding: 20px; border-radius: 8px; border: 1px solid #c3e6cb; display: inline-block;">
          <span style="font-size: 24px; font-weight: bold; color: #28a745;">₱${parseFloat(netPay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <p style="margin-top: 20px;">For your security, your attached payslip is <strong>password-protected</strong>. To open the file, please use the following password format:</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeeba; margin-bottom: 20px;">
          <p style="margin: 5px 0; color: #856404;"><strong>Password Format:</strong> [PeriodDigits][Month][LastName][PaddedID]</p>
          <p style="margin: 5px 0; color: #856404; font-size: 0.9em;">Example: If the period is May 1-15, name is <strong>Rodrigo</strong>, and ID is <strong>MACJ-001</strong>, your password is: <strong>0115MayRodrigo001</strong></p>
        </div>
        <p>Attached is your official payslip PDF. You can also view your full records by logging into the MaChip portal.</p>
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


