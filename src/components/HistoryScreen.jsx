import { useState, useEffect } from 'react'
import {
  getAllDatesWithTransactions,
  getTransactionsForDate,
  getOpeningBalance,
  calcClosing,
} from '../db'
import { formatDateShort, formatCurrency } from '../utils'
import styles from './HistoryScreen.module.css'

export default function HistoryScreen({ onSelectDate }) {
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const dates = await getAllDatesWithTransactions()
      const dayData = await Promise.all(
        dates.map(async (date) => {
          const [txs, opening] = await Promise.all([
            getTransactionsForDate(date),
            getOpeningBalance(date),
          ])
          const closing = calcClosing(opening, txs)
          return { date, txCount: txs.length, opening, closing }
        })
      )
      setDays(dayData)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.appName}>Daybook</span>
        <span className={styles.title}>History</span>
      </header>

      {loading && <div className={styles.empty}>Loading…</div>}

      {!loading && days.length === 0 && (
        <div className={styles.empty}>No history yet</div>
      )}

      {!loading && days.length > 0 && (
        <ul className={styles.list}>
          {days.map((d) => (
            <li key={d.date} className={styles.item} onClick={() => onSelectDate(d.date)}>
              <div className={styles.left}>
                <span className={styles.date}>{formatDateShort(d.date)}</span>
                <span className={styles.txCount}>{d.txCount} transaction{d.txCount !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.right}>
                <div className={styles.balRow}>
                  <span className={styles.balLabel}>Op</span>
                  <span className={styles.balAmt}>{formatCurrency(d.opening)}</span>
                </div>
                <div className={styles.balRow}>
                  <span className={styles.balLabel}>Cl</span>
                  <span className={`${styles.balAmt} ${d.closing < 0 ? styles.negative : styles.positive}`}>
                    {formatCurrency(d.closing)}
                  </span>
                </div>
              </div>
              <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
