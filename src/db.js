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

export async function getTransactionsForDate(date) {
  const db = await getDB()
  const all = await db.getAllFromIndex('transactions', 'by_date', date)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAllDatesWithTransactions() {
  const db = await getDB()
  const all = await db.getAll('transactions')
  const dates = [...new Set(all.map((t) => t.date))]
  return dates.sort((a, b) => (a > b ? -1 : 1)) // newest first
}

// Compute opening balance for a given date
export async function getOpeningBalance(date) {
  const openingBalance = (await getSetting('openingBalance')) ?? 0

  // Walk backwards to find the most recent prior day with data
  const db = await getDB()
  const all = await db.getAll('transactions')
  const prior = all.filter((t) => t.date < date)

  if (prior.length === 0) return openingBalance

  // Find the latest date before `date`
  const latestPriorDate = prior.reduce((max, t) => (t.date > max ? t.date : max), prior[0].date)
  const priorTxs = prior.filter((t) => t.date === latestPriorDate)

  const priorOpening = await getOpeningBalance(latestPriorDate)
  return calcClosing(priorOpening, priorTxs)
}

export function calcClosing(opening, transactions) {
  return transactions.reduce((bal, tx) => {
    return tx.type === 'credit' ? bal + tx.amount : bal - tx.amount
  }, opening)
}
