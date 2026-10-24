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