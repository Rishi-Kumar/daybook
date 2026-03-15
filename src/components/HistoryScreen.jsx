import { useState, useEffect } from 'react'
import { getTransactionsForDate, getAllDatesWithTransactions, getOpeningBalance, calcClosing } from '../db'
import { today, toDateStr, formatDateLong, formatCurrency } from '../utils'
import styles from './HistoryScreen.module.css'

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}

export default function HistoryScreen() {
  const [fromDate, setFromDate] = useState(nDaysAgo(6))
  const [toDate, setToDate] = useState(today())
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const allDates = await getAllDatesWithTransactions()
      const inRange = allDates.filter((d) => d >= fromDate && d <= toDate)
      const loaded = await Promise.all(
        inRange.map(async (date) => {
          const [transactions, opening] = await Promise.all([
            getTransactionsForDate(date),
            getOpeningBalance(date),
          ])
          return { date, transactions, opening, closing: calcClosing(opening, transactions) }
        })
      )
      loaded.sort((a, b) => (a.date > b.date ? 1 : -1))
      setGroups(loaded)
      setLoading(false)
    }
    load()
  }, [fromDate, toDate])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.appName}>Daybook</span>
        <span className={styles.title}>History</span>
      </header>

      <div className={styles.rangePicker}>
        <div className={styles.dateField}>
          <label className={styles.dateLabel}>From</label>
          <input
            className={styles.dateInput}
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className={styles.dateSep} />
        <div className={styles.dateField}>
          <label className={styles.dateLabel}>To</label>
          <input
            className={styles.dateInput}
            type="date"
            value={toDate}
            min={fromDate}
            max={today()}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.listArea}>
        {loading && <div className={styles.empty}>Loading…</div>}

        {!loading && groups.length === 0 && (
          <div className={styles.empty}>No transactions in this range</div>
        )}

        {!loading && groups.map(({ date, transactions, opening, closing }) => (
          <div key={date} className={styles.group}>
            <div className={styles.dayHeader}>
              <span className={styles.dayDate}>{formatDateLong(date)}</span>
            </div>
            <ul className={styles.txList}>
              {/* Opening balance row */}
              <li className={`${styles.txItem} ${styles.balanceRow}`}>
                <span className={styles.balanceRowLabel}>Opening Balance</span>
                <span className={styles.balanceRowAmt}>{formatCurrency(opening)}</span>
              </li>

              {/* Transactions */}
              {transactions.map((tx) => (
                <li key={tx.id} className={styles.txItem}>
                  <span className={`${styles.badge} ${tx.type === 'credit' ? styles.credit : styles.debit}`}>
                    {tx.type === 'credit' ? 'CR' : 'DR'}
                  </span>
                  <span className={styles.particulars}>{tx.particulars || '—'}</span>
                  <span className={`${styles.amount} ${tx.type === 'credit' ? styles.creditAmt : styles.debitAmt}`}>
                    {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount)}
                  </span>
                </li>
              ))}

              {/* Closing balance row */}
              <li className={`${styles.txItem} ${styles.balanceRow} ${styles.closingRow}`}>
                <span className={styles.balanceRowLabel}>Closing Balance</span>
                <span className={`${styles.balanceRowAmt} ${closing < opening ? styles.down : styles.up}`}>
                  {formatCurrency(closing)}
                </span>
              </li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
