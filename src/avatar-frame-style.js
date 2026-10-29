const FRAME_PREVIEW_AVATAR_SIZE = 86
const FRAME_DIAMETER_RATIO = 1.2

function offsetToFramePercent(value) {
  return Number(((value * 100) / (FRAME_PREVIEW_AVATAR_SIZE * FRAME_DIAMETER_RATIO)).toFixed(4))
}

export function avatarFrameStyle(source = {}) {
  const x = Math.max(-80, Math.min(80, Math.round(Number(source.avatarFrameOffsetX) || 0)))
  const y = Math.max(-80, Math.min(80, Math.round(Number(source.avatarFrameOffsetY) || 0)))
  const scale = Math.max(0.5, Math.min(2, Number(source.avatarFrameScale) || 1))
  return { transform: 'translate(calc(-50% + ' + offsetToFramePercent(x) + '%), calc(-50% + ' + offsetToFramePercent(y) + '%)) scale(' + scale + ')' }
}

function escapeCssUrl(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '')
}

export function avatarFrameImageCss(skin = {}) {
  const image = String(skin.image || '').trim()
  if (!image) return ''
  const x = Math.max(-80, Math.min(80, Math.round(Number(skin.offsetX) || 0)))
  const y = Math.max(-80, Math.min(80, Math.round(Number(skin.offsetY) || 0)))
  const scale = Math.max(0.5, Math.min(2, Number(skin.scale) || 1))
  return [
    '.echoes-avatar-user::after,',
    '.echoes-avatar-other::after {',
    '  content: "" !important;',
    '  display: block !important;',
    '  position: absolute !important;',
    '  top: 50% !important;',
    '  left: 50% !important;',
    '  width: 120% !important;',
    '  height: 120% !important;',
    '  transform: translate(calc(-50% + ' + offsetToFramePercent(x) + '%), calc(-50% + ' + offsetToFramePercent(y) + '%)) scale(' + scale + ') !important;',
    '  background: url("' + escapeCssUrl(image) + '") center / contain no-repeat !important;',
    '  border: 0 !important;',
    '  box-shadow: none !important;',
    '  filter: none !important;',
    '  pointer-events: none !important;',
    '  z-index: 8 !important;',
    '}',
  ].join('\n')
}

export function resolveAvatarFrameSkinCss(skin = {}) {
  return String(skin?.image || '').trim() ? avatarFrameImageCss(skin) : String(skin?.css || '')
}