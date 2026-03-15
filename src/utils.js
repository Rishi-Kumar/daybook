import { v4 as uuidv4 } from 'uuid'

export function newId() {
  return uuidv4()
}

export function today() {
  return toDateStr(new Date())
}

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Generates a self-contained printer-friendly HTML report
export function generatePrintReport(groups, fromDate, toDate) {
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(n)

  const generatedOn = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const dayRows = groups.map(({ date, transactions, opening, closing }) => {
    const txRows = transactions
      .map(
        (tx) => `
        <tr>
          <td>${tx.particulars || '—'}</td>
          <td class="amount cr">${tx.type === 'credit' ? fmt(tx.amount) : ''}</td>
          <td class="amount dr">${tx.type === 'debit' ? fmt(tx.amount) : ''}</td>
        </tr>`
      )
      .join('')

    return `
      <div class="day-section">
        <div class="day-title">${formatDateLong(date)}</div>
        <table>
          <thead>
            <tr>
              <th>Particulars</th>
              <th class="amount">Credit</th>
              <th class="amount">Debit</th>
            </tr>
          </thead>
          <tbody>
            <tr class="balance-row">
              <td>Opening Balance</td>
              <td class="amount" colspan="2">${fmt(opening)}</td>
            </tr>
            ${txRows}
            <tr class="balance-row closing">
              <td>Closing Balance</td>
              <td class="amount" colspan="2">${fmt(closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>`
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daybook Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #111;
      padding: 32px 28px;
      max-width: 720px;
      margin: 0 auto;
    }
    .report-header { margin-bottom: 28px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .report-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .report-meta { font-size: 13px; color: #555; margin-top: 6px; }
    .report-meta span { margin-right: 20px; }
    .day-section { margin-bottom: 28px; page-break-inside: avoid; }
    .day-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
      margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 9px 12px;
      border: 1px solid #ddd;
      vertical-align: middle;
    }
    th { background: #f0f0f0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
    td:last-child, th:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td:nth-child(2), th:nth-child(2) { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .balance-row td { background: #f5f5f5; font-weight: 600; font-size: 13px; }
    .closing td { background: #efefef; border-top: 2px solid #ccc; }
    .cr { color: #15803d; }
    .dr { color: #b91c1c; }
    .amount { font-weight: 500; }
    .close-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 20px;
      padding: 8px 14px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      text-decoration: none;
    }
    .close-btn:hover { background: #e5e7eb; }
    @media print {
      body { padding: 16px; }
      .day-section { page-break-inside: avoid; }
      .close-btn { display: none; }
    }
  </style>
</head>
<body>
  <button class="close-btn" onclick="window.close()">← Back</button>
  <div class="report-header">
    <div class="report-title">Daybook Report</div>
    <div class="report-meta">
      <span>From: ${formatDateLong(fromDate)}</span>
      <span>To: ${formatDateLong(toDate)}</span>
      <span>Generated: ${generatedOn}</span>
    </div>
  </div>
  ${groups.length === 0 ? '<p style="color:#888">No transactions in this period.</p>' : dayRows.join('')}
</body>
</html>`
}
