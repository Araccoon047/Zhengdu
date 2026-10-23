function clamp(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0.6
  return Math.min(1, Math.max(0, n / 100))
}

function safeUrl(url) {
  return String(url).replace(/"/g, '%22')
}

export function backgroundLayerStyle(url, opacity) {
  if (!url) return null
  return {
    backgroundImage: `url("${safeUrl(url)}")`,
    opacity: clamp(opacity),
  }
}

export function backgroundVariableStyle(url, opacity) {
  if (!url) return null
  return {
    '--custom-bg-image': `url("${safeUrl(url)}")`,
    '--custom-bg-opacity': clamp(opacity),
  }
}

export function chatBackgroundStyle(url, opacity) {
  if (!url) return null
  const alpha = clamp(opacity)
  const veil = Math.min(1, Math.max(0, 1 - alpha)).toFixed(3)
  return {
    backgroundImage: `linear-gradient(rgba(255, 255, 255, ${veil}), rgba(255, 255, 255, ${veil})), url("${safeUrl(url)}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
}