import { useState } from 'react'
import { setSetting } from '../db'
import { today } from '../utils'
import styles from './SetupScreen.module.css'

export default function SetupScreen({ onDone }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(value)
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid amount')
      return
    }
    await setSetting('openingBalance', amount)
    await setSetting('setupDate', today())
    onDone()
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📒</span>
        <h1 className={styles.appName}>Daybook</h1>
        <p className={styles.tagline}>Your daily cash ledger</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>Opening Balance</label>
        <p className={styles.hint}>Enter the current balance to start tracking from today.</p>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            autoFocus
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
