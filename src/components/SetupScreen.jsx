import { useState } from 'react'
import { addLedger, setSetting } from '../db'
import { newId, today } from '../utils'
import styles from './SetupScreen.module.css'

export default function SetupScreen({ onDone }) {
  const [name, setName] = useState('Cash')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(value)
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid amount')
      return
    }
    const ledger = {
      id: newId(),
      name: name.trim() || 'Cash',
      openingBalance: amount,
      setupDate: today(),
      createdAt: Date.now(),
    }
    await addLedger(ledger)
    await setSetting('activeLedgerId', ledger.id)
    onDone(ledger.id)
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📒</span>
        <h1 className={styles.appName}>Daybook</h1>
        <p className={styles.tagline}>Your daily cash ledger</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>Ledger Name</label>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            style={{ fontSize: '18px' }}
            type="text"
            placeholder="Cash"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <label className={styles.label} style={{ marginTop: '8px' }}>Opening Balance</label>
        <p className={styles.hint}>Enter the current balance to start tracking from today.</p>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit">
          Get Started
        </button>
      </form>
    </div>
  )
}
