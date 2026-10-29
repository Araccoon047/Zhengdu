import { reactive, watch } from 'vue'
import initial from './data/sms.json'
import { settings } from './settings'
import { store } from './store'
import { randomIncomingNudge } from './nudge'
import systemCardsData from './data/system-cards.json'
import { loadStickerLibrary, randomStickerForContact, stickerState } from './stickers'
import { listPhotos } from './album-store'
import musicData from './data/music.json'
import { dictionaryEntriesFor } from './dictionary-cards'
import { isNativeApp, nativeNotificationPermission, requestNativePermissions, showNativeNotification } from './native-bridge'
import { SYSTEM_GIFT_GROUPS, SYSTEM_GIFT_NAMES, randomItem as randomGiftItem } from './gift-data'
import { isSystemCardGroupDeleted, systemCategoryTexts } from './system-card-pool'

const STORAGE_KEY = 'zhengdu_sms_v1'
const GROUPS_KEY = 'zhengdu_groups_v1'
const CALL_KEY = 'zhengdu_active_call_v1'
const STORAGE_VERSION = 2
const DEFAULT_CARD_GROUPS = [
  { id: 'basic', name: '基础' },
  { id: 'report', name: '报备' },
  { id: 'weather', name: '天气' },
  { id: 'gift', name: '礼物' },
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
  if (!cardGroups.some((group) => group.id === 'gift')) {
    cardGroups.push({ id: 'gift', name: '礼物', locked: false })
  }
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
    avatarFrameSkin: String(source.avatarFrameSkin || settings.contactAvatarFrameSkin || 'none'),
    avatarFrameOffsetX: Math.max(-80, Math.min(80, Math.round(Number(source.avatarFrameOffsetX) || 0))),
    avatarFrameOffsetY: Math.max(-80, Math.min(80, Math.round(Number(source.avatarFrameOffsetY) || 0))),
    avatarFrameScale: Math.max(0.5, Math.min(2, Number(source.avatarFrameScale) || 1)),
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
    avatar: String(source.avatar || '群').slice(0, 8),
    avatarImage: typeof source.avatarImage === 'string' ? source.avatarImage : '',
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
const groupCallTimers = new Set()

let contactsSaveTimer = null
let groupsSaveTimer = null

function writeContactsNow() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, contacts: chatState.contacts })
    )
  } catch (e) {
    /* 忽略不可写场景 */
  }
}

function writeGroupsNow() {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ groups: chatState.groups }))
  } catch (e) {
    /* 忽略不可写场景 */
  }
}

function saveContacts() {
  clearTimeout(contactsSaveTimer)
  contactsSaveTimer = setTimeout(() => {
    contactsSaveTimer = null
    writeContactsNow()
  }, 140)
}

function saveGroups() {
  clearTimeout(groupsSaveTimer)
  groupsSaveTimer = setTimeout(() => {
    groupsSaveTimer = null
    writeGroupsNow()
  }, 140)
}

