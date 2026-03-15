import { useState, useEffect } from 'react'
import {
  getTransactionsForDate,
  getOpeningBalance,
  calcClosing,
} from '../db'
import { formatDateLong, formatCurrency } from '../utils'
import TransactionList from './TransactionList'
import styles from './DayScreen.module.css'

export default function DayDetail({ date, onBack }) {
  const [transactions, setTransactions] = useState([])
  const [openingBalance, setOpeningBalance] = useState(0)

  useEffect(() => {
    Promise.all([
      getTransactionsForDate(date),
      getOpeningBalance(date),
    ]).then(([txs, ob]) => {
      setTransactions(txs)
      setOpeningBalance(ob)
    })
  }, [date])

  const closing = calcClosing(openingBalance, transactions)

  return (
    <div className={styles.screen}>
      <header className={styles.headerRow}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.appName}>History</span>
          <span className={styles.dateStr}>{formatDateLong(date)}</span>
        </div>
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
          readOnly
          emptyMessage="No transactions for this day"
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.closingLabel}>Closing Balance</span>
        <span className={`${styles.closingAmount} ${closing < 0 ? styles.negative : ''}`}>
          {formatCurrency(closing)}
        </span>
      </div>
    </div>
  )
}
