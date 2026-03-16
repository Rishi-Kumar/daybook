import { Resend } from 'resend'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDateLong, generatePrintReport } from '../src/utils.js'

const resend = new Resend(process.env.RESEND_API_KEY)

// Colours matching the app palette
const ACCENT    = [124, 106, 247]  // --accent  #7c6af7
const CR_TEXT   = [21,  128,  61]  // credit green (print-friendly, darker than app)
const DR_TEXT   = [185,  28,  28]  // debit red
const CR_BG     = [220, 252, 231]  // light green bg
const DR_BG     = [254, 226, 226]  // light red bg
const BAL_BG    = [245, 245, 250]  // balance row bg
const HEADER_BG = [240, 240, 248]  // table header bg
const GRAY_TEXT = [100, 100, 120]
const DARK_TEXT = [30,  30,   50]

function generatePDF(groups, fromDate, toDate) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fmt = formatCurrency
  const PW = 210  // A4 width mm
  const ML = 14   // margin left
  const MR = 14   // margin right
  const CW = PW - ML - MR

  // ── Title banner ──────────────────────────────────────────────
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, PW, 24, 'F')

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('DAYBOOK', ML, 10)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(220, 215, 255)
  doc.text('Daily Accounting Report', ML, 16)

  // date range top-right
  doc.setFontSize(8)
  doc.setTextColor(220, 215, 255)
  const dateRange = `${formatDateLong(fromDate)}  –  ${formatDateLong(toDate)}`
  doc.text(dateRange, PW - MR, 10, { align: 'right' })

  const generated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.setFontSize(7)
  doc.text(`Generated: ${generated}`, PW - MR, 16, { align: 'right' })

  // ── Body ──────────────────────────────────────────────────────
  let y = 30

  for (const { date, transactions, opening, closing } of groups) {
    // Day heading pill
    doc.setFillColor(...HEADER_BG)
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...ACCENT)
    doc.text(formatDateLong(date).toUpperCase(), ML + 3, y + 5.5)
    doc.setTextColor(...DARK_TEXT)

    const body = [
      [
        'Opening Balance',
        opening >= 0 ? fmt(opening) : '',
        opening < 0  ? fmt(Math.abs(opening)) : '',
        'balance',
      ],
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

    const balanceRows = new Set([0, body.length - 1])

    autoTable(doc, {
      startY: y + 9,
      head: [['Particulars', 'Credit', 'Debit']],
      // strip the internal tag column before rendering
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
          // colour the value cell
          if (data.column.index === 1 && crVal) data.cell.styles.textColor = CR_TEXT
          if (data.column.index === 2 && drVal) data.cell.styles.textColor = DR_TEXT
        } else {
          if (tag === 'credit') {
            if (data.column.index === 1) {
              data.cell.styles.fillColor = CR_BG
              data.cell.styles.textColor = CR_TEXT
            }
          } else if (tag === 'debit') {
            if (data.column.index === 2) {
              data.cell.styles.fillColor = DR_BG
              data.cell.styles.textColor = DR_TEXT
            }
          }
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

  const { to, groups, fromDate, toDate } = req.body
  if (!to || !groups) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const html     = generatePrintReport(groups, fromDate, toDate, { forEmail: true })
  const pdfBuffer = generatePDF(groups, fromDate, toDate)
  const filename  = `daybook-${fromDate}-to-${toDate}.pdf`

  const { data, error } = await resend.emails.send({
    from: 'Daybook <onboarding@resend.dev>',
    to,
    subject: 'Daybook Report',
    html,
    attachments: [{ filename, content: pdfBuffer }],
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, id: data.id })
}
