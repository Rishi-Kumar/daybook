import { useState } from 'react'
import { deleteTransaction } from '../db'
import { formatCurrency } from '../utils'
import styles from './TransactionList.module.css'

export default function TransactionList({ transactions, onDeleted, emptyMessage, readOnly }) {
  const [deleting, setDeleting] = useState(null)

  async function handleDelete(id) {
    if (deleting) return
    setDeleting(id)
    await deleteTransaction(id)
    onDeleted?.()
    setDeleting(null)
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
        <li key={tx.id} className={styles.item}>
          <div className={styles.left}>
            <span className={`${styles.badge} ${tx.type === 'credit' ? styles.credit : styles.debit}`}>
              {tx.type === 'credit' ? 'CR' : 'DR'}
            </span>
            <span className={styles.particulars}>{tx.particulars || '—'}</span>
          </div>
          <div className={styles.right}>
            <span className={`${styles.amount} ${tx.type === 'credit' ? styles.creditAmt : styles.debitAmt}`}>
              {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount)}
            </span>
            {!readOnly && (
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(tx.id)}
                disabled={deleting === tx.id}
                aria-label="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
