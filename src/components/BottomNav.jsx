import styles from './BottomNav.module.css'

export default function BottomNav({ active, onChange }) {
  return (
    <nav className={styles.nav}>
      <button
        className={`${styles.tab} ${active === 'today' ? styles.active : ''}`}
        onClick={() => onChange('today')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>Today</span>
      </button>
      <button
        className={`${styles.tab} ${active === 'history' ? styles.active : ''}`}
        onClick={() => onChange('history')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </svg>
        <span>History</span>
      </button>
    </nav>
  )
}
