import { reactive, watch } from 'vue'
import initial from './data/sms.json'
import { settings } from './settings'
import { store } from './store'
import { randomIncomingNudge } from './nudge'
import systemCardsData from './data/system-cards.json'
import { loadStickerLibrary, randomStickerForContact, stickerState } from './stickers'
import { listPhotos } from './album-store'
import musicData from './data/music.json'

const STORAGE_KEY = 'zhengdu_sms_v1'
const GROUPS_KEY = 'zhengdu_groups_v1'
const CALL_KEY = 'zhengdu_active_call_v1'
const STORAGE_VERSION = 2
const DEFAULT_CARD_GROUPS = [
  { id: 'basic', name: '基础' },
  { id: 'report', name: '报备' },
  { id: 'weather', name: '天气' },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function clampOpacity(value, fallback = 60) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback
}

const LEGACY_BLUE_COLORS = new Set(['#4a90e2', '#69b1ff', '#91caff'])

function themeAwareColor(value, fallback = 'var(--theme-primary)') {
  const color = String(value || '').trim()
  if (!color || LEGACY_BLUE_COLORS.has(color.toLowerCase())) return fallback
  return color
}
function normalizeContact(contact, index = 0, legacy = false) {
  const source = contact || {}
  const sourceGroups = Array.isArray(source.cardGroups)
    ? source.cardGroups.filter((group) => group && group.name)
    : []
  const cardGroups = sourceGroups.length
    ? sourceGroups.map((group) => ({
        id: String(group.id || makeId('g')),
        name: String(group.name).trim(),
        // 锁定分组不参与抽卡，但仍保留在字卡库里可见、可解锁
        locked: group.locked === true,
      }))
    : clone(DEFAULT_CARD_GROUPS).map((group) => ({ ...group, locked: false }))
  const groupIds = new Set(cardGroups.map((group) => group.id))
  const cardList = Array.isArray(source.cards) ? source.cards : []
  const cards = cardList
    .map((card) => {
      const text =
        typeof card === 'string'
          ? card
          : String(card?.text ?? card?.content ?? '').trim()
      if (!text) return null
      const groupId =
        typeof card === 'object' && card?.groupId && groupIds.has(card.groupId)
          ? card.groupId
          : typeof card === 'string' && groupIds.has('basic')
            ? 'basic'
            : ''
      return {
        id: typeof card === 'object' && card?.id ? card.id : makeId('card'),
        text: text.trim(),
        groupId,
      }
    })
    .filter(Boolean)
  const legacyDefaultNames = ['淅沥沥', '海豹观察员', '争渡小助手']
  const customLegacyName =
    legacy &&
    index === 0 &&
    settings.opponentName &&
    settings.opponentName !== '淅沥沥'
      ? settings.opponentName
      : ''
  let name = String((index === 0 && customLegacyName) || source.name || 'TA').trim() || 'TA'
  if (legacy && legacyDefaultNames.includes(name) && !customLegacyName) name = 'TA'
  const note = String(source.note || (legacy ? name : source.name) || name).trim() || name
  return {
    id: source.id || makeId('c'),
    name,
    note,
    gender: ['male', 'female'].includes(source.gender) ? source.gender : 'unspecified',
    avatar: String(source.avatar || 'T').slice(0, 8),
    color: themeAwareColor(source.color),
    avatarImage:
      source.avatarImage ||
      (legacy && index === 0 ? settings.opponentAvatarImage || '' : ''),
    avatarFrame: source.avatarFrame || '',
    chatBackground:
      source.chatBackground ||
      (legacy && index === 0 ? settings.chatBackground || '' : ''),
    chatBackgroundOpacity: clampOpacity(source.chatBackgroundOpacity),
    momentsCover: source.momentsCover || '',
    momentsCoverOpacity: 100,
    cardGroups,
    cards,
    stickers: Array.isArray(source.stickers) ? source.stickers : [],
    replyFrequency: ['fast', 'normal', 'slow'].includes(source.replyFrequency)
      ? source.replyFrequency
      : 'normal',
    notificationSound: ['default', 'soft', 'clear', 'none'].includes(
      source.notificationSound
    )
      ? source.notificationSound
      : 'default',
    backstory: source.backstory || '',
    // 互动卡功能已下线，历史里的 interaction 消息直接丢弃，避免聊天里留下空白气泡
    messages: Array.isArray(source.messages)
      ? source.messages.filter((message) => message?.type !== 'interaction')
      : [],
    pinned: Boolean(source.pinned),
    muted: Boolean(source.muted),
  }
}

function loadContacts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.contacts) && parsed.contacts.length) {
        const legacy = parsed.version !== STORAGE_VERSION
        const list = legacy ? parsed.contacts.slice(0, 1) : parsed.contacts
        return list.map((contact, index) => normalizeContact(contact, index, legacy))
      }
    }
  } catch (e) {
    /* 损坏数据回退到内置数据 */
  }
  return clone(initial.contacts).map((contact, index) =>
    normalizeContact(contact, index, false)
  )
}

function normalizeGroup(group) {
  const source = group || {}
  return {
    id: source.id || makeId('g'),
    name: String(source.name || '群聊').trim() || '群聊',
    memberIds: Array.isArray(source.memberIds) ? source.memberIds : [],
    avatar: '群',
    color: themeAwareColor(source.color, 'var(--theme-accent)'),
    chatBackground: source.chatBackground || '',
    chatBackgroundOpacity: clampOpacity(source.chatBackgroundOpacity),
    messages: Array.isArray(source.messages) ? source.messages : [],
    pinned: Boolean(source.pinned),
    muted: Boolean(source.muted),
    createdAt: source.createdAt || Date.now(),
  }
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.groups)) return parsed.groups.map(normalizeGroup)
    }
  } catch (e) {
    /* 忽略损坏数据 */
  }
  return []
}

export const chatState = reactive({
  contacts: loadContacts(),
  groups: loadGroups(),
  activeId: null,
  activeGroupId: null,
  notification: null,
  selectingContactId: null,
  selectingGroupId: null,
  call: null,
})

let proactiveTimer = null
let notificationTimer = null
let engineStarted = false
let audioContext = null
let callConnectTimer = null
let callClockTimer = null
// 来电响铃超时（按「来电铃声时长」自动记为未接听）
let callRingTimer = null
// 通话中联系人主动挂断的定时器（受「禁止联系人主动挂断」与「主动挂断概率」联立控制）
let callHangupTimer = null
const replyTimers = new Set()

function saveContacts() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, contacts: chatState.contacts })
    )
  } catch (e) {
    /* 忽略不可写场景 */
  }
}

function saveGroups() {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ groups: chatState.groups }))
  } catch (e) {
    /* 忽略不可写场景 */
  }
}

