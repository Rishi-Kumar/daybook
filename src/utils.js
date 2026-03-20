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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export function formatDateDMY(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
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

// Generates a self-contained printer-friendly HTML report.
// Pass { forEmail: true } to strip the interactive top bar (Back / Print buttons).
export function generatePrintReport(groups, fromDate, toDate, { forEmail = false, ledgerName = '' } = {}) {
  const fmt = formatCurrency

  const generatedOn = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const tableRows = []
  for (const [i, { date, transactions, opening, closing }] of groups.entries()) {
    const dateLabel = formatDateDMY(date)
    let dateUsed = false
    let groupStarted = false

    const addRow = (date, particulars, cr, dr, extraClass = '') => {
      const sepClass = !groupStarted && i > 0 ? ' day-separator' : ''
      groupStarted = true
      tableRows.push(`<tr class="${extraClass}${sepClass}">
          <td class="date-col">${date}</td>
          <td>${particulars}</td>
          <td class="amount${cr ? ' cr' : ''}">${cr}</td>
          <td class="amount${dr ? ' dr' : ''}">${dr}</td>
        </tr>`)
    }

    if (i === 0) {
      addRow(dateLabel, 'Opening Balance',
        opening >= 0 ? fmt(opening) : '',
        opening < 0 ? fmt(Math.abs(opening)) : '',
        'balance-row')
      dateUsed = true
    }

    for (const tx of transactions) {
      addRow(
        dateUsed ? '' : dateLabel,
        tx.particulars || '—',
        tx.type === 'credit' ? fmt(Math.abs(tx.amount)) : '',
        tx.type === 'debit' ? fmt(Math.abs(tx.amount)) : '',
      )
      dateUsed = true
    }

    addRow(
      dateUsed ? '' : dateLabel,
      'Closing Balance',
      closing >= 0 ? fmt(closing) : '',
      closing < 0 ? fmt(Math.abs(closing)) : '',
      'balance-row closing',
    )
  }

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
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 9px 12px;
      border: 1px solid #ddd;
      vertical-align: middle;
    }
    th { background: #f0f0f0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; text-align: left; }
    td:last-child, th:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td:nth-child(3), th:nth-child(3) { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .date-col { white-space: nowrap; color: #555; font-size: 13px; }
    .day-separator td { border-top: 2px solid #bbb !important; }
    .balance-row td { background: #f5f5f5; font-weight: 600; font-size: 13px; }
    .closing td { background: #efefef; border-top: 2px solid #ccc; }
    .cr { color: #15803d; }
    .dr { color: #b91c1c; }
    .amount { font-weight: 500; }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .close-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }
    .close-btn:hover { background: #e5e7eb; }
    .share-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      color: #374151;
      cursor: pointer;
    }
    .share-btn:hover { background: #e5e7eb; }
    @media print {
      body { padding: 16px; }
      .top-bar { display: none; }
    }
  </style>
</head>
<body>
  ${forEmail ? '' : `<div class="top-bar">
    <button class="close-btn" onclick="window.close()">← Back</button>
    <button class="share-btn" onclick="window.print()" title="Print / Share as PDF">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    </button>
  </div>`}
  <div class="report-header">
    <div class="report-title">Daybook Report</div>
    <div class="report-meta">
      ${ledgerName ? `<span>Ledger: ${ledgerName}</span>` : ''}
      <span>From: ${formatDateLong(fromDate)}</span>
      <span>To: ${formatDateLong(toDate)}</span>
      <span>Generated: ${generatedOn}</span>
    </div>
  </div>
  ${groups.length === 0 ? '<p style="color:#888">No transactions in this period.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Particulars</th>
        <th>Credit</th>
        <th>Debit</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows.join('')}
    </tbody>
  </table>`}
</body>
</html>`
}
