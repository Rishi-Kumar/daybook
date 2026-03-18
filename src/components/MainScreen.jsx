import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getTransactionsForDate,
  getAllDatesWithTransactions,
  getOpeningBalancesForDates,
  calcClosing,
} from '../db'
import { today, toDateStr, formatDateLong, formatCurrency } from '../utils'
import TransactionList from './TransactionList'
import AddTransaction from './AddTransaction'
import EmailSheet from './EmailSheet'
import styles from './MainScreen.module.css'

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}

export default function MainScreen() {
  const [fromDate, setFromDate] = useState(nDaysAgo(6))
  const [toDate, setToDate] = useState(today())
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [showEmail, setShowEmail] = useState(false)

  const bottomRef = useRef(null)
  const shouldScrollRef = useRef(true)

  const load = useCallback(async (scrollBottom = false) => {
    setLoading(true)
    const allDates = await getAllDatesWithTransactions()
    const inRange = allDates.filter((d) => d >= fromDate && d <= toDate)
    const [allTransactions, openings] = await Promise.all([
      Promise.all(inRange.map((date) => getTransactionsForDate(date))),
      getOpeningBalancesForDates(inRange),
    ])
    const loaded = inRange
      .map((date, i) => {
        const transactions = allTransactions[i]
        const opening = openings.get(date)
        return { date, transactions, opening, closing: calcClosing(opening, transactions) }
      })
      .sort((a, b) => (a.date > b.date ? 1 : -1))
    setGroups(loaded)
    setLoading(false)
    if (scrollBottom) {
      shouldScrollRef.current = true
    }
  }, [fromDate, toDate])

  // Scroll to bottom after groups render when flagged
  useEffect(() => {
    if (shouldScrollRef.current && !loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      shouldScrollRef.current = false
    }
  }, [loading, groups])

  // Initial load + reload on date range change — always scroll to bottom
  useEffect(() => {
    load(true)
  }, [load])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.appName}>Daybook</span>
          <button
            className={styles.emailBtn}
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
      </header>

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

            <div className={styles.txList}>
              {i === 0 && (
                <div className={`${styles.txItem} ${styles.balanceRow}`}>
                  <span className={styles.balanceRowLabel}>Opening Balance</span>
                  <span className={styles.balanceRowAmt}>{formatCurrency(opening)}</span>
                </div>
              )}

              <TransactionList
                transactions={transactions}
                onEdit={(tx) => setEditingTx(tx)}
              />

              <div className={`${styles.txItem} ${styles.balanceRow} ${styles.closingRow}`}>
                <span className={styles.balanceRowLabel}>Closing Balance</span>
                <span className={`${styles.balanceRowAmt} ${closing < 0 ? styles.down : styles.up}`}>
                  {formatCurrency(closing)}
                </span>
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <button className={styles.fab} onClick={() => setShowAdd(true)} aria-label="Add transaction">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {showAdd && (
        <AddTransaction
          date={today()}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(false) }}
        />
      )}

      {editingTx && (
        <AddTransaction
          date={today()}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); load(false) }}
        />
      )}

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