function nowHM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function makeId(prefix = 'm') {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7)
}

export function contactById(id) {
  return chatState.contacts.find((contact) => contact.id === id) || null
}

export function primaryContact() {
  return chatState.contacts[0] || null
}

export function groupById(id) {
  return chatState.groups.find((group) => group.id === id) || null
}

export function groupMembers(group) {
  if (!group) return []
  return group.memberIds
    .map((id) => contactById(id))
    .filter(Boolean)
}

export function contactDisplayName(contact) {
  return contact?.note || contact?.name || 'TA'
}

export function unreadOf(contact) {
  return contact.messages.filter((message) => message.from === 'other' && !message.read).length
}

export function totalUnread() {
  const direct = chatState.contacts.reduce((sum, contact) => sum + unreadOf(contact), 0)
  const groups = chatState.groups.reduce((sum, group) => sum + unreadOf(group), 0)
  return direct + groups
}

export function refreshUnread() {
  store.unreadSms = totalUnread()
}

export function markRead(id) {
  const contact = contactById(id)
  if (!contact) return
  contact.messages.forEach((message) => {
    if (message.from === 'other') message.read = true
  })
  saveContacts()
  refreshUnread()
}

export function openChat(id) {
  chatState.activeGroupId = null
  chatState.activeId = id
  markRead(id)
}

export function openGroup(id) {
  const group = groupById(id)
  if (!group) return
  chatState.activeId = null
  chatState.activeGroupId = id
  group.messages.forEach((message) => {
    if (message.from === 'other') message.read = true
  })
  saveGroups()
  refreshUnread()
}

export function closeChat() {
  chatState.activeId = null
  chatState.activeGroupId = null
}

function isReading(conversation) {
  const active =
    conversation &&
    ((conversation.memberIds && chatState.activeGroupId === conversation.id) ||
      (!conversation.memberIds && chatState.activeId === conversation.id))
  if (!active) return false
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  return store.page === 'sms'
}

function playNotificationSound(type) {
  if (type === 'none') return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!audioContext) audioContext = new AudioCtx()
    audioContext.resume()
    const now = audioContext.currentTime
    const frequencies =
      type === 'soft' ? [520] : type === 'clear' ? [880, 660] : [720, 720]
    frequencies.forEach((frequency, index) => {
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + index * 0.09)
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.09 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.08)
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.start(now + index * 0.09)
      osc.stop(now + index * 0.09 + 0.09)
    })
  } catch (e) {
    /* 音频不可用时静默 */
  }
}

function conversationName(conversation) {
  return conversation?.memberIds ? conversation.name : contactDisplayName(conversation)
}

function pushToast(conversation, text) {
  if (!settings.inAppNotifications) return
  chatState.notification = {
    id: makeId('n'),
    contactId: conversation.id,
    conversationType: conversation.memberIds ? 'group' : 'contact',
    name: conversationName(conversation),
    avatar: conversation.avatar,
    avatarImage: conversation.avatarImage,
    color: conversation.color,
    text,
  }
  clearTimeout(notificationTimer)
  const id = chatState.notification.id
  notificationTimer = setTimeout(() => {
    if (chatState.notification?.id === id) chatState.notification = null
  }, 5200)
}

function announce(conversation, text) {
  if (!settings.inAppNotifications || !settings.chatNotifications) return
  if (conversation?.muted) return
  const soundSource = conversation.memberIds
    ? groupMembers(conversation)[0]
    : conversation
  playNotificationSound(soundSource?.notificationSound || 'default')
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
  if (hidden) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(conversationName(conversation), {
          body: text,
          tag: 'zhengdu-message',
          silent: true,
        })
      } catch (e) {
        /* 浏览器通知失败时保留站内未读提示 */
      }
    }
    return
  }
  pushToast(conversation, text)
}

export function dismissNotification() {
  chatState.notification = null
}

function callKindLabel(kind) {
  return kind === 'video' ? '视频通话' : '语音通话'
}

function formatCallDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function clearCallTimers() {
  clearTimeout(callConnectTimer)
  clearTimeout(callRingTimer)
  clearTimeout(callHangupTimer)
  clearInterval(callClockTimer)
  callConnectTimer = null
  callRingTimer = null
  callHangupTimer = null
  callClockTimer = null
}

/**
 * 接通后，按「禁止联系人主动挂断」与「主动挂断概率」联立决定是否自动挂断：
 *   禁止开启 → 永不主动挂断；
 *   禁止关闭 → 命中主动挂断概率时，由联系人在随机时刻挂断（不设固定时间范围）。
 */
function scheduleContactHangup() {
  clearTimeout(callHangupTimer)
  callHangupTimer = null
  const current = chatState.call
  if (!current) return
  const auto = settings.contactAutoSettings?.[current.contactId] || {}
  if (auto.forbidContactHangup === true) return
  if (!chancePercent(auto.contactHangupChance, 30, auto.contactHangupChanceRandom)) return
  const delay = 2000 + Math.random() * 3600000
  callHangupTimer = setTimeout(() => {
    callHangupTimer = null
    if (!chatState.call || chatState.call.status !== '通话中') return
    hangupCallByContact()
  }, delay)
}

function saveCallSession() {
  try {
    if (typeof localStorage === 'undefined') return
    if (!chatState.call) localStorage.removeItem(CALL_KEY)
    else localStorage.setItem(CALL_KEY, JSON.stringify(chatState.call))
  } catch (e) {
    /* 忽略本地存储失败 */
  }
}

function clearSavedCallSession() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(CALL_KEY)
  } catch (e) {
    /* 忽略本地存储失败 */
  }
}

function syncCallSeconds() {
  const current = chatState.call
  if (!current || current.status !== '通话中') return
  const connectedAt = Number(current.connectedAt)
  if (!Number.isFinite(connectedAt)) return
  current.seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
}

function startCallClock(connectedAt = Date.now()) {
  clearTimeout(callConnectTimer)
  clearInterval(callClockTimer)
  callConnectTimer = null
  if (!chatState.call) return
  chatState.call.connectedAt = connectedAt
  syncCallSeconds()
  saveCallSession()
  callClockTimer = setInterval(syncCallSeconds, 1000)
}

function scheduleOutgoingCallConnect(delay = 1400) {
  clearTimeout(callConnectTimer)
  callConnectTimer = setTimeout(() => {
    callConnectTimer = null
    if (!chatState.call || chatState.call.direction !== 'outgoing') return
    if (chatState.call.status !== '正在呼叫…') return
    chatState.call.status = '通话中'
    startCallClock(Date.now())
    scheduleContactHangup()
  }, Math.max(0, delay))
}

