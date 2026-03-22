import { supabase } from './supabase'
import { buildLedgerGroups } from './utils'

// ── Row mappers ────────────────────────────────────────────────────────────────

function ledgerFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    openingBalance: Number(row.opening_balance),
    setupDate: row.setup_date,
    createdAt: Number(row.created_at),
  }
}

function ledgerToRow(ledger, userId) {
  return {
    id: ledger.id,
    user_id: userId,
    name: ledger.name,
    opening_balance: ledger.openingBalance,
    setup_date: ledger.setupDate,
    created_at: ledger.createdAt,
  }
}

function txFromRow(row) {
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    date: row.date,
    type: row.type,
    amount: Number(row.amount),
    particulars: row.particulars,
    createdAt: Number(row.created_at),
  }
}

function txToRow(tx, userId) {
  return {
    id: tx.id,
    user_id: userId,
    ledger_id: tx.ledgerId,
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    particulars: tx.particulars,
    created_at: tx.createdAt,
  }
}

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? null
}

export async function setSetting(key, value) {
  const userId = await getUserId()
  if (!userId) return
  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, key, value: String(value) }, { onConflict: 'user_id,key' })
}

// ── Ledgers ───────────────────────────────────────────────────────────────────

export async function getAllLedgers() {
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(ledgerFromRow)
}

export async function getLedger(id) {
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? ledgerFromRow(data) : null
}

export async function addLedger(ledger) {
  const userId = await getUserId()
  const { error } = await supabase
    .from('ledgers')
    .insert(ledgerToRow(ledger, userId))
  if (error) throw error
}

export async function updateLedger(ledger) {
  const { error } = await supabase
    .from('ledgers')
    .update({
      name: ledger.name,
      opening_balance: ledger.openingBalance,
      setup_date: ledger.setupDate,
      created_at: ledger.createdAt,
    })
    .eq('id', ledger.id)
  if (error) throw error
}

export async function deleteLedger(id) {
  // ON DELETE CASCADE in Postgres handles transaction cleanup
  const { error } = await supabase
    .from('ledgers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getLedgerCurrentBalance(ledgerId) {
  const ledger = await getLedger(ledgerId)
  if (!ledger) return 0
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('ledger_id', ledgerId)
  if (error) throw error
  return calcClosing(ledger.openingBalance, (data ?? []).map((r) => ({ amount: Number(r.amount) })))
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function addTransaction(tx) {
  const userId = await getUserId()
  const { error } = await supabase
    .from('transactions')
    .insert(txToRow(tx, userId))
  if (error) throw error
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateTransaction(tx) {
  const { error } = await supabase
    .from('transactions')
    .update({
      ledger_id: tx.ledgerId,
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      particulars: tx.particulars,
      created_at: tx.createdAt,
    })
    .eq('id', tx.id)
  if (error) throw error
}

export async function getTransactionsForDate(date, ledgerId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('date', date)
  if (error) throw error
  return (data ?? []).map(txFromRow).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'credit' ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export async function getAllDatesWithTransactions(ledgerId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('ledger_id', ledgerId)
    .order('date', { ascending: false })
  if (error) throw error
  const dates = [...new Set((data ?? []).map((r) => r.date))]
  return dates.sort((a, b) => (a > b ? -1 : 1))
}

export async function getOpeningBalance(date, ledgerId) {
  const ledger = await getLedger(ledgerId)
  const initialBalance = ledger?.openingBalance ?? 0
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('ledger_id', ledgerId)
    .lt('date', date)
  if (error) throw error

  const prior = (data ?? []).map((r) => ({ date: r.date, amount: Number(r.amount) }))
  if (prior.length === 0) return initialBalance

  const byDate = {}
  for (const tx of prior) {
    ;(byDate[tx.date] ??= []).push(tx)
  }
  let balance = initialBalance
  for (const d of Object.keys(byDate).sort()) {
    balance = calcClosing(balance, byDate[d])
  }
  return balance
}

export async function getOpeningBalancesForDates(dates, ledgerId) {
  const ledger = await getLedger(ledgerId)
  const initialBalance = ledger?.openingBalance ?? 0
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))

  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('ledger_id', ledgerId)
    .lt('date', maxDate)
  if (error) throw error

  const byDate = {}
  for (const r of data ?? []) {
    ;(byDate[r.date] ??= []).push({ amount: Number(r.amount) })
  }
  const allDataDates = Object.keys(byDate).sort()

  const cumulativeAfter = []
  let balance = initialBalance
  for (const d of allDataDates) {
    balance = calcClosing(balance, byDate[d])
    cumulativeAfter.push(balance)
  }

  const result = new Map()
  for (const queryDate of dates) {
    let lastPriorIdx = -1
    for (let i = 0; i < allDataDates.length; i++) {
      if (allDataDates[i] < queryDate) lastPriorIdx = i
      else break
    }
    result.set(queryDate, lastPriorIdx === -1 ? initialBalance : cumulativeAfter[lastPriorIdx])
  }
  return result
}

export function calcClosing(opening, transactions) {
  return transactions.reduce((bal, tx) => bal + tx.amount, opening)
}

export async function getAllLedgersGroupsForRange(fromDate, toDate) {
  const [ledgers, txResult] = await Promise.all([
    getAllLedgers(),
    supabase
      .from('transactions')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('created_at', { ascending: true }),
  ])
  if (txResult.error) throw txResult.error
  const transactions = (txResult.data ?? []).map(txFromRow)
  return buildLedgerGroups(ledgers, transactions)
}
