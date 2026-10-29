import { chatState, importChatBundle, saveChatDataNow } from './chat'
import { settings, saveSettingsNow } from './settings'
import { importMomentPosts, momentsState } from './moments'
import { setLoadedStickers, stickerState, importStickerGroups, loadStickerLibrary } from './stickers'
import { clearPhotos, importAlbumCollections, listAlbumCollections, listPhotos, putPhoto } from './album-store'
import { clearStickers, listStickers, putSticker } from './sticker-store'
import { isNativeApp, saveTextFileNatively } from './native-bridge'
import { listMirroredKeys } from './persistence'
import {
  APP_STORAGE_GROUPS,
  EXPORT_CATEGORIES,
  isAppDataCategory,
  readStorageCategory,
  storageKeysForCategory,
} from './app-data-catalog'
export { EXPORT_CATEGORIES }

const BACKUP_FORMAT = 'zhengdu-backup'
const BACKUP_VERSION = 2
const APP_PREFIX = 'zhengdu_'
const STORAGE_KEYS = {
  chat: 'zhengdu_sms_v1',
  groups: 'zhengdu_groups_v1',
  settings: 'zhengdu_custom_settings_v1',
  stickerGroups: 'zhengdu_sticker_groups_v1',
  moments: 'zhengdu_moments_v1',
}


