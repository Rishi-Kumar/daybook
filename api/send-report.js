import { Resend } from 'resend'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDateLong, generatePrintReport } from '../src/utils.js'

const resend = new Resend(process.env.RESEND_API_KEY)

function generatePDF(groups, fromDate, toDate) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fmt = formatCurrency

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Daybook Report', 14, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`${formatDateLong(fromDate)}  –  ${formatDateLong(toDate)}`, 14, 26)
  doc.setTextColor(0)

  let startY = 32

  for (const { date, transactions, opening, closing } of groups) {
    // Day heading
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60)
    doc.text(formatDateLong(date).toUpperCase(), 14, startY + 6)
    doc.setTextColor(0)

    const body = [
      [
        'Opening Balance',
        opening >= 0 ? fmt(opening) : '',
        opening < 0 ? fmt(Math.abs(opening)) : '',
      ],
      ...transactions.map((tx) => [
        tx.particulars || '-',
        tx.type === 'credit' ? fmt(tx.amount) : '',
        tx.type === 'debit' ? fmt(tx.amount) : '',
      ]),
      [
        'Closing Balance',
        closing >= 0 ? fmt(closing) : '',
        closing < 0 ? fmt(Math.abs(closing)) : '',
      ],
    ]

    const balanceRows = new Set([0, body.length - 1])

    autoTable(doc, {
      startY: startY + 9,
      head: [['Particulars', 'Credit', 'Debit']],
      body,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [80, 80, 80],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        1: { halign: 'right', cellWidth: 38 },
        2: { halign: 'right', cellWidth: 38 },
      },
      didParseCell(data) {
        if (data.section === 'body' && balanceRows.has(data.row.index)) {
          data.cell.styles.fillColor = [245, 245, 245]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    startY = doc.lastAutoTable.finalY + 10
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

  const html = generatePrintReport(groups, fromDate, toDate, { forEmail: true })
  const pdfBuffer = generatePDF(groups, fromDate, toDate)
  const filename = `daybook-${fromDate}-to-${toDate}.pdf`

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
