import { reactive, watch } from 'vue'
import { chatState, contactById, contactDisplayName } from './chat'
import { settings } from './settings'
import systemCardsData from './data/system-cards.json'

const KEY = 'zhengdu_mailbox_v1'
let proactiveTimer = null
let stopSettingsWatch = null
const replyTimers = new Set()

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

const LETTER_DICTIONARY_CARDS = (() => {
  const category = (systemCardsData.categories || []).find((item) => item.key === 'dict')
  return (category?.groups || []).flatMap((group) => group.cards || []).filter(Boolean)
})()

function cardsForContact(contact) {
  const cards =
    contact && Array.isArray(contact.cards) && contact.cards.length
      ? contact.cards
      : settings.replyCards
  return Array.isArray(cards)
    ? cards
        .map((card) => (typeof card === 'string' ? card : String(card?.text ?? '').trim()))
        .filter(Boolean)
    : []
}

function randomLetterBody(contact) {
  const auto = settings.contactAutoSettings?.[contact?.id] || {}
  const cards = auto.letterDictionaryEnabled === true && LETTER_DICTIONARY_CARDS.length
    ? LETTER_DICTIONARY_CARDS
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
  const timer = setTimeout(() => {
    replyTimers.delete(timer)
    addContactLetter(contactId, { replyToId })
  }, delay)
  replyTimers.add(timer)
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