function flushChatStorage() {
  if (contactsSaveTimer) {
    clearTimeout(contactsSaveTimer)
    contactsSaveTimer = null
    writeContactsNow()
  }
  if (groupsSaveTimer) {
    clearTimeout(groupsSaveTimer)
    groupsSaveTimer = null
    writeGroupsNow()
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
    if (isNativeApp()) {
      showNativeNotification(conversationName(conversation), text)
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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

export function showAppNotice(notice = {}) {
  if (!settings.inAppNotifications) return false
  const text = String(notice.text || '').trim()
  if (!text) return false
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
  if (hidden) {
    if (isNativeApp()) {
      showNativeNotification(String(notice.name || '争渡'), text)
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(String(notice.name || '争渡'), {
          body: text,
          tag: `zhengdu-${notice.actionPage || 'app'}`,
          silent: true,
        })
      } catch (e) {
        /* 系统通知失败时仍保留模块内记录 */
      }
    }
    return true
  }
  chatState.notification = {
    id: makeId('notice'),
    actionPage: String(notice.actionPage || ''),
    actionId: String(notice.actionId || ''),
    contactId: String(notice.contactId || ''),
    conversationType: notice.conversationType === 'group' ? 'group' : 'contact',
    name: String(notice.name || '争渡'),
    avatar: String(notice.avatar || '✦').slice(0, 8),
    avatarImage: String(notice.avatarImage || ''),
    color: String(notice.color || 'var(--theme-primary)'),
    text,
  }
  clearTimeout(notificationTimer)
  const id = chatState.notification.id
  notificationTimer = setTimeout(() => {
    if (chatState.notification?.id === id) chatState.notification = null
  }, 5200)
  return true
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
  groupCallTimers.forEach((timer) => clearTimeout(timer))
  groupCallTimers.clear()
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

function groupNotice(group, text) {
  if (!group) return
  showAppNotice({ actionPage: 'sms', contactId: group.id, conversationType: 'group', name: group.name, avatar: group.avatar || '群', avatarImage: group.avatarImage || '', color: group.color || 'var(--theme-primary)', text })
}
function groupCallNotice(call, text) {
  groupNotice(groupById(call?.groupId), text)
}
function refreshGroupCallConnection(call) {
  if (!call?.groupId) return
  if (call.joinedMemberIds.length) {
    if (call.status !== '通话中') {
      call.status = '通话中'
      startCallClock(call.connectedAt || Date.now())
    }
    groupCallNotice(call, `${call.kind === 'video' ? '视频通话' : '语音通话'}已接通，当前 ${call.joinedMemberIds.length + (call.userJoined ? 1 : 0)} 人`)
  } else if (!call.userJoined) {
    finishGroupCall('completed')
  }
  saveCallSession()
}
export function startGroupCall(groupId, memberIds, kind = 'voice') {
  const group = groupById(groupId)
  const members = groupMembers(group).filter((member) => memberIds.includes(member.id))
  if (!group || !members.length || chatState.call) return false
  clearCallTimers()
  clearSavedCallSession()
  chatState.call = {
    kind: kind === 'video' ? 'video' : 'voice',
    direction: 'outgoing',
    status: '正在呼叫…',
    contactId: members[0].id,
    groupId: group.id,
    groupName: group.name,
    participantIds: members.map((member) => member.id),
    joinedMemberIds: [],
    userJoined: true,
    seconds: 0,
    startedAt: Date.now(),
    connectedAt: null,
    expanded: true,
  }
  saveCallSession()
  groupCallNotice(chatState.call, `发起${kind === 'video' ? '视频' : '语音'}群通话`)
  members.forEach((member, index) => {
    const timer = setTimeout(() => {
      groupCallTimers.delete(timer)
      const current = chatState.call
      if (!current?.groupId || current.groupId !== group.id || !current.participantIds.includes(member.id)) return
      if (!current.joinedMemberIds.includes(member.id)) current.joinedMemberIds.push(member.id)
      refreshGroupCallConnection(current)
    }, 900 + index * 620)
    groupCallTimers.add(timer)
  })
  return true
}
export function startIncomingGroupCall(groupId, memberId, kind = 'voice') {
  const group = groupById(groupId)
  const caller = contactById(memberId)
  if (!group || !caller || !group.memberIds.includes(caller.id) || chatState.call) return false
  const auto = autoForContact(caller)
  if (auto.callsAllowed === false) return false
  clearCallTimers()
  clearSavedCallSession()
  chatState.call = {
    kind: kind === 'video' ? 'video' : 'voice',
    direction: 'incoming',
    status: '邀请你通话',
    contactId: caller.id,
    groupId: group.id,
    groupName: group.name,
    participantIds: [...group.memberIds],
    joinedMemberIds: [caller.id],
    userJoined: false,
    seconds: 0,
    startedAt: Date.now(),
    connectedAt: null,
    expanded: true,
  }
  saveCallSession()
  groupNotice(group, `${contactDisplayName(caller)}发起了群${kind === 'video' ? '视频' : '语音'}通话`)
  const ringSeconds = Math.max(1, Number(auto.incomingRingSeconds) || 30)
  callRingTimer = setTimeout(() => finishGroupCall('missed'), ringSeconds * 1000)
  return true
}


export function joinGroupCall() {
  const call = chatState.call
  if (!call?.groupId) return false
  call.userJoined = true
  call.expanded = true
  refreshGroupCallConnection(call)
  return true
}
export function leaveGroupCall() {
  const call = chatState.call
  if (!call?.groupId) return false
  call.userJoined = false
  call.expanded = false
  groupCallNotice(call, '你退出了群通话')
  if (call.joinedMemberIds.length < 2) finishGroupCall('completed')
  else saveCallSession()
  return true
}
export function endGroupCall() {
  if (!chatState.call?.groupId) return false
  finishGroupCall('completed')
  return true
}
export function simulateGroupCallMember(memberId, joined = true) {
  const call = chatState.call
  if (!call?.groupId || !call.participantIds.includes(memberId)) return false
  call.joinedMemberIds = joined
    ? [...new Set([...call.joinedMemberIds, memberId])]
    : call.joinedMemberIds.filter((id) => id !== memberId)
  refreshGroupCallConnection(call)
  return true
}
function finishGroupCall(outcome = 'completed') {
  const current = chatState.call
  if (!current?.groupId) return false
  const group = groupById(current.groupId)
  syncCallSeconds()
  const seconds = current.seconds
  const result = outcome === 'declined'
    ? '已拒绝'
    : outcome === 'missed'
      ? '未接听'
      : outcome === 'cancelled'
        ? '已取消'
        : formatCallDuration(seconds)
  const text = `群${current.kind === 'video' ? '视频通话' : '语音通话'} · ${result}`
  clearCallTimers()
  chatState.call = null
  clearSavedCallSession()
  if (group) {
    group.messages.push({ id: makeId('group-call'), from: 'system', type: 'nudge', text, time: nowHM(), createdAt: Date.now(), read: true })
    saveGroups()
    refreshUnread()
  }
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
  if (chatState.call.groupId) {
    joinGroupCall()
    return true
  }
  chatState.call.status = '通话中'
  startCallClock(Date.now())
  scheduleContactHangup()
  return true
}

export function declineIncomingCall() {
  if (!chatState.call || chatState.call.direction !== 'incoming') return false
  if (chatState.call.groupId) {
    finishGroupCall('declined')
    return true
  }
  finishCall('declined')
  return true
}

export function hangupCallByContact() {
  if (!chatState.call || chatState.call.status !== '通话中') return false
  return finishCall('completed', 'contact')
}
export function hangupCall() {
  if (!chatState.call) return false
  if (chatState.call.groupId) return leaveGroupCall()
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
      groupId: String(saved.groupId || ''),
      groupName: String(saved.groupName || ''),
      participantIds: Array.isArray(saved.participantIds) ? saved.participantIds : [],
      joinedMemberIds: Array.isArray(saved.joinedMemberIds) ? saved.joinedMemberIds : [],
      userJoined: saved.userJoined !== false,
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
const SYSTEM_CARD_SOURCE = new Map()
for (const group of SYSTEM_CARD_GROUPS) {
  for (const card of group.cards) {
    if (!SYSTEM_CARD_SOURCE.has(card)) SYSTEM_CARD_SOURCE.set(card, group.name)
  }
}
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
      if (typeof card === 'object' && card?.groupId === 'gift') return false
      if (!locked.size || typeof card === 'string') return true
      return !locked.has(card?.groupId)
    })
    .map((card) => (typeof card === 'string' ? card : String(card?.text ?? '').trim()))
    .filter(Boolean)
}

/** 系统预设中未被锁定的字卡；settings.systemLockedCardGroups 存 'main:3' 这类分组键 */
let systemCardPoolCache = []
let systemCardPoolCacheKey = ''

function systemCardsForContact() {
  const lockedList = Array.isArray(settings.systemLockedCardGroups) ? settings.systemLockedCardGroups : []
  const deletedList = Array.isArray(settings.systemDeletedCardGroups) ? settings.systemDeletedCardGroups : []
  const hiddenList = Array.isArray(settings.systemHiddenCardIds) ? settings.systemHiddenCardIds : []
  const edits = settings.systemCardEdits || {}
  const customList = (settings.systemCustomCards || []).filter((card) => card?.categoryKey === 'main' && !hiddenList.includes(card.id) && !isSystemCardGroupDeleted('main', Number(card.groupIndex)))
  const cacheKey = [
    lockedList.join('|'),
    deletedList.join('|'),
    hiddenList.join('|'),
    JSON.stringify(edits),
    JSON.stringify(customList),
  ].join('::')
  if (cacheKey === systemCardPoolCacheKey) return systemCardPoolCache
  const locked = new Set(lockedList)
  const hidden = new Set(hiddenList)
  const custom = customList.map((card) => card.text)
  systemCardPoolCache = SYSTEM_CARD_GROUPS
    .flatMap((group, groupIndex) => {
      if (locked.has(group.key) || isSystemCardGroupDeleted('main', groupIndex)) return []
      return group.cards
        .map((card, cardIndex) => {
          const id = `main:${groupIndex}:${cardIndex}`
          return hidden.has(id) ? '' : edits[id] || card
        })
        .filter(Boolean)
    })
    .concat(custom)
  systemCardPoolCacheKey = cacheKey
  return systemCardPoolCache
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

function sourceLabelsForCard(contact, text) {
  const card = (contact?.cards || []).find(
    (item) => (typeof item === 'string' ? item : String(item?.text ?? '').trim()) === text
  )
  if (card && typeof card === 'object') {
    const group = (contact?.cardGroups || []).find((item) => item.id === card.groupId)
    return ['我的字卡', group?.name || '未分组']
  }
  const edits = settings.systemCardEdits || {}
  for (let groupIndex = 0; groupIndex < SYSTEM_CARD_GROUPS.length; groupIndex += 1) {
    const group = SYSTEM_CARD_GROUPS[groupIndex]
    for (let cardIndex = 0; cardIndex < group.cards.length; cardIndex += 1) {
      const id = `main:${groupIndex}:${cardIndex}`
      if ((edits[id] || group.cards[cardIndex]) === text) return ['系统预设', group.name]
    }
  }
  if ((settings.systemCustomCards || []).some((item) => item.categoryKey === 'main' && item.text === text && !(settings.systemHiddenCardIds || []).includes(item.id))) {
    return ['系统预设', '自定义系统字卡']
  }
  return ['系统预设', SYSTEM_CARD_SOURCE.get(text) || '未分组']
}

function uniqueLabels(labels) {
  return [...new Set((labels || []).map((label) => String(label || '').trim()).filter(Boolean))]
}


export function giftNameOptionsForContact(contact = primaryContact()) {
  const hidden = new Set(settings.systemHiddenCardIds || [])
  const locked = new Set(settings.systemLockedCardGroups || [])
  const giftLocked = locked.has('gift:0') || isSystemCardGroupDeleted('gift', 0)
  const edits = settings.systemCardEdits || {}
  const systemNames = (giftLocked ? [] : SYSTEM_GIFT_GROUPS[0].cards)
    .map((text, index) => {
      const id = `gift:0:${index}`
      return hidden.has(id) ? '' : edits[id] || text
    })
    .filter(Boolean)
    .map((text) => {
      const entry = SYSTEM_GIFT_NAMES.find((item) => item.text === text)
      return { text, emoji: entry?.emoji || '🎁', price: entry?.price || 0, source: '系统预设' }
    })
  const customSystem = (giftLocked ? [] : (settings.systemCustomCards || []))
    .filter((card) => card.categoryKey === 'gift' && Number(card.groupIndex) === 0 && !hidden.has(card.id))
    .map((card) => ({ text: card.text, emoji: '🎁', price: 0, source: '系统预设' }))
  const customNames = (contact?.cards || [])
    .filter((card) => typeof card === 'object' && card?.groupId === 'gift' && card.text)
    .map((card) => ({ text: String(card.text).trim(), emoji: '🎁', price: 0, source: '我的字卡' }))
  const unique = new Map()
  for (const item of [...customNames, ...systemNames, ...customSystem]) {
    if (item.text && !unique.has(item.text)) unique.set(item.text, item)
  }
  return [...unique.values()]
}

export function randomGiftForContact(contact = primaryContact()) {
  const names = giftNameOptionsForContact(contact).filter((item) => item.source === '系统预设')
  const gift = names.length ? randomGiftItem(names) : null
  const customNotes = (contact?.cards || [])
    .filter((card) => typeof card === 'object' && card?.text && card?.groupId !== 'gift')
    .map((card) => String(card.text).trim())
    .filter(Boolean)
  const note = customNotes.length ? randomGiftItem(customNotes) : '一点心意'
  const price = gift?.price || 20 + Math.floor(Math.random() * 501)
  return {
    name: gift?.text || '一份小礼物',
    note,
    emoji: gift?.emoji || '🎁',
    price: Number(price.toFixed(2)),
  }
}

function drawReplyBatches(contact = primaryContact(), options = {}) {
  const cards = cardsForContact(contact)
  if (!cards.length) return []
  const auto = autoForContact(contact)
  const messageMin = Math.max(1, Math.round(Number(options.messageMin ?? options.min ?? auto.replyMessageMin) || 1))
  const messageMax = Math.max(messageMin, Math.round(Number(options.messageMax ?? options.max ?? auto.replyMessageMax) || messageMin))
  const messageCount = randomCount(messageMin, messageMax, 1, 1)
  const multiEnabled = auto.multiCardEnabled !== false
  return Array.from({ length: messageCount }, () => {
    const multiTriggered = multiEnabled && chancePercent(auto.multiCardChance, 100, auto.multiCardChanceRandom)
    const cardCount = multiTriggered
      ? randomCount(
          options.cardMin ?? auto.multiCardMin ?? settings.replyCardCountMin,
          options.cardMax ?? auto.multiCardMax ?? settings.replyCardCountMax,
          1,
          1
        )
      : 1
    const picked = Array.from(
      { length: cardCount },
      () => cards[Math.floor(Math.random() * cards.length)]
    ).filter(Boolean)
    return {
      text: picked.join(' '),
      cards: picked,
      sourceLabels: uniqueLabels(picked.flatMap((cardText) => sourceLabelsForCard(contact, cardText))),
    }
  }).filter((batch) => batch.text)
}

export function drawReplyCards(contact = primaryContact(), options = {}) {
  return drawReplyBatches(contact, options).map((batch) => batch.text)
}

/**
 * 首页「今天 TA 想对你说」卡片：从字卡池（系统 + 自定义，均排除锁定分组）随机抽 min~max 张（去重）。
 * 系统字卡与自定义字卡合并后完全随机抽取，不再使用额外概率。
 */
export function drawTaTodayCards(min = 1, max = 3) {
  const contact = primaryContact()
  const pool = [...customCardsForContact(contact), ...systemCardsForContact()]
  if (!pool.length) return []
  const count = randomCount(min, max, 1, 3)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function selectionDelayFor(contact) {
  const auto = autoForContact(contact)
  const normalize = (value, fallback = 0) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, number) : fallback
  }
  const min = normalize(auto.replyDelayMinSeconds ?? settings.replyDelayMinSeconds, 4)
  const max = Math.max(min, normalize(auto.replyDelayMaxSeconds ?? settings.replyDelayMaxSeconds, min))
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

      deliver(currentConversation, texts[index], index)
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



const PROACTIVE_LOCATIONS = [
  '公司楼下的便利店',
  '公司附近的咖啡馆',
  '办公室靠窗的位置',
  '下班后的写字楼门口',
  '梧桐树下的街边',
  '老城区的石板路',
  '街角的长椅',
  '下雨的公交站',
  '楼下的小商店',
  '巷口的杂货铺',
  '热闹的商场',
  '常去的那家小餐厅',
  '街边面馆',
  '安静的甜品店',
  '弯弯的小巷',
  '种满花的小巷',
  '城市公园',
  '湖边公园',
  '长椅旁的草地',
  '回家路上的花店',
  '家门口',
  '亮着灯的客厅',
  '医院门口',
  '医院附近的小路',
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
    const batches = drawReplyBatches(contact, { messageMin: min, messageMax: max })
    deliverIncomingCards(contact.id, batches.map((batch) => batch.text), {
      sourceLabels: batches.map((batch) => batch.sourceLabels),
    })
    return true
  }

  if (action === 'gift') {
    const gift = randomGiftForContact(contact)
    deliverProactiveAction(
      contact,
      {
        type: 'gift',
        text: gift.name,
        giftName: gift.name,
        giftWish: gift.note,
        giftEmoji: gift.emoji,
        giftPrice: gift.price,
        giftCat: 'custom',
        giftSelf: false,
        giftSourceGroup: '系统预设 · 礼物',
      },
      `[礼物] ${gift.name}`
    )
    return true
  }

  if (action === 'transfer') {
    const amount = (1 + Math.floor(Math.random() * 5200) / 100).toFixed(2)
    const note = randomItem(PROACTIVE_TRANSFER_NOTES)
    deliverProactiveAction(
      contact,
      {
        type: 'transfer',
        amount,
        text: note,
        transferRecipientId: 'me',
        transferRecipientName: '我',
        transferRecipientKind: 'user',
      },
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

  const sourceLabels = Array.isArray(options.sourceLabels)
    ? options.sourceLabels
    : texts.map((text) => sourceLabelsForCard(contact, text))
  queueCardSequence(contact, contact, texts, options, (liveContact, text, index) => {
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
      sourceLabels: uniqueLabels(sourceLabels[index] || []),
      sourceGroup: (sourceLabels[index] || []).at(-1) || '',
      dictionary: options.dictionary === true,
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
    const emojis = systemCategoryTexts('emoji')
    const emoji = emojis.length ? randomItem(emojis) : ''
    if (emoji) result[last] = `${result[last]} ${emoji}`
  }
  if (chancePercent(auto.kaomojiChance, 5, auto.kaomojiChanceRandom)) {
    const kaomojis = systemCategoryTexts('kaomoji')
    const kaomoji = kaomojis.length ? randomItem(kaomojis) : ''
    if (kaomoji) result[last] = `${result[last]} ${kaomoji}`
  }
  return result
}

function dictionaryReplyEntries(auto) {
  const dictionaryEntries = dictionaryEntriesFor()
  if (!dictionaryEntries.length) return []
  const count = randomCount(auto.dictionaryMin, auto.dictionaryMax, 2, 5)
  const entries = Array.from(
    { length: count },
    () => dictionaryEntries[Math.floor(Math.random() * dictionaryEntries.length)]
  )
  if (auto.dictionaryMulti !== false) {
    return entries.map((entry) => ({
      text: entry.text,
      labels: uniqueLabels(['拼词', entry.categoryLabel, entry.groupName]),
    }))
  }
  const separator = auto.multiCardJoin === 'comma' ? '，' : auto.multiCardJoin === 'semicolon' ? '；' : auto.multiCardJoin === 'none' ? '' : ' '
  return [{
    text: entries.map((entry) => entry.text).join(separator),
    labels: uniqueLabels(['拼词', ...entries.flatMap((entry) => [entry.categoryLabel, entry.groupName])]),
  }]
}

async function deliverSpecialReply(contact, payload, preview) {
  if (!contact) return false
  setSelectingFor(contact, true)
  try {
    await new Promise((resolve) => setTimeout(resolve, selectionDelayFor(contact)))
    const liveContact = contactById(contact.id)
    if (!liveContact) return false
    return deliverIncomingPayload(liveContact, payload, preview)
  } finally {
    setSelectingFor(contact, false)
  }
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

function scheduleReadReceipt(contact) {
  if (!contact) return
  const timer = setTimeout(() => {
    replyTimers.delete(timer)
    const liveContact = contactById(contact.id)
    if (!liveContact) return
    const messages = liveContact.messages || []
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.from !== 'me') return
    liveContact.messages.push({
      id: makeId('read-receipt'),
      from: 'system',
      type: 'readReceipt',
      text: `${contactDisplayName(liveContact)}已读不回`,
      time: nowHM(),
      createdAt: Date.now(),
      read: true,
    })
    saveContacts()
  }, 900 + Math.random() * 1300)
  replyTimers.add(timer)
}

async function scheduleCardReply(contactId) {
  const contact = contactById(contactId)
  if (!contact) return false
  const auto = autoForContact(contact)
  if (chancePercent(auto.noReplyChance, 0, auto.noReplyChanceRandom)) {
    scheduleReadReceipt(contact)
    return false
  }
  // 表情包、照片、语音等特殊回复也要在筛选阶段就显示输入提示。
  setSelectingFor(contact, true)

  if (chancePercent(auto.touchChance, 5, auto.touchChanceRandom)) {
    return deliverSpecialReply(
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
        return deliverSpecialReply(contact, { type: 'sticker', src: sticker.src, text: '[表情包]' }, '[表情包]')
      }
    } catch (e) {
      /* 表情包不可用时继续使用文字回复 */
    }
  }

  if (chancePercent(settings.audioGuaranteeChance, 0, settings.audioGuaranteeChanceRandom)) {
    const maxSeconds = Math.max(3, Math.min(60, Math.round(Number(settings.audioCardWeight) || 5)))
    const duration = 3 + Math.floor(Math.random() * maxSeconds)
    return deliverSpecialReply(
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
        return deliverSpecialReply(contact, { type: 'photo', src: photo.src, text: '' }, '[照片]')
      }
    } catch (e) {
      /* 相册不可用时继续使用文字回复 */
    }
  }

  let texts = []
  let sourceLabels = []
  let dictionary = false
  if (auto.dictionaryEnabled === true && chancePercent(auto.dictionaryChance, 25, auto.dictionaryChanceRandom)) {
    const entries = dictionaryReplyEntries(auto)
    texts = entries.map((entry) => entry.text)
    sourceLabels = entries.map((entry) => entry.labels)
    dictionary = texts.length > 0
  }
  if (!texts.length) {
    const batches = drawReplyBatches(contact, {
      messageMin: auto.replyMessageMin,
      messageMax: auto.replyMessageMax,
    })
    texts = batches.map((batch) => batch.text)
    sourceLabels = batches.map((batch) => batch.sourceLabels)
  }
  if (!texts.length) {
    setSelectingFor(contact, false)
    return false
  }
  deliverIncomingCards(contactId, decorateReplyTexts(texts, auto), { sourceLabels, dictionary })
  return true
}

function deliverGroupCards(groupId, memberId, texts, options = {}) {
  const group = groupById(groupId)
  const member = contactById(memberId)
  if (!group || !member) {
    if (options.reschedule !== false) scheduleNextProactive()
    return
  }

  const sourceLabels = Array.isArray(options.sourceLabels)
    ? options.sourceLabels
    : texts.map((text) => sourceLabelsForCard(member, text))
  queueCardSequence(group, member, texts, options, (liveGroup, text, index) => {
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
      sourceLabels: uniqueLabels(sourceLabels[index] || []),
      sourceGroup: (sourceLabels[index] || []).at(-1) || '',
      dictionary: options.dictionary === true,
      senderId: member.id,
      senderName: contactDisplayName(member),
      senderAvatar: member.avatar,
      senderAvatarImage: member.avatarImage,
      senderAvatarFrame: member.avatarFrame,
      senderAvatarFrameOffsetX: member.avatarFrameOffsetX,
      senderAvatarFrameOffsetY: member.avatarFrameOffsetY,
      senderAvatarFrameScale: member.avatarFrameScale,
      senderColor: member.color,
    })
    saveGroups()
    refreshUnread()
    if (!reading) announce(liveGroup, `${contactDisplayName(member)}：${text}`)
  })
}