function appendCallBubbles(contact, kind, seconds, outcome) {
  if (!contact) return
  const reading = isReading(contact)
  const time = nowHM()
  const createdAt = Date.now()
  const label = callKindLabel(kind)
  const result =
    outcome === 'declined'
      ? '对方已拒绝'
      : outcome === 'cancelled'
        ? '已取消'
        : outcome === 'missed'
          ? '未接听'
          : formatCallDuration(seconds)
  const text = `${label} · ${result}`
  contact.messages.push(
    {
      id: makeId('call-me'),
      from: 'me',
      type: 'call',
      text,
      time,
      createdAt,
      read: true,
    },
    {
      id: makeId('call-other'),
      from: 'other',
      type: 'call',
      text,
      time,
      createdAt,
      read: reading,
    }
  )
  saveContacts()
  refreshUnread()
}

function finishCall(outcome, initiator = 'user') {
  const current = chatState.call
  if (!current) return false
  const auto = settings.contactAutoSettings?.[current.contactId] || {}
  if (initiator === 'contact' && auto.forbidContactHangup === true) return false
  syncCallSeconds()
  const contact = contactById(current.contactId)
  const seconds = current.seconds
  const kind = current.kind
  clearCallTimers()
  chatState.call = null
  clearSavedCallSession()
  appendCallBubbles(contact, kind, seconds, outcome)
  return true
}

/**
 * 拨出电话的接听判定，完全由「TA的回复 → 通话设置 · 我打给对方」决定：
 *   1. 允许拒接 && 命中拒接概率 → 对方拒接（记为「对方已拒绝」）
 *   2. 否则对方在 1～15 秒内接听（接听延迟随机）
 *   3. 开启「无人接听自动结束」时，若接听所需时间超过设定时长 → 记为「未接听」；
 *      关闭则无论多晚最终都会接通。
 */
export function startOutgoingCall(kind) {
  const contact = contactById(chatState.activeId)
  if (!contact || chatState.call) return false
  clearCallTimers()
  clearSavedCallSession()
  chatState.call = {
    kind: kind === 'video' ? 'video' : 'voice',
    direction: 'outgoing',
    status: '正在呼叫…',
    contactId: contact.id,
    seconds: 0,
    startedAt: Date.now(),
    connectedAt: null,
    expanded: true,
  }
  saveCallSession()

  const auto = autoForContact(contact)

  // 1. 对方拒接
  if (auto.allowReject === true && chancePercent(auto.rejectChance, 0, auto.rejectChanceRandom)) {
    callConnectTimer = setTimeout(() => finishCall('declined'), 900)
    return true
  }

  // 2. 无人接听：联系人在「无人接听时长」内未接电话 → 记为未接听
  if (auto.noAnswerEnd === true && chancePercent(auto.noAnswerChance, 30, auto.noAnswerChanceRandom)) {
    const limitMs = Math.max(1, Number(auto.noAnswerSeconds) || 30) * 1000
    callConnectTimer = setTimeout(() => finishCall('missed'), limitMs)
    return true
  }

  // 3. 否则接通
  scheduleOutgoingCallConnect()
  return true
}

export function startIncomingCall(contactId, kind) {
  const contact = contactById(contactId)
  if (!contact || chatState.call) return false
  const auto = autoForContact(contactId)
  if (auto.callsAllowed === false) return false
  clearCallTimers()
  clearSavedCallSession()
  chatState.call = {
    kind: kind === 'video' ? 'video' : 'voice',
    direction: 'incoming',
    status: '邀请你通话',
    contactId: contact.id,
    seconds: 0,
    startedAt: Date.now(),
    connectedAt: null,
    expanded: true,
  }
  saveCallSession()
  announce(contact, `${callKindLabel(chatState.call.kind)}邀请`)
  // 响满「来电铃声时长」仍未接听 → 自动记为未接听
  const ringSeconds = Math.max(1, Number(auto.incomingRingSeconds) || 30)
  callRingTimer = setTimeout(() => finishCall('missed'), ringSeconds * 1000)
  return true
}

export function answerIncomingCall() {
  if (!chatState.call || chatState.call.direction !== 'incoming') return false
  clearTimeout(callRingTimer)
  callRingTimer = null
  chatState.call.status = '通话中'
  startCallClock(Date.now())
  scheduleContactHangup()
  return true
}

export function declineIncomingCall() {
  if (!chatState.call || chatState.call.direction !== 'incoming') return false
  finishCall('declined')
  return true
}

export function hangupCallByContact() {
  if (!chatState.call || chatState.call.status !== '通话中') return false
  return finishCall('completed', 'contact')
}
export function hangupCall() {
  if (!chatState.call) return false
  const outcome =
    chatState.call.status === '通话中'
      ? 'completed'
      : chatState.call.direction === 'incoming'
        ? 'declined'
        : 'cancelled'
  finishCall(outcome)
  return true
}

export function toggleCallExpanded() {
  if (!chatState.call) return
  chatState.call.expanded = !chatState.call.expanded
  saveCallSession()
}
function restoreCallSession() {
  if (chatState.call || typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(CALL_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (!saved || !saved.contactId || !contactById(saved.contactId)) {
      clearSavedCallSession()
      return
    }

    const startedAt = Number(saved.startedAt) || Date.now()
    const restored = {
      kind: saved.kind === 'video' ? 'video' : 'voice',
      direction: saved.direction === 'incoming' ? 'incoming' : 'outgoing',
      status: typeof saved.status === 'string' ? saved.status : '正在呼叫…',
      contactId: saved.contactId,
      seconds: Math.max(0, Number(saved.seconds) || 0),
      startedAt,
      connectedAt: Number(saved.connectedAt) || null,
      expanded: saved.expanded !== false,
    }
    chatState.call = restored

    if (restored.status === '通话中') {
      const connectedAt = restored.connectedAt || startedAt + 1400
      restored.connectedAt = connectedAt
      startCallClock(connectedAt)
      scheduleContactHangup()
      return
    }

    if (restored.direction === 'outgoing' && restored.status === '正在呼叫…') {
      const connectAt = startedAt + 1400
      if (Date.now() >= connectAt) {
        restored.status = '通话中'
        startCallClock(connectAt)
        scheduleContactHangup()
      } else {
        saveCallSession()
        scheduleOutgoingCallConnect(connectAt - Date.now())
      }
      return
    }

    saveCallSession()
  } catch (e) {
    clearSavedCallSession()
    chatState.call = null
  }
}
function clampInterval(value, fallback) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(1440, Math.max(1, n))
}

export function nextProactiveDelayMinutes() {
  if (settings.randomInterval) {
    return 1 + Math.floor(Math.random() * 1440)
  }
  let min = clampInterval(settings.minInterval, 5)
  let max = clampInterval(settings.maxInterval, 60)
  if (min > max) [min, max] = [max, min]
  return min + Math.floor(Math.random() * (max - min + 1))
}

