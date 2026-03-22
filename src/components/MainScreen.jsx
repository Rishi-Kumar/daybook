import { useState, useEffect, useCallback, useRef } from 'react'
import { getTransactionGroupsForRange, getLedger } from '../db'
import { today, toDateStr, formatDateLong, formatCurrency, formatMonthEnd } from '../utils'
import TransactionList from './TransactionList'
import AddTransaction from './AddTransaction'
import EmailSheet from './EmailSheet'
import NetworkDot from './NetworkDot'
import styles from './MainScreen.module.css'

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}

export default function MainScreen({ ledgerId, showAdd, onCloseAdd, onSignOut }) {
  const [ledgerName, setLedgerName] = useState('')
  const [fromDate, setFromDate] = useState(nDaysAgo(6))
  const [toDate, setToDate] = useState(today())
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTx, setEditingTx] = useState(null)
  const [showEmail, setShowEmail] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const bottomRef = useRef(null)
  const shouldScrollRef = useRef(true)

  // Load ledger name when ledgerId changes
  useEffect(() => {
    if (!ledgerId) return
    getLedger(ledgerId).then((l) => setLedgerName(l?.name ?? ''))
  }, [ledgerId])

  const load = useCallback(async (scrollBottom = false) => {
    if (!ledgerId) return
    setLoading(true)
    const groups = await getTransactionGroupsForRange(fromDate, toDate, ledgerId)
    setGroups(groups)
    setLoading(false)
    if (scrollBottom) shouldScrollRef.current = true
  }, [ledgerId, fromDate, toDate])

  useEffect(() => {
    if (shouldScrollRef.current && !loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      shouldScrollRef.current = false
    }
  }, [loading, groups])

  useEffect(() => { load(true) }, [load])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <div className={styles.appNameRow}>
              <span className={styles.appName}>Daybook</span>
              <NetworkDot />
            </div>
            {ledgerName && <span className={styles.ledgerName}>{ledgerName}</span>}
          </div>
          <div className={styles.headerActions}>
            {confirmSignOut ? (
              <>
                <span className={styles.signOutPrompt}>Sign out?</span>
                <button className={styles.signOutCancel} onClick={() => setConfirmSignOut(false)}>Cancel</button>
                <button className={styles.signOutConfirm} onClick={onSignOut}>Yes</button>
              </>
            ) : (
              <>
                <button
                  className={styles.iconBtn}
                  onClick={() => setShowEmail(true)}
                  aria-label="Email report"
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <polyline points="2,4 12,13 22,4"/>
                  </svg>
                </button>
                {onSignOut && (
                  <button className={styles.iconBtn} onClick={() => setConfirmSignOut(true)} aria-label="Sign out">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
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

              {(i === groups.length - 1 || date.slice(0, 7) !== groups[i + 1].date.slice(0, 7)) && (
                <div className={`${styles.txItem} ${styles.balanceRow} ${styles.closingRow}`}>
                  <div className={styles.balanceRowLabel}>
                    <span>Closing Balance</span>
                    {i !== groups.length - 1 && (
                      <span className={styles.closingDate}>{formatMonthEnd(date)}</span>
                    )}
                  </div>
                  <span className={`${styles.balanceRowAmt} ${closing < 0 ? styles.down : styles.up}`}>
                    {formatCurrency(closing)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {showAdd && (
        <AddTransaction
          date={today()}
          ledgerId={ledgerId}
          onClose={onCloseAdd}
          onSaved={() => { onCloseAdd(); load(false) }}
        />
      )}

      {editingTx && (
        <AddTransaction
          date={today()}
          ledgerId={ledgerId}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); load(false) }}
        />
      )}

      {showEmail && (
        <EmailSheet
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}
