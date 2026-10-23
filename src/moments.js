import { reactive, watch } from 'vue'
import { chatState, contactById, contactDisplayName, primaryContact } from './chat'
import { settings } from './settings'
import systemCardsData from './data/system-cards.json'

const KEY = 'zhengdu_moments_v1'
const photos = import.meta.glob('./assets/photos/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const photoList = Object.keys(photos).sort().map((key) => photos[key])

const fallbackTexts = [
  '今天的光线很软，适合慢一点。',
  '路过一阵风，顺手把心情也吹亮了。',
  '给自己留一小段没有安排的时间。',
  '晚一点也没关系，今天已经做得很好。',
  '把这一刻收进口袋，改天再拿出来看。',
]

const fallbackComments = [
  '这一幕很好看。',
  '今天也辛苦啦。',
  '偷偷留下一个脚印。',
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export const momentsState = reactive({ posts: loadPosts() })
let postTimer = null
let stopSettingsWatch = null
let stopScheduledWatch = null
const interactionTimers = new Set()
const scheduledPostTimers = new Map()

function savePosts() {
  try {
    localStorage.setItem(KEY, JSON.stringify(momentsState.posts))
  } catch (e) {
    /* 忽略本地存储失败 */
  }
}

function makeId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7)
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

const MOMENT_DICTIONARY_CARDS = (() => {
  const category = (systemCardsData.categories || []).find((item) => item.key === 'dict')
  return (category?.groups || []).flatMap((group) => group.cards || []).filter(Boolean)
})()
function contactCards(contact) {
  if (!contact) return []
  const cards = Array.isArray(contact.cards) ? contact.cards : []
  const texts = cards.map((card) => (typeof card === 'string' ? card : card?.text)).filter(Boolean)
  return texts.length ? texts : settings.replyCards || []
}

function composeFromCards(contact, min = 1, max = 3, useDictionary = false) {
  const cards = (useDictionary && MOMENT_DICTIONARY_CARDS.length ? MOMENT_DICTIONARY_CARDS : contactCards(contact)).filter(Boolean)
  if (!cards.length) return randomItem(fallbackComments)
  const count = min + Math.floor(Math.random() * (max - min + 1))
  return Array.from({ length: count }, () => randomItem(cards)).join('，')
}

function chanceWithRandom(value, random = false, fallback = 0) {
  if (random === true) return Math.random() < 0.5
  return chance(Number(value ?? fallback))
}
function chance(percent) {
  const value = Math.min(100, Math.max(0, Number(percent) || 0))
  return Math.random() * 100 < value
}

function autoForContact(contact) {
  return settings.contactAutoSettings?.[contact?.id] || {}
}

function delayMs(value, unit, fallback = 2500) {
  const amount = Math.max(0, Number(value) || 0)
  if (!amount) return fallback
  if (unit === 'hours') return amount * 3600000
  if (unit === 'minutes') return amount * 60000
  return amount * 1000
}

function schedulePostInteraction(post, contact, auto) {
  if (!contact || !post) return
  const fallback = Math.max(0, Math.min(100, Number(settings.momentsInteractionChance) || 0))
  const likeChance = Math.max(0, Math.min(100, Number(auto.momentsLikeChance ?? fallback)))
  const commentChance = Math.max(0, Math.min(100, Number(auto.momentsCommentChance ?? fallback)))
  const name = contactDisplayName(contact)

  if (chanceWithRandom(likeChance, auto.momentsLikeChanceRandom, fallback)) {
    const timer = setTimeout(() => {
      interactionTimers.delete(timer)
      const livePost = momentsState.posts.find((item) => item.id === post.id)
      if (!livePost) return
      livePost.likes = [
        ...(livePost.likes || []).filter((item) => item.contactId !== contact.id),
        { contactId: contact.id, name },
      ]
      savePosts()
    }, delayMs(auto.momentsLikeDelay, auto.momentsLikeUnit, 2500))
    interactionTimers.add(timer)
  }

  if (chanceWithRandom(commentChance, auto.momentsCommentChanceRandom, fallback)) {
    const timer = setTimeout(() => {
      interactionTimers.delete(timer)
      const livePost = momentsState.posts.find((item) => item.id === post.id)
      if (!livePost) return
      if ((livePost.comments || []).some((item) => item.contactId === contact.id)) return
      livePost.comments = [
        ...(livePost.comments || []),
        { id: makeId('mc'), contactId: contact.id, name, text: composeFromCards(contact, 1, 3, auto.momentsDictionaryEnabled === true) },
      ]
      savePosts()
    }, delayMs(auto.momentsCommentDelay, auto.momentsCommentUnit, 4000))
    interactionTimers.add(timer)
  }

  if (
    auto.momentsFavoriteEnabled === true &&
    chanceWithRandom(auto.momentsFavoriteChance, auto.momentsFavoriteRandom, 50)
  ) {
    const timer = setTimeout(() => {
      interactionTimers.delete(timer)
      const livePost = momentsState.posts.find((item) => item.id === post.id)
      if (!livePost) return
      livePost.contactFavorites = [
        ...(livePost.contactFavorites || []).filter((item) => item.contactId !== contact.id),
        { contactId: contact.id, name },
      ]
      savePosts()
    }, delayMs(auto.momentsLikeDelay, auto.momentsLikeUnit, 2500))
    interactionTimers.add(timer)
  }
}
function addInteraction(post) {
  const contact = primaryContact()
  if (!contact || post.authorType !== 'me') return
  schedulePostInteraction(post, contact, autoForContact(contact))
}

function addMutualContactInteractions(post) {
  if (!settings.allowContactsMutualComments) return
  const candidates = chatState.contacts.filter((contact) => contact && contact.id !== post.authorId)
  candidates.forEach((contact) => schedulePostInteraction(post, contact, autoForContact(contact)))
}
export function createContactMoment(preferredContactId = '') {
  const contacts = chatState.contacts.filter(Boolean)
  const contact = (preferredContactId && contactById(preferredContactId)) || (contacts.length ? randomItem(contacts) : primaryContact())
  if (!contact) return null
  const cards = contactCards(contact)
  const post = {
    id: makeId('moment'),
    authorType: 'contact',
    authorId: contact.id,
    authorName: contactDisplayName(contact),
    authorAvatar: contact.avatar,
    authorAvatarImage: contact.avatarImage,
    authorAvatarFrame: contact.avatarFrame,
    authorColor: contact.color,
text: (() => {
      const auto = autoForContact(contact)
      const min = Math.max(1, Number(auto.momentsCardMin) || 8)
      const max = Math.max(min, Number(auto.momentsCardMax) || 10)
      return String(cards.length ? composeFromCards(contact, min, max, auto.momentsDictionaryEnabled === true) : randomItem(fallbackTexts)).trim()
    })(),
    images: Math.random() < 0.45 ? [randomItem(photoList)] : [],
    createdAt: Date.now(),
    likes: [],
    comments: [],
    favoriteByMe: false,
  }
  momentsState.posts.unshift(post)
  savePosts()
  addMutualContactInteractions(post)
  return post
}

export function addUserMoment(text, images = []) {
  const clean = String(text || '').trim()
  if (!clean && !images.length) return null
  const post = {
    id: makeId('moment'),
    authorType: 'me',
    authorId: 'me',
    authorName: settings.userName || '我',
    authorAvatar: '我',
    authorAvatarImage: settings.anniversaryAvatarB || '',
    authorAvatarFrame: settings.userAvatarFrame || '',
    authorColor: 'var(--theme-primary)',
    text: clean,
    images: images.slice(0, 9),
    createdAt: Date.now(),
    likes: [],
    comments: [],
    favoriteByMe: false,
  }
  momentsState.posts.unshift(post)
  savePosts()
  addInteraction(post)
  return post
}

export function toggleUserLike(postId) {
  const post = momentsState.posts.find((item) => item.id === postId)
  if (!post) return false
  const name = settings.userName || '我'
  const liked = (post.likes || []).some((item) => item.contactId === 'me')
  post.likes = liked
    ? (post.likes || []).filter((item) => item.contactId !== 'me')
    : [...(post.likes || []), { contactId: 'me', name }]
  savePosts()
  return true
}

export function toggleUserFavorite(postId) {
  const post = momentsState.posts.find((item) => item.id === postId)
  if (!post) return false
  post.favoriteByMe = !post.favoriteByMe
  savePosts()
  return true
}
export function addMomentComment(postId, text, replyTo = null) {
  const clean = String(text || '').trim()
  const post = momentsState.posts.find((item) => item.id === postId)
  if (!post || !clean) return false
  post.comments = [
    ...(post.comments || []),
    { id: makeId('mc'), contactId: 'me', name: settings.userName || '我', text: clean, replyToId: replyTo?.id || null, replyToName: replyTo?.name || '', replyToText: replyTo?.text || '' },
  ]
  savePosts()
  if (post.authorType === 'contact') scheduleReplyToUserComment(post, post.comments[post.comments.length - 1])
  return true
}

function scheduleReplyToUserComment(post, replyTo) {
  const contact = contactById(post.authorId)
  if (!contact) return
const auto = settings.contactAutoSettings?.[contact.id] || {}
  if (auto.momentsReplyMyComment === false) return
  if (!chanceWithRandom(auto.momentsReplyChance, auto.momentsReplyChanceRandom, 60)) return
  const value = Math.max(0, Number(auto.momentsReplyDelay) || 30)
  const unit = auto.momentsReplyUnit || 'seconds'
  const factor = unit === 'hours' ? 3600000 : unit === 'minutes' ? 60000 : 1000
  const timer = setTimeout(() => {
    interactionTimers.delete(timer)
    const livePost = momentsState.posts.find((item) => item.id === post.id)
    if (!livePost) return
    livePost.comments = [
      ...(livePost.comments || []),
      {
        id: makeId('mc'),
        contactId: contact.id,
        name: contactDisplayName(contact),
        text: composeFromCards(contact, 1, 3, auto.momentsDictionaryEnabled === true),
        replyToId: replyTo.id,
        replyToName: settings.userName || '我',
        replyToText: replyTo.text,
      },
    ]
    savePosts()
  }, value * factor)
  interactionTimers.add(timer)
}
export function deleteMoment(postId) {
  momentsState.posts = momentsState.posts.filter((post) => post.id !== postId)
  savePosts()
}

export function momentTime(createdAt) {
  const diff = Math.max(0, Date.now() - Number(createdAt || Date.now()))
  const minute = 60000
  const hour = minute * 60
  const day = hour * 24
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`
  const date = new Date(createdAt)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function clearScheduledPostTimers() {
  scheduledPostTimers.forEach((timer) => clearTimeout(timer))
  scheduledPostTimers.clear()
}

function scheduleTimedPostForContact(contact) {
  if (!contact) return
  const existing = scheduledPostTimers.get(contact.id)
  if (existing) clearTimeout(existing)
  scheduledPostTimers.delete(contact.id)
  const auto = settings.contactAutoSettings?.[contact.id] || {}
  if (auto.momentsScheduledEnabled !== true) return
  const match = String(auto.momentsScheduledTime || '12:00').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return
  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  const delay = Math.max(1000, target.getTime() - now.getTime())
  const timer = setTimeout(() => {
    scheduledPostTimers.delete(contact.id)
    const latest = settings.contactAutoSettings?.[contact.id] || {}
    if (latest.momentsScheduledEnabled === true) createContactMoment(contact.id)
    scheduleTimedPostForContact(contactById(contact.id))
  }, delay)
  scheduledPostTimers.set(contact.id, timer)
}

function rescheduleTimedPosts() {
  clearScheduledPostTimers()
  chatState.contacts.forEach((contact) => scheduleTimedPostForContact(contact))
}
function scheduleNextPost() {
  clearTimeout(postTimer)
  postTimer = null
  if (!settings.momentsAutoPublishEnabled) return
  const min = Math.max(1, Number(settings.momentsMinInterval) || 60)
  const max = Math.max(min, Number(settings.momentsMaxInterval) || min)
  const minutes = min + Math.random() * (max - min)
  postTimer = setTimeout(() => {
    postTimer = null
    if (!settings.momentsAutoPublishEnabled) return
    if (chanceWithRandom(settings.momentsPublishChance, settings.momentsPublishChanceRandom, 35)) createContactMoment()
    scheduleNextPost()
  }, minutes * 60000)
}

export function startMomentsEngine() {
  scheduleNextPost()
  rescheduleTimedPosts()
  if (!stopSettingsWatch) {
    stopSettingsWatch = watch(
      () => [
        settings.momentsAutoPublishEnabled,
        settings.momentsMinInterval,
        settings.momentsMaxInterval,
        settings.momentsPublishChance,
      ],
      scheduleNextPost
    )
  }
  if (!stopScheduledWatch) {
    stopScheduledWatch = watch(
      () => settings.contactAutoSettings,
      rescheduleTimedPosts,
      { deep: true }
    )
  }
}

export function stopMomentsEngine() {
  clearTimeout(postTimer)
  postTimer = null
  interactionTimers.forEach((timer) => clearTimeout(timer))
  interactionTimers.clear()
  clearScheduledPostTimers()
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
  }
  if (stopScheduledWatch) {
    stopScheduledWatch()
    stopScheduledWatch = null
  }
}

export function importMomentPosts(posts = []) {
  if (!Array.isArray(posts)) return 0
  const existing = new Set(momentsState.posts.map((post) => post.id))
  let count = 0
  for (const post of posts) {
    if (!post || !post.id || existing.has(post.id)) continue
    momentsState.posts.push(clone(post))
    existing.add(post.id)
    count += 1
  }
  momentsState.posts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  savePosts()
  return count
}

export function clearMoments() {
  momentsState.posts = []
  savePosts()
}