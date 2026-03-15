import { useState, useEffect, useCallback } from 'react'
import {
  getTransactionsForDate,
  getOpeningBalance,
  calcClosing,
} from '../db'
import { today, formatDateLong, formatCurrency } from '../utils'
import TransactionList from './TransactionList'
import AddTransaction from './AddTransaction'
import styles from './DayScreen.module.css'

export default function TodayScreen() {
  const date = today()
  const [transactions, setTransactions] = useState([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editingTx, setEditingTx] = useState(null)

  const load = useCallback(async () => {
    const [txs, ob] = await Promise.all([
      getTransactionsForDate(date),
      getOpeningBalance(date),
    ])
    setTransactions(txs)
    setOpeningBalance(ob)
  }, [date])

  useEffect(() => { load() }, [load])

  const closing = calcClosing(openingBalance, transactions)

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.appName}>Daybook</span>
        <span className={styles.dateStr}>{formatDateLong(date)}</span>
      </header>

      <div className={styles.balanceRow}>
        <div className={styles.balanceItem}>
          <span className={styles.balLabel}>Opening</span>
          <span className={styles.balAmount}>{formatCurrency(openingBalance)}</span>
        </div>
      </div>

      <div className={styles.listArea}>
        <TransactionList
          transactions={transactions}
          onDeleted={load}
          onEdit={(tx) => setEditingTx(tx)}
          emptyMessage="No transactions yet"
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.closingLabel}>Closing Balance</span>
        <span className={`${styles.closingAmount} ${closing < 0 ? styles.negative : ''}`}>
          {formatCurrency(closing)}
        </span>
      </div>

      <button className={styles.fab} onClick={() => setShowAdd(true)} aria-label="Add transaction">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {showAdd && (
        <AddTransaction
          date={date}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {editingTx && (
        <AddTransaction
          date={date}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); load() }}
        />
      )}
    </div>
  )
}
