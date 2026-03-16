import { useState, useEffect } from 'react'
import { getSetting, setSetting } from '../db'
import { generatePrintReport } from '../utils'
import styles from './EmailSheet.module.css'

export default function EmailSheet({ groups, fromDate, toDate, onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    getSetting('reportEmail').then((saved) => {
      if (saved) setEmail(saved)
    })
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) return
    setStatus('sending')
    setErrorMsg('')

    const html = generatePrintReport(groups, fromDate, toDate)

    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: addr, html, subject: 'Daybook Report' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Send failed')
      }
      await setSetting('reportEmail', addr)
      setStatus('sent')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <span className={styles.title}>Email Report</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === 'sent' ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className={styles.successMsg}>Report sent to</p>
            <p className={styles.successEmail}>{email}</p>
            <button className={styles.doneBtn} onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSend}>
            <div className={styles.field}>
              <label className={styles.label}>Send to</label>
              <input
                className={styles.emailInput}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                autoFocus
              />
            </div>
            {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
            <button
              className={styles.sendBtn}
              type="submit"
              disabled={!email.trim() || status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