function scheduleGroupReadReceipt(groupId, memberId) {
  const member = contactById(memberId)
  const group = groupById(groupId)
  if (!member || !group) return
  const timer = setTimeout(() => {
    replyTimers.delete(timer)
    const liveGroup = groupById(groupId)
    const liveMember = contactById(memberId)
    if (!liveGroup || !liveMember) return
    const lastMessage = liveGroup.messages[liveGroup.messages.length - 1]
    if (!lastMessage || lastMessage.from !== 'me') return
    const text = `${contactDisplayName(liveMember)}已读不回`
    liveGroup.messages.push({
      id: makeId('group-read-receipt'),
      from: 'system',
      type: 'readReceipt',
      text,
      senderId: liveMember.id,
      senderName: contactDisplayName(liveMember),
      time: nowHM(),
      createdAt: Date.now(),
      read: true,
    })
    saveGroups()
    refreshUnread()
    groupNotice(liveGroup, text)
  }, 900 + Math.random() * 1300)
  replyTimers.add(timer)
}

function scheduleMemberInitiatedGroupCall(group, member, auto) {
  if (!group || !member || auto?.callsAllowed === false) return
  const chance = Number(auto?.proactiveCallChance ?? settings.contactAutoSettings?.[member.id]?.proactiveCallChance ?? 0)
  if (!chancePercent(chance, 0, auto?.proactiveCallChanceRandom)) return
  const timer = setTimeout(() => {
    replyTimers.delete(timer)
    if (chatState.call) return
    const kind = Math.random() < 0.5 ? 'video' : 'voice'
    startIncomingGroupCall(group.id, member.id, kind)
  }, 4200 + Math.random() * 3600)
  replyTimers.add(timer)
}
function scheduleGroupReply(groupId) {
  const group = groupById(groupId)
  const members = groupMembers(group)
  if (!group || !members.length) return 0
  const responders = members.filter((member) => {
    const auto = autoForContact(member)
    return chancePercent(auto.groupReplyChance, 100, auto.groupReplyChanceRandom)
  }).sort(() => Math.random() - 0.5)
  for (const member of responders) {
    const auto = autoForContact(member)
    if (chancePercent(auto.noReplyChance, 0, auto.noReplyChanceRandom)) {
      scheduleGroupReadReceipt(group.id, member.id)
      continue
    }
    let texts = []
    let sourceLabels = []
    let dictionary = false
    const groupDictionaryEntries = dictionaryEntriesFor()
    if (auto.groupDictionaryEnabled === true && groupDictionaryEntries.length) {
      const count = randomCount(auto.groupReplyCardMin, auto.groupReplyCardMax, 1, 1)
      const entries = Array.from(
        { length: count },
        () => groupDictionaryEntries[Math.floor(Math.random() * groupDictionaryEntries.length)]
      )
      texts = entries.map((entry) => entry.text)
      sourceLabels = entries.map((entry) => uniqueLabels(['拼词', entry.categoryLabel, entry.groupName]))
      dictionary = true
    } else {
      const batches = drawReplyBatches(member, {
        messageMin: auto.groupReplyCardMin,
        messageMax: auto.groupReplyCardMax,
      })
      texts = batches.map((batch) => batch.text)
      sourceLabels = batches.map((batch) => batch.sourceLabels)
    }
    deliverGroupCards(group.id, member.id, texts, { sourceLabels, dictionary })
    scheduleMemberInitiatedGroupCall(group, member, auto)
  }
  return responders.length
}

