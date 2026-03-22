import { useNetworkStatus } from '../hooks/useNetworkStatus'
import styles from './NetworkDot.module.css'

export default function NetworkDot() {
  const isOnline = useNetworkStatus()
  return <span className={`${styles.dot} ${isOnline ? styles.online : styles.offline}`} />
}
