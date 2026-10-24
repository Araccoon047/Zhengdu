/**
 * 番茄钟
 *
 * 移植自 mochi 的番茄钟：专注 / 小憩 / 长休三档，圆环倒计时，🍅 今日与累计统计，
 * 完成后自动切到休息、随机夸一句，可选发到聊天，到点响铃 + 本地通知。
 *
 * 计时基于 endAt 时间戳而不是累加 tick，所以切页面、锁屏、刷新回来时间都是准的。
 * 状态放模块级单例，页面卸载不会停表。
 */
import { reactive } from 'vue'
import { sendIncomingText } from './chat'
import { isNativeApp, showNativeNotification } from './native-bridge'

const STORE_KEY = 'zhengdu_pomodoro_v1'
const RUNTIME_KEY = 'zhengdu_pomodoro_runtime_v1'
const TICK_MS = 250
// 刷新回来时如果已经超过结束时间太久，说明中间关机/关页面了，不补记这颗番茄
const OVERTIME_GRACE_MS = 10 * 60 * 1000

export const POMO_MODES = [
  { id: 'focus', name: '专注', defaultMinutes: 25 },
  { id: 'short', name: '小憩', defaultMinutes: 5 },
  { id: 'long', name: '长休', defaultMinutes: 15 },
]

const MODE_MAP = Object.fromEntries(POMO_MODES.map((mode) => [mode.id, mode]))

export const PRAISE_DEFAULT = [
  '专注的你最棒了',
  '认真的人最好看',
  '加油，我在陪你',
  '嗯嗯，我安静陪着',
  '专注完抱一下',
]

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function clampMinutes(value, fallback) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(180, Math.max(1, number))
}

function readStored() {
  const fallback = {
    durations: { focus: 25, short: 5, long: 15 },
    today: { date: todayKey(), count: 0 },
    total: 0,
    praises: [...PRAISE_DEFAULT],
    bellEnabled: true,
    sendToChat: true,
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    const durations = saved.durations || {}
    const today = saved.today && saved.today.date === todayKey()
      ? { date: todayKey(), count: Math.max(0, Number(saved.today.count) || 0) }
      : { date: todayKey(), count: 0 }
    return {
      durations: {
        focus: clampMinutes(durations.focus, 25),
        short: clampMinutes(durations.short, 5),
        long: clampMinutes(durations.long, 15),
      },
      today,
      total: Math.max(0, Number(saved.total) || 0),
      praises: Array.isArray(saved.praises) && saved.praises.length
        ? saved.praises.map((item) => String(item).trim()).filter(Boolean).slice(0, 40)
        : [...PRAISE_DEFAULT],
      bellEnabled: saved.bellEnabled !== false,
      sendToChat: saved.sendToChat !== false,
    }
  } catch {
    return fallback
  }
}

const stored = readStored()

export const pomoState = reactive({
  mode: 'focus',
  running: false,
  endAt: 0,
  remainMs: stored.durations.focus * 60000,
  durations: stored.durations,
  today: stored.today,
  total: stored.total,
  praises: stored.praises,
  bellEnabled: stored.bellEnabled,
  sendToChat: stored.sendToChat,
  message: '点开始，专注一会儿',
  lastFinished: '',
})

let tickTimer = null
let audioContext = null
let notifyTimer = null

/* ------------------------------------------------------------------ */
/* 持久化                                                              */
/* ------------------------------------------------------------------ */

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      durations: pomoState.durations,
      today: pomoState.today,
      total: pomoState.total,
      praises: pomoState.praises,
      bellEnabled: pomoState.bellEnabled,
      sendToChat: pomoState.sendToChat,
    }))
  } catch {
    /* 忽略 */
  }
}

function persistRuntime() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify({
      mode: pomoState.mode,
      running: pomoState.running,
      endAt: pomoState.endAt,
      remainMs: pomoState.remainMs,
    }))
  } catch {
    /* 忽略 */
  }
}

export function totalMsOf(mode = pomoState.mode) {
  const minutes = pomoState.durations[mode] ?? MODE_MAP[mode]?.defaultMinutes ?? 25
  return minutes * 60000
}

export function modeMinutes(mode = pomoState.mode) {
  return pomoState.durations[mode] ?? MODE_MAP[mode]?.defaultMinutes ?? 25
}

export function modeName(mode = pomoState.mode) {
  return MODE_MAP[mode]?.name || '专注'
}

/* ------------------------------------------------------------------ */
/* 提示音 / 通知                                                       */
/* ------------------------------------------------------------------ */

function ensureAudioContext() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    if (!audioContext) audioContext = new Ctx()
    if (audioContext.state === 'suspended') audioContext.resume?.()
    return audioContext
  } catch {
    return null
  }
}

/** 三音上行的小铃声，纯 Web Audio 合成，不依赖任何音频文件 */
function playChime() {
  if (!pomoState.bellEnabled) return
  const context = ensureAudioContext()
  if (!context) return
  try {
    const start = context.currentTime
    ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const at = start + index * 0.16
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.85)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.9)
    })
  } catch {
    /* 忽略 */
  }
}

