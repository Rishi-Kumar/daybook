import { useState, useEffect } from 'react'
import { getSetting } from './db'
import SetupScreen from './components/SetupScreen'
import TodayScreen from './components/TodayScreen'
import HistoryScreen from './components/HistoryScreen'
import BottomNav from './components/BottomNav'

export default function App() {
  const [ready, setReady] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [tab, setTab] = useState('today')

  useEffect(() => {
    getSetting('openingBalance').then((val) => {
      setIsSetup(val !== undefined)
      setReady(true)
    })
  }, [])

  if (!ready) return null

  if (!isSetup) {
    return <SetupScreen onDone={() => setIsSetup(true)} />
  }

  return (
    <>
      <div className="screen-area">
        {tab === 'today' && <TodayScreen />}
        {tab === 'history' && <HistoryScreen />}
      </div>
      <BottomNav active={tab} onChange={setTab} />
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
