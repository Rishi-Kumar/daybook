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

export function formatMonthEnd(dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  const month = new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })
  return `End of ${month} ${y}`
}

// Credits before debits, then by creation time.
export function compareTx(a, b) {
  if (a.type !== b.type) return a.type === 'credit' ? -1 : 1
  return a.createdAt - b.createdAt
}

// Pure helper: given flat arrays of ledgers and transactions (already sorted),
// builds the { name, groups } structure used by the PDF report generator.
// Used by both db.js (client) and api/send-report.js (server).
export function buildLedgerGroups(ledgers, transactions) {
  const results = []

  for (const ledger of ledgers) {
    const ledgerTxs = transactions.filter((t) => t.ledgerId === ledger.id)
    if (ledgerTxs.length === 0) continue

    const byDate = {}
    for (const tx of ledgerTxs) {
      ;(byDate[tx.date] ??= []).push(tx)
    }
    for (const date of Object.keys(byDate)) {
      byDate[date].sort(compareTx)
    }

    const allDataDates = Object.keys(byDate).sort()
    const cumulativeAfter = []
    let balance = ledger.openingBalance
    for (const d of allDataDates) {
      balance = byDate[d].reduce((bal, tx) => bal + tx.amount, balance)
      cumulativeAfter.push(balance)
    }

    const groups = allDataDates.map((date, i) => {
      const opening = i === 0 ? ledger.openingBalance : cumulativeAfter[i - 1]
      const txs = byDate[date]
      return { date, transactions: txs, opening, closing: txs.reduce((b, tx) => b + tx.amount, opening) }
    })

    results.push({ name: ledger.name, groups })
  }

  return results
}