const SYSTEM_CARD_GROUPS = (() => {
  const category = (systemCardsData.categories || []).find((item) => item.key === 'main')
  return (category?.groups || []).map((group, index) => ({
    key: `main:${index}`,
    name: group.name || `分组 ${index + 1}`,
    cards: (group.cards || []).filter(Boolean),
  }))
})()
const SYSTEM_CHAT_CARDS = SYSTEM_CARD_GROUPS.flatMap((group) => group.cards)
const DICTIONARY_TEXT_CARDS = (() => {
  const category = (systemCardsData.categories || []).find((item) => item.key === 'dict')
  return (category?.groups || []).flatMap((group) => group.cards || []).filter(Boolean)
})()
const REPLY_EMOJIS = ['🙂', '🥺', '🌙', '✨', '💙', '🫶', '🌿', '☕']
const REPLY_KAOMOJI = ['(｡•́︿•̀｡)', '(๑•̀ㅂ•́)و✧', '(￣▽￣)', '(*/ω＼*)', '(´･ᴗ･ `)', 'ฅ^•ﻌ•^ฅ']

function autoForContact(contactOrId) {
  const id = typeof contactOrId === 'string' ? contactOrId : contactOrId?.id
  return (id && settings.contactAutoSettings?.[id]) || {}
}

function chancePercent(value, fallback = 0, random = false) {
  if (random === true) return Math.random() < 0.5
  const percent = Math.min(100, Math.max(0, Number(value ?? fallback) || 0))
  return Math.random() * 100 < percent
}

function randomCount(minValue, maxValue, fallbackMin = 1, fallbackMax = 1) {
  const min = Math.max(1, Math.round(Number(minValue) || fallbackMin))
  const max = Math.max(min, Math.round(Number(maxValue) || Math.max(min, fallbackMax)))
  return min + Math.floor(Math.random() * (max - min + 1))
}

function lockedCustomGroupIds(contact) {
  return new Set(
    (contact?.cardGroups || [])
      .filter((group) => group && group.locked === true)
      .map((group) => group.id)
  )
}

function customCardsForContact(contact) {
  const source =
    contact && Array.isArray(contact.cards) && contact.cards.length
      ? contact.cards
      : settings.replyCards
  if (!Array.isArray(source)) return []
  const locked = lockedCustomGroupIds(contact)
  return source
    .filter((card) => {
      if (!locked.size || typeof card === 'string') return true
      return !locked.has(card?.groupId)
    })
    .map((card) => (typeof card === 'string' ? card : String(card?.text ?? '').trim()))
    .filter(Boolean)
}

/** 系统预设中未被锁定的字卡；settings.systemLockedCardGroups 存 'main:3' 这类分组键 */
function systemCardsForContact() {
  const locked = new Set(
    Array.isArray(settings.systemLockedCardGroups) ? settings.systemLockedCardGroups : []
  )
  if (!locked.size) return SYSTEM_CHAT_CARDS
  return SYSTEM_CARD_GROUPS
    .filter((group) => !locked.has(group.key))
    .flatMap((group) => group.cards)
}

function cardsForContact(contact) {
  const auto = autoForContact(contact)
  const customCards = customCardsForContact(contact)
  const systemCards = systemCardsForContact()
  if (!systemCards.length) return customCards
  if (!customCards.length) return systemCards
  const customChance = auto.customCardChanceRandom === true
    ? 50
    : Math.min(100, Math.max(0, Number(auto.customCardChance ?? 100)))
  const systemChance = auto.systemCardChanceRandom === true
    ? 50
    : Math.min(100, Math.max(0, Number(auto.systemCardChance ?? 20)))
  if (customChance + systemChance <= 0) return customCards
  const useSystem = Math.random() * (customChance + systemChance) >= customChance
  return useSystem ? systemCards : customCards
}

export function drawReplyCards(contact = primaryContact(), options = {}) {
  const cards = cardsForContact(contact)
  if (!cards.length) return []
  const auto = autoForContact(contact)
  const explicitRange = options.forceRange === true
  const multiEnabled = auto.multiCardEnabled !== false
  const multiTriggered = explicitRange || (multiEnabled && chancePercent(auto.multiCardChance, 100, auto.multiCardChanceRandom))
  if (!multiTriggered) return [cards[Math.floor(Math.random() * cards.length)]]
  const count = randomCount(
    options.min ?? auto.multiCardMin ?? settings.replyCardCountMin,
    options.max ?? auto.multiCardMax ?? settings.replyCardCountMax,
    1,
    2
  )
  return Array.from(
    { length: count },
    () => cards[Math.floor(Math.random() * cards.length)]
  )
}

/**
 * 首页「今天 TA 想对你说」卡片：从字卡池（系统 + 自定义，均排除锁定分组）随机抽 min~max 张（去重）。
 * 系统字卡概率由 settings.taTodayCardSystemChance 控制，其余落到自定义字卡。
 */
