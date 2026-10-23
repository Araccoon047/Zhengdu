const DB_NAME = 'zhengdu_album_v1'
const DB_VERSION = 1
const STORE_NAME = 'photos'

let dbPromise = null

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

export async function clearPhotos() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error || new Error('相册清空失败'))
  })
}