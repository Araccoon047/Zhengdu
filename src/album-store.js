const DB_NAME = 'zhengdu_album_v1'
const DB_VERSION = 1
const STORE_NAME = 'photos'
const COLLECTIONS_KEY = 'zhengdu_album_collections_v1'
const DEFAULT_COLLECTIONS = [
  { id: 'default', name: '默认合集', kind: 'default', locked: true },
  { id: 'carousel', name: '轮播合集', kind: 'carousel', locked: true },
]

let dbPromise = null

function normalizeCollections(value) {
  const custom = (Array.isArray(value) ? value : [])
    .filter((item) => item && item.id && item.name && item.kind === 'custom')
    .map((item) => ({
      id: String(item.id),
      name: String(item.name).trim().slice(0, 30),
      kind: 'custom',
      locked: false,
      createdAt: Number(item.createdAt) || Date.now(),
    }))
    .filter((item) => item.name)
  return [...DEFAULT_COLLECTIONS.map((item) => ({ ...item })), ...custom]
}

export function listAlbumCollections() {
  try {
    return normalizeCollections(JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '[]'))
  } catch {
    return DEFAULT_COLLECTIONS.map((item) => ({ ...item }))
  }
}

function saveCustomCollections(collections) {
  const custom = collections.filter((item) => item.kind === 'custom')
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(custom))
}

export function addAlbumCollection(name) {
  const clean = String(name || '').trim().slice(0, 30)
  if (!clean) return null
  const collections = listAlbumCollections()
  if (collections.some((item) => item.name === clean)) return null
  const collection = {
    id: `album-col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    kind: 'custom',
    locked: false,
    createdAt: Date.now(),
  }
  saveCustomCollections([...collections, collection])
  return collection
}

export function importAlbumCollections(value) {
  const collections = listAlbumCollections()
  let imported = 0
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || item.kind !== 'custom' || !item.id || !item.name) continue
    const id = String(item.id)
    const name = String(item.name).trim().slice(0, 30)
    if (!name || collections.some((collection) => collection.id === id || collection.name === name)) continue
    collections.push({ id, name, kind: 'custom', locked: false, createdAt: Number(item.createdAt) || Date.now() })
    imported += 1
  }
  saveCustomCollections(collections)
  return imported
}

export function renameAlbumCollection(id, name) {
  const clean = String(name || '').trim().slice(0, 30)
  if (!clean) return false
  const collections = listAlbumCollections()
  const target = collections.find((item) => item.id === id && item.kind === 'custom')
  if (!target || collections.some((item) => item.id !== id && item.name === clean)) return false
  target.name = clean
  saveCustomCollections(collections)
  return true
}

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持本地相册存储'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('相册数据库打开失败'))
  })
  return dbPromise
}

export async function listPhotos() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const photos = (request.result || []).sort((a, b) => a.id - b.id)
      resolve(photos)
    }
    request.onerror = () => reject(request.error || new Error('相册读取失败'))
  })
}

export async function addPhoto(photo) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const request = tx.objectStore(STORE_NAME).add({
      name: photo.name || '照片',
      src: photo.src,
      collectionId: String(photo.collectionId || 'default'),
      createdAt: photo.createdAt || Date.now(),
    })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('照片保存失败'))
  })
}

export async function deletePhoto(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const request = tx.objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error || new Error('照片删除失败'))
  })
}

export async function putPhoto(photo) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const request = tx.objectStore(STORE_NAME).put({
      ...photo,
      name: photo.name || '照片',
      src: photo.src,
      createdAt: photo.createdAt || Date.now(),
    })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('照片保存失败'))
  })
}

export async function listCarouselPhotos() {
  return (await listPhotos()).filter((photo) => photo.collectionId === 'carousel')
}

export async function setPhotoCollection(photoId, collectionId) {
  const photos = await listPhotos()
  const photo = photos.find((item) => item.id === Number(photoId) || item.id === photoId)
  if (!photo) return false
  const valid = listAlbumCollections().some((item) => item.id === collectionId)
  await putPhoto({ ...photo, collectionId: valid ? collectionId : 'default' })
  return true
}

export async function removeAlbumCollection(id) {
  const collections = listAlbumCollections()
  const target = collections.find((item) => item.id === id && item.kind === 'custom')
  if (!target) return false
  const photos = await listPhotos()
  for (const photo of photos) {
    if (photo.collectionId === id) await putPhoto({ ...photo, collectionId: 'default' })
  }
  saveCustomCollections(collections.filter((item) => item.id !== id))
  return true
}

export async function clearPhotos() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error || new Error('相册清空失败'))
  })
}