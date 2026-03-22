import { useState, useEffect } from 'react'
import { getAllLedgers, getSetting, setSetting } from './db'
import { supabase } from './supabase'
import AuthScreen from './components/AuthScreen'
import SetupScreen from './components/SetupScreen'
import MainScreen from './components/MainScreen'
import LedgersScreen from './components/LedgersScreen'
import BottomNav from './components/BottomNav'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined=loading, null=unauthenticated, obj=authenticated
  const [ready, setReady] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [tab, setTab] = useState('transactions')
  const [activeLedgerId, setActiveLedgerId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Ledger init — runs after session is established
  useEffect(() => {
    if (!session) return
    async function init() {
      const ledgers = await getAllLedgers()
      if (ledgers.length === 0) {
        setIsSetup(false)
        setReady(true)
        return
      }
      const savedId = await getSetting('activeLedgerId')
      const valid = savedId && ledgers.find((l) => l.id === savedId)
      setActiveLedgerId(valid ? savedId : ledgers[0].id)
      setIsSetup(true)
      setReady(true)
    }
    init()
  }, [session])

  function handleAdd() {
    setTab('transactions')
    setShowAdd(true)
  }

  function handleSelectLedger(id) {
    setActiveLedgerId(id)
    setSetting('activeLedgerId', id)
    setTab('transactions')
  }

  function handleActiveLedgerDeleted(remainingLedgers) {
    if (remainingLedgers.length > 0) {
      const next = remainingLedgers[0].id
      setActiveLedgerId(next)
      setSetting('activeLedgerId', next)
    } else {
      setIsSetup(false)
    }
  }

  if (session === undefined) return null

  if (!session) return <AuthScreen />

  if (!ready) return null

  if (!isSetup) {
    return (
      <SetupScreen
        onDone={(ledgerId) => {
          setActiveLedgerId(ledgerId)
          setIsSetup(true)
        }}
      />
    )
  }

  return (
    <>
      <div className="screen-area">
        {tab === 'transactions' && (
          <MainScreen
            ledgerId={activeLedgerId}
            showAdd={showAdd}
            onCloseAdd={() => setShowAdd(false)}
            onSignOut={() => supabase.auth.signOut()}
          />
        )}
        {tab === 'ledgers' && (
          <LedgersScreen
            activeLedgerId={activeLedgerId}
            onSelect={handleSelectLedger}
            onActiveLedgerDeleted={handleActiveLedgerDeleted}
          />
        )}
      </div>
      <BottomNav active={tab} onChange={setTab} onAdd={handleAdd} />
      <style>{`
        .screen-area {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  )
}
