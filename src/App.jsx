import { useState, useEffect } from 'react'
import { getSetting } from './db'
import SetupScreen from './components/SetupScreen'
import TodayScreen from './components/TodayScreen'
import HistoryScreen from './components/HistoryScreen'
import DayDetail from './components/DayDetail'
import BottomNav from './components/BottomNav'

export default function App() {
  const [ready, setReady] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [tab, setTab] = useState('today')
  const [historyDate, setHistoryDate] = useState(null) // date string for detail view

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

  function handleHistorySelect(date) {
    setHistoryDate(date)
  }

  function handleBackFromDetail() {
    setHistoryDate(null)
  }

  return (
    <>
      <div className="screen-area">
        {tab === 'today' && <TodayScreen />}
        {tab === 'history' && !historyDate && (
          <HistoryScreen onSelectDate={handleHistorySelect} />
        )}
        {tab === 'history' && historyDate && (
          <DayDetail date={historyDate} onBack={handleBackFromDetail} />
        )}
      </div>
      <BottomNav active={tab} onChange={(t) => { setTab(t); setHistoryDate(null) }} />
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
