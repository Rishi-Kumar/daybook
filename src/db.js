import { openDB } from 'idb'

const DB_NAME = 'daybook'
const DB_VERSION = 2

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, newVersion, tx) {
      if (oldVersion < 1) {
        // Fresh install — create all stores
        db.createObjectStore('settings')
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by_date', 'date')
        txStore.createIndex('by_ledger_date', ['ledgerId', 'date'])
        db.createObjectStore('ledgers', { keyPath: 'id' })
      }

      if (oldVersion === 1) {
        // Migrate v1 → v2: introduce ledgers, scope transactions by ledgerId
        db.createObjectStore('ledgers', { keyPath: 'id' })
        tx.objectStore('transactions').createIndex('by_ledger_date', ['ledgerId', 'date'])

        const openingBalance = (await tx.objectStore('settings').get('openingBalance')) ?? 0
        const setupDate = (await tx.objectStore('settings').get('setupDate')) ?? new Date().toISOString().slice(0, 10)

        const defaultLedgerId = crypto.randomUUID()
        await tx.objectStore('ledgers').add({
          id: defaultLedgerId,
          name: 'Cash',
          openingBalance,
          setupDate,
          createdAt: Date.now(),
        })

        const allTxs = await tx.objectStore('transactions').getAll()
        for (const t of allTxs) {
          await tx.objectStore('transactions').put({ ...t, ledgerId: defaultLedgerId })
        }
      }
    },
  })
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const db = await getDB()
  return db.get('settings', key)
}

export async function setSetting(key, value) {
  const db = await getDB()
  return db.put('settings', value, key)
}

// ── Ledgers ───────────────────────────────────────────────────────────────────

export async function getAllLedgers() {
  const db = await getDB()
  const all = await db.getAll('ledgers')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getLedger(id) {
  const db = await getDB()
  return db.get('ledgers', id)
}

export async function addLedger(ledger) {
  const db = await getDB()
  return db.add('ledgers', ledger)
}

export async function updateLedger(ledger) {
  const db = await getDB()
  return db.put('ledgers', ledger)
}

export async function deleteLedger(id) {
  const db = await getDB()
  const range = IDBKeyRange.bound([id, ''], [id, '\uffff'])
  const txsToDelete = await db.getAllFromIndex('transactions', 'by_ledger_date', range)
  await Promise.all(txsToDelete.map((t) => db.delete('transactions', t.id)))
  await db.delete('ledgers', id)
}

// Returns the running balance for a ledger through all transactions (used on ledger cards)
export async function getLedgerCurrentBalance(ledgerId) {
  const ledger = await getLedger(ledgerId)
  if (!ledger) return 0
  const db = await getDB()
  const range = IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff'])
  const txs = await db.getAllFromIndex('transactions', 'by_ledger_date', range)
  return calcClosing(ledger.openingBalance, txs)
}

// ── Transactions ──────────────────────────────────────────────────────────────

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

export async function getTransactionsForDate(date, ledgerId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('transactions', 'by_ledger_date', IDBKeyRange.only([ledgerId, date]))
  return all.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'credit' ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export async function getAllDatesWithTransactions(ledgerId) {
  const db = await getDB()
  const range = IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff'])
  const all = await db.getAllFromIndex('transactions', 'by_ledger_date', range)
  const dates = [...new Set(all.map((t) => t.date))]
  return dates.sort((a, b) => (a > b ? -1 : 1)) // newest first
}

// Compute opening balance for a given date, scoped to a ledger.
export async function getOpeningBalance(date, ledgerId) {
  const ledger = await getLedger(ledgerId)
  const initialBalance = ledger?.openingBalance ?? 0
  const db = await getDB()
  const range = IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff'])
  const all = await db.getAllFromIndex('transactions', 'by_ledger_date', range)

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

// Batch variant: compute opening balances for multiple dates in a single pass.
export async function getOpeningBalancesForDates(dates, ledgerId) {
  const ledger = await getLedger(ledgerId)
  const initialBalance = ledger?.openingBalance ?? 0
  const db = await getDB()
  const range = IDBKeyRange.bound([ledgerId, ''], [ledgerId, '\uffff'])
  const all = await db.getAllFromIndex('transactions', 'by_ledger_date', range)

  const byDate = {}
  for (const tx of all) {
    ;(byDate[tx.date] ??= []).push(tx)
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
  return transactions.reduce((bal, tx) => {
    return tx.type === 'credit' ? bal + tx.amount : bal - tx.amount
  }, opening)
}
