/**
 * Generates a standardized password for payslip PDF protection.
 * Format: {period_digits}{MonthName}{LastName}{User_Id}
 * Example: 0115MayDoe1001
 * 
 * @param {Object} payroll - Payroll object containing necessary fields
 * @returns {string} - The generated password
 */
exports.generatePayslipPassword = (payroll) => {
  const { period_Start, period_End, user_LastName, user_Id } = payroll;

  // Use UTC to ensure consistency regardless of server timezone
  const startDate = new Date(period_Start + "T00:00:00Z");
  const endDate = new Date(period_End + "T00:00:00Z");

  // 1. Get period digits (e.g., "0115")
  const startDay = startDate.getUTCDate().toString().padStart(2, '0');
  const endDay = endDate.getUTCDate().toString().padStart(2, '0');
  const periodDigits = `${startDay}${endDay}`;

  // 2. Get Month Name (e.g., "May")
  const monthName = startDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  // 3. Get Last Name (Sanitized: Title case or preserved camel/mixed case, no spaces)
  const lastName = (user_LastName || "").trim().split(' ')[0];
  let capitalizedLastName = "";
  if (lastName) {
    if (lastName === lastName.toUpperCase()) {
      // If ALL CAPS like "DOE", normalize to Titlecase
      capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    } else {
      // Preserve existing mixed case (e.g. "McQuack", "DeGuzman")
      capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
    }
  }

  // 4. User ID (Padded to 3 digits to match MACJ-001 format)
  const id = String(user_Id).padStart(3, '0');

  return `${periodDigits}${monthName}${capitalizedLastName}${id}`;
};
