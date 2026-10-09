const fs = require('fs');
const path = require('path');

// Locate paths
const rootDir = path.resolve(__dirname, '..');
const mdPath = path.join(rootDir, 'docs', 'MAChip_System_Architecture_Guide.md');
const pdfPath = path.join(rootDir, 'docs', 'MAChip_System_Architecture_Guide.pdf');

// Import puppeteer from backend
let puppeteer;
try {
  puppeteer = require(path.join(rootDir, 'backend', 'node_modules', 'puppeteer'));
} catch (e) {
  puppeteer = require('puppeteer');
}

/**
 * Robust, print-optimized Markdown to HTML converter with custom Table Fixer
 * and zero whitespace-waste page flow.
 */
function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const htmlParts = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeContent = [];
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];
  let inList = false;
  let listType = 'ul';

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineFormat(text) {
    if (!text) return '';
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italics: *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Math format $...$
    text = text.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');
    return text;
  }

  function closeList() {
    if (inList) {
      htmlParts.push(`</${listType}>`);
      inList = false;
    }
  }

  function closeTable() {
    if (inTable) {
      const colCount = tableHeader.length;
      let colWidths = '';
      if (colCount === 2) {
        colWidths = '<colgroup><col style="width: 28%;"><col style="width: 72%;"></colgroup>';
      } else if (colCount === 3) {
        colWidths = '<colgroup><col style="width: 25%;"><col style="width: 45%;"><col style="width: 30%;"></colgroup>';
      } else if (colCount === 4) {
        colWidths = '<colgroup><col style="width: 20%;"><col style="width: 30%;"><col style="width: 25%;"><col style="width: 25%;"></colgroup>';
      }

      let tableHtml = `<div class="table-container"><table>${colWidths}<thead><tr>`;
      tableHeader.forEach(cell => {
        tableHtml += `<th>${inlineFormat(cell.trim())}</th>`;
      });
      tableHtml += `</tr></thead><tbody>`;

      tableRows.forEach(row => {
        tableHtml += `<tr>`;
        row.forEach((cell, idx) => {
          if (idx < colCount) {
            tableHtml += `<td>${inlineFormat(cell.trim())}</td>`;
          }
        });
        // Fill missing columns if any
        for (let i = row.length; i < colCount; i++) {
          tableHtml += `<td></td>`;
        }
        tableHtml += `</tr>`;
      });

      tableHtml += `</tbody></table></div>`;
      htmlParts.push(tableHtml);
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      closeList();
      closeTable();
      if (inCodeBlock) {
        htmlParts.push(`<pre><code class="language-${codeLang}">${escapeHtml(codeContent.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeContent = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Markdown Table parsing
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if separator line (e.g. |:---|:---|)
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      closeTable();
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      closeList();
      htmlParts.push('<hr />');
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      closeList();
      htmlParts.push(`<h1>${inlineFormat(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeList();
      htmlParts.push(`<h2>${inlineFormat(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeList();
      htmlParts.push(`<h3>${inlineFormat(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      closeList();
      htmlParts.push(`<h4>${inlineFormat(trimmed.slice(5))}</h4>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      closeList();
      htmlParts.push(`<blockquote>${inlineFormat(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[-*]\s+/, '');
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(`<li>${inlineFormat(itemContent)}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^\d+\.\s+/, '');
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        htmlParts.push('<ol>');
      }
      htmlParts.push(`<li>${inlineFormat(itemContent)}</li>`);
      continue;
    }

    // Empty line
    if (trimmed === '') {
      closeList();
      continue;
    }

    // Regular paragraph
    closeList();
    htmlParts.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeList();
  closeTable();

  return htmlParts.join('\n');
}

async function generatePdf() {
  console.log(`[PDF] Reading markdown from: ${mdPath}`);
  const mdContent = fs.readFileSync(mdPath, 'utf8');

  console.log(`[PDF] Converting Markdown to print-optimized HTML...`);
  const bodyHtml = markdownToHtml(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MAChip System Architecture & Defense Guide</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }

    *, *:before, *:after {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.45;
      color: #1f2328;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #0969da;
      border-bottom: 2px solid #0969da;
      padding-bottom: 4px;
      margin-top: 8px;
      margin-bottom: 10px;
      break-after: avoid;
      page-break-after: avoid;
    }

    h2 {
      font-size: 12pt;
      font-weight: 600;
      color: #1f2328;
      border-bottom: 1px solid #d0d7de;
      padding-bottom: 3px;
      margin-top: 14px;
      margin-bottom: 8px;
      break-after: avoid;
      page-break-after: avoid;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #24292f;
      margin-top: 10px;
      margin-bottom: 4px;
      break-after: avoid;
      page-break-after: avoid;
    }

    h4 {
      font-size: 9.5pt;
      font-weight: 600;
      color: #0969da;
      margin-top: 8px;
      margin-bottom: 3px;
      break-after: avoid;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 5px;
      text-align: justify;
      break-inside: auto;
      page-break-inside: auto;
      orphans: 2;
      widows: 2;
    }

    /* ── COMPACT & RESPONSIVE TABLE STYLING ── */
    .table-container {
      width: 100% !important;
      margin: 8px 0 10px 0 !important;
      break-inside: auto !important;
      page-break-inside: auto !important;
    }

    table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      font-size: 8pt !important;
      line-height: 1.3 !important;
      background: #ffffff !important;
      break-inside: auto !important;
      page-break-inside: auto !important;
    }

    thead {
      display: table-header-group !important;
    }

    tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      page-break-after: auto !important;
    }

    th, td {
      border: 1px solid #d0d7de !important;
      padding: 4px 6px !important;
      text-align: left !important;
      vertical-align: top !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      hyphens: auto !important;
    }

    th {
      background-color: #f6f8fa !important;
      font-weight: 600 !important;
      color: #1f2328 !important;
      border-bottom: 2px solid #afb8c1 !important;
    }

    tr:nth-child(even) td {
      background-color: #fcfcfd !important;
    }

    /* Code blocks & Inline code */
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 7.5pt;
      background-color: #eff1f3;
      padding: 1px 3.5px;
      border-radius: 3px;
      color: #cf222e;
    }

    pre {
      background-color: #0d1117;
      color: #e6edf3;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 7.5pt;
      line-height: 1.3;
      overflow-x: auto;
      margin: 6px 0;
      break-inside: auto;
      page-break-inside: auto;
    }

    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }

    blockquote {
      border-left: 3px solid #0969da;
      padding: 3px 8px;
      margin: 4px 0 6px 0;
      background-color: #f0f7ff;
      color: #1f2328;
      font-size: 8.5pt;
      line-height: 1.4;
      break-inside: auto;
      page-break-inside: auto;
    }

    ul, ol {
      margin-top: 2px;
      margin-bottom: 5px;
      padding-left: 18px;
    }

    li {
      margin-bottom: 2px;
      break-inside: auto;
      page-break-inside: auto;
      orphans: 2;
      widows: 2;
    }

    hr {
      border: 0;
      border-top: 1px solid #d0d7de;
      margin: 8px 0;
      break-after: auto;
      page-break-after: auto;
      break-before: auto;
      page-break-before: auto;
    }

    a {
      color: #0969da;
      text-decoration: none;
    }

    .math {
      font-family: "Cambria Math", "Times New Roman", serif;
      font-style: italic;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  console.log(`[PDF] Launching headless browser with Puppeteer...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log(`[PDF] Printing to A4 document with continuous flow and headers/footers...`);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '14mm',
      bottom: '14mm',
      left: '12mm',
      right: '12mm'
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-family: -apple-system, sans-serif; font-size: 7pt; color: #8c959f; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm;">
        <span>MAChip System Architecture &amp; Defense Guide</span>
        <span>MAC-J Int'l Forwarding Ltd.</span>
      </div>`,
    footerTemplate: `
      <div style="font-family: -apple-system, sans-serif; font-size: 7pt; color: #8c959f; width: 100%; text-align: center;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`
  });

  await browser.close();
  const stats = fs.statSync(pdfPath);
  console.log(`[PDF] Successfully created ${pdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

generatePdf().catch(err => {
  console.error('[PDF ERROR]:', err);
  process.exit(1);
});
