import { useState, useRef, useEffect } from 'react'
import { addTransaction, updateTransaction, deleteTransaction, getAllLedgers } from '../db'
import { newId } from '../utils'
import styles from './AddTransaction.module.css'

export default function AddTransaction({ date, ledgerId, transaction, onClose, onSaved }) {
  const isEdit = Boolean(transaction)
  const [txDate, setTxDate] = useState(isEdit ? transaction.date : date)
  const [amount, setAmount] = useState(isEdit ? String(transaction.amount) : '')
  const [type, setType] = useState(isEdit ? transaction.type : 'credit')
  const [particulars, setParticulars] = useState(isEdit ? transaction.particulars : '')
  const [txLedgerId, setTxLedgerId] = useState(isEdit ? transaction.ledgerId : ledgerId)
  const [allLedgers, setAllLedgers] = useState([])
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const particularsRef = useRef(null)

  useEffect(() => {
    getAllLedgers().then(setAllLedgers)
    const t = setTimeout(() => particularsRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  async function handleSave() {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (isEdit) {
      await updateTransaction({
        ...transaction,
        ledgerId: txLedgerId,
        date: txDate,
        type,
        amount: num,
        particulars: particulars.trim(),
      })
    } else {
      await addTransaction({
        id: newId(),
        ledgerId: txLedgerId,
        date: txDate,
        type,
        amount: num,
        particulars: particulars.trim(),
        createdAt: Date.now(),
      })
    }
    onSaved()
  }

  async function handleDelete() {
    await deleteTransaction(transaction.id)
    onSaved()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Ledger picker — only shown when multiple ledgers exist */}
        {allLedgers.length > 1 && (
          <div className={styles.field}>
            <label className={styles.label}>Ledger</label>
            <select
              className={styles.textInput}
              value={txLedgerId}
              onChange={(e) => setTxLedgerId(e.target.value)}
            >
              {allLedgers.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div className={styles.field}>
          <label className={styles.label}>Date</label>
          <input
            className={styles.textInput}
            type="date"
            value={txDate}
            max={date}
            onChange={(e) => setTxDate(e.target.value)}
          />
        </div>

        {/* Particulars */}
        <div className={styles.field}>
          <label className={styles.label}>Particulars</label>
          <input
            ref={particularsRef}
            className={styles.textInput}
            type="text"
            placeholder="What is this for?"
            value={particulars}
            onChange={(e) => setParticulars(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Credit / Debit toggle */}
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${type === 'credit' ? styles.activeCredit : ''}`}
            onClick={() => setType('credit')}
          >
            Credit
          </button>
          <button
            className={`${styles.toggleBtn} ${type === 'debit' ? styles.activeDebit : ''}`}
            onClick={() => setType('debit')}
          >
            Debit
          </button>
        </div>

        {/* Amount */}
        <div className={styles.field}>
          <label className={styles.label}>Amount</label>
          <div className={styles.inputWrapper}>
            <input
              className={styles.amountInput}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <button className={`${styles.saveBtn} ${type === 'credit' ? styles.saveBtnCredit : styles.saveBtnDebit}`} onClick={handleSave}>
          {isEdit ? 'Update' : 'Save'} {type === 'credit' ? 'Credit' : 'Debit'}
        </button>

        {isEdit && (
          confirmingDelete ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deleteConfirmText}>Delete this transaction?</span>
              <div className={styles.deleteConfirmBtns}>
                <button className={styles.deleteCancelBtn} onClick={() => setConfirmingDelete(false)}>Cancel</button>
                <button className={styles.deleteConfirmBtn} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          ) : (
            <button className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>
              Delete transaction
            </button>
          )
        )}
      </div>
    </div>
  )
}