export function sendGroupMemberMessage(groupId, memberId, text, options = {}) {
  const group = groupById(groupId)
  const member = contactById(memberId)
  const clean = String(text || '').trim()
  if (!group || !member || !clean) return false
  const reading = isReading(group)
  const payload = { ...(options.payload || {}) }
  const messageType = options.type || payload.type || 'text'
  if (messageType === 'transfer' || messageType === 'redpacket') {
    payload.transferRecipientId = 'me'
    payload.transferRecipientName = '我'
    payload.transferRecipientKind = 'user'
  }
  group.messages.push({
    id: makeId('gr-tool'),
    from: 'other',
    type: messageType,
    text: clean,
    time: nowHM(),
    createdAt: Date.now(),
    read: reading,
    sourceLabels: uniqueLabels(options.sourceLabels || []),
    senderId: member.id,
    senderName: contactDisplayName(member),
    senderAvatar: member.avatar,
    senderAvatarImage: member.avatarImage,
    senderAvatarFrame: member.avatarFrame,
    senderAvatarFrameOffsetX: member.avatarFrameOffsetX,
    senderAvatarFrameOffsetY: member.avatarFrameOffsetY,
    senderAvatarFrameScale: member.avatarFrameScale,
    senderColor: member.color,
    ...payload,
  })
  saveGroups()
  refreshUnread()
  if (!reading) announce(group, `${contactDisplayName(member)}：${clean}`)
  return true
}
export function triggerProactiveForActiveChat() {
  if (chatState.activeGroupId) {
    const group = groupById(chatState.activeGroupId)
    const members = groupMembers(group)
    if (!group || !members.length) return false
    const member = members[Math.floor(Math.random() * members.length)]
    const batches = drawReplyBatches(member)
    deliverGroupCards(group.id, member.id, batches.map((batch) => batch.text), {
      sourceLabels: batches.map((batch) => batch.sourceLabels),
    })
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

export function deleteGroup(id) {
  const group = groupById(id)
  if (!group) return false
  if (chatState.call?.groupId === id) finishGroupCall('completed')
  chatState.groups = chatState.groups.filter((item) => item.id !== id)
  if (chatState.activeGroupId === id) chatState.activeGroupId = null
  saveGroups()
  refreshUnread()
  return true
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
      avatarFrameSkin: 'none',
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
  flushChatStorage()
  writeContactsNow()
  writeGroupsNow()
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
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushChatStorage)
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
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', flushChatStorage)
  }
}

function onVisibilityChange() {
  syncCallSeconds()
  if (document.visibilityState === 'hidden') flushChatStorage()
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
  return isNativeApp() || typeof Notification !== 'undefined'
}

export function notificationPermission() {
  if (isNativeApp()) return nativeNotificationPermission()
  return notificationSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission() {
  if (isNativeApp()) {
    requestNativePermissions()
    return nativeNotificationPermission()
  }
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