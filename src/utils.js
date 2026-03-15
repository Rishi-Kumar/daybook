import { v4 as uuidv4 } from 'uuid'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

// Generates a PDF report blob using jsPDF + autoTable
export function generatePdfReport(groups, fromDate, toDate) {
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(n)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Daybook Report', 14, 18)

  // Subtitle
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(`From: ${formatDateLong(fromDate)}   To: ${formatDateLong(toDate)}`, 14, 25)
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    14, 30
  )

  // Divider
  doc.setDrawColor(180)
  doc.line(14, 33, pageW - 14, 33)

  let y = 39

  for (const { date, transactions, opening, closing } of groups) {
    // Day heading
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text(formatDateLong(date).toUpperCase(), 14, y)
    y += 2

    const GREY_LIGHT = [245, 245, 245]
    const GREY_MID = [230, 230, 230]
    const GREEN = [21, 128, 61]
    const RED = [185, 28, 28]
    const BLACK = [17, 17, 17]

    const bodyRows = [
      // Opening balance
      {
        cells: ['Opening Balance', opening >= 0 ? fmt(opening) : '', opening < 0 ? fmt(Math.abs(opening)) : ''],
        isBalance: true,
        isClosing: false,
      },
      // Transactions
      ...transactions.map((tx) => ({
        cells: [
          tx.particulars || '—',
          tx.type === 'credit' ? fmt(tx.amount) : '',
          tx.type === 'debit' ? fmt(tx.amount) : '',
        ],
        isBalance: false,
        isClosing: false,
        type: tx.type,
      })),
      // Closing balance
      {
        cells: ['Closing Balance', closing >= 0 ? fmt(closing) : '', closing < 0 ? fmt(Math.abs(closing)) : ''],
        isBalance: true,
        isClosing: true,
      },
    ]

    autoTable(doc, {
      startY: y,
      head: [['Particulars', 'Credit', 'Debit']],
      body: bodyRows.map((r) => r.cells),
      margin: { left: 14, right: 14 },
      tableWidth: pageW - 28,
      styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [80, 80, 80],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      didParseCell(data) {
        const row = bodyRows[data.row.index]
        if (!row || data.section !== 'body') return
        if (row.isBalance) {
          data.cell.styles.fillColor = row.isClosing ? GREY_MID : GREY_LIGHT
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = BLACK
        } else {
          // Credit col (index 1) green, debit col (index 2) red
          if (data.column.index === 1 && row.type === 'credit') data.cell.styles.textColor = GREEN
          if (data.column.index === 2 && row.type === 'debit') data.cell.styles.textColor = RED
        }
      },
    })

    y = doc.lastAutoTable.finalY + 8

    // Page break safety
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 14
    }
  }

  return doc.output('blob')
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
              <td class="amount cr">${opening >= 0 ? fmt(opening) : ''}</td>
              <td class="amount dr">${opening < 0 ? fmt(Math.abs(opening)) : ''}</td>
            </tr>
            ${txRows}
            <tr class="balance-row closing">
              <td>Closing Balance</td>
              <td class="amount cr">${closing >= 0 ? fmt(closing) : ''}</td>
              <td class="amount dr">${closing < 0 ? fmt(Math.abs(closing)) : ''}</td>
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
      .day-section { page-break-inside: avoid; }
      .top-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <button class="close-btn" onclick="window.close()">← Back</button>
    <button class="share-btn" onclick="window.print()" title="Print / Share as PDF">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    </button>
  </div>
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
