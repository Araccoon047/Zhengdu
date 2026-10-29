function bridge() {
  if (typeof window === 'undefined') return null
  return window.ZhengduNative || null
}

function call(name, ...args) {
  const api = bridge()
  if (!api || typeof api[name] !== 'function') return undefined
  try {
    return api[name](...args)
  } catch (error) {
    console.warn(`Native bridge ${name} failed`, error)
    return undefined
  }
}

export function isNativeApp() {
  try {
    return Boolean(bridge()?.isNativeApp?.())
  } catch {
    return false
  }
}

export function nativeNotificationPermission() {
  if (!isNativeApp()) return 'unsupported'
  try {
    return bridge().hasNotificationPermission?.() ? 'granted' : 'default'
  } catch {
    return 'default'
  }
}

export function requestNativePermissions() {
  if (!isNativeApp()) return false
  call('requestAppPermissions')
  return true
}

export function requestIgnoreBatteryOptimizations() {
  if (!isNativeApp()) return false
  call('requestIgnoreBatteryOptimizations')
  return true
}

export function syncNativeKeepAlive(enabled) {
  if (!isNativeApp()) return
  call('setKeepAlive', Boolean(enabled))
}

export function showNativeNotification(title, body) {
  if (!isNativeApp()) return false
  call('showNotification', String(title || '争渡'), String(body || ''))
  return true
}

export function saveTextFileNatively(filename, mimeType, text) {
  if (!isNativeApp()) return false
  return Boolean(call('saveTextFile', String(filename), String(mimeType || 'text/plain'), String(text ?? '')))
}

export function canCustomizeLauncherIcon() {
  if (!isNativeApp()) return false
  try {
    return typeof bridge().createLauncherShortcut === 'function'
  } catch {
    return false
  }
}

export function createNativeLauncherShortcut(dataUrl, label) {
  if (!canCustomizeLauncherIcon() || !dataUrl) return false
  return Boolean(call('createLauncherShortcut', String(dataUrl), String(label || '争渡')))
}


export function nativeAppVersion() {
  if (!isNativeApp()) return ''
  try {
    return String(bridge().getAppVersion?.() || '')
  } catch {
    return ''
  }
}

export function notifyNativeReady() {
  if (!isNativeApp()) return
  call('onWebReady')
}
const pendingNativeJson = new Map()
let nativeJsonSequence = 0

if (typeof window !== 'undefined' && !window.__zhengduNativeJsonResponse) {
  window.__zhengduNativeJsonResponse = (requestId, status, body) => {
    const task = pendingNativeJson.get(requestId)
    if (!task) return
    pendingNativeJson.delete(requestId)
    clearTimeout(task.timer)
    task.resolve({ status: Number(status), body: String(body ?? '') })
  }
}

export function requestNativeJson(url, headers, body) {
  if (!isNativeApp()) return Promise.reject(new Error('原生网络桥接不可用'))
  const requestId = `ai-${Date.now()}-${++nativeJsonSequence}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingNativeJson.delete(requestId)
      reject(new Error('AI 请求超时，请检查网络或接口地址'))
    }, 50000)
    pendingNativeJson.set(requestId, { resolve, reject, timer })
    const sent = call('requestJson', requestId, String(url), JSON.stringify(headers || {}), String(body || ''))
    if (sent === undefined) {
      clearTimeout(timer)
      pendingNativeJson.delete(requestId)
      reject(new Error('无法发起原生 AI 请求'))
    }
  })
}