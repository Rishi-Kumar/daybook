import nodemailer from 'nodemailer'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDateLong, generatePrintReport } from '../src/utils.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const CR_TEXT   = [21,  128,  61]  // credit green (print-friendly)
const DR_TEXT   = [185,  28,  28]  // debit red
const BAL_BG    = [245, 245, 250]  // balance row bg
const HEADER_BG = [240, 240, 248]  // table header bg
const GRAY_TEXT = [100, 100, 120]
const DARK_TEXT = [30,  30,   50]

function generatePDF(groups, fromDate, toDate, ledgerName = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fmt = formatCurrency
  const ML = 14
  const MR = 14
  const CW = 210 - ML - MR

  // ── Header ────────────────────────────────────────────────────
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK_TEXT)
  doc.text(ledgerName ? `${ledgerName} — Daybook Report` : 'Daybook Report', ML, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TEXT)
  const dateRange = `From: ${formatDateLong(fromDate)}   To: ${formatDateLong(toDate)}`
  doc.text(dateRange, ML, 25)

  const generated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Generated: ${generated}`, ML, 30)

  // thin rule under header
  doc.setDrawColor(180, 180, 200)
  doc.setLineWidth(0.4)
  doc.line(ML, 33, ML + CW, 33)

  // ── Body ──────────────────────────────────────────────────────
  let y = 39

  for (const [groupIdx, { date, transactions, opening, closing }] of groups.entries()) {
    // Day heading
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY_TEXT)
    doc.text(formatDateLong(date).toUpperCase(), ML, y + 4)
    doc.setTextColor(...DARK_TEXT)

    // Each row: [particulars, creditAmt, debitAmt, tag]
    // tag ('balance'|'credit'|'debit') is a 4th internal column used only in
    // didParseCell for styling — it is stripped before passing to autoTable.
    const body = [
      ...(groupIdx === 0 ? [[
        'Opening Balance',
        opening >= 0 ? fmt(opening) : '',
        opening < 0  ? fmt(Math.abs(opening)) : '',
        'balance',
      ]] : []),
      ...transactions.map((tx) => [
        tx.particulars || '—',
        tx.type === 'credit' ? fmt(tx.amount) : '',
        tx.type === 'debit'  ? fmt(tx.amount) : '',
        tx.type,
      ]),
      [
        'Closing Balance',
        closing >= 0 ? fmt(closing) : '',
        closing < 0  ? fmt(Math.abs(closing)) : '',
        'balance',
      ],
    ]

    const balanceRows = new Set([...(groupIdx === 0 ? [0] : []), body.length - 1])

    autoTable(doc, {
      startY: y + 7,
      head: [],
      body: body.map(([p, c, d]) => [p, c, d]),
      margin: { left: ML, right: MR },
      tableWidth: CW,
      styles: {
        fontSize: 9,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        textColor: DARK_TEXT,
        lineColor: [220, 220, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: HEADER_BG,
        textColor: GRAY_TEXT,
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [200, 200, 210],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
        2: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
      },
      didParseCell(data) {
        if (data.section !== 'body') return
        const [, crVal, drVal, tag] = body[data.row.index]
        const isBalance = balanceRows.has(data.row.index)

        if (isBalance) {
          data.cell.styles.fillColor = BAL_BG
          data.cell.styles.fontStyle = 'bold'
          if (data.column.index === 1 && crVal) data.cell.styles.textColor = CR_TEXT
          if (data.column.index === 2 && drVal) data.cell.styles.textColor = DR_TEXT
        } else {
          if (tag === 'credit' && data.column.index === 1) data.cell.styles.textColor = CR_TEXT
          if (tag === 'debit'  && data.column.index === 2) data.cell.styles.textColor = DR_TEXT
        }
      },
    })

    y = doc.lastAutoTable.finalY + 8

    // page break guard
    if (y > 265) { doc.addPage(); y = 14 }
  }

  return Buffer.from(doc.output('arraybuffer'))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Vercel doesn't always auto-parse JSON for ESM functions — handle both cases
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const { to, groups, fromDate, toDate, ledgerName } = body ?? {}
  if (!to || !groups) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const html      = generatePrintReport(groups, fromDate, toDate, { forEmail: true, ledgerName })
  const pdfBuffer = generatePDF(groups, fromDate, toDate, ledgerName)
  const safeName  = ledgerName ? ledgerName.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'report'
  const filename  = `daybook-${safeName}-${fromDate}-to-${toDate}.pdf`

  try {
    await transporter.sendMail({
      from: `Daybook <${process.env.GMAIL_USER}>`,
      to,
      subject: ledgerName ? `Daybook Report — ${ledgerName}` : 'Daybook Report',
      html,
      attachments: [{ filename, content: pdfBuffer }],
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  return res.status(200).json({ ok: true })
}
