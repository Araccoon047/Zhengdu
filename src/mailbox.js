import { reactive, watch } from 'vue'
import { chatState, contactById, contactDisplayName, showAppNotice } from './chat'
import { settings } from './settings'
import { dictionaryCardsFor } from './dictionary-cards'
import { systemCategoryTexts } from './system-card-pool'

const KEY = 'zhengdu_mailbox_v1'
const REPLY_QUEUE_KEY = 'zhengdu_mailbox_reply_queue_v1'
let proactiveTimer = null
let stopSettingsWatch = null
const replyTimers = new Map()

function loadReplyQueue() {
  try {
    const list = JSON.parse(localStorage.getItem(REPLY_QUEUE_KEY) || '[]')
    return Array.isArray(list)
      ? list.filter((item) => item?.id && item?.contactId && Number(item.dueAt) > 0)
      : []
  } catch {
    return []
  }
}

function saveReplyQueue(list) {
  try { localStorage.setItem(REPLY_QUEUE_KEY, JSON.stringify(list)) } catch {}
}

function armReply(item) {
  if (!item || replyTimers.has(item.id)) return
  const dueAt = Number(item.dueAt) || Date.now()
  const delay = Math.max(0, dueAt - Date.now())
  const timer = setTimeout(() => {
    replyTimers.delete(item.id)
    saveReplyQueue(loadReplyQueue().filter((entry) => entry.id !== item.id))
    if (contactById(item.contactId)) addContactLetter(item.contactId, { replyToId: item.replyToId })
  }, delay)
  replyTimers.set(item.id, timer)
}

function loadLetters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export const mailboxState = reactive({ letters: loadLetters() })

function saveLetters() {
  try {
    localStorage.setItem(KEY, JSON.stringify(mailboxState.letters))
  } catch (e) {
    /* 忽略本地存储失败 */
  }
}

function makeId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7)
}

function rollChance(value, random = false, fallback = 100) {
  if (random === true) return Math.random() < 0.5
  const percent = Math.max(0, Math.min(100, Number(value ?? fallback)))
  return Math.random() * 100 < percent
}
function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function cardsForContact(contact) {
  const cards =
    contact && Array.isArray(contact.cards) && contact.cards.length
      ? contact.cards
      : settings.replyCards
  const customCards = Array.isArray(cards)
    ? cards
        .map((card) => (typeof card === 'string' ? card : String(card?.text ?? '').trim()))
        .filter(Boolean)
    : []
  return customCards.length ? customCards : systemCategoryTexts('main')
}

function randomLetterBody(contact) {
  const auto = settings.contactAutoSettings?.[contact?.id] || {}
  const dictionaryCards = dictionaryCardsFor(['dict'])
  const cards = auto.letterDictionaryEnabled === true && dictionaryCards.length
    ? dictionaryCards
    : cardsForContact(contact)
  if (!cards.length) return ''
  const min = Math.max(1, Math.min(50, Number(auto.letterCardMin) || 1))
  const max = Math.max(min, Math.min(50, Number(auto.letterCardMax) || 25))
  const count = min + Math.floor(Math.random() * (max - min + 1))
  return Array.from({ length: count }, () => randomItem(cards)).join('；')
}
function addLetter({ direction, kind, contact, body, replyToId = null }) {
  if (!contact || !String(body || '').trim()) return null
  const letter = {
    id: makeId('letter'),
    direction,
    kind,
    contactId: contact.id,
    contactName: contactDisplayName(contact),
    contactAvatar: contact.avatar,
    contactAvatarImage: contact.avatarImage || '',
    contactColor: contact.color || 'var(--theme-primary)',
    body: String(body).trim(),
    replyToId,
    favorite: false,
    createdAt: Date.now(),
  }
  mailboxState.letters.unshift(letter)
  saveLetters()
  if (direction === 'incoming' && settings.mailboxNotifications) {
    showAppNotice({
      actionPage: 'mail',
      name: contactDisplayName(contact),
      avatar: contact.avatar || 'TA',
      avatarImage: contact.avatarImage || '',
      color: contact.color || 'var(--theme-primary)',
      text: replyToId ? `${contactDisplayName(contact)} 回信了` : `${contactDisplayName(contact)} 寄来一封信`,
    })
  }
  return letter
}

