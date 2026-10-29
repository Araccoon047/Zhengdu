const DB_NAME = 'zhengdu_persistence_v1'
const STORE_NAME = 'entries'
const APP_PREFIX = 'zhengdu_'
const META_KEY = 'zhengdu-persistence-meta'
const mirror = new Map()
const pendingWrites = new Set()
let dbPromise = null
let installed = false

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function track(promise) {
  pendingWrites.add(promise)
  promise.finally(() => pendingWrites.delete(promise))
  return promise
}

function persistRecord(key, value) {
  const record = { key, value: String(value ?? ''), updatedAt: Date.now() }
  return track(openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })).catch(() => {}))
}

function deleteRecord(key) {
  return track(openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(key)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })).catch(() => {}))
}

function clearRecords() {
  return track(openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })).catch(() => {}))
}

export async function flushPersistence() {
  for (let round = 0; round < 2 && pendingWrites.size; round += 1) {
    await Promise.allSettled([...pendingWrites])
  }
}

export function listMirroredKeys() {
  const keys = new Set(mirror.keys())
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(APP_PREFIX)) keys.add(key)
    }
  } catch {}
  return [...keys]
}

export function getMirroredValue(key) {
  return mirror.has(key) ? mirror.get(key) : null
}

function readLocalWriteTimes() {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}


function installMirror() {
  if (installed || typeof localStorage === 'undefined' || typeof Storage === 'undefined') return
  installed = true
  const originalGetItem = Storage.prototype.getItem
  const originalSetItem = Storage.prototype.setItem
  const originalRemoveItem = Storage.prototype.removeItem
  const originalClear = Storage.prototype.clear

  function markLocalWrite(key) {
    try {
      const times = readLocalWriteTimes()
      times[key] = Date.now()
      originalSetItem.call(localStorage, META_KEY, JSON.stringify(times))
    } catch {}
  }
  function clearLocalWrite(key) {
    try {
      const times = readLocalWriteTimes()
      delete times[key]
      originalSetItem.call(localStorage, META_KEY, JSON.stringify(times))
    } catch {}
  }

  Storage.prototype.getItem = function patchedGetItem(key) {
    if (this === localStorage && String(key).startsWith(APP_PREFIX) && mirror.has(String(key))) {
      return mirror.get(String(key))
    }
    return originalGetItem.call(this, key)
  }
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    const textKey = String(key)
    const textValue = String(value)
    if (this === localStorage && textKey.startsWith(APP_PREFIX)) {
      mirror.set(textKey, textValue)
      persistRecord(textKey, textValue)
      try {
        const result = originalSetItem.call(this, textKey, textValue)
        markLocalWrite(textKey)
        return result
      } catch {
        window.dispatchEvent(new CustomEvent('zhengdu-storage-mirrored', { detail: { key: textKey } }))
        return undefined
      }
    }
    return originalSetItem.call(this, key, value)
  }
  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    const textKey = String(key)
    if (this === localStorage && textKey.startsWith(APP_PREFIX)) {
      mirror.delete(textKey)
      deleteRecord(textKey)
      clearLocalWrite(textKey)
    }
    return originalRemoveItem.call(this, key)
  }
  Storage.prototype.clear = function patchedClear() {
    if (this === localStorage) {
      mirror.clear()
      clearRecords()
      try { originalRemoveItem.call(this, META_KEY) } catch {}
    }
    return originalClear.call(this)
  }

}

export async function initializePersistence() {
  const recordTimes = new Map()
  try {
    const db = await openDb()
    const records = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    for (const record of records) {
      if (record?.key?.startsWith(APP_PREFIX) && typeof record.value === 'string') {
        mirror.set(record.key, record.value)
        recordTimes.set(record.key, Number(record.updatedAt) || 0)
      }
    }
  } catch {}
  try {
    const localTimes = readLocalWriteTimes()
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(APP_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (value === null) continue
      const localTime = Number(localTimes[key]) || 0
      const mirrorTime = recordTimes.get(key) || 0
      if (mirror.has(key) && mirrorTime > localTime) continue
      mirror.set(key, value)
      persistRecord(key, value)
    }
  } catch {}

  installMirror()
  try { await navigator.storage?.persist?.() } catch {}
  return mirror.size
}
