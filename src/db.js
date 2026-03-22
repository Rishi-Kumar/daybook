import { supabase } from './supabase'
import { buildLedgerGroups, compareTx } from './utils'
import {
  getCache, setCache, patchCache, getQueue, enqueue, clearQueue,
  getLocalSetting, setLocalSetting,
} from './cache'

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

// ── Offline read helpers ───────────────────────────────────────────────────────

function groupsFromCache(fromDate, toDate, ledgerId) {
  const cache = getCache()
  if (!cache) return []
  const ledger = cache.ledgers.find((l) => l.id === ledgerId)
  if (!ledger) return []

  const ledgerTxs = cache.transactions.filter((t) => t.ledgerId === ledgerId)
  const openingBalance = calcClosing(ledger.openingBalance, ledgerTxs.filter((t) => t.date < fromDate))

  const byDate = {}
  for (const tx of ledgerTxs.filter((t) => t.date >= fromDate && t.date <= toDate)) {
    ;(byDate[tx.date] ??= []).push(tx)
  }

  let balance = openingBalance
  return Object.keys(byDate).sort().map((date) => {
    const transactions = byDate[date].sort(compareTx)
    const group = { date, transactions, opening: balance, closing: calcClosing(balance, transactions) }
    balance = group.closing
    return group
  })
}

function ledgersWithBalancesFromCache() {
  const cache = getCache()
  if (!cache) return []
  const sumByLedger = {}
  for (const tx of cache.transactions) {
    sumByLedger[tx.ledgerId] = (sumByLedger[tx.ledgerId] ?? 0) + tx.amount
  }
  return cache.ledgers.map((l) => ({ ...l, balance: l.openingBalance + (sumByLedger[l.id] ?? 0) }))
}

// ── Cache refresh ──────────────────────────────────────────────────────────────

// Returns ledger array on success, null if offline or error.
export async function refreshCache() {
  if (!navigator.onLine) return null
  const [ledgerResult, txResult] = await Promise.all([
    supabase.from('ledgers').select('*').order('created_at', { ascending: true }),
    supabase.from('transactions').select('*'),
  ])
  if (ledgerResult.error || txResult.error) return null
  const ledgers = (ledgerResult.data ?? []).map(ledgerFromRow)
  setCache(ledgers, (txResult.data ?? []).map(txFromRow))
  return ledgers
}

// ── Queue flush (runs on reconnect) ───────────────────────────────────────────

const QUEUE_OPS = {
  addTransaction: async (userId, [tx]) => {
    const { error } = await supabase.from('transactions').insert(txToRow(tx, userId))
    if (error) throw error
  },
  updateTransaction: async (_userId, [tx]) => {
    const { error } = await supabase.from('transactions').update({
      ledger_id: tx.ledgerId, date: tx.date, type: tx.type,
      amount: tx.amount, particulars: tx.particulars, created_at: tx.createdAt,
    }).eq('id', tx.id)
    if (error) throw error
  },
  deleteTransaction: async (_userId, [id]) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  },
  addLedger: async (userId, [ledger]) => {
    const { error } = await supabase.from('ledgers').insert(ledgerToRow(ledger, userId))
    if (error) throw error
  },
  updateLedger: async (_userId, [ledger]) => {
    const { error } = await supabase.from('ledgers').update({
      name: ledger.name, opening_balance: ledger.openingBalance,
      setup_date: ledger.setupDate, created_at: ledger.createdAt,
    }).eq('id', ledger.id)
    if (error) throw error
  },
  deleteLedger: async (_userId, [id]) => {
    const { error } = await supabase.from('ledgers').delete().eq('id', id)
    if (error) throw error
  },
}

async function flushQueue() {
  const queue = getQueue()
  if (queue.length === 0) return
  const userId = await getUserId()
  for (const { op, args } of queue) {
    try {
      await QUEUE_OPS[op](userId, args)
    } catch {
      return // stop on first failure; retry next reconnect
    }
  }
  clearQueue()
  await refreshCache()
}

