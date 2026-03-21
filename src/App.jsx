import { useState, useEffect } from 'react'
import { getAllLedgers, getSetting, setSetting } from './db'
import SetupScreen from './components/SetupScreen'
import MainScreen from './components/MainScreen'
import LedgersScreen from './components/LedgersScreen'
import BottomNav from './components/BottomNav'

export default function App() {
  const [ready, setReady] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [tab, setTab] = useState('transactions')
  const [activeLedgerId, setActiveLedgerId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  function handleAdd() {
    setTab('transactions')
    setShowAdd(true)
  }

  useEffect(() => {
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
  }, [])

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

  return (
    <>
      <div className="screen-area">
        {tab === 'transactions' && <MainScreen ledgerId={activeLedgerId} showAdd={showAdd} onCloseAdd={() => setShowAdd(false)} />}
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
