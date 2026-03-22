import { useState, useEffect, useRef } from 'react'
import { getAllLedgers, getAllLedgersWithBalances } from '../db'
import { formatCurrency } from '../utils'
import LedgerSheet from './LedgerSheet'
import NetworkDot from './NetworkDot'
import styles from './LedgersScreen.module.css'

const LONG_PRESS_MS = 500

export default function LedgersScreen({ activeLedgerId, onSelect, onActiveLedgerDeleted }) {
  const [ledgers, setLedgers] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [sheetLedger, setSheetLedger] = useState(undefined) // undefined = closed, null = create, ledger obj = edit
  const longPressTimer = useRef(null)

  async function load() {
    setLoading(true)
    const all = await getAllLedgersWithBalances()
    setLedgers(all)
    setBalances(Object.fromEntries(all.map((l) => [l.id, l.balance])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startLongPress(ledger) {
    longPressTimer.current = setTimeout(() => setSheetLedger(ledger), LONG_PRESS_MS)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
  }

  async function handleSaved(deletedId) {
    await load()
    if (deletedId && deletedId === activeLedgerId) {
      const remaining = await getAllLedgers()
      onActiveLedgerDeleted(remaining)
    }
    setSheetLedger(undefined)
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <span className={styles.appName}>Daybook</span>
        <div className={styles.headerRight}>
          <NetworkDot />
          <button className={styles.newBtn} onClick={() => setSheetLedger(null)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
        </div>
      </header>

      <div className={styles.listArea}>
        {loading && <div className={styles.empty}>Loading…</div>}

        {!loading && ledgers.length === 0 && (
          <div className={styles.empty}>No ledgers yet</div>
        )}

        {!loading && ledgers.map((ledger) => (
          <div
            key={ledger.id}
            className={`${styles.card} ${ledger.id === activeLedgerId ? styles.activeCard : ''}`}
            onClick={() => onSelect(ledger.id)}
            onTouchStart={() => startLongPress(ledger)}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            onContextMenu={(e) => { e.preventDefault(); setSheetLedger(ledger) }}
          >
            <div className={styles.cardTop}>
              <div className={styles.cardName}>
                {ledger.id === activeLedgerId && <span className={styles.activeDot} />}
                <span>{ledger.name}</span>
              </div>
              <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            <div className={`${styles.cardBalance} ${(balances[ledger.id] ?? 0) < 0 ? styles.negative : ''}`}>
              {balances[ledger.id] !== undefined ? formatCurrency(balances[ledger.id]) : '—'}
            </div>
          </div>
        ))}
      </div>

      {sheetLedger !== undefined && (
        <LedgerSheet
          ledger={sheetLedger}
          onClose={() => setSheetLedger(undefined)}
          onSaved={() => handleSaved(null)}
          onDeleted={(id) => handleSaved(id)}
        />
      )}
    </div>
  )
}