if (typeof window !== 'undefined') {
  window.removeEventListener('online', flushQueue)
  window.addEventListener('online', flushQueue)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  if (!navigator.onLine) return getLocalSetting(key)
  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  const value = data?.value ?? null
  if (value !== null) setLocalSetting(key, value)
  return value
}

export async function setSetting(key, value) {
  setLocalSetting(key, value)
  if (!navigator.onLine) return
  const userId = await getUserId()
  if (!userId) return
  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, key, value: String(value) }, { onConflict: 'user_id,key' })
}

// ── Ledgers ───────────────────────────────────────────────────────────────────

export async function getAllLedgers() {
  if (!navigator.onLine) return getCache()?.ledgers ?? []
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(ledgerFromRow)
}

export async function getLedger(id) {
  if (!navigator.onLine) return getCache()?.ledgers.find((l) => l.id === id) ?? null
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? ledgerFromRow(data) : null
}

export async function addLedger(ledger) {
  patchCache((c) => ({ ...c, ledgers: [...c.ledgers, ledger] }))
  if (!navigator.onLine) {
    enqueue('addLedger', [ledger])
    return
  }
  const userId = await getUserId()
  const { error } = await supabase.from('ledgers').insert(ledgerToRow(ledger, userId))
  if (error) {
    enqueue('addLedger', [ledger])
    if (navigator.onLine) throw error
  }
}

export async function updateLedger(ledger) {
  patchCache((c) => ({ ...c, ledgers: c.ledgers.map((l) => l.id === ledger.id ? ledger : l) }))
  if (!navigator.onLine) {
    enqueue('updateLedger', [ledger])
    return
  }
  const { error } = await supabase
    .from('ledgers')
    .update({
      name: ledger.name,
      opening_balance: ledger.openingBalance,
      setup_date: ledger.setupDate,
      created_at: ledger.createdAt,
    })
    .eq('id', ledger.id)
  if (error) {
    enqueue('updateLedger', [ledger])
    if (navigator.onLine) throw error
  }
}

export async function deleteLedger(id) {
  patchCache((c) => ({
    ledgers: c.ledgers.filter((l) => l.id !== id),
    transactions: c.transactions.filter((t) => t.ledgerId !== id),
  }))
  if (!navigator.onLine) {
    enqueue('deleteLedger', [id])
    return
  }
  const { error } = await supabase.from('ledgers').delete().eq('id', id)
  if (error) {
    enqueue('deleteLedger', [id])
    if (navigator.onLine) throw error
  }
}

export async function getLedgerCurrentBalance(ledgerId) {
  const ledger = await getLedger(ledgerId)
  if (!ledger) return 0
  if (!navigator.onLine) {
    const txs = getCache()?.transactions.filter((t) => t.ledgerId === ledgerId) ?? []
    return calcClosing(ledger.openingBalance, txs)
  }
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('ledger_id', ledgerId)
  if (error) throw error
  return calcClosing(ledger.openingBalance, (data ?? []).map((r) => ({ amount: Number(r.amount) })))
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function addTransaction(tx) {
  patchCache((c) => ({ ...c, transactions: [...c.transactions, tx] }))
  if (!navigator.onLine) {
    enqueue('addTransaction', [tx])
    return
  }
  const userId = await getUserId()
  const { error } = await supabase.from('transactions').insert(txToRow(tx, userId))
  if (error) {
    enqueue('addTransaction', [tx])
    if (navigator.onLine) throw error
  }
}

export async function deleteTransaction(id) {
  patchCache((c) => ({ ...c, transactions: c.transactions.filter((t) => t.id !== id) }))
  if (!navigator.onLine) {
    enqueue('deleteTransaction', [id])
    return
  }
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) {
    enqueue('deleteTransaction', [id])
    if (navigator.onLine) throw error
  }
}

export async function updateTransaction(tx) {
  patchCache((c) => ({ ...c, transactions: c.transactions.map((t) => t.id === tx.id ? tx : t) }))
  if (!navigator.onLine) {
    enqueue('updateTransaction', [tx])
    return
  }
  const { error } = await supabase.from('transactions').update({
    ledger_id: tx.ledgerId,
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    particulars: tx.particulars,
    created_at: tx.createdAt,
  }).eq('id', tx.id)
  if (error) {
    enqueue('updateTransaction', [tx])
    if (navigator.onLine) throw error
  }
}

