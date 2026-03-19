import { useState, useRef, useEffect } from 'react'
import { addLedger, updateLedger, deleteLedger } from '../db'
import { newId, today } from '../utils'
import styles from './LedgerSheet.module.css'

export default function LedgerSheet({ ledger, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(ledger)
  const [name, setName] = useState(isEdit ? ledger.name : '')
  const [balance, setBalance] = useState(isEdit ? String(Math.abs(ledger.openingBalance)) : '')
  const [isNegative, setIsNegative] = useState(isEdit ? ledger.openingBalance < 0 : false)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Enter a ledger name'); return }
    const amount = parseFloat(balance)
    if (isNaN(amount)) { setError('Enter a valid opening balance'); return }
    const signedAmount = isNegative ? -Math.abs(amount) : amount

    if (isEdit) {
      await updateLedger({ ...ledger, name: trimmedName, openingBalance: signedAmount })
    } else {
      const newLedger = {
        id: newId(),
        name: trimmedName,
        openingBalance: signedAmount,
        setupDate: today(),
        createdAt: Date.now(),
      }
      await addLedger(newLedger)
    }
    onSaved()
  }

  async function handleDelete() {
    await deleteLedger(ledger.id)
    onDeleted(ledger.id)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Ledger' : 'New Ledger'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            ref={nameRef}
            className={styles.textInput}
            type="text"
            placeholder="e.g. Cash, Savings"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Opening Balance</label>
          <div className={styles.inputWrapper}>
            <button
              type="button"
              className={`${styles.signToggle} ${isNegative ? styles.signNegative : ''}`}
              onClick={() => setIsNegative(v => !v)}
            >
              {isNegative ? '−' : '+'}
            </button>
            <input
              className={styles.amountInput}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={balance}
              onChange={(e) => { setBalance(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.saveBtn} onClick={handleSave}>
          {isEdit ? 'Save Changes' : 'Create Ledger'}
        </button>

        {isEdit && (
          confirmingDelete ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deleteConfirmText}>Delete ledger and all its transactions?</span>
              <div className={styles.deleteConfirmBtns}>
                <button className={styles.deleteCancelBtn} onClick={() => setConfirmingDelete(false)}>Cancel</button>
                <button className={styles.deleteConfirmBtn} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          ) : (
            <button className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>
              Delete ledger
            </button>
          )
        )}
      </div>
    </div>
  )
}
