import { reactive } from 'vue'

/*
 * 首页爱心与时差使用页面会话状态：
 * - 第一次打开页面时生成爱心和随机时差
 * - 刷新页面时 sessionStorage 保留，爱心和时差保持不变
 * - 关闭页面/浏览器后 sessionStorage 清空，下次打开重新生成
 *
 * 时差为 0～720 分钟中的随机值（0～12 小时），每个分钟值等概率；
 * 非零时差再等概率决定对方时间更早或更晚。
 *
 * 首页显示的“我的时间”始终读取浏览器当前系统时间，
 * “他的时间”则在此基础上应用本次会话的固定分钟偏移。
 *
 * 所有数据都只保存在浏览器本地，不依赖任何服务器。
 */
const SESSION_KEY = 'zhengdu_home_session_v5'
const PREVIOUS_SESSION_KEY = 'zhengdu_home_session_v4'
const LEGACY_OFFSET_KEY = 'zhengdu_contact_time_offset_v1'
const LEGACY_SESSION_KEYS = ['zhengdu_home_session_v2', 'zhengdu_home_session_v3']
const MIN_OFFSET_MINUTES = 0
const MAX_OFFSET_MINUTES = 720

// 清理旧版本遗留的永久时差和会话快照。
try {
  localStorage.removeItem(LEGACY_OFFSET_KEY)
  for (const key of LEGACY_SESSION_KEYS) sessionStorage.removeItem(key)
} catch (e) {
  // 浏览器存储不可用时无需额外处理。
}

function clampHearts(value) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null
}

function randomHearts() {
  // 1、2、3、4、5 颗爱心出现的概率完全相同。
  return Math.floor(Math.random() * 5) + 1
}

function isValidOffset(value) {
  const n = Number(value)
  return (
    Number.isInteger(n) &&
    n >= -MAX_OFFSET_MINUTES &&
    n <= MAX_OFFSET_MINUTES
  )
}

function randomOffsetMinutes() {
  // 先等概率选择 0～720 分钟的绝对值，再决定对方更早或更晚。
  const magnitude =
    Math.floor(Math.random() * (MAX_OFFSET_MINUTES - MIN_OFFSET_MINUTES + 1)) +
    MIN_OFFSET_MINUTES
  if (magnitude === 0) return 0
  return Math.random() < 0.5 ? -magnitude : magnitude
}

function createSessionState() {
  return {
    version: 5,
    hearts: randomHearts(),
    openedAt: Date.now(),
    timeOffsetMinutes: randomOffsetMinutes(),
  }
}

function isValidState(value) {
  return Boolean(
    value &&
      value.version === 5 &&
      clampHearts(value.hearts) &&
      Number.isFinite(Number(value.openedAt)) &&
      isValidOffset(value.timeOffsetMinutes)
  )
}

function persist(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch (e) {
    // 极少数隐私模式下会话存储不可写；不影响本次页面使用。
  }
}

function readPreviousState() {
  try {
    const raw = sessionStorage.getItem(PREVIOUS_SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (
      !saved ||
      saved.version !== 4 ||
      !clampHearts(saved.hearts) ||
      !Number.isFinite(Number(saved.openedAt)) ||
      !isValidOffset(saved.timeOffsetMinutes)
    ) {
      return null
    }
    return {
      version: 5,
      hearts: clampHearts(saved.hearts),
      openedAt: Number(saved.openedAt),
      timeOffsetMinutes: Number(saved.timeOffsetMinutes),
    }
  } catch (e) {
    return null
  }
}

function readSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (isValidState(saved)) return saved
    }
  } catch (e) {
    // 数据损坏或存储不可用时，生成新的本地会话状态。
  }

  // 从上一版迁移时保留当前爱心和时差，避免升级后刷新发生跳变。
  const previous = readPreviousState()
  const state = previous || createSessionState()
  persist(state)
  try {
    sessionStorage.removeItem(PREVIOUS_SESSION_KEY)
  } catch (e) {
    // 忽略清理失败。
  }
  return state
}

export const homeSession = reactive(readSessionState())

// 兼容旧引用。
export const linkStatus = homeSession