export async function getTransactionsForDate(date, ledgerId) {
  if (!navigator.onLine) {
    return (getCache()?.transactions ?? [])
      .filter((t) => t.ledgerId === ledgerId && t.date === date)
      .sort(compareTx)
  }
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('date', date)
  if (error) throw error
  return (data ?? []).map(txFromRow).sort(compareTx)
}

export async function getAllDatesWithTransactions(ledgerId) {
  if (!navigator.onLine) {
    const dates = [...new Set(
      (getCache()?.transactions ?? []).filter((t) => t.ledgerId === ledgerId).map((t) => t.date)
    )]
    return dates.sort((a, b) => (a > b ? -1 : 1))
  }
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

  if (!navigator.onLine) {
    return (getCache()?.transactions ?? [])
      .filter((t) => t.ledgerId === ledgerId && t.date < date)
      .reduce((bal, t) => bal + t.amount, initialBalance)
  }

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
  if (dates.length === 0) return new Map()

  if (!navigator.onLine) {
    const cache = getCache()
    const ledger = cache?.ledgers.find((l) => l.id === ledgerId)
    const initialBalance = ledger?.openingBalance ?? 0
    const result = new Map()
    for (const date of dates) {
      const prior = (cache?.transactions ?? []).filter((t) => t.ledgerId === ledgerId && t.date < date)
      result.set(date, calcClosing(initialBalance, prior))
    }
    return result
  }

  const maxDate = dates.reduce((a, b) => (a > b ? a : b))

  const [ledger, { data, error }] = await Promise.all([
    getLedger(ledgerId),
    supabase.from('transactions').select('date, amount').eq('ledger_id', ledgerId).lt('date', maxDate),
  ])
  if (error) throw error

  const initialBalance = ledger?.openingBalance ?? 0
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

// Single-ledger transaction groups for MainScreen — 3 parallel queries instead of N+3.
export async function getTransactionGroupsForRange(fromDate, toDate, ledgerId) {
  if (!navigator.onLine) return groupsFromCache(fromDate, toDate, ledgerId)

  const [ledger, inRangeResult, priorResult] = await Promise.all([
    getLedger(ledgerId),
    supabase.from('transactions').select('*').eq('ledger_id', ledgerId).gte('date', fromDate).lte('date', toDate),
    supabase.from('transactions').select('amount').eq('ledger_id', ledgerId).lt('date', fromDate),
  ])
  if (inRangeResult.error) throw inRangeResult.error
  if (priorResult.error) throw priorResult.error

  const initialBalance = ledger?.openingBalance ?? 0
  const openingBalance = (priorResult.data ?? []).reduce((bal, r) => bal + Number(r.amount), initialBalance)

  const byDate = {}
  for (const r of inRangeResult.data ?? []) {
    ;(byDate[r.date] ??= []).push(txFromRow(r))
  }

  let balance = openingBalance
  return Object.keys(byDate).sort().map((date) => {
    const transactions = byDate[date].sort(compareTx)
    const group = { date, transactions, opening: balance, closing: calcClosing(balance, transactions) }
    balance = group.closing
    return group
  })
}

// All ledgers with current balances — 2 parallel queries instead of 2N+1.
export async function getAllLedgersWithBalances() {
  if (!navigator.onLine) return ledgersWithBalancesFromCache()

  const [ledgers, txResult] = await Promise.all([
    getAllLedgers(),
    supabase.from('transactions').select('ledger_id, amount'),
  ])
  if (txResult.error) throw txResult.error

  const sumByLedger = {}
  for (const r of txResult.data ?? []) {
    sumByLedger[r.ledger_id] = (sumByLedger[r.ledger_id] ?? 0) + Number(r.amount)
  }

  return ledgers.map((l) => ({ ...l, balance: l.openingBalance + (sumByLedger[l.id] ?? 0) }))
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