function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0)
  if (value < 1024) return `${Math.round(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function textBytes(text) {
  return new Blob([String(text || '')]).size
}

function storageValueBytes(key) {
  try {
    return textBytes(localStorage.getItem(key) || '')
  } catch (e) {
    return 0
  }
}

function localKeys() {
  return listMirroredKeys()
}

const MUSIC_FILES_DB = 'zhengdu_music_files_v1'
const MUSIC_FILES_STORE = 'files'

function openMusicFilesDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MUSIC_FILES_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MUSIC_FILES_STORE)) db.createObjectStore(MUSIC_FILES_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl) {
  const text = String(dataUrl || '')
  const match = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) return new Blob([text])
  const type = match[1] || 'application/octet-stream'
  const binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

async function serializeMusicFile(key, value) {
  if (value instanceof Blob) {
    return {
      key: String(key),
      kind: 'data-url',
      name: String(value.name || key),
      type: String(value.type || 'application/octet-stream'),
      lastModified: Number(value.lastModified) || 0,
      data: await blobToDataUrl(value),
    }
  }
  if (value instanceof ArrayBuffer) {
    const blob = new Blob([value], { type: 'application/octet-stream' })
    return { key: String(key), kind: 'data-url', name: String(key), type: blob.type, lastModified: 0, data: await blobToDataUrl(blob) }
  }
  if (typeof value === 'string') return { key: String(key), kind: 'text', data: value }
  return { key: String(key), kind: 'json', data: clone(value) }
}

async function exportMusicFiles() {
  try {
    const db = await openMusicFilesDb()
    const transaction = db.transaction(MUSIC_FILES_STORE, 'readonly')
    const store = transaction.objectStore(MUSIC_FILES_STORE)
    const [keys, values] = await Promise.all([requestResult(store.getAllKeys()), requestResult(store.getAll())])
    const files = []
    for (let index = 0; index < keys.length; index += 1) files.push(await serializeMusicFile(keys[index], values[index]))
    return files
  } catch {
    return []
  }
}

async function measureMusicFiles() {
  try {
    const db = await openMusicFilesDb()
    const transaction = db.transaction(MUSIC_FILES_STORE, 'readonly')
    const values = await requestResult(transaction.objectStore(MUSIC_FILES_STORE).getAll())
    return values.reduce((sum, value) => {
      if (value instanceof Blob) return sum + Number(value.size || 0)
      if (value instanceof ArrayBuffer) return sum + value.byteLength
      if (typeof value === 'string') return sum + textBytes(value)
      return sum
    }, 0)
  } catch {
    return 0
  }
}

async function clearMusicFiles() {
  try {
    const db = await openMusicFilesDb()
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MUSIC_FILES_STORE, 'readwrite')
      transaction.objectStore(MUSIC_FILES_STORE).clear()
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
  } catch {}
}

async function importMusicFiles(files) {
  if (!Array.isArray(files) || !files.length) return 0
  const db = await openMusicFilesDb()
  let imported = 0
  for (const file of files) {
    if (!file?.key) continue
    let value = null
    if (file.kind === 'data-url') value = dataUrlToBlob(file.data)
    else if (file.kind === 'text') value = String(file.data || '')
    else value = clone(file.data)
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MUSIC_FILES_STORE, 'readwrite')
      transaction.objectStore(MUSIC_FILES_STORE).put(value, String(file.key))
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    imported += 1
  }
  return imported
}

function isCompressibleImage(value) {
  return typeof value === 'string' && /^data:image\/(?!gif|svg)/i.test(value)
}

function countImages(value, totals) {
  if (typeof value === 'string') {
    if (isCompressibleImage(value)) {
      totals.count += 1
      totals.bytes += textBytes(value)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => countImages(item, totals))
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => countImages(item, totals))
  }
}

export async function getStorageDetails() {
  let photos = []
  let stickers = []
  try {
    photos = await listPhotos()
  } catch (e) {
    /* IndexedDB 不可用时按空相册计算 */
  }
  try {
    stickers = await listStickers()
  } catch (e) {
    /* IndexedDB 不可用时按空表情包计算 */
  }

  const chatBytes = storageValueBytes(STORAGE_KEYS.chat) + storageValueBytes(STORAGE_KEYS.groups)
  const settingsBytes = storageValueBytes(STORAGE_KEYS.settings)
  const stickerGroupBytes = storageValueBytes(STORAGE_KEYS.stickerGroups)
  const momentsBytes = storageValueBytes(STORAGE_KEYS.moments)
  const photoBytes = photos.reduce((sum, photo) => sum + textBytes(photo.src), 0)
  const stickerBytes = stickers.reduce((sum, sticker) => sum + textBytes(sticker.src), 0)
  const musicFileBytes = await measureMusicFiles()
  const appCategoryItems = Object.entries(APP_STORAGE_GROUPS).map(([key]) => {
    const keys = storageKeysForCategory(key)
    const category = EXPORT_CATEGORIES.find((item) => item.key === key)
    return {
      label: category?.label || key,
      bytes: keys.reduce((sum, storageKey) => sum + storageValueBytes(storageKey), 0),
      hint: `${keys.length} 项数据`,
    }
  }).filter((item) => item.bytes > 0)
  const items = [
    ...appCategoryItems,
    ...(musicFileBytes ? [{ label: '音乐本地音频', bytes: musicFileBytes, hint: 'IndexedDB 中的上传音频' }] : []),
    { label: '聊天、角色与字卡', bytes: chatBytes, hint: `${chatState.contacts.length} 个联系人，${chatState.groups.length} 个群聊` },
    { label: '网站设置', bytes: settingsBytes, hint: '背景、纪念日、TA的回复与头像框' },
    { label: '表情包文件', bytes: stickerBytes, hint: `${stickers.length} 个表情包` },
    { label: '表情包分组', bytes: stickerGroupBytes, hint: `${stickerState.groups.length} 个分组` },
    { label: '相册照片', bytes: photoBytes, hint: `${photos.length} 张照片` },
  ].filter((item) => item.bytes > 0)
  return {
    items,
    total: items.reduce((sum, item) => sum + item.bytes, 0),
    contacts: chatState.contacts.length,
    messages: chatState.contacts.reduce((sum, contact) => sum + (contact.messages?.length || 0), 0),
    photos: photos.length,
    stickers: stickers.length,
  }
}

export async function estimateCompression() {
  let photos = []
  let stickers = []
  try {
    photos = await listPhotos()
  } catch (e) {
    /* 忽略 */
  }
  try {
    stickers = await listStickers()
  } catch (e) {
    /* 忽略 */
  }
  const totals = { count: 0, bytes: 0 }
  countImages(settings, totals)
  countImages(chatState.contacts, totals)
  countImages(chatState.groups, totals)
  countImages(stickers, totals)
  countImages(photos, totals)
  return {
    count: totals.count,
    bytes: totals.bytes,
    seconds: Math.max(2, Math.ceil(totals.count * 0.35)),
  }
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败'))
    image.src = src
  })
}

async function compressImageDataUrl(src, maxSide = 1280, quality = 0.78) {
  if (!isCompressibleImage(src)) return src
  try {
    const image = await loadImage(src)
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, width, height)
    const output = canvas.toDataURL('image/webp', quality)
    return output.length < src.length * 0.98 ? output : src
  } catch (e) {
    return src
  }
}

function maxSideForKey(key, parent = {}) {
  if (key === 'avatarImage' || key === 'senderAvatarImage' || key === 'opponentAvatarImage') {
    return 320
  }
  if (
    key === 'avatarFrame' ||
    key === 'senderAvatarFrame' ||
    key === 'userAvatarFrame' ||
    key === 'anniversaryAvatarA' ||
    key === 'anniversaryAvatarB'
  ) {
    return 480
  }
  if (parent?.type === 'sticker' || (key === 'src' && parent?.groupId)) return 480
  if (parent?.type === 'photo') return 1600
  if (key === 'src') return 1280
  return 1280
}

async function compressDeep(value, counters, onProgress, parent = {}) {
  if (typeof value === 'string') {
    if (!isCompressibleImage(value)) return value
    const before = textBytes(value)
    const result = await compressImageDataUrl(value, maxSideForKey('', parent))
    const after = textBytes(result)
    counters.processed += 1
    if (after < before) {
      counters.saved += before - after
      counters.compressed += 1
    }
    onProgress?.(counters.processed, counters.total)
    return result
  }
  if (Array.isArray(value)) {
    const result = []
    for (const item of value) result.push(await compressDeep(item, counters, onProgress))
    return result
  }
  if (value && typeof value === 'object') {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && isCompressibleImage(item)) {
        const before = textBytes(item)
        const compressed = await compressImageDataUrl(item, maxSideForKey(key, value))
        const after = textBytes(compressed)
        counters.processed += 1
        if (after < before) {
          counters.saved += before - after
          counters.compressed += 1
        }
        onProgress?.(counters.processed, counters.total)
        result[key] = compressed
      } else {
        result[key] = await compressDeep(item, counters, onProgress, value)
      }
    }
    return result
  }
  return value
}

export async function compressAllImages(onProgress) {
  let stickers = []
  let photos = []
  try {
    stickers = await listStickers()
  } catch (e) {
    /* 忽略 */
  }
  try {
    photos = await listPhotos()
  } catch (e) {
    /* 忽略 */
  }
  const estimate = await estimateCompression()
  const counters = { total: estimate.count, processed: 0, compressed: 0, saved: 0 }

  const compressedSettings = await compressDeep(clone(settings), counters, onProgress)
  const compressedContacts = await compressDeep(clone(chatState.contacts), counters, onProgress)
  const compressedGroups = await compressDeep(clone(chatState.groups), counters, onProgress)

  Object.assign(settings, compressedSettings)
  chatState.contacts.splice(0, chatState.contacts.length, ...compressedContacts)
  chatState.groups.splice(0, chatState.groups.length, ...compressedGroups)
  saveSettingsNow()
  saveChatDataNow()

  const compressedStickers = []
  for (const sticker of stickers) {
    const src = await compressImageDataUrl(sticker.src, 480, 0.8)
    const before = textBytes(sticker.src)
    const after = textBytes(src)
    counters.processed += 1
    if (after < before) {
      counters.saved += before - after
      counters.compressed += 1
    }
    const next = { ...sticker, src }
    compressedStickers.push(next)
    await putSticker(next)
    onProgress?.(counters.processed, counters.total)
  }
  setLoadedStickers(compressedStickers)

  for (const photo of photos) {
    const src = await compressImageDataUrl(photo.src, 1600, 0.78)
    const before = textBytes(photo.src)
    const after = textBytes(src)
    counters.processed += 1
    if (after < before) {
      counters.saved += before - after
      counters.compressed += 1
    }
    await putPhoto({ ...photo, src })
    onProgress?.(counters.processed, counters.total)
  }

  return {
    compressed: counters.compressed,
    processed: counters.processed,
    saved: counters.saved,
  }
}
function contactProfile(contact) {
  return {
    id: contact.id,
    name: contact.name,
    note: contact.note,
    avatar: contact.avatar,
    color: contact.color,
    avatarImage: contact.avatarImage,
    avatarFrame: contact.avatarFrame,
    chatBackground: contact.chatBackground,
    chatBackgroundOpacity: contact.chatBackgroundOpacity,
    momentsCover: contact.momentsCover,
    momentsCoverOpacity: contact.momentsCoverOpacity,
    replyFrequency: contact.replyFrequency,
    notificationSound: contact.notificationSound,
    backstory: contact.backstory,
  }
}

export async function buildBackup(categories) {
  const selected = new Set(categories)
  const data = {}
  if (selected.has('characters')) {
    data.characters = chatState.contacts.map(contactProfile)
    data.groups = chatState.groups.map((group) => ({
      id: group.id,
      name: group.name,
      memberIds: group.memberIds,
      avatar: group.avatar,
      color: group.color,
      chatBackground: group.chatBackground,
      chatBackgroundOpacity: group.chatBackgroundOpacity,
      pinned: group.pinned,
      muted: group.muted,
      createdAt: group.createdAt,
    }))
  }
  if (selected.has('cards')) {
    data.cards = chatState.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      note: contact.note,
      cardGroups: contact.cardGroups,
      cards: contact.cards,
    }))
  }
  if (selected.has('chats')) {
    data.chats = chatState.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      note: contact.note,
      messages: contact.messages,
    }))
    data.groupChats = chatState.groups.map((group) => ({
      id: group.id,
      name: group.name,
      messages: group.messages,
    }))
    data.moments = clone(momentsState.posts)
  }
  if (selected.has('stickers')) {
    try {
      data.stickers = await listStickers()
    } catch (e) {
      data.stickers = []
    }
    data.stickerGroups = clone(stickerState.groups)
  }
  if (selected.has('settings')) data.settings = clone(settings)
  if (selected.has('album')) {
    try {
      data.album = await listPhotos()
      data.albumCollections = listAlbumCollections().filter((collection) => collection.kind === 'custom')
    } catch (e) {
      data.album = []
      data.albumCollections = []
    }
  }
  const appStorage = {}
  for (const category of Object.keys(APP_STORAGE_GROUPS)) {
    if (!selected.has(category)) continue
    const entries = readStorageCategory(category)
    if (Object.keys(entries).length) appStorage[category] = entries
  }
  if (Object.keys(appStorage).length) data.appStorage = appStorage
  if (selected.has('music')) data.musicFiles = await exportMusicFiles()
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: [...selected],
    data,
  }
}

export async function exportBackup(categories) {
  const backup = await buildBackup(categories)
  const text = JSON.stringify(backup)
  const blob = new Blob([text], { type: 'application/json' })
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `zhengdu-backup-${stamp}.json`
  const savedNatively = isNativeApp() && saveTextFileNatively(filename, 'application/json', text)
  if (!savedNatively) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return { filename, bytes: textBytes(text), backup, savedNatively }
}

export function parseBackupText(text) {
  const backup = JSON.parse(text)
  if (!backup || backup.format !== BACKUP_FORMAT || !backup.data) {
    throw new Error('不是有效的争渡备份文件')
  }
  return backup
}

export function availableImportCategories(backup) {
  const data = backup?.data || {}
  return EXPORT_CATEGORIES.filter((category) => {
    if (category.key === 'characters') return Array.isArray(data.characters)
    if (category.key === 'cards') return Array.isArray(data.cards)
    if (category.key === 'chats') return Array.isArray(data.chats)
    if (category.key === 'stickers') return Array.isArray(data.stickers)
    if (category.key === 'settings') return Boolean(data.settings)
    if (category.key === 'album') return Array.isArray(data.album)
    if (isAppDataCategory(category.key)) return Boolean(data.appStorage?.[category.key]) || (category.key === 'music' && Array.isArray(data.musicFiles))
    return false
  })
}

export async function importBackup(backup, categories) {
  const selected = new Set(categories)
  const data = backup.data || {}
  const result = { characters: 0, groups: 0, cards: 0, chats: 0, moments: 0, stickers: 0, settings: 0, album: 0, appData: 0, musicFiles: 0, needsReload: false }

  if (selected.has('characters')) {
    const imported = importChatBundle({
      characters: data.characters || [],
      groups: data.groups || [],
    })
    result.characters = imported.importedCharacters
    result.groups = imported.importedGroups
  }
  if (selected.has('cards')) {
    result.cards = importChatBundle({ cards: data.cards || [] }).importedCards
  }
  if (selected.has('chats')) {
    result.chats = importChatBundle({
      chats: data.chats || [],
      groupChats: data.groupChats || [],
    }).importedChats
    result.moments = importMomentPosts(data.moments || [])
  }
  if (selected.has('stickers')) {
    const groups = importStickerGroups(data.stickerGroups || [])
    for (const sticker of data.stickers || []) {
      await putSticker(clone(sticker))
      result.stickers += 1
    }
    await loadStickerLibrary()
    result.groups += groups
  }
  if (selected.has('settings') && data.settings) {
    Object.assign(settings, clone(data.settings))
    saveSettingsNow()
    result.settings = 1
  }
  if (selected.has('album')) {
    importAlbumCollections(data.albumCollections || [])
    const validCollectionIds = new Set(listAlbumCollections().map((collection) => collection.id))
    for (const photo of data.album || []) {
      const collectionId = validCollectionIds.has(photo.collectionId) ? photo.collectionId : 'default'
      await putPhoto({ ...clone(photo), collectionId })
      result.album += 1
    }
  }
  const appStorage = data.appStorage || {}
  for (const [category, entries] of Object.entries(appStorage)) {
    if (!selected.has(category) || !isAppDataCategory(category) || !entries || typeof entries !== 'object') continue
    for (const [key, value] of Object.entries(entries)) {
      if (!key.startsWith(APP_PREFIX)) continue
      try {
        localStorage.setItem(key, String(value ?? ''))
        result.appData += 1
      } catch {}
    }
    result.needsReload = true
  }
  if (selected.has('music') && Array.isArray(data.musicFiles)) {
    result.musicFiles = await importMusicFiles(data.musicFiles)
    if (result.musicFiles) result.needsReload = true
  }
  if (result.needsReload && typeof window !== 'undefined') {
    window.setTimeout(() => window.location.reload(), 900)
  }
  return result
}

export async function clearAllAppData() {
  for (const key of localKeys()) localStorage.removeItem(key)
  try {
    await clearPhotos()
  } catch (e) {
    /* 忽略 */
  }
  try {
    await clearStickers()
  } catch (e) {
    /* 忽略 */
  }
  try {
    await clearMusicFiles()
  } catch (e) {
    /* ignore */
  }
  try {
    sessionStorage.clear()
  } catch (e) {
    /* 忽略 */
  }
}
