export const SPLASH_NONE = {
  id: 'none',
  name: '不使用开屏动画',
  kind: 'none',
  description: '直接进入主页',
}

export const SPLASH_PRESETS = [
  {
    id: 'mobius1',
    name: '莫比乌斯环1',
    kind: 'mobius',
    description: '暗红与紫罗兰环形文案',
    defaults: {
      title: 'CARNIS NODUS',
      quote: '切开胸腔，将血管接驳成没有终点的回路。\n你的恨是流进胃里的黑红色胆汁，\n我的爱是撑破喉管的苍白骨刺。\n吞食即是长存。',
    },
  },
  {
    id: 'mobius2',
    name: '莫比乌斯环2',
    kind: 'mobius',
    description: '永恒主题的双层环形文案',
    defaults: {
      title: '这一刹那延续了短短一瞬，\n但是它甚至盖过永恒。',
      quote: '鲍·列·帕斯捷尔纳克',
    },
  },
  {
    id: 'spring1',
    name: '浪漫春日1',
    kind: 'spring',
    description: '柔粉光晕、斜线与逐字入场',
    defaults: {
      english: '˚.⋆⟡𝑙𝑢𝑐𝑘𝑦 𝑡𝑜 𝑏𝑒 𝑙𝑜𝑣𝑒𝑑⟡⋆.˚',
      chinese: '你是细腻水雾钩织成的春天',
      textColor: '#fff7fa',
      accentColor: '#ffd1dc',
    },
  },
  {
    id: 'spring2',
    name: '浪漫春日2',
    kind: 'spring',
    description: '轻雾背景、细角框与樱花',
    defaults: {
      english: '˚.⋆⟡𝑙𝑢𝑐𝑘𝑦 𝑡𝑜 𝑏𝑒 𝑙𝑜𝑣𝑒𝑑⟡⋆.˚',
      chinese: '你是细腻水雾钩织成的春天',
      textColor: '#fff7fa',
      accentColor: '#ffd1dc',
    },
  },
  {
    id: 'bitterOrange',
    name: '苦橙',
    kind: 'bitterOrange',
    description: '海水路线、主副图片与特殊文字',
    defaults: {
      lead: '直到',
      small: '海水变成一颗',
      accent: '苦橙',
      english: 'Seawater',
      accentColor: '#FDA268',
      englishColor: '#7692FF',
      primaryImage: 'https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEZe5RqhdpGMlOw2feCyah1LNmq2_MXswACySIAAlXsMVTTBR54pAABjuk9BA.jpg',
      secondaryImage: 'https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEZe5dqhduKsZfV_aQc20sTyN4hUH6d-gACzCIAAlXsMVTBVAXVLDgoWD0E.jpg',
    },
  },
]

export const SPLASH_OPTIONS = [SPLASH_NONE, ...SPLASH_PRESETS]

export const SPRING_BACKGROUND_URL = 'https://img.pagehost.cn/autoupload/mw1co/20260804/LMY7/1367X1279/image_1785858784167_0.jpg'

function normalizeColor(value, fallback) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

export function splashPresetById(id) {
  return SPLASH_OPTIONS.find((preset) => preset.id === id) || SPLASH_NONE
}

export function defaultSplashConfig(id) {
  const preset = SPLASH_PRESETS.find((item) => item.id === id)
  return preset ? { ...preset.defaults } : {}
}

export function createDefaultSplashConfigs() {
  return Object.fromEntries(SPLASH_PRESETS.map((preset) => [preset.id, { ...preset.defaults }]))
}

export function normalizeSplashConfig(id, source = {}) {
  const defaults = defaultSplashConfig(id)
  if (!Object.keys(defaults).length) return {}
  const value = source && typeof source === 'object' ? source : {}
  const result = {}
  for (const [key, fallback] of Object.entries(defaults)) {
    if (key.endsWith('Color')) {
      result[key] = normalizeColor(value[key], fallback)
      continue
    }
    const limit = key.endsWith('Image') ? 8_000_000 : 1600
    result[key] = String(value[key] ?? fallback).slice(0, limit)
  }
  return result
}

export function normalizeSplashSettings(source = {}) {
  const value = source && typeof source === 'object' ? source : {}
  const splashPreset = SPLASH_OPTIONS.some((preset) => preset.id === value.splashPreset)
    ? value.splashPreset
    : 'none'
  const configs = Object.fromEntries(
    SPLASH_PRESETS.map((preset) => [
      preset.id,
      normalizeSplashConfig(preset.id, value.splashConfigs?.[preset.id]),
    ])
  )
  const schemes = Array.isArray(value.splashSchemes)
    ? value.splashSchemes
        .filter((scheme) => scheme && scheme.id && scheme.name && SPLASH_PRESETS.some((preset) => preset.id === scheme.presetId))
        .map((scheme) => ({
          id: String(scheme.id),
          name: String(scheme.name).trim().slice(0, 30),
          presetId: scheme.presetId,
          config: normalizeSplashConfig(scheme.presetId, scheme.config),
        }))
        .filter((scheme) => scheme.name)
        .slice(0, 40)
    : []
  return {
    splashPreset,
    splashConfigs: configs,
    splashSchemes: schemes,
  }
}

export function createDefaultSplashSettings() {
  return normalizeSplashSettings({})
}