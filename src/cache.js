const CACHE_KEY = 'daybook_cache'
const QUEUE_KEY = 'daybook_queue'

export function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setCache(ledgers, transactions) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ledgers, transactions }))
  } catch {}
}

// Apply an updater fn to the full cache object { ledgers, transactions }
export function patchCache(fn) {
  const cache = getCache()
  if (!cache) return
  const next = fn(cache)
  setCache(next.ledgers, next.transactions)
}

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function enqueue(op, args) {
  try {
    const queue = getQueue()
    queue.push({ op, args })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {}
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function getLocalSetting(key) {
  return localStorage.getItem(`daybook_setting_${key}`) ?? null
}

export function setLocalSetting(key, value) {
  try {
    localStorage.setItem(`daybook_setting_${key}`, String(value))
  } catch {}
}
