import { useState, useEffect } from 'react'
import { getTransactionsForDate, getAllDatesWithTransactions, getOpeningBalancesForDates, calcClosing } from '../db'
import { today, toDateStr, formatDateLong, formatCurrency } from '../utils'
import EmailSheet from './EmailSheet'
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
  const [showEmail, setShowEmail] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const allDates = await getAllDatesWithTransactions()
      const inRange = allDates.filter((d) => d >= fromDate && d <= toDate)
      const [allTransactions, openings] = await Promise.all([
        Promise.all(inRange.map((date) => getTransactionsForDate(date))),
        getOpeningBalancesForDates(inRange),
      ])
      const loaded = inRange.map((date, i) => {
        const transactions = allTransactions[i]
        const opening = openings.get(date)
        return { date, transactions, opening, closing: calcClosing(opening, transactions) }
      })
      if (cancelled) return
      loaded.sort((a, b) => (a.date > b.date ? 1 : -1))
      setGroups(loaded)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [fromDate, toDate])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.appName}>Daybook</span>
            <span className={styles.title}>History</span>
          </div>
          <button
            className={styles.headerBtn}
            onClick={() => setShowEmail(true)}
            aria-label="Email report"
            disabled={loading || groups.length === 0}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <polyline points="2,4 12,13 22,4"/>
            </svg>
          </button>
        </div>
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

        {!loading && groups.map(({ date, transactions, opening, closing }, i) => (
          <div key={date} className={styles.group}>
            <div className={styles.dayHeader}>
              <span className={styles.dayDate}>{formatDateLong(date)}</span>
            </div>
            <ul className={styles.txList}>
              {/* Opening balance row — first day only */}
              {i === 0 && (
                <li className={`${styles.txItem} ${styles.balanceRow}`}>
                  <span className={styles.balanceRowLabel}>Opening Balance</span>
                  <span className={styles.balanceRowAmt}>{formatCurrency(opening)}</span>
                </li>
              )}

              {/* Transactions */}
              {transactions.map((tx) => (
                <li key={tx.id} className={styles.txItem}>
                  <span className={`${styles.badge} ${tx.type === 'credit' ? styles.credit : styles.debit}`}>
                    {tx.type === 'credit' ? 'CR' : 'DR'}
                  </span>
                  <span className={styles.particulars}>{tx.particulars || '—'}</span>
                  <span className={`${styles.amount} ${tx.type === 'credit' ? styles.creditAmt : styles.debitAmt}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                </li>
              ))}

              {/* Closing balance row */}
              <li className={`${styles.txItem} ${styles.balanceRow} ${styles.closingRow}`}>
                <span className={styles.balanceRowLabel}>Closing Balance</span>
                <span className={`${styles.balanceRowAmt} ${closing < 0 ? styles.down : styles.up}`}>
                  {formatCurrency(closing)}
                </span>
              </li>
            </ul>
          </div>
        ))}
      </div>

      {showEmail && (
        <EmailSheet
          groups={groups}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}