function sendNotify(title, body) {
  try {
    if (document.visibilityState === 'visible') return
    if (isNativeApp()) {
      showNativeNotification(title, body)
      return
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(title, { body })
  } catch {
    /* 忽略 */
  }
}

/* ------------------------------------------------------------------ */
/* 计时                                                                */
/* ------------------------------------------------------------------ */

function stopTick() {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = null
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = null
}

function syncRemain() {
  if (!pomoState.running) return
  const left = pomoState.endAt - Date.now()
  pomoState.remainMs = Math.max(0, left)
  if (left <= 0) complete()
}

function startTick() {
  stopTick()
  tickTimer = setInterval(syncRemain, TICK_MS)
  // 后台标签页的定时器会被节流，按 endAt 再定一个到点通知兜底
  const delay = pomoState.endAt - Date.now()
  if (delay > 0) {
    notifyTimer = setTimeout(() => {
      if (!pomoState.running) return
      if (document.visibilityState === 'visible') return
      sendNotify(
        `番茄钟 · ${modeName()}结束`,
        pomoState.mode === 'focus' ? '专注完成，休息一下吧 🍅' : '休息好了，来下一个番茄吧'
      )
    }, delay + 120)
  }
}

function pickPraise() {
  const pool = pomoState.praises.length ? pomoState.praises : PRAISE_DEFAULT
  return pool[Math.floor(Math.random() * pool.length)]
}

function bumpToday() {
  const key = todayKey()
  if (pomoState.today.date !== key) {
    pomoState.today = { date: key, count: 0 }
  }
  pomoState.today.count += 1
  pomoState.total += 1
}

function switchMode(mode) {
  pomoState.mode = mode
  pomoState.running = false
  pomoState.endAt = 0
  pomoState.remainMs = totalMsOf(mode)
  stopTick()
}

function complete() {
  const finished = pomoState.mode
  stopTick()
  pomoState.running = false
  pomoState.endAt = 0
  pomoState.lastFinished = finished
  playChime()

  if (finished === 'focus') {
    const minutes = modeMinutes('focus')
    bumpToday()
    const praise = pickPraise()
    const next = pomoState.today.count % 4 === 0 ? 'long' : 'short'
    switchMode(next)
    pomoState.message = `${modeName(next)} ${modeMinutes(next)} 分钟 · ${praise}`
    if (pomoState.sendToChat) {
      try {
        sendIncomingText(`🍅 完成了 ${minutes} 分钟专注，去休息一会儿`)
      } catch {
        /* 聊天不可用时忽略 */
      }
    }
    sendNotify('番茄钟 · 专注结束', `休息一下吧：${modeName(next)} ${modeMinutes(next)} 分钟`)
  } else {
    switchMode('focus')
    pomoState.message = '休息好了，来下一个番茄吧'
    sendNotify('番茄钟 · 休息结束', '来下一个番茄吧')
  }
  persist()
  persistRuntime()
}

/* ------------------------------------------------------------------ */
/* 对外操作                                                            */
/* ------------------------------------------------------------------ */

export function startPause() {
  if (pomoState.running) {
    pomoState.remainMs = Math.max(0, pomoState.endAt - Date.now())
    pomoState.running = false
    pomoState.endAt = 0
    stopTick()
    persistRuntime()
    return
  }
  const total = totalMsOf()
  const remain = pomoState.remainMs > 0 && pomoState.remainMs <= total ? pomoState.remainMs : total
  ensureAudioContext()
  pomoState.endAt = Date.now() + remain
  pomoState.remainMs = remain
  pomoState.running = true
  pomoState.lastFinished = ''
  startTick()
  persistRuntime()
}

export function resetPomo() {
  switchMode(pomoState.mode)
  pomoState.message = `准备${modeName()}`
  pomoState.lastFinished = ''
  persistRuntime()
}

export function setPomoMode(mode) {
  if (!MODE_MAP[mode] || mode === pomoState.mode) return
  switchMode(mode)
  pomoState.message = `准备${modeName()}`
  pomoState.lastFinished = ''
  persistRuntime()
}

export function setPomoDuration(mode, minutes) {
  if (!MODE_MAP[mode]) return
  pomoState.durations[mode] = clampMinutes(minutes, MODE_MAP[mode].defaultMinutes)
  if (mode === pomoState.mode && !pomoState.running) {
    pomoState.remainMs = totalMsOf(mode)
  }
  persist()
  persistRuntime()
}

export function addPraise(text) {
  const clean = String(text || '').trim().slice(0, 40)
  if (!clean) return false
  if (pomoState.praises.includes(clean)) return false
  pomoState.praises = [...pomoState.praises, clean].slice(0, 40)
  persist()
  return true
}

export function removePraise(text) {
  pomoState.praises = pomoState.praises.filter((item) => item !== text)
  persist()
}

export function toggleBell() {
  pomoState.bellEnabled = !pomoState.bellEnabled
  persist()
}

export function toggleSendToChat() {
  pomoState.sendToChat = !pomoState.sendToChat
  persist()
}

export function formatRemain(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* 启动时恢复上次会话                                                  */
/* ------------------------------------------------------------------ */

;(function restore() {
  if (typeof localStorage === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(RUNTIME_KEY) || 'null')
    if (!saved || !MODE_MAP[saved.mode]) return
    pomoState.mode = saved.mode
    if (!saved.running || !saved.endAt) {
      const total = totalMsOf(saved.mode)
      const remain = Number(saved.remainMs) || 0
      pomoState.remainMs = remain > 0 && remain <= total ? remain : total
      return
    }
    const left = saved.endAt - Date.now()
    pomoState.endAt = saved.endAt
    if (left > 0) {
      pomoState.running = true
      pomoState.remainMs = left
      startTick()
    } else if (left > -OVERTIME_GRACE_MS) {
      // 刚结束不久：补记这次完成
      pomoState.remainMs = 0
      pomoState.mode = saved.mode
      complete()
    } else {
      // 太久没回来，当作中断
      pomoState.remainMs = totalMsOf(saved.mode)
      pomoState.message = '上次专注中断了，重新开始吧'
    }
  } catch {
    /* 忽略损坏数据 */
  }
})()

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pomoState.running) syncRemain()
  })
}