export function drawTaTodayCards(min = 1, max = 3) {
  const contact = primaryContact()
  const customCards = customCardsForContact(contact)
  const systemCards = systemCardsForContact()
  const systemChance = Math.min(100, Math.max(0, Number(settings.taTodayCardSystemChance ?? 100)))
  let pool
  if (!systemCards.length) pool = customCards
  else if (!customCards.length) pool = systemCards
  else pool = Math.random() * 100 < systemChance ? systemCards : customCards
  if (!pool.length) return []
  const count = randomCount(min, max, 1, 3)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function selectionDelayFor(contact) {
  const min = Math.max(1, Number(settings.replyDelayMinSeconds) || 4)
  const max = Math.max(min, Number(settings.replyDelayMaxSeconds) || min)
  const seconds = min + Math.random() * (max - min)
  if (contact?.replyFrequency === 'fast') return seconds * 650
  if (contact?.replyFrequency === 'slow') return seconds * 1500
  return seconds * 1000
}

function betweenCardsDelayFor(contact) {
  if (contact?.replyFrequency === 'fast') return 1200 + Math.random() * 800
  if (contact?.replyFrequency === 'slow') return 3500 + Math.random() * 2500
  return 1800 + Math.random() * 1600
}

function quoteTextOf(message) {
  if (!message || message.recalled) return ''
  if (message.type === 'sticker') return '[表情包]'
  if (message.type === 'photo') return `[图片]${message.text ? ` ${message.text}` : ''}`
  if (message.type === 'transfer') {
    return `[转账] ¥${message.amount}${message.text ? ` ${message.text}` : ''}`
  }
  if (message.type === 'redpacket') {
    return `[红包] ¥${message.amount}${message.text ? ` ${message.text}` : ''}`
  }
  if (message.type === 'call') return message.text || '[通话]'
  if (message.type === 'location') return `[位置] ${message.text || ''}`.trim()
  if (message.type === 'file') return `[文件] ${message.text || ''}`.trim()
  if (message.type === 'gift') return `[礼物] ${message.text || ''}`.trim()
  return String(message.text || '').trim()
}

function randomQuoteFrom(conversation, chance = 20, random = false) {
  const candidates = (conversation?.messages || []).filter(
    (message) => message.from === 'me' && quoteTextOf(message)
  )
  if (!candidates.length || !chancePercent(chance, 20, random)) return null
  const quoted = candidates[Math.floor(Math.random() * candidates.length)]
  return {
    messageId: quoted.id,
    sender: settings.userName || '我',
    text: quoteTextOf(quoted),
  }
}

function setSelectingFor(conversation, selecting) {
  if (!conversation) return
  if (conversation.memberIds) {
    if (selecting) chatState.selectingGroupId = conversation.id
    else if (chatState.selectingGroupId === conversation.id) chatState.selectingGroupId = null
    return
  }
  if (selecting) chatState.selectingContactId = conversation.id
  else if (chatState.selectingContactId === conversation.id) chatState.selectingContactId = null
}

function queueCardSequence(conversation, contact, texts, options, deliver) {
  if (!conversation || !contact || !texts.length) {
    setSelectingFor(conversation, false)
    if (options.reschedule !== false) scheduleNextProactive()
    return
  }

  setSelectingFor(conversation, true)
  let index = 0

  const scheduleNextCard = () => {
    const delay =
      index === 0 ? selectionDelayFor(contact) : betweenCardsDelayFor(contact)
    const timer = setTimeout(() => {
      replyTimers.delete(timer)
      const currentConversation = conversation.memberIds
        ? groupById(conversation.id)
        : contactById(conversation.id)
      if (!currentConversation) {
        setSelectingFor(conversation, false)
        if (options.reschedule !== false) scheduleNextProactive()
        return
      }

      deliver(currentConversation, texts[index])
      index += 1

      if (index < texts.length) {
        scheduleNextCard()
      } else {
        // 最后一张字卡发出后，才结束“正在挑选字卡”状态。
        setSelectingFor(conversation, false)
        if (options.reschedule !== false) scheduleNextProactive()
      }
    }, delay)
    replyTimers.add(timer)
  }

  scheduleNextCard()
}

const PROACTIVE_GIFTS = [
  { name: '一束小雏菊', note: '路过花店时想到你。' },
  { name: '一杯热可可', note: '今天也要甜甜的。' },
  { name: '一枚月亮徽章', note: '把今晚的月亮送给你。' },
  { name: '一条软乎乎的围巾', note: '降温了，记得保暖。' },
]

const PROACTIVE_LOCATIONS = [
  '海边旧灯塔',
  '街角咖啡店',
  '开满花的公园',
  '夜晚的便利店',
  '回家路上的公交站',
]

const PROACTIVE_TRANSFER_NOTES = [
  '给自己买点喜欢的。',
  '今天也辛苦了。',
  '一份小小的心意。',
  '记得好好吃饭。',
]

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function deliverProactiveAction(contact, payload, preview) {
  const reading = isReading(contact)
  contact.messages.push({
    id: makeId('pa'),
    from: 'other',
    time: nowHM(),
    createdAt: Date.now(),
    read: reading,
    ...payload,
  })
  saveContacts()
  refreshUnread()
  if (!reading) announce(contact, preview)
  scheduleNextProactive()
}

async function runRandomProactiveAction(contact) {
  if (!contact) return false
  const auto = autoForContact(contact)
  const actions = []
  if (chancePercent(auto.proactiveMessageChance, 40, auto.proactiveMessageChanceRandom)) actions.push('cards')
  if (chancePercent(auto.proactiveGiftChance, 10, auto.proactiveGiftChanceRandom)) actions.push('gift')
  if (chancePercent(auto.proactiveTransferChance, 10, auto.proactiveTransferChanceRandom)) actions.push('transfer')
  if (chancePercent(auto.proactiveLocationChance, 10, auto.proactiveLocationChanceRandom)) actions.push('location')
  if (chancePercent(auto.proactiveNudgeChance, 10, auto.proactiveNudgeChanceRandom)) actions.push('nudge')
  if (
    auto.callsAllowed !== false &&
    !chatState.call &&
    chancePercent(auto.proactiveCallChance, 10, auto.proactiveCallChanceRandom)
  ) {
    actions.push('voice', 'video')
  }
  if (chancePercent(settings.songChance, 5, settings.songChanceRandom)) actions.push('song')
  if (!actions.length) actions.push('cards')
  const action = randomItem(actions)

  if (action === 'cards') {
    // 「主动消息 每次发送最少/最多条数」直接决定这一次连发几条
    const min = Math.max(1, Math.min(10, Math.round(Number(auto.proactiveMessageMin) || 1)))
    const max = Math.max(min, Math.min(10, Math.round(Number(auto.proactiveMessageMax) || min)))
    const texts = drawReplyCards(contact, { forceRange: true, min, max })
    deliverIncomingCards(contact.id, texts)
    return true
  }

  if (action === 'gift') {
    const gift = randomItem(PROACTIVE_GIFTS)
    deliverProactiveAction(
      contact,
      { type: 'gift', text: gift.name, note: gift.note },
      `[礼物] ${gift.name}`
    )
    return true
  }

  if (action === 'transfer') {
    const amount = (1 + Math.floor(Math.random() * 5200) / 100).toFixed(2)
    const note = randomItem(PROACTIVE_TRANSFER_NOTES)
    deliverProactiveAction(
      contact,
      { type: 'transfer', amount, text: note },
      `[转账] ¥${amount} ${note}`
    )
    return true
  }

  if (action === 'location') {
    const place = randomItem(PROACTIVE_LOCATIONS)
    deliverProactiveAction(
      contact,
      { type: 'location', text: place },
      `[位置] ${place}`
    )
    return true
  }

  if (action === 'nudge') {
    deliverProactiveAction(
      contact,
      { type: 'nudge', text: randomIncomingNudge(contactDisplayName(contact)) },
      '拍了拍你'
    )
    return true
  }

  if (action === 'song') {
    const track = randomItem(musicData.tracks || [])
    const text = track ? `给你推荐一首歌：${track.title} · ${track.artist}` : '想和你一起听一首歌。'
    deliverProactiveAction(contact, { type: 'text', text }, text)
    return true
  }

  startIncomingCall(contact.id, action)
  scheduleNextProactive()
  return true
}

export function scheduleNextProactive() {
  clearTimeout(proactiveTimer)
  proactiveTimer = null
  if (!settings.proactiveEnabled) return
  const delay = nextProactiveDelayMinutes() * 60 * 1000
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null
    const contact = primaryContact()
    if (!contact || !settings.proactiveEnabled) return
    runRandomProactiveAction(contact)
  }, delay)
}

