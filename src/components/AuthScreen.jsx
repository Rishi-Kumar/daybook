import { supabase } from '../supabase'
import styles from './AuthScreen.module.css'

export default function AuthScreen() {
  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📒</span>
        <h1 className={styles.appName}>Daybook</h1>
        <p className={styles.tagline}>Your daily cash ledger</p>
      </div>

      <div className={styles.actions}>
        <button className={styles.googleBtn} onClick={handleSignIn}>
          <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
            <path fill="#34A853" d="M24 48c6.6 0 12.2-2.2 16.2-5.9l-7.9-6.1c-2.2 1.5-5 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.1v6.3C6.1 42.9 14.4 48 24 48z"/>
            <path fill="#FBBC05" d="M10.3 28.2A14.3 14.3 0 0 1 9.8 24c0-1.5.3-2.9.7-4.2v-6.3H2.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l7.8-6.6z"/>
            <path fill="#EA4335" d="M24 9.5c3.6 0 6.8 1.2 9.3 3.6l7-7C36.2 2.2 30.6 0 24 0 14.4 0 6.1 5.1 2.1 12.7l8.2 6.3C12.2 13.8 17.6 9.5 24 9.5z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