export function addContactLetter(contactId, options = {}) {
  const contact = contactById(contactId)
  if (!contact) return null
  const body = randomLetterBody(contact)
  if (!body) return null
  return addLetter({
    direction: 'incoming',
    kind: 'incoming',
    contact,
    body,
    replyToId: options.replyToId || null,
  })
}

function scheduleContactReply(contactId, replyToId) {
  const auto = settings.contactAutoSettings?.[contactId] || {}
  if (!rollChance(auto.letterReplyChance, auto.letterReplyChanceRandom, 100)) return
  const min = Math.max(1, Number(settings.letterReplyMin) || 1)
  const max = Math.max(min, Number(settings.letterReplyMax) || min)
  const delay = (min + Math.random() * (max - min)) * 60000
  const queue = loadReplyQueue().filter((item) => !(item.contactId === contactId && item.replyToId === replyToId))
  const item = { id: makeId('mail-reply'), contactId, replyToId, dueAt: Date.now() + delay }
  queue.push(item)
  saveReplyQueue(queue)
  armReply(item)
}

export function addUserLetter(contactId, body, options = {}) {
  const contact = contactById(contactId)
  const letter = addLetter({
    direction: 'me',
    kind: options.kind === 'reply' ? 'reply' : 'sent',
    contact,
    body,
    replyToId: options.replyToId || null,
  })
  if (letter) scheduleContactReply(contactId, letter.id)
  return letter
}

export function toggleLetterFavorite(id) {
  const letter = mailboxState.letters.find((item) => item.id === id)
  if (!letter) return false
  letter.favorite = !letter.favorite
  saveLetters()
  return true
}

export function deleteLetter(id) {
  mailboxState.letters = mailboxState.letters.filter((letter) => letter.id !== id)
  saveLetters()
}

export function lettersForTab(tab) {
  if (tab === 'incoming') return mailboxState.letters.filter((letter) => letter.direction === 'incoming')
  if (tab === 'replies') return mailboxState.letters.filter((letter) => letter.direction === 'me' && letter.kind === 'reply')
  if (tab === 'sent') return mailboxState.letters.filter((letter) => letter.direction === 'me' && letter.kind === 'sent')
  return mailboxState.letters.filter((letter) => letter.favorite)
}
function scheduleNextContactLetter() {
  clearTimeout(proactiveTimer)
  proactiveTimer = null
  if (!settings.proactiveLettersEnabled || !chatState.contacts.length) return
  const min = Math.max(1, Number(settings.letterMinInterval) || 120)
  const max = Math.max(min, Number(settings.letterMaxInterval) || min)
  const minutes = min + Math.random() * (max - min)
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null
    if (!settings.proactiveLettersEnabled) return
    const contact = randomItem(chatState.contacts)
    if (contact) {
      const auto = settings.contactAutoSettings?.[contact.id] || {}
      if (rollChance(auto.letterWriteChance, auto.letterWriteChanceRandom, 100)) addContactLetter(contact.id)
    }
    scheduleNextContactLetter()
  }, minutes * 60000)
}
export function startMailboxEngine() {
  scheduleNextContactLetter()
  loadReplyQueue().forEach(armReply)
  if (!stopSettingsWatch) {
    stopSettingsWatch = watch(
      () => [settings.proactiveLettersEnabled, settings.letterMinInterval, settings.letterMaxInterval],
      scheduleNextContactLetter
    )
  }
}
export function stopMailboxEngine() {
  clearTimeout(proactiveTimer)
  proactiveTimer = null
  replyTimers.forEach((timer) => clearTimeout(timer))
  replyTimers.clear()
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
  }
}