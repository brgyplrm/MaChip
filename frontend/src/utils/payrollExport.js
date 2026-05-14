import { saveAs } from "file-saver";
import { fetchWithAuth } from "./api";

/**
 * Batch exports all payrolls in the list to a ZIP file with optional password.
 * Now fetches from the backend to ensure PDF-level encryption is applied.
 */
export const exportBatchToZip = async (payrolls, periodLabel = "Payroll", password = null) => {
  if (!payrolls || payrolls.length === 0) return;

  const first = payrolls[0];
  const { period_Start, period_End } = first;

  try {
    const queryParams = new URLSearchParams({
      period_Start,
      period_End,
      zipPassword: password || ""
    }).toString();

    // Use fetchWithAuth to handle token
    const response = await fetchWithAuth(`/payroll/batch-zip?${queryParams}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to download batch ZIP");
    }

    const blob = await response.blob();
    const [startY, startM, startD] = period_Start.split('-').map(Number);
    const startObj = new Date(startY, startM - 1, startD);
    const monthName = startObj.toLocaleString('en-US', { month: 'long' });
    const endD = period_End.split('-')[2];
    
    const zipFilename = `${monthName}${startD}-${endD}_MaChipPayslip.zip`;
    saveAs(blob, zipFilename);
  } catch (error) {
    console.error("ZIP Export Error:", error);
    throw error;
  }
};
