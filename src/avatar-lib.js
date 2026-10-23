import { settings } from './settings'
import { updateContact, primaryContact } from './chat'

// 头像库存储键
const TA_LIB_KEY = 'zhengdu_avatar_ta_lib_v1'
const ME_LIB_KEY = 'zhengdu_avatar_me_lib_v1'
const RUNTIME_KEY = 'zhengdu_avatar_runtime_v1'

function loadJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback } catch { return fallback }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
function now() { return Date.now() }

/** 换头像频率（天）→ 毫秒，min~max 之间随机 */
function intervalMs() {
  const min = Math.max(1, Number(settings.avatarChangeMin) || 5)
  const max = Math.max(min, Number(settings.avatarChangeMax) || 7)
  const days = min + Math.floor(Math.random() * (max - min + 1))
  return days * 86400000
}

/** 换头像概率：完全随机走 50/50，否则用自定义百分比 */
function hitChance() {
  if (settings.avatarChangeChanceRandom === true) return Math.random() < 0.5
  const p = Math.max(0, Math.min(100, Number(settings.avatarChangeChance) || 50))
  return Math.random() * 100 < p
}

// ---------- 两个库的读写 ----------
export function getTaLib() {
  const v = loadJson(TA_LIB_KEY, [])
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []
}
export function getMeLib() {
  const v = loadJson(ME_LIB_KEY, [])
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []
}
function setTaLib(list) { saveJson(TA_LIB_KEY, list) }
function setMeLib(list) { saveJson(ME_LIB_KEY, list) }

/** 上传头像进库（去重，最多 60 张） */
export function addToTaLib(src) {
  if (!src) return false
  const list = getTaLib().filter((x) => x !== src)
  list.unshift(src)
  setTaLib(list.slice(0, 60))
  return true
}
export function addToMeLib(src) {
  if (!src) return false
  const list = getMeLib().filter((x) => x !== src)
  list.unshift(src)
  setMeLib(list.slice(0, 60))
  return true
}
export function removeFromTaLib(index) {
  const list = getTaLib()
  list.splice(index, 1)
  setTaLib(list)
}
export function removeFromMeLib(index) {
  const list = getMeLib()
  list.splice(index, 1)
  setMeLib(list)
}

// ---------- 换头像（全局生效） ----------
/** 换 TA 的头像：聊天/通话/通知/联系人列表都读 contact.avatarImage，纪念日头像一读 anniversaryAvatarA */
export function applyTaAvatar(src) {
  const contact = primaryContact()
  if (contact && src) updateContact(contact.id, { avatarImage: src })
  if (typeof settings.anniversaryAvatarA === 'string') settings.anniversaryAvatarA = src
}
/** 换用户头像：聊天「我」头像与纪念日头像二都读 settings.anniversaryAvatarB */
export function applyMeAvatar(src) {
  settings.anniversaryAvatarB = src
}

// ---------- 自动换头像引擎 ----------
let engineTimer = null
let engineStarted = false

function maybeAutoChange() {
  const rt = loadJson(RUNTIME_KEY, null) || { taNext: now() + intervalMs(), meNext: now() + intervalMs() }
  const t = now()
  let dirty = false
  // TA 换自己的头像（从 TA 头像库抽）
  if (t >= rt.taNext) {
    if (hitChance()) {
      const lib = getTaLib()
      if (lib.length) applyTaAvatar(lib[Math.floor(Math.random() * lib.length)])
    }
    rt.taNext = t + intervalMs()
    dirty = true
  }
  // TA 为用户换头像（从用户头像库抽，受「允许 TA 为我换头像」开关控制）
  if (settings.avatarAllowTaChange && t >= rt.meNext) {
    if (hitChance()) {
      const lib = getMeLib()
      if (lib.length) applyMeAvatar(lib[Math.floor(Math.random() * lib.length)])
    }
    rt.meNext = t + intervalMs()
    dirty = true
  }
  if (dirty) saveJson(RUNTIME_KEY, rt)
}

export function startAvatarEngine() {
  if (engineStarted) return
  engineStarted = true
  maybeAutoChange()
  engineTimer = setInterval(maybeAutoChange, 3600000) // 每小时检查一次
}

export function stopAvatarEngine() {
  engineStarted = false
  if (engineTimer) { clearInterval(engineTimer); engineTimer = null }
}
