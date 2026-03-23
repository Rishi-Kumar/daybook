import nodemailer from 'nodemailer'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDateDMY, formatDateLong, formatMonthEnd, buildLedgerGroups } from '../src/utils.js'

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const CR_TEXT   = [21,  128,  61]
const DR_TEXT   = [185,  28,  28]
const BAL_BG    = [245, 245, 250]
const HEADER_BG = [240, 240, 248]
const GRAY_TEXT = [100, 100, 120]
const DARK_TEXT = [30,  30,   50]

function renderLedgerSection(doc, name, groups, startY, ML, MR, CW) {
  const fmt = formatCurrency

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK_TEXT)
  doc.text(name, ML, startY)

  const body = []
  const balanceRows = new Set()
  const separatorRows = new Set()

  for (const [groupIdx, { date, transactions, opening, closing }] of groups.entries()) {
    const isLastGroup = groupIdx === groups.length - 1
    const isMonthEnd = isLastGroup || date.slice(0, 7) !== groups[groupIdx + 1].date.slice(0, 7)
    const dateLabel = formatDateDMY(date)
    let dateUsed = false
    const groupStartRow = body.length

    if (groupIdx === 0) {
      body.push([dateLabel, 'Opening Balance',
        opening >= 0 ? fmt(opening) : '',
        opening < 0  ? fmt(Math.abs(opening)) : '',
        'balance'])
      balanceRows.add(body.length - 1)
      dateUsed = true
    }

    for (const tx of transactions) {
      body.push([
        dateUsed ? '' : dateLabel,
        tx.particulars || '—',
        tx.type === 'credit' ? fmt(Math.abs(tx.amount)) : '',
        tx.type === 'debit'  ? fmt(Math.abs(tx.amount)) : '',
        tx.type,
      ])
      dateUsed = true
    }

    if (isMonthEnd) {
      body.push([
        isLastGroup ? dateLabel : formatMonthEnd(date),
        'Closing Balance',
        closing >= 0 ? fmt(closing) : '',
        closing < 0  ? fmt(Math.abs(closing)) : '',
        'balance',
      ])
      balanceRows.add(body.length - 1)
    }

    if (groupIdx > 0) separatorRows.add(groupStartRow)
  }

  autoTable(doc, {
    startY: startY + 6,
    head: [['Date', 'Particulars', 'Credit', 'Debit']],
    body: body.map(([d, p, c, dr]) => [d, p, c, dr]),
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
      0: { cellWidth: 38, textColor: GRAY_TEXT, fontStyle: 'normal' },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 34, fontStyle: 'bold' },
      3: { halign: 'right', cellWidth: 34, fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'head' && (data.column.index === 2 || data.column.index === 3)) {
        data.cell.styles.halign = 'right'
        return
      }
      if (data.section !== 'body') return
      const [, , crVal, drVal, tag] = body[data.row.index]
      const isBalance = balanceRows.has(data.row.index)
      const isSeparator = separatorRows.has(data.row.index)

      if (isSeparator) {
        data.cell.styles.lineWidth = { top: 0.6, right: 0.2, bottom: 0.2, left: 0.2 }
      }

      if (isBalance) {
        data.cell.styles.fillColor = BAL_BG
        if (data.column.index !== 0) data.cell.styles.fontStyle = 'bold'
        if (data.column.index === 2 && crVal) data.cell.styles.textColor = CR_TEXT
        if (data.column.index === 3 && drVal) data.cell.styles.textColor = DR_TEXT
      } else {
        if (tag === 'credit' && data.column.index === 2) data.cell.styles.textColor = CR_TEXT
        if (tag === 'debit'  && data.column.index === 3) data.cell.styles.textColor = DR_TEXT
      }
    },
  })
}

export function generatePDF(ledgerGroups, fromDate, toDate) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ML = 14
  const MR = 14
  const CW = 210 - ML - MR

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK_TEXT)
  doc.text('Daybook Report', ML, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TEXT)
  doc.text(`From: ${formatDateLong(fromDate)}   To: ${formatDateLong(toDate)}`, ML, 25)

  const generated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Generated: ${generated}`, ML, 30)

  doc.setDrawColor(180, 180, 200)
  doc.setLineWidth(0.4)
  doc.line(ML, 33, ML + CW, 33)

  for (const [i, { name, groups }] of ledgerGroups.entries()) {
    if (i > 0) doc.addPage()
    renderLedgerSection(doc, name, groups, i === 0 ? 39 : 18, ML, MR, CW)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

export function generateEmailBody(fromDate, toDate) {
  const range = `${formatDateLong(fromDate)} – ${formatDateLong(toDate)}`
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e1e32;padding:24px">
    <h2 style="margin:0 0 8px">Daybook Report</h2>
    <p style="margin:0 0 16px;color:#666">Report period: ${range}</p>
    <p style="margin:0">Please find the full report attached as a PDF.</p>
  </body></html>`
}

// Fetches ledger groups for a user in the given date range using the provided admin client.
export async function fetchLedgerGroups(userId, fromDate, toDate, supabaseAdmin) {
  const [ledgersResult, txResult] = await Promise.all([
    supabaseAdmin.from('ledgers').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabaseAdmin.from('transactions').select('*').eq('user_id', userId).gte('date', fromDate).lte('date', toDate).order('created_at', { ascending: true }),
  ])

  if (ledgersResult.error) throw new Error(ledgersResult.error.message)
  if (txResult.error) throw new Error(txResult.error.message)

  const ledgers = (ledgersResult.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    openingBalance: Number(r.opening_balance),
    setupDate: r.setup_date,
    createdAt: Number(r.created_at),
  }))

  const transactions = (txResult.data ?? []).map((r) => ({
    id: r.id,
    ledgerId: r.ledger_id,
    date: r.date,
    type: r.type,
    amount: Number(r.amount),
    particulars: r.particulars,
    createdAt: Number(r.created_at),
  }))

  return buildLedgerGroups(ledgers, transactions)
}
