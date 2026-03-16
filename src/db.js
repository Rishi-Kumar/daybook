import { openDB } from 'idb'

const DB_NAME = 'daybook'
const DB_VERSION = 1

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Key-value store for settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' })
        store.createIndex('by_date', 'date')
      }
    },
  })
}

// Settings
export async function getSetting(key) {
  const db = await getDB()
  return db.get('settings', key)
}

export async function setSetting(key, value) {
  const db = await getDB()
  return db.put('settings', value, key)
}

// Transactions
export async function addTransaction(tx) {
  const db = await getDB()
  return db.add('transactions', tx)
}

export async function deleteTransaction(id) {
  const db = await getDB()
  return db.delete('transactions', id)
}

export async function updateTransaction(tx) {
  const db = await getDB()
  return db.put('transactions', tx)
}

export async function getTransactionsForDate(date) {
  const db = await getDB()
  const all = await db.getAllFromIndex('transactions', 'by_date', date)
  return all.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'credit' ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export async function getAllDatesWithTransactions() {
  const db = await getDB()
  const all = await db.getAll('transactions')
  const dates = [...new Set(all.map((t) => t.date))]
  return dates.sort((a, b) => (a > b ? -1 : 1)) // newest first
}

// Compute opening balance for a given date.
// Iterative: groups all prior transactions by date, walks forward once — O(n), 2 DB reads.
export async function getOpeningBalance(date) {
  const initialBalance = (await getSetting('openingBalance')) ?? 0
  const db = await getDB()
  const all = await db.getAll('transactions')

  const prior = all.filter((t) => t.date < date)
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

// Batch variant: compute opening balance for multiple dates in a single pass.
// 2 DB reads total regardless of how many dates are queried.
export async function getOpeningBalancesForDates(dates) {
  const initialBalance = (await getSetting('openingBalance')) ?? 0
  const db = await getDB()
  const all = await db.getAll('transactions')

  // Group all transactions by date, sorted ascending
  const byDate = {}
  for (const tx of all) {
    ;(byDate[tx.date] ??= []).push(tx)
  }
  const allDataDates = Object.keys(byDate).sort()

  // Build cumulative closing balance after each data date
  const cumulativeAfter = []
  let balance = initialBalance
  for (const d of allDataDates) {
    balance = calcClosing(balance, byDate[d])
    cumulativeAfter.push(balance)
  }

  // For each query date, find the running balance from all dates strictly before it
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
  return transactions.reduce((bal, tx) => {
    return tx.type === 'credit' ? bal + tx.amount : bal - tx.amount
  }, opening)
}
