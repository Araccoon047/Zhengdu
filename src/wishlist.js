import { computed, reactive, watch } from 'vue'
import { chatState, contactById, contactDisplayName, sendIncomingText, sendOutgoing, showAppNotice } from './chat'
import { settings } from './settings'

const STORAGE_KEY = 'zhengdu_wishlist_v1'
const LIMIT_OVERRIDE_CHANCE = 5
const EXCLUSIVE_IGNORE_CHANCE = 8

const DEFAULT_ITEMS = [
  { id: 'wish-ring', name: '戒指', price: 520, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-handwritten-letter', name: '手写信', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-email', name: '电子信', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-herb-bottle', name: '草药瓶', price: 88, limit: 2, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-brooch', name: '胸针', price: 128, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-new-stickers', name: '新表情包', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-new-avatar', name: '新头像', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-update-feature', name: '快点更新新功能！', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-fix-bug', name: '能不能修修bug啊！', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-cuddle', name: '贴贴', price: 0, limit: 3, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-date', name: '出门约会', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-goods', name: '谷子', price: 68, limit: 3, image: '', noImage: true, exclusiveContactId: '' },
  { id: 'wish-attention', name: '老婆理理我', price: 0, limit: 1, image: '', noImage: true, exclusiveContactId: '' },
]

export const WISHLIST_COMPLETION_MESSAGE = '礼物正在打包中，请把礼物放在你生活中最常见的地方，可手写便签或信件，将礼物压在信/便签上。耐心等待物流。预计等待5到7天。对方收到礼物的速度因人而异，有概率提前或延迟。请不要担心。这几天请耐心留意TA的暗号或消息！'

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}
export function normalizeWishWidgetSize(value) {
  const match = String(value || '').trim().match(/^([1-4])\s*[xX×]\s*([1-4])$/)
  return match ? `${Number(match[1])}x${Number(match[2])}` : '2x1'
}
function makeId(prefix = 'wish') {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}
function clone(value) {
  return JSON.parse(JSON.stringify(value))
}
function normalizeItem(item, index) {
  const fallback = DEFAULT_ITEMS[index] || DEFAULT_ITEMS[0]
  return {
    id: String(item?.id || makeId('wish-item')).trim(),
    name: String(item?.name || fallback.name || '未命名愿望').trim().slice(0, 30) || '未命名愿望',
    price: Math.max(0, Math.round((Number(item?.price) || 0) * 100) / 100),
    limit: clampInt(item?.limit, 1, 99, fallback.limit || 1),
    image: typeof item?.image === 'string' ? item.image : '',
    noImage: item?.noImage !== false,
    exclusiveContactId: String(item?.exclusiveContactId || '').trim(),
  }
}
function normalizeOrder(order) {
  const status = ['pending', 'accepted', 'completed', 'rejected'].includes(order?.status)
    ? order.status
    : 'pending'
  const rawItems = Array.isArray(order?.items) ? order.items : []
  const items = rawItems.map((item) => ({
    itemId: String(item?.itemId || ''),
    name: String(item?.name || '未命名愿望').trim().slice(0, 30) || '未命名愿望',
    price: Math.max(0, Number(item?.price) || 0),
    qty: clampInt(item?.qty, 1, 999, 1),
    image: typeof item?.image === 'string' ? item.image : '',
    noImage: item?.noImage !== false,
  }))
  return {
    id: String(order?.id || makeId('wish-order')),
    no: String(order?.no || ''),
    contactId: String(order?.contactId || ''),
    contactName: String(order?.contactName || settings.opponentName || 'TA').slice(0, 30),
    items,
    total: Math.max(0, Number(order?.total) || 0),
    status,
    source: String(order?.source || 'auto'),
    overrideLimit: Boolean(order?.overrideLimit),
    createdAt: Number(order?.createdAt) || Date.now(),
    acceptedAt: Number(order?.acceptedAt) || 0,
    completedAt: Number(order?.completedAt) || 0,
    rejectedAt: Number(order?.rejectedAt) || 0,
    sentToChatAt: Number(order?.sentToChatAt) || 0,
  }
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const items = Array.isArray(saved.items) && saved.items.length
      ? saved.items.slice(0, 100).map(normalizeItem)
      : DEFAULT_ITEMS.map((item) => ({ ...item }))
    const orders = Array.isArray(saved.orders)
      ? saved.orders.slice(0, 500).map(normalizeOrder)
      : []
    const legacyMinDays = Math.max(1, Math.ceil((Number(saved.autoOrderMinMinutes) || 1440) / 1440))
    const legacyMaxDays = Math.max(legacyMinDays, Math.ceil((Number(saved.autoOrderMaxMinutes) || 4320) / 1440))
    const orderMinDays = clampInt(saved.orderMinDays, 1, 365, legacyMinDays || 1)
    const orderMaxDays = Math.max(orderMinDays, clampInt(saved.orderMaxDays, 1, 365, legacyMaxDays || 3))
    return {
      items,
      orders,
      maxKinds: clampInt(saved.maxKinds, 1, 20, 3),
      autoOrderEnabled: saved.autoOrderEnabled !== false,
      orderChance: clampInt(saved.orderChance, 0, 100, 35),
      orderMinDays,
      orderMaxDays,
      preferredContactId: String(saved.preferredContactId || '').trim(),
      widgetEnabled: saved.widgetEnabled === true,
      widgetSize: normalizeWishWidgetSize(saved.widgetSize),
    }
  } catch {
    return {
      items: DEFAULT_ITEMS.map((item) => ({ ...item })),
      orders: [],
      maxKinds: 3,
      autoOrderEnabled: true,
      orderChance: 35,
      orderMinDays: 1,
      orderMaxDays: 3,
      preferredContactId: '',
      widgetEnabled: false,
      widgetSize: '2x1',
    }
  }
}