function deliverIncomingCards(contactId, texts, options = {}) {
  const contact = contactById(contactId)
  if (!contact) {
    if (options.reschedule !== false) scheduleNextProactive()
    return
  }

  queueCardSequence(contact, contact, texts, options, (liveContact, text) => {
    const reading = isReading(liveContact)
    const auto = autoForContact(liveContact)
    liveContact.messages.push({
      id: makeId('r'),
      from: 'other',
      type: 'text',
      text,
      time: nowHM(),
      createdAt: Date.now(),
      read: reading,
      quote: randomQuoteFrom(liveContact, auto.quoteChance, auto.quoteChanceRandom),
    })
    saveContacts()
    refreshUnread()
    if (!reading) announce(liveContact, text)
  })
}

function decorateReplyTexts(texts, auto) {
  const result = [...texts]
  if (!result.length) return result
  const last = result.length - 1
  if (chancePercent(auto.emojiChance, 5, auto.emojiChanceRandom)) {
    result[last] = `${result[last]} ${randomItem(REPLY_EMOJIS)}`
  }
  if (chancePercent(auto.kaomojiChance, 5, auto.kaomojiChanceRandom)) {
    result[last] = `${result[last]} ${randomItem(REPLY_KAOMOJI)}`
  }
  return result
}

function dictionaryReplyTexts(auto) {
  if (!DICTIONARY_TEXT_CARDS.length) return []
  const count = randomCount(auto.dictionaryMin, auto.dictionaryMax, 2, 5)
  const cards = Array.from(
    { length: count },
    () => DICTIONARY_TEXT_CARDS[Math.floor(Math.random() * DICTIONARY_TEXT_CARDS.length)]
  )
  if (auto.dictionaryMulti !== false) return cards
  const separator = auto.multiCardJoin === 'comma' ? '，' : auto.multiCardJoin === 'semicolon' ? '；' : auto.multiCardJoin === 'none' ? '' : ' '
  return [cards.join(separator)]
}

function deliverIncomingPayload(contact, payload, preview) {
  if (!contact) return false
  const reading = isReading(contact)
  const message = {
    id: makeId('reply-special'),
    from: 'other',
    time: nowHM(),
    createdAt: Date.now(),
    read: reading,
    ...payload,
  }
  contact.messages.push(message)
  saveContacts()
  refreshUnread()
  if (!reading) announce(contact, preview)
  return message
}

async function scheduleCardReply(contactId) {
  const contact = contactById(contactId)
  if (!contact) return false
  const auto = autoForContact(contact)
  if (chancePercent(auto.noReplyChance, 0, auto.noReplyChanceRandom)) return false

  if (chancePercent(auto.touchChance, 5, auto.touchChanceRandom)) {
    return deliverIncomingPayload(
      contact,
      { type: 'nudge', text: randomIncomingNudge(contactDisplayName(contact)) },
      '拍了拍你'
    )
  }

  if (chancePercent(auto.stickerChance, 10, auto.stickerChanceRandom)) {
    try {
      if (!stickerState.loaded) await loadStickerLibrary()
      const sticker = randomStickerForContact(contact.id)
      if (sticker?.src) {
        return deliverIncomingPayload(contact, { type: 'sticker', src: sticker.src, text: '[表情包]' }, '[表情包]')
      }
    } catch (e) {
      /* 表情包不可用时继续使用文字回复 */
    }
  }

  if (chancePercent(settings.audioGuaranteeChance, 0, settings.audioGuaranteeChanceRandom)) {
    const maxSeconds = Math.max(3, Math.min(60, Math.round(Number(settings.audioCardWeight) || 5)))
    const duration = 3 + Math.floor(Math.random() * maxSeconds)
    return deliverIncomingPayload(
      contact,
      { type: 'voice', text: `语音 ${formatCallDuration(duration)}`, duration },
      '[语音]'
    )
  }
  if (chancePercent(auto.photoChance, 5, auto.photoChanceRandom)) {
    try {
      const photos = await listPhotos()
      if (photos.length) {
        const photo = photos[Math.floor(Math.random() * photos.length)]
        return deliverIncomingPayload(contact, { type: 'photo', src: photo.src, text: '' }, '[照片]')
      }
    } catch (e) {
      /* 相册不可用时继续使用文字回复 */
    }
  }

  let texts = []
  if (auto.dictionaryEnabled === true && chancePercent(auto.dictionaryChance, 25, auto.dictionaryChanceRandom)) {
    texts = dictionaryReplyTexts(auto)
  }
  if (!texts.length) texts = drawReplyCards(contact)
  if (!texts.length) return false
  deliverIncomingCards(contactId, decorateReplyTexts(texts, auto))
  return true
}

function deliverGroupCards(groupId, memberId, texts, options = {}) {
  const group = groupById(groupId)
  const member = contactById(memberId)
  if (!group || !member) {
    if (options.reschedule !== false) scheduleNextProactive()
    return
  }

  queueCardSequence(group, member, texts, options, (liveGroup, text) => {
    const reading = isReading(liveGroup)
    const auto = autoForContact(member)
    liveGroup.messages.push({
      id: makeId('gr'),
      from: 'other',
      type: 'text',
      text,
      time: nowHM(),
      createdAt: Date.now(),
      read: reading,
      quote: randomQuoteFrom(liveGroup, auto.quoteChance, auto.quoteChanceRandom),
      senderId: member.id,
      senderName: contactDisplayName(member),
      senderAvatar: member.avatar,
      senderAvatarImage: member.avatarImage,
      senderAvatarFrame: member.avatarFrame,
      senderColor: member.color,
    })
    saveGroups()
    refreshUnread()
    if (!reading) announce(liveGroup, `${contactDisplayName(member)}：${text}`)
  })
}

function scheduleGroupReply(groupId) {
  const group = groupById(groupId)
  const members = groupMembers(group)
  if (!group || !members.length) return
  const member = members[Math.floor(Math.random() * members.length)]
  const auto = autoForContact(member)
  if (!chancePercent(auto.groupReplyChance, 100, auto.groupReplyChanceRandom)) return
  let texts
  if (auto.groupDictionaryEnabled === true && DICTIONARY_TEXT_CARDS.length) {
    const count = randomCount(auto.groupReplyCardMin, auto.groupReplyCardMax, 1, 1)
    texts = Array.from(
      { length: count },
      () => DICTIONARY_TEXT_CARDS[Math.floor(Math.random() * DICTIONARY_TEXT_CARDS.length)]
    )
  } else {
    texts = drawReplyCards(member, {
      forceRange: true,
      min: auto.groupReplyCardMin,
      max: auto.groupReplyCardMax,
    })
  }
  deliverGroupCards(group.id, member.id, texts)
}
export function triggerProactiveForActiveChat() {
  if (chatState.activeGroupId) {
    const group = groupById(chatState.activeGroupId)
    const members = groupMembers(group)
    if (!group || !members.length) return false
    const member = members[Math.floor(Math.random() * members.length)]
    deliverGroupCards(group.id, member.id, drawReplyCards(member))
    return true
  }
  const contact = contactById(chatState.activeId)
  if (!contact) return false
  return runRandomProactiveAction(contact)
}

