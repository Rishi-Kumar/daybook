import { useRef } from 'react'
import { formatCurrency } from '../utils'
import styles from './TransactionList.module.css'

const LONG_PRESS_MS = 500

export default function TransactionList({ transactions, onEdit, emptyMessage, readOnly }) {
  const longPressTimer = useRef(null)

  function startLongPress(tx) {
    if (readOnly || !onEdit) return
    longPressTimer.current = setTimeout(() => {
      onEdit(tx)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
  }

  if (transactions.length === 0) {
    return (
      <div className={styles.empty}>
        <span>{emptyMessage ?? 'No transactions'}</span>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {transactions.map((tx) => (
        <li
          key={tx.id}
          className={styles.item}
          onTouchStart={() => startLongPress(tx)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          onContextMenu={(e) => { if (!readOnly && onEdit) { e.preventDefault(); onEdit(tx) } }}
        >
          <div className={styles.left}>
            <span className={styles.particulars}>{tx.particulars || '—'}</span>
          </div>
          <div className={styles.right}>
            <span className={`${styles.amount} ${tx.type === 'credit' ? styles.creditAmt : styles.debitAmt}`}>
              {formatCurrency(tx.amount)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