const loaded = loadState()
export const wishlistState = reactive({
  ...loaded,
  focusOrderId: '',
})
export const wishlistStats = computed(() => ({
  pending: wishlistState.orders.filter((order) => order.status === 'pending').length,
  accepted: wishlistState.orders.filter((order) => order.status === 'accepted').length,
  completed: wishlistState.orders.filter((order) => order.status === 'completed').length,
  rejected: wishlistState.orders.filter((order) => order.status === 'rejected').length,
  total: wishlistState.orders.length,
}))

let audioContext = null
let engineTimer = null
let engineStarted = false

function persistState() {
  try {
    const payload = {
      items: wishlistState.items,
      orders: wishlistState.orders,
      maxKinds: wishlistState.maxKinds,
      autoOrderEnabled: wishlistState.autoOrderEnabled,
      orderChance: wishlistState.orderChance,
      orderMinDays: wishlistState.orderMinDays,
      orderMaxDays: wishlistState.orderMaxDays,
      preferredContactId: wishlistState.preferredContactId,
      widgetEnabled: wishlistState.widgetEnabled,
      widgetSize: wishlistState.widgetSize,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}

watch(wishlistState, persistState, { deep: true })

export function playWishChime() {
  if (!settings.inAppNotifications) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!audioContext) audioContext = new AudioCtx()
    audioContext.resume()
    const now = audioContext.currentTime
    ;[1046.5, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = now + index * 0.13
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.17)
    })
  } catch {}
}
function contactInfo(contactId = '') {
  const contact = contactId ? contactById(contactId) : null
  if (contact) {
    return {
      id: contact.id,
      name: contactDisplayName(contact),
      avatar: contact.avatar || '✦',
      avatarImage: contact.avatarImage || '',
      color: contact.color || 'var(--theme-primary)',
    }
  }
  return {
    id: contactId,
    name: settings.opponentName || 'TA',
    avatar: settings.opponentAvatar || 'TA',
    avatarImage: settings.opponentAvatarImage || '',
    color: settings.opponentAvatarColor || 'var(--theme-primary)',
  }
}
function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)]
}
function shuffled(list) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

