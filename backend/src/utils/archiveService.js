const { sequelize, System_State } = require("../config/sequelize");
const { QueryTypes } = require("sequelize");
const puppeteer = require("puppeteer");
const { saveFileToArchive } = require("./fileStorage");
const { getSystemTime } = require("./systemTime");

/**
 * Automatically archives Audit and Transaction logs to PDF.
 * Typically triggered at the start of a new month for the previous month's data.
 */

const getMonthName = (monthIndex) => {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return months[monthIndex];
};

const formatMonthFolder = (monthIndex) => {
    return `${String(monthIndex + 1).padStart(2, '0')}_${getMonthName(monthIndex)}`;
};

/**
 * Builds HTML for Audit Logs
 */
const buildAuditLogHTML = (logs, monthName, year) => {
    return `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { color: #2A174E; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .meta { text-align: center; margin-bottom: 20px; color: #666; }
        </style>
    </head>
    <body>
        <h1>Audit Log Report</h1>
        <div class="meta">Archive for ${monthName} ${year}</div>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Target ID</th>
                    <th>Date</th>
                    <th>IP Address</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${log.auditId}</td>
                        <td>${log.user_FirstName} ${log.user_LastName}</td>
                        <td>${log.module}</td>
                        <td>${log.action}</td>
                        <td>${log.target_Table}</td>
                        <td>${log.target_Id}</td>
                        <td>${new Date(log.createdAt).toLocaleString()}</td>
                        <td>${log.ip_Address}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
};

/**
 * Builds HTML for Transaction Logs
 */
const buildTransactionLogHTML = (logs, monthName, year) => {
    return `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { color: #2A174E; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .meta { text-align: center; margin-bottom: 20px; color: #666; }
        </style>
    </head>
    <body>
        <h1>Transaction Log Report</h1>
        <div class="meta">Archive for ${monthName} ${year}</div>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>User (Target)</th>
                    <th>Initiated By</th>
                    <th>Event Type</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>IP Address</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${log.transId}</td>
                        <td>${log.emp_FirstName ? log.emp_FirstName + ' ' + log.emp_LastName : 'N/A'}</td>
                        <td>${log.admin_FirstName ? log.admin_FirstName + ' ' + log.admin_LastName : 'System'}</td>
                        <td>${log.event_Type}</td>
                        <td>${log.description}</td>
                        <td>${new Date(log.createdAt).toLocaleString()}</td>
                        <td>${log.ip_Address}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
};

const generatePDF = async (html) => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        return await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } });
    } finally {
        await browser.close();
    }
};

/**
 * Performs the archival of logs for a specific month and year.
 */
const performArchival = async (year, monthIndex) => {
    const monthName = getMonthName(monthIndex);
    const monthFolder = formatMonthFolder(monthIndex);
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    console.log(`[ARCHIVE] Starting archival for ${monthName} ${year}...`);

    try {
        // 1. Fetch Audit Logs
        const auditLogs = await sequelize.query(
            `SELECT a.*, u."user_FirstName", u."user_LastName"
             FROM "Audit_Log" a
             LEFT JOIN "User" u ON u."user_Id" = a."user_Id"
             WHERE a."createdAt" BETWEEN :startDate AND :endDate
             ORDER BY a."createdAt" ASC`,
            { replacements: { startDate, endDate }, type: QueryTypes.SELECT }
        );

        if (auditLogs.length > 0) {
            const auditHTML = buildAuditLogHTML(auditLogs, monthName, year);
            const auditPDF = await generatePDF(auditHTML);
            await saveFileToArchive(auditPDF, `Audit_Logs_${monthName}_${year}.pdf`, { year, month: monthFolder });
        }

        // 2. Fetch Transaction Logs
        const transLogs = await sequelize.query(
            `SELECT t.*, u."user_FirstName" AS "emp_FirstName", u."user_LastName" AS "emp_LastName",
                    a."user_FirstName" AS "admin_FirstName", a."user_LastName" AS "admin_LastName"
             FROM "Transaction_Log" t
             LEFT JOIN "User" u ON u."user_Id" = t."user_Id"
             LEFT JOIN "User" a ON a."user_Id" = t."initiated_By"
             WHERE t."createdAt" BETWEEN :startDate AND :endDate
             ORDER BY t."createdAt" ASC`,
            { replacements: { startDate, endDate }, type: QueryTypes.SELECT }
        );

        if (transLogs.length > 0) {
            const transHTML = buildTransactionLogHTML(transLogs, monthName, year);
            const transPDF = await generatePDF(transHTML);
            await saveFileToArchive(transPDF, `Transaction_Logs_${monthName}_${year}.pdf`, { year, month: monthFolder });
        }

        console.log(`[ARCHIVE] Archival complete for ${monthName} ${year}.`);
        return true;
    } catch (error) {
        console.error(`[ARCHIVE ERROR] Failed to archive ${monthName} ${year}:`, error.message);
        return false;
    }
};

/**
 * Checks if archival is needed and triggers it.
 * Should be called periodically.
 */
exports.checkAndTriggerArchival = async () => {
    try {
        const now = await getSystemTime();
        // Archive the PREVIOUS month if we are in a new month
        const targetDate = new Date(now);
        targetDate.setMonth(targetDate.getMonth() - 1); // Go back one month
        
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        const archiveKey = `ARCHIVE_DONE_${targetYear}_${String(targetMonth + 1).padStart(2, '0')}`;

        const [state, created] = await System_State.findOrCreate({
            where: { key: archiveKey },
            defaults: { value: 'false' }
        });

        if (state.value === 'false') {
            const success = await performArchival(targetYear, targetMonth);
            if (success) {
                await state.update({ value: 'true' });
            }
        }
    } catch (error) {
        console.error("[ARCHIVE SERVICE] checkAndTriggerArchival failed:", error.message);
    }
};
