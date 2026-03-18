import { useState, useEffect } from 'react'
import { getSetting } from './db'
import SetupScreen from './components/SetupScreen'
import MainScreen from './components/MainScreen'

export default function App() {
  const [ready, setReady] = useState(false)
  const [isSetup, setIsSetup] = useState(false)

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

  return <MainScreen />
}