export function addWishlistItem(data = {}) {
  const item = normalizeItem({
    ...data,
    id: makeId('wish-item'),
  }, wishlistState.items.length)
  wishlistState.items.push(item)
  return item
}
export function updateWishlistItem(id, data = {}) {
  const index = wishlistState.items.findIndex((item) => item.id === id)
  if (index < 0) return null
  wishlistState.items[index] = normalizeItem({ ...wishlistState.items[index], ...data, id }, index)
  return wishlistState.items[index]
}
export function removeWishlistItem(id) {
  const index = wishlistState.items.findIndex((item) => item.id === id)
  if (index < 0) return false
  wishlistState.items.splice(index, 1)
  return true
}
export function formatWishPrice(value) {
  const price = Math.max(0, Number(value) || 0)
  if (!price) return '无价'
  return `¥${Number.isInteger(price) ? price : price.toFixed(2)}`
}
export function formatWishDate(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function createContactOrder(options = {}) {
  const allAvailable = wishlistState.items.filter((item) => item.name)
  if (!allAvailable.length) return null
  const preferredContact = wishlistState.preferredContactId ? contactById(wishlistState.preferredContactId) : null
  const preferredItems = preferredContact
    ? allAvailable.filter((item) => !item.exclusiveContactId || item.exclusiveContactId === preferredContact.id)
    : allAvailable
  const available = preferredItems.length ? preferredItems : allAvailable
  const maxKinds = clampInt(wishlistState.maxKinds, 1, available.length, 1)
  const desiredKinds = 1 + Math.floor(Math.random() * maxKinds)
  let selected = shuffled(available).slice(0, desiredKinds)
  const exclusiveItem = selected.find((item) => item.exclusiveContactId)
  const restrictionFailed = Boolean(exclusiveItem && Math.random() * 100 < EXCLUSIVE_IGNORE_CHANCE)
  let contact = preferredContact
  if (exclusiveItem && !restrictionFailed) contact = contactById(exclusiveItem.exclusiveContactId)
  if (!contact) {
    const contacts = Array.isArray(chatState.contacts) ? chatState.contacts : []
    contact = contacts.length ? randomItem(contacts) : null
  }
  const contactId = contact?.id || ''
  selected = selected.filter((item) => {
    if (!item.exclusiveContactId || restrictionFailed) return true
    return item.exclusiveContactId === contactId
  })
  if (!selected.length) {
    const allowed = available.filter((item) => !item.exclusiveContactId || restrictionFailed || item.exclusiveContactId === contactId)
    selected = [randomItem(allowed.length ? allowed : available)]
  }
  let overrideLimit = false
  const items = selected.map((item) => {
    const overLimit = Math.random() * 100 < LIMIT_OVERRIDE_CHANCE
    if (overLimit) overrideLimit = true
    const qty = overLimit
      ? item.limit + 1 + Math.floor(Math.random() * 3)
      : 1 + Math.floor(Math.random() * Math.max(1, item.limit))
    return {
      itemId: item.id,
      name: item.name,
      price: item.price,
      qty,
      image: item.image,
      noImage: item.noImage,
    }
  })
  const info = contactInfo(contactId)
  const order = {
    id: makeId('wish-order'),
    no: `W${String(Date.now()).slice(-8)}`,
    contactId,
    contactName: info.name,
    items,
    total: items.reduce((sum, item) => sum + item.price * item.qty, 0),
    status: 'pending',
    source: String(options.source || 'auto'),
    overrideLimit,
    createdAt: Date.now(),
    acceptedAt: 0,
    completedAt: 0,
    rejectedAt: 0,
    sentToChatAt: 0,
  }
  wishlistState.orders.unshift(order)
  wishlistState.focusOrderId = order.id
  const names = items.map((item) => item.name).join('、')
  playWishChime()
  showAppNotice({
    actionPage: 'wishlist',
    actionId: order.id,
    contactId,
    name: info.name,
    avatar: info.avatar,
    avatarImage: info.avatarImage,
    color: info.color,
    text: `想要${names}，快来看看新小票。`,
  })
  return order
}

export function acceptWishOrder(id) {
  const order = wishlistState.orders.find((item) => item.id === id)
  if (!order || order.status !== 'pending') return false
  order.status = 'accepted'
  order.acceptedAt = Date.now()
  return true
}
export function rejectWishOrder(id) {
  const order = wishlistState.orders.find((item) => item.id === id)
  if (!order || order.status !== 'pending') return false
  order.status = 'rejected'
  order.rejectedAt = Date.now()
  const replies = [
    '你拒绝了我的愿望，我有一点失落，但还是会再想办法问问你的。',
    '好吧……那我把这个愿望先偷偷收起来，下次再许。',
    '虽然被拒绝了，可我还是想再靠近你一点。',
  ]
  sendIncomingText(randomItem(replies), order.contactId)
  return true
}
export function completeWishOrder(id) {
  const order = wishlistState.orders.find((item) => item.id === id)
  if (!order || order.status !== 'accepted') return false
  order.status = 'completed'
  order.completedAt = Date.now()
  return true
}
export function sendWishOrderToChat(id) {
  const order = wishlistState.orders.find((item) => item.id === id)
  if (!order || !order.contactId) return false
  const lines = order.items.map((item) => `${item.name} × ${item.qty}`).join('；')
  const sent = sendOutgoing(
    {
      type: 'wishOrder',
      text: `我想要这个！小票 ${order.no}：${lines}。`,
      wishOrder: {
        id: order.id,
        no: order.no,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({ ...item })),
      },
    },
    {
      targetKind: 'contact',
      targetId: order.contactId,
      scheduleReply: true,
    },
  )
  if (sent) order.sentToChatAt = Date.now()
  return sent
}
export function requestWishOrderFocus(id) {
  wishlistState.focusOrderId = String(id || '')
}
export function clearWishOrderFocus() {
  wishlistState.focusOrderId = ''
}

function scheduleNextOrder() {
  clearTimeout(engineTimer)
  engineTimer = null
  if (!engineStarted || !wishlistState.autoOrderEnabled) return
  const min = Math.min(wishlistState.orderMinDays, wishlistState.orderMaxDays)
  const max = Math.max(wishlistState.orderMinDays, wishlistState.orderMaxDays)
  const days = min + Math.random() * Math.max(1, max - min)
  engineTimer = window.setTimeout(() => {
    if (Math.random() * 100 < wishlistState.orderChance) createContactOrder({ source: 'auto' })
    scheduleNextOrder()
  }, Math.max(86400000, days * 86400000))
}
export function startWishlistEngine() {
  engineStarted = true
  scheduleNextOrder()
}
export function stopWishlistEngine() {
  engineStarted = false
  clearTimeout(engineTimer)
  engineTimer = null
}
export function refreshWishlistEngine() {
  scheduleNextOrder()
}
watch(
  () => [wishlistState.autoOrderEnabled, wishlistState.orderChance, wishlistState.orderMinDays, wishlistState.orderMaxDays],
  refreshWishlistEngine,
)