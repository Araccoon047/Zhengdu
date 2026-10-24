import { chatState, importChatBundle, saveChatDataNow } from './chat'
import { settings, saveSettingsNow } from './settings'
import { importMomentPosts, momentsState } from './moments'
import { setLoadedStickers, stickerState, importStickerGroups, loadStickerLibrary } from './stickers'
import { clearPhotos, listPhotos, putPhoto } from './album-store'
import { clearStickers, listStickers, putSticker } from './sticker-store'
import { isNativeApp, saveTextFileNatively } from './native-bridge'

const BACKUP_FORMAT = 'zhengdu-backup'
const BACKUP_VERSION = 1
const APP_PREFIX = 'zhengdu_'
const STORAGE_KEYS = {
  chat: 'zhengdu_sms_v1',
  groups: 'zhengdu_groups_v1',
  settings: 'zhengdu_custom_settings_v1',
  stickerGroups: 'zhengdu_sticker_groups_v1',
  moments: 'zhengdu_moments_v1',
}

export const EXPORT_CATEGORIES = [
  { key: 'characters', label: '角色与群聊', hint: '联系人资料、头像、背景和群聊信息' },
  { key: 'cards', label: '字卡', hint: '每个联系人的字卡和字卡分组' },
  { key: 'stickers', label: '表情包', hint: '表情包文件、分组和使用分配' },
  { key: 'chats', label: '聊天与朋友圈', hint: '聊天记录和朋友圈动态' },
  { key: 'settings', label: '网站设置', hint: '纪念日、背景、TA的回复等设置' },
  { key: 'album', label: '相册照片', hint: '相册中的全部照片' },
]

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
  const keys = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith(APP_PREFIX)) keys.push(key)
    }
  } catch (e) {
    /* 忽略无法读取本地存储的场景 */
  }
  return keys
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
  const items = [
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
    } catch (e) {
      data.album = []
    }
  }
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
    return false
  })
}

export async function importBackup(backup, categories) {
  const selected = new Set(categories)
  const data = backup.data || {}
  const result = { characters: 0, groups: 0, cards: 0, chats: 0, moments: 0, stickers: 0, settings: 0, album: 0 }

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
      await putSticker(sticker)
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
    for (const photo of data.album || []) {
      await putPhoto(photo)
      result.album += 1
    }
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
    sessionStorage.clear()
  } catch (e) {
    /* 忽略 */
  }
}