export function sendOutgoing(payload, options = {}) {
  const explicitTarget = Boolean(options.targetKind && options.targetId)
  const group = explicitTarget
    ? options.targetKind === 'group'
      ? groupById(options.targetId)
      : null
    : groupById(chatState.activeGroupId)
  if (group) {
    group.messages.push({
      id: makeId('go'),
      from: 'me',
      type: 'text',
      text: '',
      time: nowHM(),
      createdAt: Date.now(),
      read: true,
      ...payload,
    })
    saveGroups()
    refreshUnread()
    if (options.scheduleReply !== false) scheduleGroupReply(group.id)
    return true
  }
  const contact = explicitTarget
    ? options.targetKind === 'contact'
      ? contactById(options.targetId)
      : null
    : contactById(chatState.activeId)
  if (!contact) return false
  contact.messages.push({
    id: makeId('o'),
    from: 'me',
    type: 'text',
    text: '',
    time: nowHM(),
    createdAt: Date.now(),
    read: true,
    ...payload,
  })
  saveContacts()
  refreshUnread()
  if (options.scheduleReply !== false) scheduleCardReply(contact.id)
  return true
}

export function forwardMessages(targetKind, targetId, messages) {
  const target =
    targetKind === 'group' ? groupById(targetId) : contactById(targetId)
  if (!target || !Array.isArray(messages) || !messages.length) return false
  messages.forEach((message) => {
    target.messages.push({
      ...JSON.parse(JSON.stringify(message)),
      id: makeId('fwd'),
      from: 'me',
      time: nowHM(),
      createdAt: Date.now(),
      read: true,
      forwarded: true,
      recalled: false,
      quote: null,
      senderId: undefined,
      senderName: undefined,
      senderAvatar: undefined,
      senderAvatarImage: undefined,
      senderAvatarFrame: undefined,
      senderColor: undefined,
    })
  })
  if (targetKind === 'group') saveGroups()
  else saveContacts()
  refreshUnread()
  return true
}

function activeConversation() {
  return groupById(chatState.activeGroupId) || contactById(chatState.activeId)
}

export function deleteMessage(messageId) {
  const conversation = activeConversation()
  if (!conversation) return false
  conversation.messages = conversation.messages.filter((message) => message.id !== messageId)
  if (chatState.activeGroupId) saveGroups()
  else saveContacts()
  refreshUnread()
  return true
}

export function recallMessage(messageId) {
  const conversation = activeConversation()
  if (!conversation) return false
  const message = conversation.messages.find((item) => item.id === messageId)
  if (!message || message.from !== 'me') return false
  message.recalled = true
  message.text = ''
  message.src = ''
  message.quote = null
  if (chatState.activeGroupId) saveGroups()
  else saveContacts()
  return true
}

export function sendIncomingText(text, contactId = '') {
  const contact = contactId ? contactById(contactId) : primaryContact()
  const clean = String(text || '').trim()
  if (!contact || !clean) return false
  const reading = isReading(contact)
  contact.messages.push({
    id: makeId('system-in'),
    from: 'other',
    type: 'text',
    text: clean,
    time: nowHM(),
    createdAt: Date.now(),
    read: reading,
    quote: null,
  })
  saveContacts()
  refreshUnread()
  if (!reading) announce(contact, clean)
  return true
}
export function sendText(text) {
  const clean = String(text).trim()
  if (!clean) return false
  return sendOutgoing({ type: 'text', text: clean })
}

export function sendCallRecord(text) {
  const group = groupById(chatState.activeGroupId)
  if (group) {
    group.messages.push({
      id: makeId('go'),
      from: 'me',
      type: 'call',
      text,
      time: nowHM(),
      createdAt: Date.now(),
      read: true,
    })
    saveGroups()
    refreshUnread()
    scheduleNextProactive()
    return true
  }
  const contact = contactById(chatState.activeId)
  if (!contact) return false
  contact.messages.push({
    id: makeId('o'),
    from: 'me',
    type: 'call',
    text,
    time: nowHM(),
    createdAt: Date.now(),
    read: true,
  })
  saveContacts()
  refreshUnread()
  scheduleNextProactive()
  return true
}

export function createGroup(name, memberIds) {
  const ids = [...new Set(memberIds)].filter((id) => contactById(id))
  if (ids.length < 2) return null
  const group = normalizeGroup({
    id: makeId('group'),
    name: String(name || '群聊').trim() || '群聊',
    memberIds: ids,
    messages: [],
  })
  chatState.groups.push(group)
  saveGroups()
  refreshUnread()
  return group
}

export function updateGroup(id, patch) {
  const current = groupById(id)
  if (!current) return null
  const updated = normalizeGroup({ ...current, ...patch, id })
  Object.assign(current, updated)
  saveGroups()
  refreshUnread()
  return current
}

export function conversationPinnedCount() {
  return (
    chatState.contacts.filter((contact) => contact.pinned).length +
    chatState.groups.filter((group) => group.pinned).length
  )
}

export function setConversationPinned(kind, id, pinned) {
  const item = kind === 'group' ? groupById(id) : contactById(id)
  if (!item) return false
  if (pinned && !item.pinned && conversationPinnedCount() >= 10) return false
  item.pinned = Boolean(pinned)
  if (kind === 'group') saveGroups()
  else saveContacts()
  return true
}

export function setConversationMuted(kind, id, muted) {
  const item = kind === 'group' ? groupById(id) : contactById(id)
  if (!item) return false
  item.muted = Boolean(muted)
  if (kind === 'group') saveGroups()
  else saveContacts()
  return true
}

export function createContact(data = {}) {
  const contact = normalizeContact(
    {
      id: makeId('c'),
      name: 'TA',
      note: 'TA',
      avatar: 'T',
      color: 'var(--theme-primary)',
      messages: [],
      ...data,
    },
    chatState.contacts.length,
    false
  )
  chatState.contacts.push(contact)
  saveContacts()
  refreshUnread()
  scheduleNextProactive()
  return contact
}

export function updateContact(id, patch) {
  const current = contactById(id)
  if (!current) return null
  const updated = normalizeContact({ ...current, ...patch, id }, 0, false)
  Object.assign(current, updated)
  saveContacts()
  refreshUnread()
  scheduleNextProactive()
  return current
}

export function saveChatDataNow() {
  saveContacts()
  saveGroups()
  refreshUnread()
}

function importedContact(source = {}) {
  return (
    chatState.contacts.find(
      (contact) =>
        contact.id === source.id ||
        contact.note === source.note ||
        contact.name === source.name
    ) || null
  )
}

export function importChatBundle(bundle = {}) {
  const profileKeys = [
    'name',
    'note',
    'avatar',
    'color',
    'avatarImage',
    'avatarFrame',
    'gender',
    'chatBackground',
    'chatBackgroundOpacity',
    'momentsCover',
    'momentsCoverOpacity',
    'replyFrequency',
    'notificationSound',
    'backstory',
  ]
  let importedCharacters = 0
  let importedCards = 0
  let importedChats = 0
  let importedGroups = 0

  for (const source of Array.isArray(bundle.characters) ? bundle.characters : []) {
    if (!source || typeof source !== 'object') continue
    let target = importedContact(source)
    const base = target
      ? { ...target }
      : {
          id: source.id || makeId('c'),
          messages: [],
          cards: [],
          cardGroups: clone(DEFAULT_CARD_GROUPS),
        }
    for (const key of profileKeys) {
      if (source[key] !== undefined) base[key] = source[key]
    }
    base.id = target?.id || base.id
    base.messages = target?.messages || []
    base.cards = target?.cards || []
    base.cardGroups = target?.cardGroups || base.cardGroups || clone(DEFAULT_CARD_GROUPS)
    const normalized = normalizeContact(base, chatState.contacts.length, false)
    if (target) Object.assign(target, normalized)
    else {
      chatState.contacts.push(normalized)
      target = normalized
    }
    importedCharacters += 1
  }

  for (const source of Array.isArray(bundle.groups) ? bundle.groups : []) {
    if (!source || typeof source !== 'object') continue
    let target =
      chatState.groups.find(
        (group) => group.id === source.id || group.name === source.name
      ) || null
    const memberIds = Array.isArray(source.memberIds)
      ? source.memberIds.filter((id) => chatState.contacts.some((contact) => contact.id === id))
      : target?.memberIds || []
    const payload = {
      ...(target || {}),
      ...source,
      id: target?.id || source.id || makeId('group'),
      memberIds,
      messages: target?.messages || [],
    }
    const normalized = normalizeGroup(payload)
    if (target) Object.assign(target, normalized)
    else chatState.groups.push(normalized)
    importedGroups += 1
  }

  for (const source of Array.isArray(bundle.cards) ? bundle.cards : []) {
    const target = importedContact(source)
    if (!target) continue
    const normalized = normalizeContact(
      {
        ...target,
        cardGroups: source.cardGroups || target.cardGroups,
        cards: Array.isArray(source.cards) ? source.cards : target.cards,
      },
      0,
      false
    )
    Object.assign(target, normalized)
    importedCards += 1
  }

  for (const source of Array.isArray(bundle.chats) ? bundle.chats : []) {
    const target = importedContact(source)
    if (!target || !Array.isArray(source.messages)) continue
    target.messages = clone(source.messages)
    importedChats += 1
  }

  for (const source of Array.isArray(bundle.groupChats) ? bundle.groupChats : []) {
    const group =
      chatState.groups.find(
        (item) => item.id === source.id || item.name === source.name
      ) || null
    if (!group || !Array.isArray(source.messages)) continue
    group.messages = clone(source.messages)
    importedChats += 1
  }

  saveChatDataNow()
  return { importedCharacters, importedCards, importedChats, importedGroups }
}

export function applyChatBackgroundToAll(background, opacity) {
  const url = typeof background === 'string' ? background : ''
  const alpha = clampOpacity(opacity)
  chatState.contacts.forEach((contact) => {
    contact.chatBackground = url
    contact.chatBackgroundOpacity = alpha
  })
  chatState.groups.forEach((group) => {
    group.chatBackground = url
    group.chatBackgroundOpacity = alpha
  })
  saveContacts()
  saveGroups()
  return true
}

export function removeContact(id) {
  const index = chatState.contacts.findIndex((contact) => contact.id === id)
  if (index < 0) return false
  chatState.contacts.splice(index, 1)
  chatState.groups.forEach((group) => {
    group.memberIds = group.memberIds.filter((memberId) => memberId !== id)
  })
  chatState.groups = chatState.groups.filter((group) => group.memberIds.length >= 2)
  if (chatState.activeGroupId && !groupById(chatState.activeGroupId)) {
    chatState.activeGroupId = null
  }
  if (chatState.activeId === id) chatState.activeId = null
  if (chatState.notification?.contactId === id) chatState.notification = null
  saveContacts()
  saveGroups()
  refreshUnread()
  scheduleNextProactive()
  return true
}

export function clearAllMessages() {
  replyTimers.forEach((timer) => clearTimeout(timer))
  replyTimers.clear()
  chatState.activeId = null
  chatState.notification = null
  chatState.selectingContactId = null
  chatState.selectingGroupId = null
  chatState.contacts.forEach((contact) => {
    contact.messages = []
  })
  chatState.groups.forEach((group) => {
    group.messages = []
  })
  saveContacts()
  saveGroups()
  refreshUnread()
  scheduleNextProactive()
}

export function startChatEngine() {
  if (engineStarted) return
  engineStarted = true
  restoreCallSession()
  saveContacts()
  saveGroups()
  refreshUnread()
  scheduleNextProactive()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
}

export function stopChatEngine() {
  engineStarted = false
  clearTimeout(proactiveTimer)
  proactiveTimer = null
  clearTimeout(notificationTimer)
  notificationTimer = null
  replyTimers.forEach((timer) => clearTimeout(timer))
  replyTimers.clear()
  clearCallTimers()
  chatState.call = null
  chatState.selectingContactId = null
  chatState.selectingGroupId = null
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

function onVisibilityChange() {
  syncCallSeconds()
  if (document.visibilityState !== 'visible' || store.page !== 'sms') return
  if (chatState.activeId) markRead(chatState.activeId)
  if (chatState.activeGroupId) {
    const group = groupById(chatState.activeGroupId)
    if (group) {
      group.messages.forEach((message) => {
        if (message.from === 'other') message.read = true
      })
      saveGroups()
      refreshUnread()
    }
  }
}

export function notificationSupported() {
  return typeof Notification !== 'undefined'
}

export function notificationPermission() {
  return notificationSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission() {
  if (!notificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch (e) {
    return 'denied'
  }
}

watch(
  () => [
    settings.proactiveEnabled,
    settings.randomInterval,
    settings.minInterval,
    settings.maxInterval,
  ],
  scheduleNextProactive
)