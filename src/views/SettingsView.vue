<script setup>
import { ref, computed, onMounted } from 'vue'
import { store, go, toggleView } from '../store'
import { settings, resetCustomSettings, saveSettingsNow, SITE_THEMES, CONTACT_AUTO_DEFAULTS } from '../settings'
import {
  chatState,
  clearAllMessages,
  contactById,
  contactDisplayName,
  primaryContact,
  notificationPermission,
  notificationSupported,
  requestNotificationPermission,
  saveChatDataNow,
  updateContact,
} from '../chat'
import { cropImage } from '../image-crop'
import { imageFileToOriginalDataUrl } from '../image-utils'
import { avatarFrameStyle, resolveAvatarFrameSkinCss } from '../avatar-frame-style'
import { STATUS_BUBBLE_SKIN_OPTIONS, transferCardSkinOptions } from '../theme/card-skins'
import LineGlyph from '../components/LineGlyph.vue'
import LaunchSplash from '../components/LaunchSplash.vue'
import { CHAT_TOOL_CATALOG, createDefaultChatToolSettings } from '../chat-tools'
import ProbabilityField from '../components/ProbabilityField.vue'
import { BUILTIN_AVATAR_FRAME_SKINS, BUILTIN_BUBBLE_SKINS } from '../theme/skins'
import { APP_ICON_THEMES, appIconSrc } from '../app-icons'
import { SPLASH_OPTIONS, defaultSplashConfig, splashPresetById } from '../splash'
import { HOME_APP_ITEMS } from '../home-apps'
import { isNativeApp, nativeAppVersion, requestIgnoreBatteryOptimizations, requestNativePermissions } from '../native-bridge'
import { AI_PROVIDERS, isAiConfigured, requestAiInterpretation } from '../ai'
import {
  EXPORT_CATEGORIES,
  availableImportCategories,
  clearAllAppData,
  compressAllImages,
  estimateCompression,
  exportBackup,
  formatBytes,
  getStorageDetails,
  importBackup,
  parseBackupText,
} from '../data-tools'

const appIconItems = HOME_APP_ITEMS

const anniversaryPresets = ['我们在一起已经', '遇见你', '爱上你已经']
const FONT_OPTIONS = [
  { id: 'default', name: '默认字体', description: '随和黑体，全站默认' },
  { id: 'pixel', name: '缝合怪像素字体', description: '12px 像素风，复古游戏感' },
  { id: 'custom', name: '自定义字体链接', description: '粘贴 WOFF、WOFF2、TTF 或 OTF 地址' },
]
const fontPresetName = ref('')
const fontNotice = ref('')
const activeSection = ref('')
const splashPrimaryInput = ref(null)
const splashSecondaryInput = ref(null)
const splashSchemeName = ref('')
const splashNotice = ref('')
const activeSplashPreset = computed(() => splashPresetById(settings.splashPreset))
const activeSplashConfig = computed(() =>
  settings.splashConfigs?.[settings.splashPreset] || activeSplashPreset.value.defaults || {}
)
const isNativeShell = isNativeApp()
const nativeShellVersion = nativeAppVersion()
const nativePermissionRequested = ref(false)
const themeAvatarFrameInput = ref(null)
const frameTargetType = ref('user')
const frameContactId = ref(chatState.contacts[0]?.id || '')
const frameTargetContact = computed(() => contactById(frameContactId.value) || chatState.contacts[0] || null)
const frameTargetLabel = computed(() =>
  frameTargetType.value === 'user' ? (settings.userName || '我') : contactDisplayName(frameTargetContact.value)
)
const frameTargetImage = computed(() =>
  frameTargetType.value === 'user' ? settings.userAvatarFrame || '' : frameTargetContact.value?.avatarFrame || ''
)
const frameAvatarImage = computed(() =>
  frameTargetType.value === 'user' ? settings.anniversaryAvatarB || '' : frameTargetContact.value?.avatarImage || ''
)
const frameAvatarFallback = computed(() =>
  frameTargetType.value === 'user' ? '我' : (frameTargetContact.value?.avatar || 'TA')
)
const frameTargetStyle = computed(() =>
  avatarFrameStyle(frameTargetType.value === 'user'
    ? {
        avatarFrameOffsetX: settings.userAvatarFrameOffsetX,
        avatarFrameOffsetY: settings.userAvatarFrameOffsetY,
        avatarFrameScale: settings.userAvatarFrameScale,
      }
    : frameTargetContact.value || {})
)
function getFrameTargetValue(key) {
  if (frameTargetType.value === 'user') {
    return settings[`user${key[0].toUpperCase()}${key.slice(1)}`]
  }
  return frameTargetContact.value?.[key]
}
function setFrameTargetValue(key, value) {
  if (frameTargetType.value === 'user') {
    settings[`user${key[0].toUpperCase()}${key.slice(1)}`] = value
    return
  }
  if (!frameTargetContact.value) return
  updateContact(frameTargetContact.value.id, { [key]: value })
}
const frameOffsetX = computed({
  get: () => Number(getFrameTargetValue('avatarFrameOffsetX')) || 0,
  set: (value) => setFrameTargetValue('avatarFrameOffsetX', Math.max(-80, Math.min(80, Math.round(Number(value) || 0)))),
})
const frameOffsetY = computed({
  get: () => Number(getFrameTargetValue('avatarFrameOffsetY')) || 0,
  set: (value) => setFrameTargetValue('avatarFrameOffsetY', Math.max(-80, Math.min(80, Math.round(Number(value) || 0)))),
})
const frameScale = computed({
  get: () => Number(getFrameTargetValue('avatarFrameScale')) || 1,
  set: (value) => setFrameTargetValue('avatarFrameScale', Math.round(Math.max(0.5, Math.min(2, Number(value) || 1)) * 100) / 100),
})
const aiTesting = ref(false)
const aiTestResult = ref('')
const aiTestError = ref('')
const settingsSections = [
  { id: 'anniversary', label: '纪念日组件', hint: '标题、日期、头像和背景' },
  { id: 'time', label: '时差组件', hint: '自定义时差卡片比例' },
  { id: 'linkStatus', label: '连接状态组件', hint: '自定义链接状态卡片比例' },
  { id: 'taToday', label: 'TA想对你说组件', hint: '从字卡库抽取每日留言' },
  { id: 'homeBackground', label: '主页背景', hint: '主页壁纸与不透明度' },
  { id: 'photoCarousel', label: '照片轮播组件', hint: '轮播速度、组件高度和照片大小' },
  { id: 'momentsBackground', label: '朋友圈背景图', hint: '我的与联系人分别设置' },
  { id: 'autoChat', label: 'TA的回复', hint: '回复、主动消息与概率' },
  { id: 'chatTools', label: '聊天工具', hint: '工具开关与默认参数' },
  { id: 'ai', label: 'AI接入', hint: '配置智能体 API 与解读用途' },
  { id: 'featureHub', label: '功能大全', hint: '按分类查找聊天与全部功能' },
  { id: 'notifications', label: '通知', hint: '站内与浏览器通知' },
  { id: 'viewMode', label: '查看模式', hint: '切换手机与网站视图' },
  { id: 'icons', label: '图标', hint: 'App 图标主题与自定义' },
  { id: 'splash', label: '开屏动画', hint: '五种可自定义开屏与预设方案' },
  { id: 'data', label: '数据', hint: '存储、备份与清理' },
  { id: 'theme', label: '主题', hint: '网站整体配色' },
]

const AUTO_TABS = [
  { id: 'chat', label: '聊天' },
  { id: 'group', label: '群聊' },
  { id: 'mailbox', label: '信箱' },
  { id: 'moments', label: '朋友圈' },
  { id: 'other', label: '其他' },
]
const AUTO_CHAT_TABS = [
  { id: 'reply', label: '回复与主动' },
  { id: 'cards', label: '字卡与概率' },
  { id: 'craft', label: '拼字造句' },
]
const activeAutoTab = ref('chat')
const activeAutoChatTab = ref('reply')
const CHAT_TOOL_SETTINGS_TABS = [
  { id: 'switches', label: '工具开关' },
  { id: 'params', label: '参数与说明' },
]
const activeChatToolSettingsTab = ref('switches')
const CHAT_TOOL_CATEGORY_ORDER = ['消息与媒体', '辅助工具']
const chatToolSettingsGroups = CHAT_TOOL_CATEGORY_ORDER
  .map((label) => ({
    label,
    tools: CHAT_TOOL_CATALOG.filter((tool) => tool.category === label),
  }))
  .filter((group) => group.tools.length)
const chatToolEnabledCount = computed(
  () => CHAT_TOOL_CATALOG.filter((tool) => settings.chatTools.enabled[tool.id] !== false).length
)
const selectedAutoContactId = ref(chatState.contacts[0]?.id || '')

const selectedAutoSettings = computed(() => {
  const id = selectedAutoContactId.value
  if (!id) return { ...CONTACT_AUTO_DEFAULTS }
  if (!settings.contactAutoSettings[id]) {
    settings.contactAutoSettings[id] = { ...CONTACT_AUTO_DEFAULTS }
  }
  const target = settings.contactAutoSettings[id]
  if (target.dictionarySingleBubble === undefined) {
    // 旧存档只有 dictionaryMulti，单气泡 = 未开启逐张分条
    target.dictionarySingleBubble = target.dictionaryMulti === false
  }
  if (target.diaryQuoteEnabled === undefined && target.diaryMemoEnabled !== undefined) {
    target.diaryQuoteEnabled = target.diaryMemoEnabled !== false
  }
  for (const [key, value] of Object.entries(CONTACT_AUTO_DEFAULTS)) {
    if (target[key] === undefined) target[key] = value
  }
  return target
})
const bubbleSkinChoices = computed(() => [...BUILTIN_BUBBLE_SKINS, ...(settings.customBubbleSkins || [])])
const avatarFrameChoices = computed(() => [...BUILTIN_AVATAR_FRAME_SKINS, ...(settings.customAvatarFrameSkins || [])])
const presetFrameTarget = ref('user')
function applyAvatarFramePreset(value) {
  const skin = avatarFrameChoices.value.find((item) => item.id === value)
  const image = skin?.image || ''
  const offsetX = image ? Number(skin.offsetX) || 0 : 0
  const offsetY = image ? Number(skin.offsetY) || 0 : 0
  const scale = image ? Math.max(0.5, Math.min(2, Number(skin.scale) || 1)) : 1
  if (presetFrameTarget.value === 'user') {
    settings.userAvatarFrameSkin = value
    settings.userAvatarFrame = image
    settings.userAvatarFrameOffsetX = offsetX
    settings.userAvatarFrameOffsetY = offsetY
    settings.userAvatarFrameScale = scale
  } else if (frameTargetContact.value) {
    updateContact(frameTargetContact.value.id, {
      avatarFrameSkin: value,
      avatarFrame: image,
      avatarFrameOffsetX: offsetX,
      avatarFrameOffsetY: offsetY,
      avatarFrameScale: scale,
    })
  }
}
const selectedPresetAvatarFrameSkin = computed({
  get: () => presetFrameTarget.value === 'user'
    ? settings.userAvatarFrameSkin
    : (frameTargetContact.value?.avatarFrameSkin || 'none'),
  set: (value) => applyAvatarFramePreset(value),
})
const customMoodInput = ref('')
const transferSkinChoices = computed(() => transferCardSkinOptions(SITE_THEMES))
const customBubbleName = ref('')
const customBubbleCss = ref('')
const customFrameName = ref('')
const customFrameCss = ref('')
const imageFramePresetName = ref('')
const selectedBubbleSkinCss = computed(
  () => bubbleSkinChoices.value.find((skin) => skin.id === settings.chatBubbleSkin)?.css || ''
)
const selectedAvatarFrameCss = computed(() => {
  const skin = avatarFrameChoices.value.find((item) => item.id === selectedPresetAvatarFrameSkin.value)
  if (skin?.image) {
    return `上传图片预设：X ${Number(skin.offsetX) || 0}px · Y ${Number(skin.offsetY) || 0}px · 大小 ${(Number(skin.scale) || 1).toFixed(2)}×`
  }
  return resolveAvatarFrameSkinCss(skin)
})
function addCustomBubbleSkin() {
  const name = customBubbleName.value.trim()
  const css = customBubbleCss.value.trim()
  if (!name || !css) return
  const skin = { id: `bubble-custom-${Date.now()}`, name: name.slice(0, 24), css }
  settings.customBubbleSkins = [...(settings.customBubbleSkins || []), skin]
  settings.chatBubbleSkin = skin.id
  customBubbleName.value = ''
  customBubbleCss.value = ''
}
function removeCustomBubbleSkin(id) {
  settings.customBubbleSkins = (settings.customBubbleSkins || []).filter((skin) => skin.id !== id)
  if (settings.chatBubbleSkin === id) settings.chatBubbleSkin = 'default'
}
function addCustomFrameSkin() {
  const name = customFrameName.value.trim()
  const css = customFrameCss.value.trim()
  if (!name || !css) return
  const skin = { id: `frame-custom-${Date.now()}`, name: name.slice(0, 24), css }
  settings.customAvatarFrameSkins = [...(settings.customAvatarFrameSkins || []), skin]
  selectedPresetAvatarFrameSkin.value = skin.id
  customFrameName.value = ''
  customFrameCss.value = ''
}
function removeCustomFrameSkin(id) {
  settings.customAvatarFrameSkins = (settings.customAvatarFrameSkins || []).filter((skin) => skin.id !== id)
  if (settings.userAvatarFrameSkin === id) {
    settings.userAvatarFrameSkin = 'none'
    settings.userAvatarFrame = ''
    settings.userAvatarFrameOffsetX = 0
    settings.userAvatarFrameOffsetY = 0
    settings.userAvatarFrameScale = 1
  }
  if (settings.contactAvatarFrameSkin === id) settings.contactAvatarFrameSkin = 'none'
  for (const contact of chatState.contacts) {
    if (contact.avatarFrameSkin === id) {
      updateContact(contact.id, {
        avatarFrameSkin: 'none',
        avatarFrame: '',
        avatarFrameOffsetX: 0,
        avatarFrameOffsetY: 0,
        avatarFrameScale: 1,
      })
    }
  }
}
function saveCurrentFrameAsPreset() {
  const image = frameTargetImage.value
  const name = imageFramePresetName.value.trim()
  if (!image) {
    saveNotice.value = '请先上传头像框图片'
    return
  }
  if (!name) {
    saveNotice.value = '请先给头像框预设起名'
    return
  }
  const skin = {
    id: `frame-custom-${Date.now()}`,
    name: name.slice(0, 24),
    description: '上传图片生成的头像框预设',
    css: '',
    image,
    offsetX: frameOffsetX.value,
    offsetY: frameOffsetY.value,
    scale: frameScale.value,
  }
  settings.customAvatarFrameSkins = [...(settings.customAvatarFrameSkins || []), skin]
  presetFrameTarget.value = frameTargetType.value
  selectedPresetAvatarFrameSkin.value = skin.id
  imageFramePresetName.value = ''
  saveSettingsNow()
  saveNotice.value = `已保存头像框预设「${skin.name}」`
}
const appIconThemeOptions = computed(() => [
  ...APP_ICON_THEMES,
  ...(settings.customIconThemes || []),
])
const selectedCustomIconTheme = computed(() =>
  (settings.customIconThemes || []).find((theme) => theme.id === settings.appIconTheme) || null
)

function createCustomIconTheme() {
  const index = (settings.customIconThemes?.length || 0) + 1
  const id = `custom-icon-${Date.now()}`
  const theme = { id, name: `自定义图标主题 ${index}`, icons: {} }
  settings.customIconThemes = [...(settings.customIconThemes || []), theme]
  settings.appIconTheme = id
  saveSettingsNow()
}

function deleteCustomIconTheme() {
  const theme = selectedCustomIconTheme.value
  if (!theme) return
  if (!window.confirm(`删除图标主题“${theme.name}”？`)) return
  settings.customIconThemes = (settings.customIconThemes || []).filter((item) => item.id !== theme.id)
  settings.appIconTheme = 'default'
  saveSettingsNow()
}

function appIconStatus(id) {
  if (selectedCustomIconTheme.value) {
    if (selectedCustomIconTheme.value.icons?.[id]) return '当前自定义主题图标'
    if (settings.customAppIcons?.[id]) return '当前使用单独自定义图标'
    return '当前主题未上传，使用默认线条图标'
  }
  if (settings.customAppIcons?.[id]) return '当前使用单独自定义图标'
  if (settings.appIconTheme === 'ins-gray') return '当前使用 ins灰白渐变'
  return '当前使用默认线条图标'
}

function applyCustomFontPreset(preset) {
  settings.siteFont = 'custom'
  settings.customFontUrl = preset.url
  settings.customFontFamily = preset.family || 'ZhengduCustomFont'
  fontPresetName.value = preset.name
  fontNotice.value = `已应用字体预设「${preset.name}」`
}
function saveCustomFontPreset() {
  const name = fontPresetName.value.trim() || settings.customFontFamily || '我的字体'
  const url = String(settings.customFontUrl || '').trim()
  if (!url) {
    fontNotice.value = '请先填写字体链接或 @font-face 代码'
    return
  }
  const family = settings.customFontFamily || 'ZhengduCustomFont'
  const presets = Array.isArray(settings.customFontPresets) ? [...settings.customFontPresets] : []
  const existing = presets.findIndex((preset) => preset.name === name)
  const preset = {
    id: existing >= 0 ? presets[existing].id : `font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.slice(0, 30),
    url,
    family,
  }
  if (existing >= 0) presets[existing] = preset
  else presets.unshift(preset)
  settings.customFontPresets = presets.slice(0, 30)
  settings.siteFont = 'custom'
  fontNotice.value = `已保存字体预设「${preset.name}」`
}
function deleteCustomFontPreset(id) {
  settings.customFontPresets = (settings.customFontPresets || []).filter((preset) => preset.id !== id)
  fontNotice.value = '已删除字体预设'
}
function saveIconThemeSettings() {
  saveSettingsNow()
  saveNotice.value = '图标主题已保存'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}
const momentsCoverTarget = ref('me')
const momentsCoverContact = computed(() =>
  chatState.contacts.find((contact) => contact.id === momentsCoverTarget.value) || null
)
const momentsCoverTargetLabel = computed(() =>
  momentsCoverTarget.value === 'me'
    ? '我的'
    : momentsCoverContact.value
      ? contactDisplayName(momentsCoverContact.value)
      : '联系人'
)
const activeMomentsCover = computed(() =>
  momentsCoverTarget.value === 'me'
    ? settings.momentsBackground || ''
    : momentsCoverContact.value?.momentsCover || ''
)
const momentsCoverPreviewStyle = computed(() => {
  const cover = activeMomentsCover.value
  return cover
    ? { backgroundImage: `url("${cover.replace(/"/g, '%22')}")` }
    : null
})

function setMomentsCoverValue(value) {
  if (momentsCoverTarget.value === 'me') {
    settings.momentsBackground = value
    settings.momentsBackgroundOpacity = 100
    return
  }
  if (momentsCoverContact.value) {
    updateContact(momentsCoverContact.value.id, {
      momentsCover: value,
      momentsCoverOpacity: 100,
    })
  }
}

async function pickMomentsCover(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  imageError.value = ''
  try {
    const result = await cropImage(file, {
      title: `裁剪${momentsCoverTargetLabel.value}的朋友圈背景图`,
      aspectRatio: 16 / 9,
      lockAspect: true,
      shape: 'rect',
      maxSide: 1600,
      quality: 0.84,
    })
    if (result) setMomentsCoverValue(result)
  } catch (e) {
    imageError.value = e.message || '图片处理失败'
  }
}

function clearMomentsCover() {
  setMomentsCoverValue('')
}

function saveMomentsCoverSettings() {
  saveSettingsNow()
  saveChatDataNow()
  saveNotice.value = '已保存并立即生效'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}
function restoreSplashDefaults() {
  const id = settings.splashPreset
  if (!id || id === 'none') return
  settings.splashConfigs[id] = defaultSplashConfig(id)
  splashNotice.value = `已恢复「${activeSplashPreset.value.name}」默认设置`
}

function saveSplashScheme() {
  const name = splashSchemeName.value.trim()
  if (!settings.splashPreset || settings.splashPreset === 'none') {
    splashNotice.value = '请先选择一个开屏预设'
    return
  }
  if (!name) {
    splashNotice.value = '请先给方案起名'
    return
  }
  const scheme = {
    id: `splash-scheme-${Date.now()}`,
    name: name.slice(0, 30),
    presetId: settings.splashPreset,
    config: { ...activeSplashConfig.value },
  }
  settings.splashSchemes = [scheme, ...(settings.splashSchemes || [])].slice(0, 40)
  splashSchemeName.value = ''
  splashNotice.value = `已保存开屏方案「${scheme.name}」`
}

function applySplashScheme(scheme) {
  settings.splashPreset = scheme.presetId
  settings.splashConfigs[scheme.presetId] = { ...scheme.config }
  splashNotice.value = `已应用开屏方案「${scheme.name}」`
}

function deleteSplashScheme(id) {
  settings.splashSchemes = (settings.splashSchemes || []).filter((scheme) => scheme.id !== id)
  splashNotice.value = '已删除开屏方案'
}

async function pickSplashImage(event, key, aspectRatio) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file?.type?.startsWith('image/')) return
  try {
    const result = await cropImage(file, {
      title: key === 'primaryImage' ? '裁剪苦橙主图' : '裁剪苦橙副图',
      aspectRatio,
      lockAspect: true,
      shape: 'rect',
      maxSide: 1600,
      quality: 0.86,
    })
    if (!result) return
    settings.splashConfigs.bitterOrange[key] = result
    splashNotice.value = key === 'primaryImage' ? '已更新苦橙主图' : '已更新苦橙副图'
  } catch (error) {
    splashNotice.value = error.message || '图片处理失败'
  }
}
const activeSectionTitle = computed(
  () => settingsSections.find((section) => section.id === activeSection.value)?.label || '设置'
)
function openSettingsSection(id) {
  // 功能大全是一个独立页面，不是设置页内的面板
  if (id === 'featureHub') {
    go('featureHub')
    return
  }
  activeSection.value = id
  if (id === 'chatTools') loadChatToolPromptDraft()
  requestAnimationFrame(() => {
    document.querySelector('.site-main')?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
function closeSettingsSection() {
  activeSection.value = ''
  requestAnimationFrame(() => {
    document.querySelector('.site-main')?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
const typingIndicatorPresets = ['正在挑选字卡', '正在输入中', '正在纠结中', '让我想想……']

function applyAnniversaryPreset(event) {
  if (event.target.value !== 'custom') settings.anniversaryTitle = event.target.value
}

function normalizeCardRatio(key, fallback) {
  const match = String(settings[key] ?? '')
    .trim()
    .match(/^([1-4])\s*[xX×]\s*([1-8])$/)
  settings[key] = match ? `${Number(match[1])}x${Number(match[2])}` : fallback
}

function saveSkinSettings() {
  saveSettingsNow()
  saveNotice.value = '皮肤设置已保存并立即生效'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}
function saveCardLayoutSettings() {
  saveSettingsNow()
  saveNotice.value = '已保存并立即生效'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}
const permission = ref(notificationPermission())
const imageError = ref('')
const saveNotice = ref('')
let saveNoticeTimer = null

function showChatToolNotice(message) {
  saveNotice.value = message
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 2200)
}
function applyAiProviderPreset() {
  const provider = AI_PROVIDERS.find((item) => item.id === settings.ai.provider)
  if (!provider) return
  if (provider.endpoint) settings.ai.endpoint = provider.endpoint
  if (provider.model) settings.ai.model = provider.model
}
function saveAiSettings() {
  saveSettingsNow()
  saveNotice.value = 'AI 接入设置已保存'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}
async function testAiConnection() {
  aiTestResult.value = ''
  aiTestError.value = ''
  if (!isAiConfigured(settings.ai)) {
    aiTestError.value = '请先启用 AI，并填写接口地址、模型和 API Key。'
    return
  }
  aiTesting.value = true
  try {
    const contact = primaryContact()
    aiTestResult.value = await requestAiInterpretation(settings.ai, {
      characterName: contactDisplayName(contact),
      backstory: contact?.backstory || '',
      contentType: '连接测试',
      content: '请用角色口吻简短地打一次招呼，证明解读接口已经连通。',
    })
  } catch (error) {
    aiTestError.value = error.message || 'AI 连接测试失败'
  } finally {
    aiTesting.value = false
  }
}
function saveChatToolSettings() {
  saveSettingsNow()
  showChatToolNotice('聊天工具设置已保存并立即生效')
}
function resetChatToolSettings() {
  if (!window.confirm('恢复全部聊天工具的开关和默认参数？')) return
  settings.chatTools = createDefaultChatToolSettings()
  saveSettingsNow()
  showChatToolNotice('聊天工具已恢复默认设置')
}
function clearChatToolHistory() {
  if (!window.confirm('清空「帮我决定」的历史？聊天消息不会被删除。')) return
  try {
    localStorage.removeItem('zhengdu_decision_history_v1')
  } catch {}
  showChatToolNotice('聊天工具历史已清空')
}
const storageOpen = ref(false)
const storageLoading = ref(false)
const storageDetails = ref(null)
const storageError = ref('')
const compressionStage = ref('idle')
const compressionEstimate = ref(null)
const compressionProgress = ref(0)
const compressionResult = ref(null)
const compressionError = ref('')
const exportCategories = ref(EXPORT_CATEGORIES.map((item) => item.key))
const exportBusy = ref(false)
const exportNotice = ref('')
const importBusy = ref(false)
const importNotice = ref('')
const importError = ref('')
const importFileName = ref('')
const importBackupData = ref(null)
const importAvailable = ref([])
const importCategories = ref([])
const importInput = ref(null)
const clearBusy = ref(false)

const permissionLabel = computed(() => {
  const labels = {
    granted: '已开启浏览器通知',
    denied: '浏览器通知已被拒绝，请在浏览器设置中修改',
    default: '尚未开启浏览器通知',
    unsupported: '当前浏览器不支持系统通知',
  }
  return labels[permission.value] || labels.default
})

const intervalSummary = computed(() => {
  if (!settings.proactiveEnabled) return '主动发消息已关闭'
  if (settings.randomInterval) return '随机间隔：每次在 1 分钟～24 小时之间抽取'
  const min = Math.min(settings.minInterval, settings.maxInterval)
  const max = Math.max(settings.minInterval, settings.maxInterval)
  return `自定义间隔：每 ${min}～${max} 分钟主动发一次`
})

function clampInterval(key) {
  const value = Math.round(Number(settings[key]))
  settings[key] = Number.isFinite(value)
    ? Math.min(1440, Math.max(1, value))
    : key === 'minInterval'
      ? 5
      : 60
}

function normalizeSelectedReplyDelay(changed = 'min') {
  let min = Math.max(0, Number(selectedAutoSettings.value.replyDelayMinSeconds) || 0)
  let max = Math.max(0, Number(selectedAutoSettings.value.replyDelayMaxSeconds) || 0)
  if (min > max) {
    if (changed === 'min') max = min
    else min = max
  }
  selectedAutoSettings.value.replyDelayMinSeconds = min
  selectedAutoSettings.value.replyDelayMaxSeconds = max
}
function clampSelectedAutoValue(key, min, max, fallback) {
  const value = Math.round(Number(selectedAutoSettings.value[key]))
  selectedAutoSettings.value[key] = Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function clampAutoValue(key, min, max, fallback) {
  const value = Math.round(Number(settings[key]))
  settings[key] = Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function addCustomDiaryMood() {
  const value = customMoodInput.value.trim().slice(0, 16)
  if (!value) return
  if (!Array.isArray(settings.customDiaryMoods)) settings.customDiaryMoods = []
  if (!settings.customDiaryMoods.includes(value)) settings.customDiaryMoods.push(value)
  customMoodInput.value = ''
}

function removeCustomDiaryMood(index) {
  if (!Array.isArray(settings.customDiaryMoods)) return
  settings.customDiaryMoods.splice(index, 1)
}

function clampDiaryCardRange(prefix, changed) {
  const minKey = `${prefix}CardMin`
  const maxKey = `${prefix}CardMax`
  let min = Math.min(20, Math.max(1, Math.round(Number(selectedAutoSettings.value[minKey]) || 3)))
  let max = Math.min(20, Math.max(1, Math.round(Number(selectedAutoSettings.value[maxKey]) || 8)))
  if (min > max) {
    if (changed === 'min') max = min
    else min = max
  }
  selectedAutoSettings.value[minKey] = min
  selectedAutoSettings.value[maxKey] = max
}
function clampSelectedRange(minKey, maxKey, changed, lower = 1, upper = 20) {
  let min = Math.min(upper, Math.max(lower, Math.round(Number(selectedAutoSettings.value[minKey]) || lower)))
  let max = Math.min(upper, Math.max(lower, Math.round(Number(selectedAutoSettings.value[maxKey]) || min)))
  if (min > max) {
    if (changed === 'min') max = min
    else min = max
  }
  selectedAutoSettings.value[minKey] = min
  selectedAutoSettings.value[maxKey] = max
}
function setDictionarySendMode(mode) {
  selectedAutoSettings.value.dictionaryMulti = mode === 'multi'
  selectedAutoSettings.value.dictionarySingleBubble = mode === 'single'
}

function clampReplyCardRange(changed = '') {
  let min = Math.min(10, Math.max(1, Math.round(Number(settings.replyCardCountMin) || 1)))
  let max = Math.min(10, Math.max(1, Math.round(Number(settings.replyCardCountMax) || 1)))
  if (min > max) {
    if (changed === 'min') max = min
    else min = max
  }
  settings.replyCardCountMin = min
  settings.replyCardCountMax = max
}
function restoreSettings() {
  if (!window.confirm('恢复默认设置？背景、纪念日和TA的回复设置都会重置。')) return
  resetCustomSettings()
}

function clearMessages() {
  if (!window.confirm('清空全部聊天记录？联系人和个性化设置会保留。')) return
  clearAllMessages()
}

function bgStyle(url, opacity = 60) {
  if (!url) return null
  return {
    backgroundImage: `url("${url.replace(/"/g, '%22')}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: Math.min(1, Math.max(0, Number(opacity) / 100)),
  }
}

function anniversaryBackgroundAspect() {
  const match = String(settings.anniversaryCardSize || '4x2').match(/^(\d+)\s*[xX×]\s*(\d+)$/)
  if (!match) return 2
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? width / height : 2
}

async function pickImage(event, key, maxSide, aspectRatio = 16 / 9) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  imageError.value = ''
  try {
    const result = await cropImage(file, {
      title: key === 'momentsBackground' ? '裁剪朋友圈背景图' : '裁剪背景图',
      aspectRatio,
      lockAspect: true,
      shape: 'rect',
      maxSide,
      quality: 0.84,
    })
    if (result) settings[key] = result
  } catch (e) {
    imageError.value = e.message || '图片处理失败'
  }
}

function clearImage(key) {
  settings[key] = ''
}

async function pickAppIcon(event, id) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  imageError.value = ''
  try {
    const item = appIconItems.find((entry) => entry.id === id)
    const result = await cropImage(file, {
      title: `裁剪${item?.label || 'APP'}图标`,
      aspectRatio: 1,
      lockAspect: true,
      shape: 'rect',
      maxSide: 512,
      quality: 0.88,
    })
    if (!result) return
    const customTheme = selectedCustomIconTheme.value
    if (customTheme) {
      settings.customIconThemes = (settings.customIconThemes || []).map((theme) =>
        theme.id === customTheme.id
          ? { ...theme, icons: { ...(theme.icons || {}), [id]: result } }
          : theme
      )
    } else {
      settings.customAppIcons = {
        ...(settings.customAppIcons || {}),
        [id]: result,
      }
    }
  } catch (e) {
    imageError.value = e.message || '图标处理失败'
  }
}

function clearAppIcon(id) {
  const customTheme = selectedCustomIconTheme.value
  if (customTheme) {
    settings.customIconThemes = (settings.customIconThemes || []).map((theme) => {
      if (theme.id !== customTheme.id) return theme
      const icons = { ...(theme.icons || {}) }
      delete icons[id]
      return { ...theme, icons }
    })
  }
  const next = { ...(settings.customAppIcons || {}) }
  delete next[id]
  settings.customAppIcons = next
}
async function pickAnniversaryAvatar(event, key) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  imageError.value = ''
  try {
    const result = await cropImage(file, {
      title: key === 'anniversaryAvatarA' ? '裁剪纪念日头像一' : '裁剪纪念日头像二',
      aspectRatio: 1,
      lockAspect: true,
      shape: 'circle',
      maxSide: 360,
      quality: 0.86,
    })
    if (result) settings[key] = result
  } catch (e) {
    imageError.value = e.message || '头像处理失败'
  }
}

function saveAnniversarySettings() {
  saveSettingsNow()
  saveNotice.value = '已保存并立即生效'
  clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => (saveNotice.value = ''), 1800)
}

async function loadStorageDetails() {
  storageLoading.value = true
  storageError.value = ''
  try {
    storageDetails.value = await getStorageDetails()
  } catch (e) {
    storageError.value = e.message || '无法读取储存空间'
  } finally {
    storageLoading.value = false
  }
}

async function toggleStorageDetails() {
  storageOpen.value = !storageOpen.value
  if (storageOpen.value) await loadStorageDetails()
}

async function prepareCompression() {
  compressionError.value = ''
  compressionResult.value = null
  compressionStage.value = 'checking'
  try {
    const estimate = await estimateCompression()
    if (!estimate.count) {
      compressionStage.value = 'idle'
      compressionError.value = '没有检测到可压缩的图片。'
      return
    }
    compressionEstimate.value = estimate
    compressionStage.value = 'confirm'
  } catch (e) {
    compressionStage.value = 'idle'
    compressionError.value = e.message || '无法估算压缩时间'
  }
}

function cancelCompression() {
  compressionStage.value = 'idle'
  compressionProgress.value = 0
}

async function confirmCompression() {
  compressionStage.value = 'running'
  compressionProgress.value = 0
  compressionError.value = ''
  try {
    const result = await compressAllImages((processed, total) => {
      compressionProgress.value = total ? Math.min(100, Math.round((processed / total) * 100)) : 0
    })
    compressionResult.value = result
    compressionStage.value = 'done'
    if (storageOpen.value) await loadStorageDetails()
  } catch (e) {
    compressionError.value = e.message || '压缩失败'
    compressionStage.value = 'confirm'
  }
}

function toggleAllExport(checked) {
  exportCategories.value = checked ? EXPORT_CATEGORIES.map((item) => item.key) : []
}

async function handleExport() {
  if (!exportCategories.value.length) {
    exportNotice.value = '请至少选择一个导出栏目。'
    return
  }
  exportBusy.value = true
  exportNotice.value = ''
  try {
    const result = await exportBackup(exportCategories.value)
    exportNotice.value = result.savedNatively
      ? '已保存到手机下载目录：' + result.filename + '（' + formatBytes(result.bytes) + '）'
      : '已导出 ' + result.filename + '（' + formatBytes(result.bytes) + '）'
  } catch (e) {
    exportNotice.value = e.message || '导出失败'
  } finally {
    exportBusy.value = false
  }
}

function pickImportFile() {
  importInput.value?.click()
}

async function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  importBusy.value = true
  importError.value = ''
  importNotice.value = ''
  try {
    const backup = parseBackupText(await readImportFile(file))
    importBackupData.value = backup
    importFileName.value = file.name
    importAvailable.value = availableImportCategories(backup)
    importCategories.value = importAvailable.value.map((item) => item.key)
  } catch (e) {
    importBackupData.value = null
    importAvailable.value = []
    importCategories.value = []
    importError.value = e.message || '备份文件读取失败'
  } finally {
    importBusy.value = false
  }
}

async function handleImport(all = false) {
  if (!importBackupData.value) return
  const categories = all
    ? importAvailable.value.map((item) => item.key)
    : importCategories.value
  if (!categories.length) {
    importError.value = '请至少选择一个导入栏目。'
    return
  }
  importBusy.value = true
  importError.value = ''
  importNotice.value = ''
  try {
    const result = await importBackup(importBackupData.value, categories)
    const summary = [
      result.characters ? `角色 ${result.characters}` : '',
      result.groups ? `群聊 ${result.groups}` : '',
      result.cards ? `字卡 ${result.cards}` : '',
      result.chats ? `聊天记录 ${result.chats}` : '',
      result.stickers ? `表情包 ${result.stickers}` : '',
      result.settings ? '网站设置' : '',
      result.album ? `相册 ${result.album}` : '',
      result.appData ? `其他应用数据 ${result.appData}` : '',
      result.musicFiles ? `音乐文件 ${result.musicFiles}` : '',
      result.needsReload ? '，导入后页面将自动刷新' : '',
    ].filter(Boolean)
    importNotice.value = summary.length ? `导入完成：${summary.join('、')}` : '没有读取到可导入的数据。'
    if (storageOpen.value) await loadStorageDetails()
  } catch (e) {
    importError.value = e.message || '导入失败'
  } finally {
    importBusy.value = false
  }
}

async function clearEverything() {
  if (!window.confirm('清空全部本地数据？角色、字卡、聊天记录、表情包、照片和设置都会被删除。')) return
  if (!window.confirm('此操作无法撤销。建议先导出备份，确定继续清空吗？')) return
  clearBusy.value = true
  try {
    await clearAllAppData()
    window.location.reload()
  } catch (e) {
    window.alert(e.message || '清空数据失败')
    clearBusy.value = false
  }
}

async function enableBrowserNotifications() {
  if (isNativeShell) nativePermissionRequested.value = true
  permission.value = await requestNotificationPermission()
}

function requestNativeAppPermissions() {
  if (!requestNativePermissions()) return
  nativePermissionRequested.value = true
}

function openBatteryOptimizationSettings() {
  requestIgnoreBatteryOptimizations()
}

async function pickThemeAvatarFrame(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file?.type?.startsWith('image/')) return
  imageError.value = ''
  try {
    const result = await imageFileToOriginalDataUrl(file)
    if (!result) return
    setFrameTargetValue('avatarFrame', result)
    setFrameTargetValue('avatarFrameOffsetX', 0)
    setFrameTargetValue('avatarFrameOffsetY', 0)
    setFrameTargetValue('avatarFrameScale', 1)
    saveSettingsNow()
    saveNotice.value = `已更新${frameTargetLabel.value}的头像框`
  } catch (e) {
    imageError.value = e.message || '头像框上传失败'
  }
}

function clearThemeAvatarFrame() {
  setFrameTargetValue('avatarFrame', '')
  saveSettingsNow()
}

function adjustThemeAvatarFrameScale(delta) {
  frameScale.value = frameScale.value + delta
}

function resetThemeAvatarFramePosition() {
  frameOffsetX.value = 0
  frameOffsetY.value = 0
  frameScale.value = 1
}

function readImportFile(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('备份文件读取失败'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsText(file)
  })
}

onMounted(() => {
  permission.value = notificationPermission()
  // 功能大全跳过来时，直接进入指定分区（如「回复设置」→ autoChat）
  const pending = store.pendingSettingsSection
  if (pending) {
    store.pendingSettingsSection = null
    openSettingsSection(pending)
  }
})
</script>
<template>
  <section class="settings">
    <template v-if="!activeSection">
      <header class="settings-menu-head"><strong>设置</strong><span>选择要进入的设置栏目</span></header>
      <div class="settings-menu">
        <button v-for="section in settingsSections" :key="section.id" type="button" @click="openSettingsSection(section.id)">
          <span><strong>{{ section.label }}</strong><small>{{ section.hint }}</small></span><i>›</i>
        </button>
      </div>
    </template>
    <template v-else>
      <header class="settings-fixed-head">
        <button type="button" aria-label="返回设置" @click="closeSettingsSection"><LineGlyph type="back" /></button>
        <strong>{{ activeSectionTitle }}</strong>
        <span></span>
      </header>
    <details v-show="activeSection === 'anniversary'" :open="activeSection === 'anniversary'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">纪念日</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>预设文案</span>
          <select
            class="input"
            :value="anniversaryPresets.includes(settings.anniversaryTitle) ? settings.anniversaryTitle : 'custom'"
            @change="applyAnniversaryPreset"
          >
            <option v-for="preset in anniversaryPresets" :key="preset" :value="preset">{{ preset }}</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label class="field">
          <span>标题文字</span>
          <input v-model="settings.anniversaryTitle" class="input" type="text" maxlength="30" />
        </label>
        <label class="field">
          <span>卡片比例</span>
          <input
            v-model="settings.anniversaryCardSize"
            class="input"
            type="text"
            placeholder="4x2"
            @change="normalizeCardRatio('anniversaryCardSize', '4x2')"
          />
        </label>
        <label class="field">
          <span>卡片颜色</span>
          <input v-model="settings.anniversaryCardColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>卡片文字颜色</span>
          <input v-model="settings.anniversaryCardTextColor" class="input color-input" type="color" />
        </label>
        <div class="auto-chat-hint">格式为“宽x高”：宽度 1～4 个 APP，高度 1～8 个 APP。</div>
        <label class="field">
          <span>文字颜色</span>
          <input v-model="settings.anniversaryTextColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>天数颜色</span>
          <input v-model="settings.anniversaryCountColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>日期</span>
          <input v-model="settings.anniversaryDate" class="input" type="date" />
        </label>
        <label class="field">
          <span>计算方式</span>
          <select v-model="settings.anniversaryMode" class="input">
            <option value="since">从那天到今天</option>
            <option value="until">从今天开始倒数</option>
          </select>
        </label>
        <div class="anniversary-avatar-settings">
          <div class="anniversary-avatar-item">
            <span class="anniversary-avatar-preview">
              <img v-if="settings.anniversaryAvatarA" :src="settings.anniversaryAvatarA" alt="" />
              <span v-else>一</span>
            </span>
            <span class="anniversary-avatar-copy">
              <strong>头像一</strong>
              <small>从设置上传，主页不再显示选择文件</small>
            </span>
            <label class="file-button">
              上传
              <input type="file" accept="image/*" @change="pickAnniversaryAvatar($event, 'anniversaryAvatarA')" />
            </label>
            <button v-if="settings.anniversaryAvatarA" class="small-button" type="button" @click="settings.anniversaryAvatarA = ''">清除</button>
          </div>
          <div class="anniversary-avatar-item">
            <span class="anniversary-avatar-preview">
              <img v-if="settings.anniversaryAvatarB" :src="settings.anniversaryAvatarB" alt="" />
              <span v-else>二</span>
            </span>
            <span class="anniversary-avatar-copy">
              <strong>头像二</strong>
              <small>与【我的】个人信息头像同步</small>
            </span>
            <label class="file-button">
              上传
              <input type="file" accept="image/*" @change="pickAnniversaryAvatar($event, 'anniversaryAvatarB')" />
            </label>
            <button v-if="settings.anniversaryAvatarB" class="small-button" type="button" @click="settings.anniversaryAvatarB = ''">清除</button>
          </div>
        </div>
        <label class="switch-row">
          <span>显示头像框</span>
          <input v-model="settings.anniversaryShowAvatarFrames" type="checkbox" />
        </label>
        <p class="frame-preset-hint">关闭后，纪念日卡片的两个头像仍会显示，但不显示用户或联系人头像框。</p>
        <label class="field">
          <span>背景图片</span>
          <input v-model="settings.anniversaryBackground" class="input" type="text" placeholder="图片链接" />
        </label>
        <div class="image-actions">
          <label class="file-button">
            选择纪念日背景
            <input type="file" accept="image/*" @change="pickImage($event, 'anniversaryBackground', 1600, anniversaryBackgroundAspect())" />
          </label>
          <button v-if="settings.anniversaryBackground" class="small-button" type="button" @click="clearImage('anniversaryBackground')">清除</button>
        </div>
        <div v-if="settings.anniversaryBackground" class="background-preview" :style="bgStyle(settings.anniversaryBackground, settings.anniversaryBackgroundOpacity)"></div>
        <label v-if="settings.anniversaryBackground" class="opacity-row">
          <span>背景不透明度</span>
          <input v-model.number="settings.anniversaryBackgroundOpacity" type="range" min="0" max="100" />
          <strong>{{ settings.anniversaryBackgroundOpacity }}%</strong>
        </label>
        <div class="save-settings-row">
          <button class="save-settings-button" type="button" @click="saveAnniversarySettings">
            保存并立即生效
          </button>
          <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
        </div>
      </div>
    </details>

    <details v-show="activeSection === 'time'" :open="activeSection === 'time'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">时差</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>卡片比例</span>
          <input
            v-model="settings.timeCardSize"
            class="input"
            type="text"
            placeholder="2x1"
            @change="normalizeCardRatio('timeCardSize', '2x1')"
          />
        </label>
        <label class="field">
          <span>卡片颜色</span>
          <input v-model="settings.timeCardColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>卡片文字颜色</span>
          <input v-model="settings.timeCardTextColor" class="input color-input" type="color" />
        </label>
        <div class="auto-chat-hint">格式为“宽x高”：数字 1 表示 1 个 APP 的宽度，数字 2 表示 2 个 APP 的高度。</div>
        <div class="save-settings-row">
          <button class="save-settings-button" type="button" @click="saveCardLayoutSettings">
            保存并立即生效
          </button>
          <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
        </div>
      </div>
    </details>

    <details v-show="activeSection === 'linkStatus'" :open="activeSection === 'linkStatus'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">连接状态</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>卡片比例</span>
          <input
            v-model="settings.linkStatusCardSize"
            class="input"
            type="text"
            placeholder="2x1"
            @change="normalizeCardRatio('linkStatusCardSize', '2x1')"
          />
        </label>
        <label class="field">
          <span>卡片颜色</span>
          <input v-model="settings.linkStatusCardColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>卡片文字颜色</span>
          <input v-model="settings.linkStatusCardTextColor" class="input color-input" type="color" />
        </label>
        <div class="auto-chat-hint">格式为“宽x高”：数字 1 表示 1 个 APP 的宽度，数字 2 表示 2 个 APP 的高度。</div>
        <div class="save-settings-row">
          <button class="save-settings-button" type="button" @click="saveCardLayoutSettings">
            保存并立即生效
          </button>
          <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
        </div>
      </div>
    </details>
    <details v-show="activeSection === 'taToday'" :open="activeSection === 'taToday'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">TA 想对你说</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>卡片比例</span>
          <input
            v-model="settings.taTodayCardSize"
            class="input"
            type="text"
            placeholder="2x2"
            @change="normalizeCardRatio('taTodayCardSize', '2x2')"
          />
        </label>
        <label class="field">
          <span>卡片颜色</span>
          <input v-model="settings.taTodayCardColor" class="input color-input" type="color" />
        </label>
        <label class="field">
          <span>卡片文字颜色</span>
          <input v-model="settings.taTodayCardTextColor" class="input color-input" type="color" />
        </label>
        <div class="auto-chat-hint">格式为“宽x高”：数字 1 表示 1 个 APP 的宽度，数字 2 表示 2 个 APP 的高度。</div>
        <label class="field">
          <span>最少字卡数</span>
          <input v-model.number="settings.taTodayCardMin" class="input" type="number" min="1" max="3" />
        </label>
        <label class="field">
          <span>最多字卡数</span>
          <input v-model.number="settings.taTodayCardMax" class="input" type="number" min="1" max="3" />
        </label>
        <div class="auto-chat-hint">每天必定出现留言，并在 0 点自动刷新。系统预设字卡和自定义字卡会合并后等概率完全随机抽取，不再使用额外概率。</div>
        <div class="save-settings-row">
          <button class="save-settings-button" type="button" @click="saveCardLayoutSettings">
            保存并立即生效
          </button>
          <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
        </div>
      </div>
    </details>

    <details v-show="activeSection === 'homeBackground'" :open="activeSection === 'homeBackground'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">主页背景</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>背景图片</span>
          <input v-model="settings.homeBackground" class="input" type="text" placeholder="图片链接" />
        </label>
        <div class="image-actions">
          <label class="file-button">
            选择主页图片
            <input type="file" accept="image/*" @change="pickImage($event, 'homeBackground', 1600, 9 / 16)" />
          </label>
          <button v-if="settings.homeBackground" class="small-button" type="button" @click="clearImage('homeBackground')">清除</button>
        </div>
        <div v-if="settings.homeBackground" class="background-preview" :style="bgStyle(settings.homeBackground, settings.homeBackgroundOpacity)"></div>
        <label v-if="settings.homeBackground" class="opacity-row">
          <span>背景不透明度</span>
          <input v-model.number="settings.homeBackgroundOpacity" type="range" min="0" max="100" />
          <strong>{{ settings.homeBackgroundOpacity }}%</strong>
        </label>
      </div>
    </details>

    <details v-show="activeSection === 'photoCarousel'" :open="activeSection === 'photoCarousel'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">照片轮播组件</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <section class="echoes-character-card auto-chat-section carousel-settings-card">
          <div class="auto-chat-title">轮播速度</div>
          <div class="opacity-row">
            <span>切换间隔</span>
            <input v-model.number="settings.photoCarouselSpeed" type="range" min="1" max="20" step="0.5" />
            <strong>{{ settings.photoCarouselSpeed }} 秒</strong>
          </div>
          <div class="auto-chat-hint">数值越小，照片自动滚动的速度越快。默认 4.5 秒。</div>
        </section>

        <section class="echoes-character-card auto-chat-section carousel-settings-card">
          <div class="auto-chat-title">组件高度</div>
          <div class="carousel-height-options">
            <button
              v-for="height in 4"
              :key="height"
              type="button"
              :class="{ active: Number(settings.photoCarouselHeight) === height }"
              @click="settings.photoCarouselHeight = height"
            >
              {{ height }} 格高
            </button>
          </div>
          <div class="auto-chat-hint">按主页 APP 网格计算，组件宽度固定为 4 格。默认 2 格高。</div>
        </section>

        <section class="echoes-character-card auto-chat-section carousel-settings-card">
          <div class="auto-chat-title">照片大小</div>
          <div class="opacity-row">
            <span>照片尺寸</span>
            <input v-model.number="settings.photoCarouselPhotoSize" type="range" min="35" max="90" step="1" />
            <strong>{{ settings.photoCarouselPhotoSize }}%</strong>
          </div>
          <div class="auto-chat-hint">控制轮播中主照片的显示大小，两侧照片会按比例缩小并淡出。</div>
        </section>

        <div class="auto-chat-hint">轮播内容来自「相册 → 轮播合集」。没有加入轮播合集的照片不会出现在桌面组件里。</div>
      </div>
    </details>

    <details v-show="activeSection === 'momentsBackground'" :open="activeSection === 'momentsBackground'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">朋友圈背景图</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>编辑对象</span>
          <select v-model="momentsCoverTarget" class="input">
            <option value="me">我的朋友圈背景</option>
            <option v-for="contact in chatState.contacts" :key="contact.id" :value="contact.id">
              {{ contactDisplayName(contact) }}的朋友圈背景
            </option>
          </select>
        </label>
        <label class="field">
          <span>背景图片</span>
          <input
            :value="activeMomentsCover"
            class="input"
            type="text"
            placeholder="图片链接"
            @input="setMomentsCoverValue($event.target.value)"
          />
        </label>
        <div class="image-actions">
          <label class="file-button">
            选择朋友圈图片
            <input type="file" accept="image/*" @change="pickMomentsCover" />
          </label>
          <button v-if="activeMomentsCover" class="small-button" type="button" @click="clearMomentsCover">清除</button>
        </div>
        <div v-if="activeMomentsCover" class="background-preview moments-cover-preview" :style="momentsCoverPreviewStyle"></div>
        <div class="auto-chat-hint">当前编辑：{{ momentsCoverTargetLabel }}。裁剪区域固定为朋友圈 16:9 背景比例，不透明度固定为 100%。</div>
        <div v-if="imageError" class="error-line">{{ imageError }}</div>
        <div class="save-settings-row">
          <button class="save-settings-button" type="button" @click="saveMomentsCoverSettings">
            保存并立即生效
          </button>
          <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
        </div>
      </div>
    </details>    <details v-show="activeSection === 'autoChat'" :open="activeSection === 'autoChat'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">TA的回复</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body auto-chat-body">
        <label class="field">
          <span>联系人</span>
          <select v-model="selectedAutoContactId" class="input">
            <option v-for="contact in chatState.contacts" :key="contact.id" :value="contact.id">
              {{ contactDisplayName(contact) }}
            </option>
          </select>
        </label>
        <nav class="auto-chat-tabs">
          <button
            v-for="tab in AUTO_TABS"
            :key="tab.id"
            type="button"
            :class="{ active: activeAutoTab === tab.id }"
            @click="activeAutoTab = tab.id"
          >{{ tab.label }}</button>
        </nav>

        <div v-show="activeAutoTab === 'chat'" class="auto-chat-tab-panel">
          <nav class="auto-chat-subtabs" aria-label="聊天回复设置分类">
            <button
              v-for="tab in AUTO_CHAT_TABS"
              :key="tab.id"
              type="button"
              :class="{ active: activeAutoChatTab === tab.id }"
              @click="activeAutoChatTab = tab.id"
            >{{ tab.label }}</button>
          </nav>
          <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
            <div class="auto-chat-title">通话设置 · 对方打给我</div>
            <label class="switch-row">
              <span>允许对方打给我</span>
              <input v-model="selectedAutoSettings.callsAllowed" type="checkbox" />
            </label>
            <label class="field">
              <span>来电铃声时长（秒）</span>
              <input v-model.number="selectedAutoSettings.incomingRingSeconds" class="input" type="number" min="1" max="300" />
            </label>
            <div class="auto-chat-hint">对方打给你时生效：响满该时长你仍未接听，就自动记为未接听；你接听或拒接都会中断这个倒计时。</div>
          </section>
          <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
            <div class="auto-chat-title">通话设置 · 我打给对方</div>
            <label class="switch-row">
              <span>对方可能拒接</span>
              <input v-model="selectedAutoSettings.allowReject" type="checkbox" />
            </label>
            <ProbabilityField v-if="selectedAutoSettings.allowReject" v-model="selectedAutoSettings.rejectChance" v-model:random-value="selectedAutoSettings.rejectChanceRandom" label="拒接概率（%）" />
            <div v-if="selectedAutoSettings.allowReject" class="auto-chat-hint">设为 100% 时对方每次都拒接，设为 0% 时每次都接听。</div>
            <label class="switch-row">
              <span>无人接听自动结束</span>
              <input v-model="selectedAutoSettings.noAnswerEnd" type="checkbox" />
            </label>
            <template v-if="selectedAutoSettings.noAnswerEnd">
              <label class="field">
                <span>无人接听时长（秒）</span>
                <input v-model.number="selectedAutoSettings.noAnswerSeconds" class="input" type="number" min="1" max="300" />
              </label>
              <ProbabilityField v-model="selectedAutoSettings.noAnswerChance" v-model:random-value="selectedAutoSettings.noAnswerChanceRandom" label="无人接听概率（%）" />
              <div class="auto-chat-hint">联系人在「无人接听时长」内未接电话的概率。命中时到点记为未接听；未命中则正常接通。</div>
            </template>
          </section>

          <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
            <div class="auto-chat-title">通话设置 · 通话中</div>
            <label class="switch-row">
              <span>禁止联系人主动挂断</span>
              <input v-model="selectedAutoSettings.forbidContactHangup" type="checkbox" />
            </label>
            <ProbabilityField v-if="!selectedAutoSettings.forbidContactHangup" v-model="selectedAutoSettings.contactHangupChance" v-model:random-value="selectedAutoSettings.contactHangupChanceRandom" label="主动挂断概率（%）" />
            <div class="auto-chat-hint">接通后，联系人按该概率在随机时刻主动挂断（不设固定时间）。开启「禁止联系人主动挂断」后该概率失效，联系人永不主动挂断，只能由你结束通话。</div>
          </section>        <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
          <div class="auto-chat-title">回复延迟 · {{ chatState.contacts.find((contact) => contact.id === selectedAutoContactId)?.note || 'TA' }}</div>
          <div class="interval-grid">
            <label>
              <span>最少延迟（秒）</span>
              <input v-model.number="selectedAutoSettings.replyDelayMinSeconds" type="number" step="1" @change="normalizeSelectedReplyDelay('min')" />
            </label>
            <label>
              <span>最多延迟（秒）</span>
              <input v-model.number="selectedAutoSettings.replyDelayMaxSeconds" type="number" step="1" @change="normalizeSelectedReplyDelay('max')" />
            </label>
          </div>
          <div class="auto-chat-hint">只影响当前选中的联系人。不设最长等待限制，可填写任意秒数；0 秒表示立即回复。</div>
          <div class="auto-chat-title">每次回复消息条数</div>
          <div class="interval-grid">
            <label>
              <span>最少消息条数</span>
              <input v-model.number="selectedAutoSettings.replyMessageMin" type="number" min="1" max="10" @change="clampSelectedRange('replyMessageMin', 'replyMessageMax', 'min', 1, 10)" />
            </label>
            <label>
              <span>最多消息条数</span>
              <input v-model.number="selectedAutoSettings.replyMessageMax" type="number" min="1" max="10" @change="clampSelectedRange('replyMessageMin', 'replyMessageMax', 'max', 1, 10)" />
            </label>
          </div>
          <div class="auto-chat-hint">只控制本次回复会发几条独立消息，不控制每条消息里包含几张字卡。字卡张数请在“拼词造句”中设置。</div>
        </section>

        <section v-show="activeAutoChatTab === 'craft'" class="auto-chat-section">
          <div class="auto-chat-title">每条消息使用多字卡回复</div>
          <label class="switch-row">
            <span>启用多字卡回复</span>
            <input v-model="selectedAutoSettings.multiCardEnabled" type="checkbox" />
          </label>
          <div v-if="selectedAutoSettings.multiCardEnabled" class="interval-grid probability-grid">
            <ProbabilityField v-model="selectedAutoSettings.multiCardChance" v-model:random-value="selectedAutoSettings.multiCardChanceRandom" label="触发概率（%）" />
            <div class="metric-preview">
              <span>当前触发概率</span>
              <strong>{{ selectedAutoSettings.multiCardChance }}%</strong>
            </div>
          </div>
          <div v-if="selectedAutoSettings.multiCardEnabled" class="interval-grid">
            <label>
              <span>每条消息最少张数</span>
              <input v-model.number="selectedAutoSettings.multiCardMin" type="number" min="1" max="10" @change="clampSelectedRange('multiCardMin', 'multiCardMax', 'min', 1, 10)" />
            </label>
            <label>
              <span>每条消息最多张数</span>
              <input v-model.number="selectedAutoSettings.multiCardMax" type="number" min="1" max="10" @change="clampSelectedRange('multiCardMin', 'multiCardMax', 'max', 1, 10)" />
            </label>
          </div>
          <div v-if="selectedAutoSettings.multiCardEnabled" class="range-preview">每条消息：{{ selectedAutoSettings.multiCardMin }}～{{ selectedAutoSettings.multiCardMax }} 张字卡</div>
          <div class="auto-chat-hint">关闭后每条消息只包含一张字卡。开启后，每条消息会在当前张数范围内抽取多张字卡，并用空格合并成一条消息；消息条数由“回复与主动”单独决定。</div>
        </section>

        <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
          <div class="auto-chat-title">主动消息时间</div>
          <label class="switch-row">
            <span>开启主动消息</span>
            <input v-model="settings.proactiveEnabled" type="checkbox" />
          </label>
          <label class="switch-row">
            <span>随机时间间隔</span>
            <input v-model="settings.randomInterval" type="checkbox" />
          </label>
          <div class="interval-grid" :class="{ disabled: settings.randomInterval }">
            <label>
              <span>最短间隔（分钟）</span>
              <input v-model.number="settings.minInterval" type="number" min="1" max="1440" :disabled="settings.randomInterval" @change="clampInterval('minInterval')" />
            </label>
            <label>
              <span>最长间隔（分钟）</span>
              <input v-model.number="settings.maxInterval" type="number" min="1" max="1440" :disabled="settings.randomInterval" @change="clampInterval('maxInterval')" />
            </label>
          </div>
          <div class="auto-chat-hint">TA 后台主动给你发消息的时间间隔。时间单位为分钟。</div>
          <div class="interval-grid">
            <label>
              <span>每次发送最少条数</span>
              <input v-model.number="selectedAutoSettings.proactiveMessageMin" type="number" min="1" max="10" @change="clampSelectedRange('proactiveMessageMin', 'proactiveMessageMax', 'min', 1, 10)" />
            </label>
            <label>
              <span>每次发送最多条数</span>
              <input v-model.number="selectedAutoSettings.proactiveMessageMax" type="number" min="1" max="10" @change="clampSelectedRange('proactiveMessageMin', 'proactiveMessageMax', 'max', 1, 10)" />
            </label>
          </div>
          <div class="auto-chat-hint">主动消息一次可以连续发送 1～10 条，设为 1～1 时只发一条。</div>
          <div class="status-line">{{ intervalSummary }}</div>
        </section>

        <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
          <div class="auto-chat-title">输入提示语</div>
          <div class="typing-preset-row">
            <button
              v-for="preset in typingIndicatorPresets"
              :key="preset"
              type="button"
              :class="{ active: settings.typingIndicatorText === preset }"
              @click="settings.typingIndicatorText = preset"
            >
              {{ preset }}
            </button>
          </div>
          <label class="field">
            <span>显示文字</span>
            <input v-model="settings.typingIndicatorText" class="input" type="text" maxlength="20" placeholder="可直接输入自定义提示语" />
          </label>
          <label class="switch-row">
            <span>回车键用来换行</span>
            <input v-model="settings.enterForNewline" type="checkbox" />
          </label>
          <div class="auto-chat-hint">聊天时“对方正在…”状态显示的文字，默认是“正在挑选字卡”。</div>
          <div class="auto-chat-hint">开关关闭时按回车发送消息；开启后按回车换行，可使用 Ctrl + Enter 发送。</div>
        </section>

        <section v-show="activeAutoChatTab === 'cards'" class="auto-chat-section">
          <div class="auto-chat-title">音频字卡概率</div>
          <div class="interval-grid">
            <label>
              <span>音频权重</span>
              <input v-model.number="settings.audioCardWeight" type="number" min="1" max="99" @change="clampAutoValue('audioCardWeight', 1, 99, 5)" />
            </label>
            <ProbabilityField v-model="settings.audioGuaranteeChance" v-model:random-value="settings.audioGuaranteeChanceRandom" label="保底概率（%）" />
          </div>
          <div class="auto-chat-hint">每条音频相当于 N 张文字卡的抽中机会；保底概率表示无论文字卡有多少，音频至少有这么大的概率被抽中。</div>
        </section>

        <section v-show="activeAutoChatTab === 'cards'" class="auto-chat-section">
          <div class="auto-chat-title">主动推歌概率</div>
          <div class="interval-grid probability-grid">
            <ProbabilityField v-model="settings.songChance" v-model:random-value="settings.songChanceRandom" label="推歌概率（%）" />
            <div class="metric-preview">
              <span>当前推歌概率</span>
              <strong>{{ settings.songChance }}%</strong>
            </div>
          </div>
          <div class="auto-chat-hint">角色在主动消息中推荐歌曲的概率。</div>
        </section>

        <section v-show="activeAutoChatTab === 'reply'" class="auto-chat-section">
          <div class="auto-chat-title">已读不回与回复概率</div>
          <div class="interval-grid probability-grid">
            <ProbabilityField v-model="selectedAutoSettings.noReplyChance" v-model:random-value="selectedAutoSettings.noReplyChanceRandom" label="已读不回概率（%）" />
            <div class="metric-preview">
              <span>本次只显示已读</span>
              <strong>{{ selectedAutoSettings.noReplyChance }}%</strong>
            </div>
          </div>
          <div class="auto-chat-hint">命中后本次不再生成回复；用户主动发消息仍会正常写入聊天记录。</div>
        </section>

        <section v-show="activeAutoChatTab === 'cards'" class="auto-chat-section">
          <div class="auto-chat-title">回复内容概率</div>
          <div class="interval-grid">
            <ProbabilityField v-model="selectedAutoSettings.touchChance" v-model:random-value="selectedAutoSettings.touchChanceRandom" label="拍一拍概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.stickerChance" v-model:random-value="selectedAutoSettings.stickerChanceRandom" label="表情包概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.photoChance" v-model:random-value="selectedAutoSettings.photoChanceRandom" label="图片概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.emojiChance" v-model:random-value="selectedAutoSettings.emojiChanceRandom" label="emoji 概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.kaomojiChance" v-model:random-value="selectedAutoSettings.kaomojiChanceRandom" label="颜文字概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.quoteChance" v-model:random-value="selectedAutoSettings.quoteChanceRandom" label="引用概率（%）" />
          </div>
          <div class="auto-chat-hint">优先检查拍一拍、表情包和图片；文本回复会按概率附加 emoji、颜文字或引用。概率设为 0 即完全关闭。</div>
        </section>

        <section v-show="activeAutoChatTab === 'cards'" class="auto-chat-section">
          <div class="auto-chat-title">系统预设与自定义字卡</div>
          <div class="interval-grid probability-grid"><ProbabilityField v-model="selectedAutoSettings.customCardChance" v-model:random-value="selectedAutoSettings.customCardChanceRandom" label="自定义字卡概率（%）" /><ProbabilityField v-model="selectedAutoSettings.systemCardChance" v-model:random-value="selectedAutoSettings.systemCardChanceRandom" label="系统预设字卡概率（%）" /></div>
          <div class="auto-chat-hint">命中时从系统预设“主字卡”分类抽卡；未命中时继续使用当前联系人的自定义字卡。</div>
        </section>

        <section v-show="activeAutoChatTab === 'cards'" class="auto-chat-section">
          <div class="auto-chat-title">主动互动概率</div>
          <div class="interval-grid">
            <ProbabilityField v-model="selectedAutoSettings.proactiveMessageChance" v-model:random-value="selectedAutoSettings.proactiveMessageChanceRandom" label="主动消息（%）" />
            <ProbabilityField v-model="selectedAutoSettings.proactiveGiftChance" v-model:random-value="selectedAutoSettings.proactiveGiftChanceRandom" label="礼物（%）" />
            <ProbabilityField v-model="selectedAutoSettings.proactiveTransferChance" v-model:random-value="selectedAutoSettings.proactiveTransferChanceRandom" label="转账（%）" />
            <ProbabilityField v-model="selectedAutoSettings.proactiveLocationChance" v-model:random-value="selectedAutoSettings.proactiveLocationChanceRandom" label="位置（%）" />
            <ProbabilityField v-model="selectedAutoSettings.proactiveNudgeChance" v-model:random-value="selectedAutoSettings.proactiveNudgeChanceRandom" label="拍一拍（%）" />
            <ProbabilityField v-model="selectedAutoSettings.proactiveCallChance" v-model:random-value="selectedAutoSettings.proactiveCallChanceRandom" label="电话（%）" />
          </div>
          <div class="auto-chat-hint">到主动消息时间后，按这些概率决定本次主动行为；全部未命中时默认发送字卡。</div>
        </section>

        <section v-show="activeAutoChatTab === 'craft'" class="auto-chat-section">
          <div class="auto-chat-title">词典拼字 · 聊天</div>
          <label class="switch-row">
            <span>聊天使用词典拼字</span>
            <input v-model="selectedAutoSettings.dictionaryEnabled" type="checkbox" />
          </label>
          <div v-if="selectedAutoSettings.dictionaryEnabled" class="interval-grid probability-grid">
            <ProbabilityField v-model="selectedAutoSettings.dictionaryChance" v-model:random-value="selectedAutoSettings.dictionaryChanceRandom" label="拼字概率（%）" />
            <div class="metric-preview"><span>命中时从词典语录抽卡</span><strong>{{ selectedAutoSettings.dictionaryChance }}%</strong></div>
          </div>
          <div v-if="selectedAutoSettings.dictionaryEnabled" class="interval-grid">
            <label><span>最少张数</span><input v-model.number="selectedAutoSettings.dictionaryMin" type="number" min="2" max="10" @change="clampSelectedRange('dictionaryMin', 'dictionaryMax', 'min', 2, 10)" /></label>
            <label><span>最多张数</span><input v-model.number="selectedAutoSettings.dictionaryMax" type="number" min="2" max="10" @change="clampSelectedRange('dictionaryMin', 'dictionaryMax', 'max', 2, 10)" /></label>
          </div>
<label v-if="selectedAutoSettings.dictionaryEnabled" class="switch-row">
            <span>逐张分条发送</span>
            <input type="checkbox" :checked="selectedAutoSettings.dictionaryMulti" @change="setDictionarySendMode($event.target.checked ? 'multi' : 'single')" />
          </label>
          <label v-if="selectedAutoSettings.dictionaryEnabled" class="switch-row">
            <span>单气泡拼接</span>
            <input type="checkbox" :checked="selectedAutoSettings.dictionarySingleBubble" @change="setDictionarySendMode($event.target.checked ? 'single' : 'multi')" />
          </label>
          <label v-if="selectedAutoSettings.dictionaryEnabled && selectedAutoSettings.dictionarySingleBubble" class="field">
            <span>单气泡拼接方式</span>
            <select v-model="selectedAutoSettings.multiCardJoin" class="input">
              <option value="space">空格</option>
              <option value="comma">逗号</option>
              <option value="semicolon">分号“；”</option>
              <option value="none">直接连接</option>
            </select>
          </label>
          <div class="auto-chat-hint">逐张分条发送＝每张字卡分别发送一条消息；单气泡拼接＝所有抽中的字卡合并成一条消息。</div>
        </section>
        </div>
        <div v-show="activeAutoTab === 'group'" class="auto-chat-tab-panel">
          <section class="auto-chat-section">
            <div class="auto-chat-title">被动回复（群聊）</div>
            <div class="interval-grid probability-grid">
              <ProbabilityField v-model="selectedAutoSettings.groupReplyChance" v-model:random-value="selectedAutoSettings.groupReplyChanceRandom" label="每位成员回复概率（%）" />
              <div class="metric-preview"><span>命中后随机成员回复</span><strong>{{ selectedAutoSettings.groupReplyChance }}%</strong></div>
            </div>
            <div class="interval-grid">
              <label><span>最少回复条数</span><input v-model.number="selectedAutoSettings.groupReplyCardMin" type="number" min="1" max="10" @change="clampSelectedRange('groupReplyCardMin', 'groupReplyCardMax', 'min', 1, 10)" /></label>
              <label><span>最多回复条数</span><input v-model.number="selectedAutoSettings.groupReplyCardMax" type="number" min="1" max="10" @change="clampSelectedRange('groupReplyCardMin', 'groupReplyCardMax', 'max', 1, 10)" /></label>
            </div>
            <div class="auto-chat-hint">你发送群消息后，随机抽取一名群成员，并按该成员自己的回复概率和条数范围决定是否回复。</div>
          </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">词典拼字 · 群聊</div>
            <label class="switch-row">
              <span>群聊使用词典拼字</span>
              <input v-model="selectedAutoSettings.groupDictionaryEnabled" type="checkbox" />
            </label>
            <div class="auto-chat-hint">只影响群聊回复，不受聊天、信箱等其它词典开关影响。</div>
          </section>
        </div>

        <div v-show="activeAutoTab === 'moments'" class="auto-chat-tab-panel">
          <section class="auto-chat-section">
            <div class="auto-chat-title">朋友圈行为 · 发帖</div>
            <label class="switch-row"><span>指定时间点发帖</span><input v-model="selectedAutoSettings.momentsScheduledEnabled" type="checkbox" /></label>
            <label v-if="selectedAutoSettings.momentsScheduledEnabled" class="field"><span>发帖时间</span><input v-model="selectedAutoSettings.momentsScheduledTime" class="input" type="time" /></label>
            <div class="interval-grid"><label><span>最少字卡数</span><input v-model.number="selectedAutoSettings.momentsCardMin" type="number" min="1" max="25" /></label><label><span>最多字卡数</span><input v-model.number="selectedAutoSettings.momentsCardMax" type="number" min="1" max="25" /></label></div>
            <div class="auto-chat-hint">默认 8～10 张字卡，多张字卡之间使用“；”连接；相同数字表示固定张数。</div>
          </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">朋友圈行为 · 互动延迟</div>
            <div class="interval-grid delay-grid"><label><span>点赞延迟</span><input v-model.number="selectedAutoSettings.momentsLikeDelay" type="number" min="0" /><select v-model="selectedAutoSettings.momentsLikeUnit"><option value="seconds">秒</option><option value="minutes">分钟</option><option value="hours">小时</option></select></label><label><span>评论延迟</span><input v-model.number="selectedAutoSettings.momentsCommentDelay" type="number" min="0" /><select v-model="selectedAutoSettings.momentsCommentUnit"><option value="seconds">秒</option><option value="minutes">分钟</option><option value="hours">小时</option></select></label></div>
          </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">朋友圈行为 · 回复与收藏</div>
            <label class="switch-row"><span>回复我对 TA 的评论</span><input v-model="selectedAutoSettings.momentsReplyMyComment" type="checkbox" /></label>
            <div v-if="selectedAutoSettings.momentsReplyMyComment" class="interval-grid delay-grid"><label><span>回复延迟</span><input v-model.number="selectedAutoSettings.momentsReplyDelay" type="number" min="0" /><select v-model="selectedAutoSettings.momentsReplyUnit"><option value="seconds">秒</option><option value="minutes">分钟</option><option value="hours">小时</option></select></label></div>
            <label class="switch-row"><span>联系人收藏用户帖子</span><input v-model="selectedAutoSettings.momentsFavoriteEnabled" type="checkbox" /></label>
            <ProbabilityField v-if="selectedAutoSettings.momentsFavoriteEnabled" v-model="selectedAutoSettings.momentsFavoriteChance" v-model:random-value="selectedAutoSettings.momentsFavoriteRandom" label="收藏概率（%）" />
            <label class="switch-row"><span>随机收藏</span><input v-model="selectedAutoSettings.momentsFavoriteRandom" type="checkbox" /></label>
          </section>

        <section class="auto-chat-section">
          <div class="auto-chat-title">朋友圈发布</div>
          <label class="switch-row">
            <span>开启朋友圈发布</span>
            <input v-model="settings.momentsAutoPublishEnabled" type="checkbox" />
          </label>
          <div class="interval-grid">
            <label>
              <span>最短间隔（分钟）</span>
              <input v-model.number="settings.momentsMinInterval" type="number" min="1" max="1440" @change="clampAutoValue('momentsMinInterval', 1, 1440, 60)" />
            </label>
            <label>
              <span>最长间隔（分钟）</span>
              <input v-model.number="settings.momentsMaxInterval" type="number" min="1" max="1440" @change="clampAutoValue('momentsMaxInterval', 1, 1440, 120)" />
            </label>
          </div>
          <div class="interval-grid probability-grid">
            <ProbabilityField v-model="settings.momentsPublishChance" v-model:random-value="settings.momentsPublishChanceRandom" label="发布概率（%）" />
            <div class="metric-preview">
              <span>当前发布概率</span>
              <strong>{{ settings.momentsPublishChance }}%</strong>
            </div>
          </div>
          <div class="auto-chat-hint">TA 自动发布朋友圈的时间间隔；每次到达间隔后，按上方概率决定是否发布。</div>
        </section>

        <section class="auto-chat-section">
          <div class="auto-chat-title">朋友圈互动概率</div>
          <div class="interval-grid">
            <ProbabilityField v-model="selectedAutoSettings.momentsLikeChance" v-model:random-value="selectedAutoSettings.momentsLikeChanceRandom" label="点赞概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.momentsCommentChance" v-model:random-value="selectedAutoSettings.momentsCommentChanceRandom" label="评论概率（%）" />
            <ProbabilityField v-model="selectedAutoSettings.momentsReplyChance" v-model:random-value="selectedAutoSettings.momentsReplyChanceRandom" label="回复我的评论概率（%）" />
          </div>
          <div class="auto-chat-hint">你发布朋友圈后分别判定点赞和评论；你回复联系人评论后，再按回复概率继续回复。</div>
        </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">词典拼字 · 朋友圈</div>
            <label class="switch-row">
              <span>朋友圈使用词典拼字</span>
              <input v-model="selectedAutoSettings.momentsDictionaryEnabled" type="checkbox" />
            </label>
            <div class="auto-chat-hint">只影响联系人发布的朋友圈正文和评论，不被其它词典开关同步。</div>
          </section>
        </div>

        <div v-show="activeAutoTab === 'mailbox'" class="auto-chat-tab-panel">
          <section class="auto-chat-section">
            <div class="auto-chat-title">信件内容</div>
            <div class="interval-grid">
              <label><span>最少字卡条数</span><input v-model.number="selectedAutoSettings.letterCardMin" type="number" min="1" max="50" @change="clampSelectedRange('letterCardMin', 'letterCardMax', 'min', 1, 50)" /></label>
              <label><span>最多字卡条数</span><input v-model.number="selectedAutoSettings.letterCardMax" type="number" min="1" max="50" @change="clampSelectedRange('letterCardMin', 'letterCardMax', 'max', 1, 50)" /></label>
            </div>
            <div class="auto-chat-hint">每封信从联系人字卡库中随机抽取该范围内的字卡，并使用“；”连接。</div>
          </section>

        <section class="auto-chat-section">
          <div class="auto-chat-title">主动来信</div>
          <label class="switch-row">
            <span>开启主动来信</span>
            <input v-model="settings.proactiveLettersEnabled" type="checkbox" />
          </label>
          <div class="interval-grid probability-grid">
            <ProbabilityField v-model="selectedAutoSettings.letterWriteChance" v-model:random-value="selectedAutoSettings.letterWriteChanceRandom" label="主动写信概率（%）" />
            <div class="metric-preview"><span>到达间隔后判定</span><strong>{{ selectedAutoSettings.letterWriteChance }}%</strong></div>
          </div>
          <div class="interval-grid">
            <label>
              <span>最短间隔（分钟）</span>
              <input v-model.number="settings.letterMinInterval" type="number" min="1" max="1440" @change="clampAutoValue('letterMinInterval', 1, 1440, 120)" />
            </label>
            <label>
              <span>最长间隔（分钟）</span>
              <input v-model.number="settings.letterMaxInterval" type="number" min="1" max="1440" @change="clampAutoValue('letterMaxInterval', 1, 1440, 360)" />
            </label>
          </div>
          <div class="auto-chat-hint">TA 主动给你寄信的时间间隔。</div>
        </section>

        <section class="auto-chat-section">
          <div class="auto-chat-title">回信设置</div>
          <div class="interval-grid probability-grid">
            <ProbabilityField v-model="selectedAutoSettings.letterReplyChance" v-model:random-value="selectedAutoSettings.letterReplyChanceRandom" label="回信概率（%）" />
            <div class="metric-preview"><span>收到你的信后判定</span><strong>{{ selectedAutoSettings.letterReplyChance }}%</strong></div>
          </div>
          <div class="interval-grid">
            <label>
              <span>最快回复（分钟）</span>
              <input v-model.number="settings.letterReplyMin" type="number" min="1" max="1440" @change="clampAutoValue('letterReplyMin', 1, 1440, 1)" />
            </label>
            <label>
              <span>最慢回复（分钟）</span>
              <input v-model.number="settings.letterReplyMax" type="number" min="1" max="1440" @change="clampAutoValue('letterReplyMax', 1, 1440, 3)" />
            </label>
          </div>
          <div class="auto-chat-hint">收到你的信后，TA 回复的时间范围。</div>
        </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">词典拼字 · 信箱</div>
            <label class="switch-row">
              <span>信箱使用词典拼字</span>
              <input v-model="selectedAutoSettings.letterDictionaryEnabled" type="checkbox" />
            </label>
            <div class="auto-chat-hint">只影响联系人主动来信和回信内容，与聊天词典开关互不联动。</div>
          </section>
        </div>

        <div v-show="activeAutoTab === 'other'" class="auto-chat-tab-panel">
          <section class="auto-chat-section">
            <div class="auto-chat-title">词典拼字 · 其他</div>
            <label class="switch-row">
              <span>其他 APP 使用词典拼字</span>
              <input v-model="selectedAutoSettings.otherDictionaryEnabled" type="checkbox" />
            </label>
            <div class="auto-chat-hint">目前用于日记 APP 的留言和情话内容；与聊天、群聊、信箱、朋友圈独立。</div>
          </section>
          <section class="auto-chat-section">
            <div class="auto-chat-title">日记 APP</div>
            <label class="switch-row">
              <span>心情日记</span>
              <input v-model="selectedAutoSettings.diaryEnabled" type="checkbox" />
            </label>
            <div class="auto-chat-hint">总开关。关闭后，该联系人不会再生成或写入日历中的日记内容。</div>
            <label class="switch-row" :class="{ disabled: !selectedAutoSettings.diaryEnabled }">
              <span>留言</span>
              <input v-model="selectedAutoSettings.diaryMessageEnabled" type="checkbox" :disabled="!selectedAutoSettings.diaryEnabled" />
            </label>
            <div v-if="selectedAutoSettings.diaryEnabled && selectedAutoSettings.diaryMessageEnabled" class="diary-card-range">
              <div class="interval-grid">
                <label>
                  <span>最少字卡</span>
                  <input v-model.number="selectedAutoSettings.diaryMessageCardMin" type="number" min="1" max="20" @change="clampDiaryCardRange('diaryMessage', 'min')" />
                </label>
                <label>
                  <span>最多字卡</span>
                  <input v-model.number="selectedAutoSettings.diaryMessageCardMax" type="number" min="1" max="20" @change="clampDiaryCardRange('diaryMessage', 'max')" />
                </label>
              </div>
              <div class="range-preview">当前留言范围：{{ selectedAutoSettings.diaryMessageCardMin }}～{{ selectedAutoSettings.diaryMessageCardMax }} 张字卡</div>
            </div>
            <label class="switch-row" :class="{ disabled: !selectedAutoSettings.diaryEnabled }">
              <span>情话</span>
              <input v-model="selectedAutoSettings.diaryQuoteEnabled" type="checkbox" :disabled="!selectedAutoSettings.diaryEnabled" />
            </label>
            <div v-if="selectedAutoSettings.diaryEnabled && selectedAutoSettings.diaryQuoteEnabled" class="diary-card-range">
              <div class="interval-grid">
                <label>
                  <span>最少字卡</span>
                  <input v-model.number="selectedAutoSettings.diaryQuoteCardMin" type="number" min="1" max="20" @change="clampDiaryCardRange('diaryQuote', 'min')" />
                </label>
                <label>
                  <span>最多字卡</span>
                  <input v-model.number="selectedAutoSettings.diaryQuoteCardMax" type="number" min="1" max="20" @change="clampDiaryCardRange('diaryQuote', 'max')" />
                </label>
              </div>
              <div class="range-preview">当前情话范围：{{ selectedAutoSettings.diaryQuoteCardMin }}～{{ selectedAutoSettings.diaryQuoteCardMax }} 张字卡</div>
            </div>
            <label class="switch-row" :class="{ disabled: !selectedAutoSettings.diaryEnabled }">
              <span>心情</span>
              <input v-model="selectedAutoSettings.diaryMoodEnabled" type="checkbox" :disabled="!selectedAutoSettings.diaryEnabled" />
            </label>
            <div class="diary-custom-moods">
              <div class="diary-custom-mood-input">
                <input v-model="customMoodInput" type="text" maxlength="16" placeholder="添加自定义心情" @keydown.enter.prevent="addCustomDiaryMood" />
                <button type="button" @click="addCustomDiaryMood">添加</button>
              </div>
              <div v-if="settings.customDiaryMoods?.length" class="diary-mood-chips">
                <span v-for="(mood, index) in settings.customDiaryMoods" :key="mood">
                  {{ mood }}<button type="button" aria-label="删除心情" @click="removeCustomDiaryMood(index)">×</button>
                </span>
              </div>
            </div>
            <div class="auto-chat-hint">心情会从内置选项和自定义选项中随机选择；留言和情话会从字卡库中抽取。关闭总开关时，这三个选项暂不生效。</div>
          </section>
        </div>      </div>
    </details>

    <details v-show="activeSection === 'chatTools'" :open="activeSection === 'chatTools'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">聊天工具</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body chat-tool-settings-body">
        <div class="chat-tool-settings-head">
          <div>
            <strong>聊天工具栏</strong>
            <span>已开启 {{ chatToolEnabledCount }} / {{ CHAT_TOOL_CATALOG.length }} 个工具</span>
          </div>
          <button class="small-button primary" type="button" @click="saveChatToolSettings">保存</button>
        </div>
        <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>

        <nav class="auto-chat-subtabs" aria-label="聊天工具设置分类">
          <button
            v-for="tab in CHAT_TOOL_SETTINGS_TABS"
            :key="tab.id"
            type="button"
            :class="{ active: activeChatToolSettingsTab === tab.id }"
            @click="activeChatToolSettingsTab = tab.id"
          >{{ tab.label }}</button>
        </nav>

        <section v-show="activeChatToolSettingsTab === 'switches'" class="auto-chat-section">
          <div class="auto-chat-title">工具开关</div>
          <p class="auto-chat-hint">关闭后的工具会立即从聊天输入框下方的工具栏隐藏，但不会删除已经产生的聊天消息或历史记录。</p>
          <div v-for="group in chatToolSettingsGroups" :key="group.label" class="chat-tool-setting-group">
            <div class="chat-tool-setting-category">{{ group.label }}</div>
            <label
              v-for="tool in group.tools"
              :key="tool.id"
              class="chat-tool-setting-row"
              :class="{ disabled: settings.chatTools.enabled[tool.id] === false }"
            >
              <span class="chat-tool-setting-icon"><LineGlyph :type="tool.icon" /></span>
              <span class="chat-tool-setting-copy">
                <strong>{{ tool.label }}</strong>
                <small>{{ tool.description }}</small>
              </span>
              <input v-model="settings.chatTools.enabled[tool.id]" type="checkbox" />
            </label>
          </div>
        </section>

        <section v-show="activeChatToolSettingsTab === 'params'" class="auto-chat-section">
          <div class="auto-chat-title">默认参数</div>
          <div class="interval-grid">
            <label><span>帮我决定 · 默认等待秒数</span><input v-model.number="settings.chatTools.decisionDefaultSeconds" type="number" min="1" max="10" /></label>
            <label><span>帮我决定 · 默认抽取结果数</span><input v-model.number="settings.chatTools.decisionDefaultCount" type="number" min="1" max="10" /></label>
            <label><span>帮我决定 · 历史保留条数</span><input v-model.number="settings.chatTools.decisionHistoryLimit" type="number" min="10" max="200" /></label>
            <label><span>搜索记录 · 最多显示条数</span><input v-model.number="settings.chatTools.searchResultLimit" type="number" min="10" max="200" /></label>
          </div>
          <div class="chat-tool-action-row">
            <button class="small-button" type="button" @click="clearChatToolHistory">清空工具历史</button>
            <button class="small-button danger-button" type="button" @click="resetChatToolSettings">恢复全部默认</button>
          </div>
        </section>

        <section v-show="activeChatToolSettingsTab === 'params'" class="auto-chat-section">
          <div class="auto-chat-title">工具逻辑说明</div>
          <ul class="chat-tool-notes">
            <li>工具栏每页显示 8 个工具，按 4 列 × 2 行排列，可左右滑动查看更多。</li>
            <li>「发多条」会先预存消息，只有最后一条发送完成后才触发联系人回复。</li>
            <li>「搜索记录」只查当前聊天，可按关键词、开始日期和结束日期组合筛选。</li>
            <li>「帮我决定」会等待设定秒数后随机抽取结果，可以先预览，再决定是否发送到聊天。</li>
            <li>所有开关与参数保存后立即生效，不需要刷新页面。</li>
          </ul>
        </section>
      </div>
    </details>
    <details v-show="activeSection === 'ai'" :open="activeSection === 'ai'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">AI接入</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="switch-row">
          <span>启用 AI 解读</span>
          <input v-model="settings.ai.enabled" type="checkbox" />
        </label>
        <div class="auto-chat-hint">AI 只根据「我的 → TA 的相关 → 身世」中的角色背景，以角色口吻解读消息、信件或朋友圈；不会修改原文、字卡抽取概率或自动回复概率。</div>

        <label class="field">
          <span>智能体类型</span>
          <select v-model="settings.ai.provider" class="input" @change="applyAiProviderPreset">
            <option v-for="provider in AI_PROVIDERS" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
        </label>
        <label class="field">
          <span>接口地址</span>
          <input v-model="settings.ai.endpoint" class="input" type="url" placeholder="https://example.com/v1/chat/completions" />
        </label>
        <label class="field">
          <span>模型名称</span>
          <input v-model="settings.ai.model" class="input" type="text" placeholder="模型名称" />
        </label>
        <label class="field">
          <span>API Key</span>
          <input v-model="settings.ai.apiKey" class="input" type="password" autocomplete="off" placeholder="只保存在本机浏览器" />
        </label>
        <label class="field">
          <span>认证方式</span>
          <select v-model="settings.ai.authMode" class="input">
            <option value="bearer">Authorization: Bearer</option>
            <option value="api-key">api-key 请求头</option>
          </select>
        </label>
        <div class="interval-grid">
          <label><span>温度</span><input v-model.number="settings.ai.temperature" type="number" min="0" max="2" step="0.1" /></label>
          <label><span>最大输出 Token</span><input v-model.number="settings.ai.maxTokens" type="number" min="50" max="4000" step="50" /></label>
        </div>

        <div class="auto-chat-title">使用位置</div>
        <label class="switch-row"><span>聊天消息「解读」</span><input v-model="settings.ai.useChatInterpret" type="checkbox" /></label>
        <label class="switch-row"><span>信箱信件「AI解读」</span><input v-model="settings.ai.useMailInterpret" type="checkbox" /></label>
        <label class="switch-row"><span>朋友圈帖子「AI解读」</span><input v-model="settings.ai.useMomentsInterpret" type="checkbox" /></label>

        <label class="field">
          <span>补充角色口吻要求</span>
          <textarea v-model="settings.ai.rolePrompt" class="input" rows="3" maxlength="1000" placeholder="可选，例如：语气温柔克制，句子简短"></textarea>
        </label>
        <div class="auto-chat-hint">接口需兼容 OpenAI Chat Completions 的 `messages` 请求格式。API Key 会随本地设置保存，请勿在公共设备上填写。</div>
        <div class="chat-tool-action-row">
          <button class="small-button" type="button" :disabled="aiTesting" @click="testAiConnection">{{ aiTesting ? '正在连接…' : '测试连接' }}</button>
          <button class="small-button primary" type="button" @click="saveAiSettings">保存 AI 设置</button>
        </div>
        <div v-if="aiTestResult" class="status-line success">{{ aiTestResult }}</div>
        <div v-if="aiTestError" class="error-line">{{ aiTestError }}</div>
        <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
      </div>
    </details>
    <details v-show="activeSection === 'notifications'" :open="activeSection === 'notifications'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">通知</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="switch-row">
          <span>站内消息提示</span>
          <input v-model="settings.inAppNotifications" type="checkbox" />
        </label>
        <label class="switch-row" :class="{ disabled: !settings.inAppNotifications }">
          <span>聊天通知</span>
          <input v-model="settings.chatNotifications" type="checkbox" :disabled="!settings.inAppNotifications" />
        </label>
        <label class="switch-row" :class="{ disabled: !settings.inAppNotifications }">
          <span>信箱通知</span>
          <input v-model="settings.mailboxNotifications" type="checkbox" :disabled="!settings.inAppNotifications" />
        </label>
        <label class="switch-row" :class="{ disabled: !settings.inAppNotifications }">
          <span>朋友圈通知</span>
          <input v-model="settings.momentsNotifications" type="checkbox" :disabled="!settings.inAppNotifications" />
        </label>
        <button class="action" type="button" :disabled="!notificationSupported() || permission === 'granted'" @click="enableBrowserNotifications">
          {{ permissionLabel }}
        </button>
        <template v-if="isNativeShell">
          <button class="action" type="button" @click="requestNativeAppPermissions">申请系统权限（通知、照片与文件访问）</button>
          <button class="action" type="button" @click="openBatteryOptimizationSettings">允许后台持续运行</button>
          <div class="auto-chat-hint">套壳 App 版本：{{ nativeShellVersion || '争渡 Android' }}。文件上传使用系统文件选择器，备份文件会保存到手机“下载”目录。</div>
        </template>
        <div class="auto-chat-hint" style="margin-top:12px">开启后台保活后，套壳 App 会使用前台服务、静音播放和唤醒锁维持网页定时器运行；仍建议在系统设置中允许后台持续运行。</div>
        <label class="switch-row">
          <span>后台保活（静音音频）</span>
          <input v-model="settings.keepAliveEnabled" type="checkbox" />
        </label>
        <div class="auto-chat-hint">开启后循环播放一段无声静音，让系统保持网页活跃；仅在套壳 APP 需要，普通浏览器无需开启。</div>
      </div>
    </details>

    <details v-show="activeSection === 'viewMode'" :open="activeSection === 'viewMode'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">查看模式</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <button class="action" type="button" @click="toggleView">
          {{ store.view === 'phone' ? '当前：手机端结构（点击切换电脑网站视图）' : '当前：电脑网站视图（点击切换手机端结构）' }}
        </button>
      </div>
    </details>

    <details v-show="activeSection === 'icons'" :open="activeSection === 'icons'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">图标</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <label class="field">
          <span>成套主题</span>
          <select v-model="settings.appIconTheme" class="input">
            <option v-for="theme in appIconThemeOptions" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
        </label>
        <div v-if="selectedCustomIconTheme" class="custom-icon-theme-editor">
          <label class="field">
            <span>主题名称</span>
            <input v-model="selectedCustomIconTheme.name" class="input" type="text" maxlength="30" />
          </label>
          <div class="image-actions">
            <button class="small-button primary" type="button" @click="saveIconThemeSettings">保存主题</button>
            <button class="small-button" type="button" @click="deleteCustomIconTheme">删除主题</button>
          </div>
        </div>
        <div class="image-actions">
          <button class="small-button" type="button" @click="createCustomIconTheme">新增自定义图标主题</button>
        </div>

        <p class="app-icon-intro">选择成套图标主题，也可以为指定 App 单独上传照片。自定义上传优先于成套主题。</p>
        <div class="app-icon-settings">
          <div v-for="item in appIconItems" :key="item.id" class="app-icon-setting-row">
            <span class="app-icon-preview">
              <img v-if="appIconSrc(settings, item.id)" :src="appIconSrc(settings, item.id)" alt="" />
              <LineGlyph v-else :type="item.glyph" />
            </span>
            <span class="app-icon-copy">
              <strong>{{ item.label }}</strong>
              <small>{{ appIconStatus(item.id) }}</small>
            </span>
            <label class="file-button">
              上传
              <input type="file" accept="image/*" @change="pickAppIcon($event, item.id)" />
            </label>
            <button
              v-if="settings.customAppIcons?.[item.id] || selectedCustomIconTheme?.icons?.[item.id]"
              class="small-button"
              type="button"
              @click="clearAppIcon(item.id)"
            >
              恢复默认
            </button>
          </div>
        </div>
        <div v-if="imageError" class="error-line">{{ imageError }}</div>
      </div>
    </details>

    <details v-show="activeSection === 'splash'" :open="activeSection === 'splash'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">开屏动画</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body splash-settings-page">
        <section class="skin-editor-section splash-preset-section">
          <div class="skin-section-head"><div><strong>选择开屏预设</strong><span>五种动画均可编辑文案；不使用开屏则直接进入主页。</span></div></div>
          <div class="splash-preset-grid">
            <label v-for="preset in SPLASH_OPTIONS" :key="preset.id" class="splash-preset-card" :class="{ active: settings.splashPreset === preset.id }">
              <input v-model="settings.splashPreset" type="radio" :value="preset.id" />
              <span><strong>{{ preset.name }}</strong><small>{{ preset.description }}</small></span>
              <i>{{ settings.splashPreset === preset.id ? '✓' : '' }}</i>
            </label>
          </div>
        </section>

        <template v-if="activeSplashPreset.kind !== 'none'">
          <section class="skin-editor-section splash-preview-section">
            <div class="skin-section-head"><div><strong>实时预览</strong><span>实际启动时会按此配置显示。</span></div><button type="button" @click="restoreSplashDefaults">恢复默认</button></div>
            <div class="splash-preview-frame">
              <LaunchSplash :preset-id="settings.splashPreset" :config="activeSplashConfig" preview />
            </div>
          </section>

          <section v-if="activeSplashPreset.kind === 'mobius'" class="skin-editor-section splash-editor-section">
            <div class="skin-section-head"><div><strong>莫比乌斯文案</strong><span>主文案和副文案都支持换行。</span></div></div>
            <label class="field"><span>主文案</span><textarea v-model="activeSplashConfig.title" class="splash-textarea" rows="3" maxlength="300"></textarea></label>
            <label class="field"><span>副文案</span><textarea v-model="activeSplashConfig.quote" class="splash-textarea" rows="5" maxlength="800"></textarea></label>
          </section>

          <section v-else-if="activeSplashPreset.kind === 'spring'" class="skin-editor-section splash-editor-section">
            <div class="skin-section-head"><div><strong>浪漫春日文案与颜色</strong><span>英文行、中文行和文字颜色均可独立修改。</span></div></div>
            <label class="field"><span>英文文字</span><input v-model="activeSplashConfig.english" class="input" type="text" maxlength="120" /></label>
            <label class="field"><span>中文文字</span><textarea v-model="activeSplashConfig.chinese" class="splash-textarea" rows="2" maxlength="120"></textarea></label>
            <div class="splash-color-grid">
              <label class="field"><span>文字颜色</span><input v-model="activeSplashConfig.textColor" class="input color-input" type="color" /></label>
              <label class="field"><span>高亮颜色</span><input v-model="activeSplashConfig.accentColor" class="input color-input" type="color" /></label>
            </div>
          </section>

          <section v-else-if="activeSplashPreset.kind === 'bitterOrange'" class="skin-editor-section splash-editor-section">
            <div class="skin-section-head"><div><strong>苦橙文案与图片</strong><span>特殊文字和英文单词可分别改色，图片使用固定比例裁剪。</span></div></div>
            <div class="splash-field-grid">
              <label class="field"><span>水印文字</span><input v-model="activeSplashConfig.lead" class="input" type="text" maxlength="20" /></label>
              <label class="field"><span>中文短句</span><input v-model="activeSplashConfig.small" class="input" type="text" maxlength="40" /></label>
              <label class="field"><span>特殊文字</span><input v-model="activeSplashConfig.accent" class="input" type="text" maxlength="30" /></label>
              <label class="field"><span>英文单词</span><input v-model="activeSplashConfig.english" class="input" type="text" maxlength="40" /></label>
            </div>
            <div class="splash-color-grid">
              <label class="field"><span>特殊文字颜色</span><input v-model="activeSplashConfig.accentColor" class="input color-input" type="color" /></label>
              <label class="field"><span>英文单词颜色</span><input v-model="activeSplashConfig.englishColor" class="input color-input" type="color" /></label>
            </div>
            <div class="splash-image-actions">
              <button class="small-button" type="button" @click="splashPrimaryInput?.click()">上传主图 · 固定 3:1</button>
              <button class="small-button" type="button" @click="splashSecondaryInput?.click()">上传副图 · 固定 4:1</button>
              <input ref="splashPrimaryInput" class="hidden-file" type="file" accept="image/*" @change="pickSplashImage($event, 'primaryImage', 3)" />
              <input ref="splashSecondaryInput" class="hidden-file" type="file" accept="image/*" @change="pickSplashImage($event, 'secondaryImage', 4)" />
            </div>
            <p class="frame-preset-hint">主图会裁成 3:1，副图会裁成 4:1；显示尺寸由预设固定，上传后不会拉伸变形。</p>
          </section>

          <section class="skin-editor-section splash-scheme-section">
            <div class="skin-section-head"><div><strong>保存为预设方案</strong><span>保存当前文案、颜色和图片，之后可一键应用。</span></div></div>
            <div class="splash-scheme-save">
              <input v-model.trim="splashSchemeName" type="text" maxlength="30" placeholder="给当前方案起名" />
              <button type="button" @click="saveSplashScheme">保存方案</button>
            </div>
            <div v-if="settings.splashSchemes?.length" class="splash-scheme-list">
              <article v-for="scheme in settings.splashSchemes" :key="scheme.id" class="splash-scheme-item">
                <div><strong>{{ scheme.name }}</strong><small>{{ splashPresetById(scheme.presetId).name }}</small></div>
                <button type="button" @click="applySplashScheme(scheme)">应用</button>
                <button type="button" class="danger-text" @click="deleteSplashScheme(scheme.id)">删除</button>
              </article>
            </div>
            <p v-else class="frame-preset-hint">还没有保存的开屏方案。</p>
            <p v-if="splashNotice" class="status-line success">{{ splashNotice }}</p>
          </section>
        </template>
      </div>
    </details>
    <details v-show="activeSection === 'data'" :open="activeSection === 'data'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">数据</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body">
        <div class="data-block">
          <button class="action" type="button" @click="toggleStorageDetails">
            {{ storageOpen ? '收起储存空间' : '储存空间 · 点击查看占用详情' }}
          </button>
          <div v-if="storageOpen" class="storage-detail-box">
            <div v-if="storageLoading" class="status-line">正在计算占用空间…</div>
            <div v-else-if="storageError" class="error-line">{{ storageError }}</div>
            <template v-else-if="storageDetails">
              <div v-for="item in storageDetails.items" :key="item.label" class="storage-row">
                <span class="storage-main">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.hint }}</small>
                </span>
                <span class="storage-size">{{ formatBytes(item.bytes) }}</span>
              </div>
              <div class="storage-row total">
                <span class="storage-main"><strong>合计占用</strong><small>浏览器本地估算值</small></span>
                <span class="storage-size">{{ formatBytes(storageDetails.total) }}</span>
              </div>
            </template>
            <button class="small-button" type="button" @click="loadStorageDetails">重新计算</button>
          </div>
        </div>

        <div class="data-block">
          <button
            class="action"
            type="button"
            :disabled="compressionStage === 'checking' || compressionStage === 'running'"
            @click="prepareCompression"
          >
            {{ compressionStage === 'checking' ? '正在估算压缩耗时…' : compressionStage === 'running' ? '正在压缩…' : '一键压缩' }}
          </button>

          <div v-if="compressionStage === 'confirm' && compressionEstimate" class="compress-confirm">
            <strong>压缩前请确认</strong>
            <p>
              检测到 {{ compressionEstimate.count }} 张图片，共
              {{ formatBytes(compressionEstimate.bytes) }}，预计需要约
              {{ compressionEstimate.seconds }} 秒。
            </p>
            <ul>
              <li>头像会缩至 320px，头像框和表情包缩至 480px，背景与照片最大 1600px。</li>
              <li>静态图片会转为 WebP，可能略微损失细节；GIF 与 SVG 会保持原样。</li>
              <li>压缩后的原始图片不能直接恢复，建议先在下方导出备份。</li>
            </ul>
            <div class="data-actions">
              <button class="small-button" type="button" @click="cancelCompression">取消</button>
              <button class="small-button primary" type="button" @click="confirmCompression">确认压缩</button>
            </div>
          </div>

          <div v-if="compressionStage === 'running'" class="compress-progress">
            <div class="progress-track"><i :style="{ width: compressionProgress + '%' }"></i></div>
            <span>{{ compressionProgress }}%</span>
          </div>
          <div v-if="compressionStage === 'done' && compressionResult" class="status-line success">
            已处理 {{ compressionResult.processed }} 张图片，压缩 {{ compressionResult.compressed }} 张，
            节省约 {{ formatBytes(compressionResult.saved) }}。
          </div>
          <div v-if="compressionError" class="error-line">{{ compressionError }}</div>
        </div>

                <details class="backup-details">
          <summary>
            <span>备份与恢复</span>
            <span class="mini-chevron">›</span>
          </summary>
          <div class="backup-body">
            <details class="backup-item">
              <summary>导出数据 <span>›</span></summary>
              <div class="backup-item-body">
                <label class="data-check all">
                  <input
                    type="checkbox"
                    :checked="exportCategories.length === EXPORT_CATEGORIES.length"
                    @change="toggleAllExport($event.target.checked)"
                  />
                  全选
                </label>
                <label v-for="category in EXPORT_CATEGORIES" :key="category.key" class="data-check">
                  <input v-model="exportCategories" type="checkbox" :value="category.key" />
                  <span><strong>{{ category.label }}</strong><small>{{ category.hint }}</small></span>
                </label>
                <button class="small-button primary" type="button" :disabled="exportBusy" @click="handleExport">
                  {{ exportBusy ? '正在导出…' : '导出选中栏目' }}
                </button>
                <div v-if="exportNotice" class="status-line">{{ exportNotice }}</div>
              </div>
            </details>

            <details class="backup-item">
              <summary>导入数据 <span>›</span></summary>
              <div class="backup-item-body">
                <p class="backup-hint">选择由本站导出的 JSON 备份文件。可一次恢复全部栏目，也可以只导入选中的栏目。</p>
                <label class="file-button primary" :class="{ disabled: importBusy }">
                  {{ importBusy ? '正在读取…' : '选择备份文件' }}
                  <input ref="importInput" type="file" accept=".json,application/json,text/json" :disabled="importBusy" @change="onImportFile" />
                </label>

                <div v-if="importBackupData" class="import-preview">
                  <div class="import-file">{{ importFileName }}</div>
                  <label v-for="category in importAvailable" :key="category.key" class="data-check">
                    <input v-model="importCategories" type="checkbox" :value="category.key" />
                    <span><strong>{{ category.label }}</strong><small>{{ category.hint }}</small></span>
                  </label>
                  <div class="data-actions">
                    <button class="small-button" type="button" :disabled="importBusy" @click="handleImport(true)">
                      恢复全部可用栏目
                    </button>
                    <button class="small-button primary" type="button" :disabled="importBusy" @click="handleImport(false)">
                      导入选中栏目
                    </button>
                  </div>
                </div>
                <div v-if="importNotice" class="status-line success">{{ importNotice }}</div>
                <div v-if="importError" class="error-line">{{ importError }}</div>
              </div>
            </details>

            <details class="backup-item danger-item">
              <summary>清空数据 <span>›</span></summary>
              <div class="backup-item-body">
                <p class="backup-hint">删除本站全部本地数据，包括角色、字卡、聊天记录、表情包、相册和设置。此操作不可撤销。</p>
                <button class="small-button danger-button" type="button" :disabled="clearBusy" @click="clearEverything">
                  {{ clearBusy ? '正在清空…' : '清空全部本地数据' }}
                </button>
              </div>
            </details>
          </div>
        </details>

        <button class="action danger" type="button" @click="clearMessages">清空全部聊天记录</button>
        <button class="action" type="button" @click="restoreSettings">恢复默认设置</button>
      </div>
    </details>

    <details v-show="activeSection === 'theme'" :open="activeSection === 'theme'" class="echoes-character-card setting-group settings-subpage">
      <summary>
        <span class="label">主题</span>
        <span class="arrow">›</span>
      </summary>
      <div class="group-body theme-settings-body">
        <div class="theme-choice-list" role="radiogroup" aria-label="网站主题">
          <label
            v-for="theme in SITE_THEMES"
            :key="theme.id"
            class="theme-choice"
            :class="{ active: settings.siteTheme === theme.id }"
          >
            <input v-model="settings.siteTheme" type="radio" :value="theme.id" />
            <span class="theme-preview" :class="theme.className" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
            <span class="theme-choice-copy">
              <strong>{{ theme.name }}</strong>
              <small>{{ theme.description }}</small>
            </span>
            <span class="theme-check">{{ settings.siteTheme === theme.id ? '✓' : '' }}</span>
          </label>
        </div>
        <p class="theme-note">选择后立即应用到整个网站，后续会继续增加更多主题。</p>
        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>网站字体</strong><span>独立于主题，可单独切换</span></div></div>
          <div class="font-choice-list" role="radiogroup" aria-label="网站字体">
            <label
              v-for="font in FONT_OPTIONS"
              :key="font.id"
              class="font-choice"
              :class="{ active: settings.siteFont === font.id }"
              :data-font-preview="font.id"
            >
              <input v-model="settings.siteFont" type="radio" :value="font.id" />
              <span class="font-choice-copy">
                <strong>{{ font.name }}</strong>
                <small>{{ font.description }}</small>
              </span>
              <span class="theme-check">{{ settings.siteFont === font.id ? '✓' : '' }}</span>
            </label>
          </div>
          <label v-if="settings.siteFont === 'custom'" class="field custom-font-field">
            <span>字体文件、CSS 链接或 @font-face 代码</span>
            <textarea v-model.trim="settings.customFontUrl" class="input custom-font-textarea" rows="3" maxlength="12000" placeholder="https://example.com/font.css 或直接粘贴 @font-face { ... }"></textarea>
          </label>
          <label v-if="settings.siteFont === 'custom'" class="field custom-font-field">
            <span>字体名称（CSS font-family）</span>
            <input v-model.trim="settings.customFontFamily" class="input" type="text" maxlength="80" placeholder="例如 Noto Sans SC" />
          </label>
          <div v-if="settings.siteFont === 'custom'" class="font-preset-save">
            <input v-model.trim="fontPresetName" type="text" maxlength="30" placeholder="给当前字体预设命名" />
            <button type="button" @click="saveCustomFontPreset">保存为预设</button>
          </div>
          <div v-if="settings.siteFont === 'custom' && settings.customFontPresets?.length" class="font-preset-list">
            <article v-for="preset in settings.customFontPresets" :key="preset.id" class="font-preset-item" :class="{ active: preset.url === settings.customFontUrl && preset.family === settings.customFontFamily }">
              <button type="button" class="font-preset-apply" @click="applyCustomFontPreset(preset)"><strong>{{ preset.name }}</strong><small>{{ preset.family }}</small></button>
              <button type="button" class="font-preset-delete" @click="deleteCustomFontPreset(preset.id)">删</button>
            </article>
          </div>
          <p v-if="fontNotice" class="status-line success">{{ fontNotice }}</p>
          <p v-if="settings.siteFont === 'custom'" class="font-load-note">
            {{ settings.customFontUrl ? '字体链接会即时载入；Google Fonts 等 CSS 链接会自动识别字体名。若仍未显示，请填写 CSS 中的准确 font-family，并确认链接允许跨域。' : '请填写可直接访问的字体文件地址。' }}
          </p>
        </section>
        <div class="theme-color-editor">
          <label class="field">
            <span>文字颜色</span>
            <input v-model="settings.themeTextColor" class="input color-input" type="color" />
          </label>
          <label class="field">
            <span>APP图标颜色</span>
            <input v-model="settings.themeAppIconColor" class="input color-input" type="color" />
          </label>
          <label class="field">
            <span>底部导航栏颜色</span>
            <input v-model="settings.themeDockColor" class="input color-input" type="color" />
          </label>
          <div class="image-actions">
            <button class="small-button" type="button" @click="settings.themeTextColor = ''">恢复文字颜色</button>
            <button class="small-button" type="button" @click="settings.themeAppIconColor = ''">恢复图标颜色</button>
            <button class="small-button" type="button" @click="settings.themeDockColor = ''">恢复导航颜色</button>
          </div>
          <div class="save-settings-row">
            <button class="save-settings-button" type="button" @click="saveCardLayoutSettings">保存并立即生效</button>
            <span v-if="saveNotice" class="save-settings-notice">{{ saveNotice }}</span>
          </div>
        </div>
        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>气泡 CSS</strong><span>独立于网站主题，可自由搭配</span></div><button type="button" @click="saveSkinSettings">保存皮肤设置</button></div>
          <div class="skin-choice-list">
            <article v-for="skin in bubbleSkinChoices" :key="skin.id" class="skin-choice" :class="{ active: settings.chatBubbleSkin === skin.id }">
              <label><input v-model="settings.chatBubbleSkin" type="radio" :value="skin.id" /><span><strong>{{ skin.name }}</strong><small>{{ skin.description || '' }}</small></span></label>
              <button v-if="skin.id.startsWith('bubble-custom-')" type="button" class="skin-delete" @click="removeCustomBubbleSkin(skin.id)">删除</button>
            </article>
          </div>
          <details class="skin-code-preview"><summary>查看当前气泡 CSS</summary><textarea readonly :value="selectedBubbleSkinCss || '（内置样式由皮肤模块提供）'"></textarea></details>
          <div class="skin-create">
            <input v-model="customBubbleName" type="text" maxlength="24" placeholder="新气泡皮肤名称" />
            <textarea v-model="customBubbleCss" rows="5" placeholder="粘贴自定义气泡 CSS，例如 .echoes-bubble-user { ... }"></textarea>
            <div class="auto-chat-hint">CSS 中的图片请使用 HTTPS 直链或 data:image。HTTP 图片在 APP 内会自动改走 HTTPS 图片代理；防盗链、登录校验或网页链接仍可能失败。</div>
            <button type="button" @click="addCustomBubbleSkin">添加气泡皮肤</button>
          </div>
        </section>
        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>头像框预设</strong><span>系统预设、上传图片预设与自定义 CSS 均可自由切换</span></div></div>
          <div class="frame-target-switch avatar-preset-target">
            <button type="button" :class="{ active: presetFrameTarget === 'user' }" @click="presetFrameTarget = 'user'">给用户戴</button>
            <button type="button" :class="{ active: presetFrameTarget === 'contact' }" @click="presetFrameTarget = 'contact'">给联系人戴</button>
            <select v-if="presetFrameTarget === 'contact'" v-model="frameContactId">
              <option v-for="contact in chatState.contacts" :key="contact.id" :value="contact.id">{{ contactDisplayName(contact) }}</option>
            </select>
          </div>
          <p class="frame-preset-hint">用户和联系人分别保存，互不同步。当前正在设置：{{ presetFrameTarget === 'user' ? '用户' : (frameTargetContact ? contactDisplayName(frameTargetContact) : '暂无联系人') }}。</p>
          <div class="skin-choice-list">
            <article v-for="skin in avatarFrameChoices" :key="skin.id" class="skin-choice" :class="{ active: selectedPresetAvatarFrameSkin === skin.id }">
              <label><input v-model="selectedPresetAvatarFrameSkin" type="radio" :value="skin.id" /><span><strong>{{ skin.name }}</strong><small>{{ skin.description || '' }}</small></span></label>
              <button v-if="skin.id.startsWith('frame-custom-')" type="button" class="skin-delete" @click="removeCustomFrameSkin(skin.id)">删除</button>
            </article>
          </div>
          <details class="skin-code-preview"><summary>查看当前头像框 CSS</summary><textarea readonly :value="selectedAvatarFrameCss || '（当前为无头像框）'"></textarea></details>
          <div class="skin-create">
            <input v-model="customFrameName" type="text" maxlength="24" placeholder="新头像框皮肤名称" />
            <textarea v-model="customFrameCss" rows="5" placeholder="粘贴自定义头像框 CSS，例如 .echoes-avatar-user::after { ... }"></textarea>
            <div class="auto-chat-hint">建议上传图片后使用应用内生成的数据地址；外部链接优先使用允许跨域、无防盗链的 HTTPS 图片直链。</div>
            <button type="button" @click="addCustomFrameSkin">添加头像框皮肤</button>
          </div>
        </section>

        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>头像框图片调整</strong><span>可切换用户或联系人，透明底图片默认中心对齐</span></div></div>
          <div class="frame-target-switch">
            <button type="button" :class="{ active: frameTargetType === 'user' }" @click="frameTargetType = 'user'">用户</button>
            <button type="button" :class="{ active: frameTargetType === 'contact' }" @click="frameTargetType = 'contact'">联系人</button>
            <select v-if="frameTargetType === 'contact'" v-model="frameContactId">
              <option v-for="contact in chatState.contacts" :key="contact.id" :value="contact.id">{{ contactDisplayName(contact) }}</option>
            </select>
          </div>
          <div class="theme-frame-preview">
            <span class="theme-frame-avatar">
              <img v-if="frameAvatarImage" :src="frameAvatarImage" alt="头像预览" />
              <template v-else>{{ frameAvatarFallback }}</template>
              <img
                v-if="frameTargetImage"
                class="theme-frame-image"
                :src="frameTargetImage"
                :style="frameTargetStyle"
                alt="头像框预览"
              />
            </span>
            <div class="theme-frame-preview-copy">
              <strong>{{ frameTargetLabel }} · {{ frameTargetImage ? '头像框预览' : '尚未上传头像框' }}</strong>
              <small>可以直接上传透明 PNG，不需要裁剪。</small>
              <div class="image-actions">
                <button class="small-button" type="button" @click="themeAvatarFrameInput?.click()">上传透明头像框</button>
                <button v-if="frameTargetImage" class="small-button" type="button" @click="clearThemeAvatarFrame">清除头像框</button>
              </div>
              <input ref="themeAvatarFrameInput" class="hidden-file" type="file" accept="image/*" @change="pickThemeAvatarFrame" />
            </div>
          </div>
          <div class="frame-preset-save">
            <input v-model.trim="imageFramePresetName" type="text" maxlength="24" placeholder="给当前头像框预设起名" />
            <button type="button" :disabled="!frameTargetImage" @click="saveCurrentFrameAsPreset">保存为头像框预设</button>
          </div>
          <p class="frame-preset-hint">保存后可在上方“头像框预设”列表中随时选用；位置与大小会一并保存。</p>
          <div v-if="frameTargetImage" class="frame-adjust-grid">
            <label><span>X 轴</span><input v-model.number="frameOffsetX" type="range" min="-80" max="80" step="1" /><strong>{{ frameOffsetX }}px</strong></label>
            <label><span>Y 轴</span><input v-model.number="frameOffsetY" type="range" min="-80" max="80" step="1" /><strong>{{ frameOffsetY }}px</strong></label>
            <label><span>大小</span><input v-model.number="frameScale" type="range" min="0.5" max="2" step="0.01" /><strong>{{ frameScale.toFixed(2) }}×</strong></label>
            <div class="frame-scale-buttons">
              <button type="button" @click="adjustThemeAvatarFrameScale(-0.05)">−</button>
              <button type="button" @click="adjustThemeAvatarFrameScale(0.05)">＋</button>
              <button type="button" @click="resetThemeAvatarFramePosition">重置位置</button>
            </div>
          </div>
        </section>

        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>转账卡皮肤</strong><span>独立于主题，暂不支持自定义</span></div></div>
          <div class="skin-choice-list">
            <article v-for="skin in transferSkinChoices" :key="skin.id" class="skin-choice" :class="{ active: settings.transferCardSkin === skin.id }">
              <label><input v-model="settings.transferCardSkin" type="radio" :value="skin.id" /><span><strong>{{ skin.name }}</strong><small>{{ skin.description }}</small></span></label>
            </article>
          </div>
        </section>

        <section class="skin-editor-section">
          <div class="skin-section-head"><div><strong>拍一拍和已读不回皮肤</strong><span>与转账卡使用同一套预设，暂不支持自定义</span></div></div>
          <div class="skin-choice-list">
            <article v-for="skin in STATUS_BUBBLE_SKIN_OPTIONS" :key="skin.id" class="skin-choice" :class="{ active: settings.statusBubbleSkin === skin.id }">
              <label><input v-model="settings.statusBubbleSkin" type="radio" :value="skin.id" /><span><strong>{{ skin.name }}</strong><small>{{ skin.description }}</small></span></label>
            </article>
          </div>
        </section>

      </div>
    </details>
    </template>
  </section>
</template>
<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
  margin: 0 auto;
}

.settings-menu-head {
  padding: 4px 2px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.settings-menu-head strong { color: var(--theme-primary); font-size: 18px; font-weight: 800; }
.settings-menu-head span { color: var(--theme-muted); font-size: 10px; }
.settings-menu { display: flex; flex-direction: column; gap: 8px; }
.settings-menu > button { width: 100%; padding: 14px 15px; border: 1px solid var(--theme-border-soft); border-radius: 13px; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }
.settings-menu > button span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.settings-menu > button strong { color: var(--theme-text-strong); font-size: 12px; font-weight: 800; }
.settings-menu > button small { color: var(--theme-muted); font-size: 9.5px; }
.settings-menu > button i { color: var(--theme-accent); font-size: 20px; font-style: normal; }
.settings-page-back { align-self: flex-start; padding: 8px 12px; border: 1px solid var(--theme-border); border-radius: 10px; background: #fff; color: var(--theme-primary); font-size: 10.5px; font-weight: 800; cursor: pointer; }
.settings-subpage > summary { display: none; }
.setting-group {
  padding: 0;
  overflow: hidden;
}

.setting-group summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 18px;
  list-style: none;
  cursor: pointer;
}

.setting-group summary::-webkit-details-marker {
  display: none;
}

.setting-group .label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--theme-primary);
}

.arrow {
  color: var(--theme-muted);
  font-size: 20px;
  line-height: 1;
  transition: transform 0.18s ease;
}

.setting-group[open] .arrow {
  transform: rotate(90deg);
}

.group-body {
  padding: 4px 18px 16px;
  border-top: 1px solid var(--theme-border-soft);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.field > span,
.interval-grid span,
.opacity-row span {
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
}

.input,
.interval-grid input {
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.color-input {
  height: 38px;
  padding: 4px 6px;
  cursor: pointer;
}

.anniversary-avatar-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
}

.anniversary-avatar-item {
  display: flex;
  align-items: center;
  gap: 9px;
}

.anniversary-avatar-preview {
  flex: none;
  width: 42px;
  height: 42px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--theme-pale);
  color: var(--theme-accent);
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(var(--theme-primary-rgb), 0.16);
}

.anniversary-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.anniversary-avatar-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.anniversary-avatar-copy strong {
  color: var(--theme-text-strong);
  font-size: 11px;
}

.anniversary-avatar-copy small {
  color: var(--theme-muted);
  font-size: 9.5px;
  line-height: 1.4;
}

.anniversary-avatar-item .file-button {
  flex: none;
}

.save-settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.save-settings-button {
  padding: 10px 18px;
  border: 0;
  border-radius: 12px;
  background: var(--theme-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(var(--theme-primary-rgb), 0.26);
}

.save-settings-notice {
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-button,
.small-button {
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.file-button input {
  display: none;
}

.background-preview {
  height: 88px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background-color: var(--theme-surface);
  background-size: cover;
  background-position: center;
}
.moments-cover-preview{height:auto;aspect-ratio:16/9}

.opacity-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 38px;
  align-items: center;
  gap: 10px;
}

.opacity-row input {
  width: 100%;
  accent-color: var(--theme-primary);
}

.opacity-row strong {
  color: var(--theme-primary);
  font-size: 10.5px;
  text-align: right;
}

.error-line {
  color: var(--theme-accent-warm);
  font-size: 11px;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--theme-text-strong);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.switch-row input {
  width: 18px;
  height: 18px;
  accent-color: var(--theme-primary);
}

.diary-custom-moods { display: flex; flex-direction: column; gap: 7px; margin: 8px 0 2px; }
.diary-custom-mood-input { display: flex; gap: 6px; align-items: center; }
.diary-custom-mood-input input { flex: 1; min-width: 0; padding: 8px 9px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-surface); color: var(--theme-text); font: inherit; font-size: 10px; }
.diary-custom-mood-input button { flex: none; }
.diary-mood-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.diary-mood-chips > span { display: inline-flex; align-items: center; gap: 3px; padding: 4px 6px 4px 9px; border-radius: 999px; background: var(--theme-soft); color: var(--theme-text); font-size: 9px; }
.diary-mood-chips button { min-height: 0; width: 15px; height: 15px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--theme-muted); display: grid; place-items: center; font-size: 12px; }.diary-card-range {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 2px 0 12px 16px;
  padding: 10px;
  border-radius: 12px;
  background: var(--theme-soft);
}
.interval-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.interval-grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.interval-grid.disabled {
  opacity: 0.45;
}

.status-line {
  color: var(--theme-accent);
  font-size: 11px;
  line-height: 1.55;
}

.action {
  border: 1px solid var(--theme-border);
  background: var(--theme-soft);
  color: var(--theme-primary);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.action:hover:not(:disabled) {
  background: var(--theme-pale);
}

.action:disabled {
  cursor: default;
  opacity: 0.75;
}

.action.danger {
  color: var(--theme-accent-warm);
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
}

.value {
  color: var(--theme-text);
  font-size: 12px;
  font-weight: 600;
}

.data-block {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
}

.storage-detail-box {
  padding: 10px;
  border-radius: 12px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.storage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--theme-border-soft);
}

.storage-row.total {
  border-bottom: 0;
  padding-top: 9px;
}

.storage-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.storage-main strong {
  color: var(--theme-text-strong);
  font-size: 11px;
}

.storage-main small {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.storage-size {
  flex: none;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
}

.compress-confirm {
  padding: 12px;
  border: 1px solid var(--theme-danger-border);
  border-radius: 12px;
  background: var(--theme-danger-surface);
  color: var(--theme-text);
  font-size: 10.5px;
  line-height: 1.55;
}

.compress-confirm > strong {
  color: var(--theme-accent-warm);
  font-size: 12px;
}

.compress-confirm p {
  margin: 6px 0;
}

.compress-confirm ul {
  margin: 7px 0 10px;
  padding-left: 18px;
}

.compress-confirm li {
  margin: 3px 0;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.small-button.primary {
  border-color: var(--theme-muted);
  background: var(--theme-primary);
  color: #ffffff;
}

.small-button.danger-button {
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
  color: var(--theme-accent-warm);
}

.compress-progress {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.progress-track {
  flex: 1;
  height: 7px;
  border-radius: 999px;
  background: var(--theme-border-soft);
  overflow: hidden;
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--theme-muted), var(--theme-primary));
  transition: width 0.2s ease;
}

.status-line.success {
  color: var(--theme-primary);
}

.backup-details {
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
  overflow: hidden;
}

.backup-details > summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 13px;
  color: var(--theme-primary);
  font-size: 11.5px;
  font-weight: 800;
  list-style: none;
  cursor: pointer;
}

.backup-details > summary::-webkit-details-marker {
  display: none;
}

.mini-chevron {
  color: var(--theme-muted);
  font-size: 18px;
  transition: transform 0.18s ease;
}

.backup-details[open] > summary .mini-chevron {
  transform: rotate(90deg);
}

.backup-body {
  padding: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backup-item {
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
}

.backup-item > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 800;
  list-style: none;
  cursor: pointer;
}

.backup-item > summary::-webkit-details-marker {
  display: none;
}

.backup-item > summary span {
  color: var(--theme-muted);
  font-size: 16px;
  transition: transform 0.18s ease;
}

.backup-item[open] > summary span {
  transform: rotate(90deg);
}

.backup-item-body {
  padding: 10px 12px 12px;
  border-top: 1px dashed var(--theme-border-soft);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backup-hint {
  margin: 0;
  color: var(--theme-muted);
  font-size: 10px;
  line-height: 1.55;
}

.data-check {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--theme-text);
  font-size: 10.5px;
  cursor: pointer;
}

.data-check.all {
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--theme-border-soft);
  font-weight: 800;
  color: var(--theme-primary);
}

.data-check input {
  flex: none;
  margin-top: 2px;
  accent-color: var(--theme-primary);
}

.data-check > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.data-check strong {
  color: var(--theme-text-strong);
  font-size: 10.5px;
}

.data-check small {
  color: var(--theme-muted);
  font-size: 9px;
  line-height: 1.4;
}

.import-preview {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--theme-border-soft);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.import-file {
  overflow: hidden;
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danger-item {
  border-color: var(--theme-danger-border);
}

.hidden-file {
  display: none !important;
}

.auto-chat-body {
  gap: 12px;
}

.chat-tool-settings-body {
  gap: 12px;
}

.chat-tool-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-tool-settings-head > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.chat-tool-settings-head strong {
  color: var(--theme-primary);
  font-size: 13px;
  font-weight: 800;
}

.chat-tool-settings-head span {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.chat-tool-setting-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.chat-tool-setting-category {
  margin-top: 3px;
  color: var(--theme-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.chat-tool-setting-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  transition: opacity 0.16s ease, background 0.16s ease;
}

.chat-tool-setting-row.disabled {
  opacity: 0.58;
}

.chat-tool-setting-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-primary);
}

.chat-tool-setting-icon svg {
  width: 21px;
  height: 21px;
  display: block;
}

.chat-tool-setting-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.chat-tool-setting-copy strong {
  color: var(--theme-text-strong);
  font-size: 11px;
  font-weight: 800;
}

.chat-tool-setting-copy small {
  color: var(--theme-muted);
  font-size: 9px;
  line-height: 1.5;
}

.chat-tool-setting-row > input[type="checkbox"] {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: var(--theme-primary);
  cursor: pointer;
}

.chat-tool-prompt-field textarea {
  width: 100%;
  min-height: 150px;
  padding: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text);
  font: inherit;
  font-size: 10px;
  line-height: 1.6;
  resize: vertical;
}

.chat-tool-action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-tool-notes {
  margin: 0;
  padding-left: 18px;
  color: var(--theme-muted);
  font-size: 9.5px;
  line-height: 1.7;
}

.chat-tool-notes li + li {
  margin-top: 4px;
}
.auto-chat-section {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
}

.auto-chat-title {
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.auto-chat-hint {
  color: var(--theme-muted);
  font-size: 10px;
  line-height: 1.55;
}

.probability-grid {
  align-items: stretch;
}

.metric-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
}

.metric-preview span {
  color: var(--theme-muted);
  font-size: 10px;
  font-weight: 700;
}

.metric-preview strong {
  color: var(--theme-primary);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.file-button.primary,
.file-button:has(input:focus-visible) {
  border-color: var(--theme-primary);
  background: var(--theme-pale);
  color: var(--theme-primary);
}

.file-button.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.app-icon-intro {
  margin: 0;
  color: var(--theme-muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.app-icon-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-icon-setting-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: var(--theme-surface);
}

.app-icon-preview {
  flex: none;
  width: 44px;
  height: 44px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 13px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #ffffff;
  color: var(--app-icon-color);
  box-shadow: 0 4px 12px rgba(var(--theme-accent-rgb), 0.1);
}

.app-icon-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.app-icon-preview svg {
  width: 30px;
  height: 30px;
  display: block;
}

.app-icon-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-icon-copy strong {
  color: var(--theme-text-strong);
  font-size: 11.5px;
}

.app-icon-copy small {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.app-icon-setting-row .file-button {
  flex: none;
}

@media (max-width: 560px) {
  .field {
    grid-template-columns: 84px minmax(0, 1fr);
  }
  .interval-grid {
    grid-template-columns: 1fr;
  }
  .group-body {
    padding-left: 14px;
    padding-right: 14px;
  }
  .setting-group summary {
    padding-left: 14px;
    padding-right: 14px;
  }
}

.theme-settings-body {
  gap: 10px;
}

.theme-choice-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.theme-choice {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.theme-choice.active {
  border-color: var(--theme-primary);
  box-shadow: 0 5px 16px rgba(var(--theme-primary-rgb), 0.12);
}

.theme-choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.theme-preview {
  flex: none;
  width: 58px;
  height: 46px;
  padding: 6px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.theme-preview i {
  display: block;
  height: 7px;
  border-radius: 999px;
}

.theme-preview.theme-default {
  background: #ffffff;
}

.theme-preview.theme-default i {
  background: #171717;
}

.theme-preview.theme-default i:nth-child(2) {
  width: 72%;
  background: #808080;
}

.theme-preview.theme-default i:nth-child(3) {
  width: 46%;
  background: #d4d4d4;
}

.theme-preview.theme-echoes {
  background: #ffffff;
}

.theme-preview.theme-echoes i {
  background: #4a90e2;
}

.theme-preview.theme-echoes i:nth-child(2) {
  width: 72%;
  background: #69b1ff;
}

.theme-preview.theme-echoes i:nth-child(3) {
  width: 46%;
  background: #bae0ff;
}

.theme-preview.theme-glass {
  background: #ffffff;
  -webkit-backdrop-filter: blur(8px);
}
.theme-preview.theme-glass i { background: #536a86; }
.theme-preview.theme-glass i:nth-child(2) { width: 72%; background: #809ab7; }
.theme-preview.theme-glass i:nth-child(3) { width: 46%; background: #c7d9ea; }
.theme-preview.theme-peach {
  background: #fff5f6;
}
.theme-preview.theme-peach i { background: #ffdde2; border: 1px solid #c26187; }
.theme-preview.theme-peach i:nth-child(2) { width: 72%; background: #fff9e5; }
.theme-preview.theme-peach i:nth-child(3) { width: 46%; background: #c26187; }
.theme-preview.theme-strawberry-milk { background: #FFF3E8; }
.theme-preview.theme-strawberry-milk i { background: #FAD8DF; border: 1px solid #F29DB0; }
.theme-preview.theme-strawberry-milk i:nth-child(2) { width: 72%; background: #FFFFFF; border-color: #F2C7CF; }
.theme-preview.theme-strawberry-milk i:nth-child(3) { width: 46%; background: #F29DB0; }.theme-preview.theme-thin-cocoa { background: #F4FAF8; }
.theme-preview.theme-thin-cocoa i { background: #E1F6F1; border: 1px solid #7EB7AA; }
.theme-preview.theme-thin-cocoa i:nth-child(2) { width: 72%; background: #B5A198; border-color: #6E584F; }
.theme-preview.theme-thin-cocoa i:nth-child(3) { width: 46%; background: #7EB7AA; }
.theme-preview.theme-daidai-tu { background: #F7F7F7; }
.theme-preview.theme-daidai-tu i { background: rgba(255,255,255,.7); border: 1px solid #DEDEDE; border-radius: 999px; }
.theme-preview.theme-daidai-tu i:nth-child(2) { width: 72%; background: #F0F0F0; }
.theme-preview.theme-daidai-tu i:nth-child(3) { width: 46%; background: #888888; }
.theme-preview.theme-berlin-snow { background: linear-gradient(145deg,#ECEFF4,#F8F9FB); }
.theme-preview.theme-berlin-snow i { background: rgba(255,255,255,.72); border: 2px solid #E3E4E8; border-radius: 3px; }
.theme-preview.theme-berlin-snow i:nth-child(2) { width: 72%; background: #F5F5F8; }
.theme-preview.theme-berlin-snow i:nth-child(3) { width: 46%; background: #AEB4BD; }
.theme-preview.theme-faint-silk { background: linear-gradient(130deg,#E7E7EA,#F5F5F6); }
.theme-preview.theme-faint-silk i { background: rgba(255,255,255,.34); border: 1px solid rgba(180,180,180,.5); border-radius: 12px; }
.theme-preview.theme-faint-silk i:nth-child(2) { width: 72%; background: rgba(255,255,255,.56); }
.theme-preview.theme-faint-silk i:nth-child(3) { width: 46%; background: #8E8E8E; }
.theme-choice-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.theme-choice-copy strong {
  color: var(--theme-text-strong);
  font-size: 11.5px;
  font-weight: 800;
}

.theme-choice-copy small {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.theme-check {
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--theme-inverse);
  background: transparent;
  font-size: 11px;
  font-weight: 800;
}

.theme-choice.active .theme-check {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
}

.font-choice-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.font-choice {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 13px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.font-choice.active {
  border-color: var(--theme-primary);
  box-shadow: 0 5px 16px rgba(var(--theme-primary-rgb), 0.12);
}

.font-choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.font-choice-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.font-choice-copy strong {
  color: var(--theme-text-strong);
  font-size: 11.5px;
  font-weight: 800;
}

.font-choice-copy small {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.font-choice.active .theme-check {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
}

/* 缝合怪像素字体在预览与设置项里也生效 */
.font-choice[data-font-preview="pixel"] .font-choice-copy strong,
.font-choice[data-font-preview="pixel"] .font-choice-copy small {
  font-family: var(--font-pixel);
  letter-spacing: 0;
}

.theme-note {
  margin: 1px 0 0;
  color: var(--theme-muted);
  font-size: 9.5px;
  line-height: 1.55;
}

.reply-card-range-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 9px;
}

.reply-card-range-grid label {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.reply-card-range-grid label > span {
  color: var(--theme-text);
  font-size: 10px;
  font-weight: 700;
}

.range-control {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-control input[type="range"] {
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
  accent-color: var(--theme-primary);
}

.range-control strong {
  flex: none;
  min-width: 38px;
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 800;
  text-align: right;
}

.range-preview {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--theme-surface);
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 800;
  text-align: center;
}

.typing-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.typing-preset-row button {
  padding: 7px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: #ffffff;
  color: var(--theme-text);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.typing-preset-row button.active {
  border-color: var(--theme-primary);
  background: var(--theme-pale);
  color: var(--theme-primary);
}

.carousel-settings-card { padding: 11px 12px; }
.carousel-height-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.carousel-height-options button { padding: 8px 5px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-soft); color: var(--theme-muted); font-size: 9px; font-weight: 750; }
.carousel-height-options button.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }.custom-icon-theme-editor,
.theme-color-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 14px;
  background: var(--theme-surface);
}
.auto-chat-tabs{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px}
.auto-chat-tabs button{flex:none;padding:7px 11px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--theme-muted);font-size:10.5px;font-weight:800;cursor:pointer}
.auto-chat-tabs button.active{border-bottom-color:var(--theme-primary);color:var(--theme-primary)}
.auto-chat-subtabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}
.auto-chat-subtabs::-webkit-scrollbar{display:none}
.auto-chat-subtabs button{flex:none;padding:7px 11px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-soft);color:var(--theme-muted);font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
.auto-chat-subtabs button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}
.auto-chat-tab-panel{display:flex;flex-direction:column;gap:12px}
.delay-grid label{display:grid;grid-template-columns:minmax(0,1fr) 66px;align-items:center;gap:6px}.delay-grid label>span{grid-column:1 / -1}.delay-grid label select{width:100%;margin:0}.delay-grid label input{width:100%;min-width:0}
.settings-fixed-head{position:static;z-index:30;height:50px;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;background:color-mix(in srgb,var(--theme-bg) 92%,transparent);backdrop-filter:blur(10px)}
.settings-fixed-head button{border:0;background:transparent;box-shadow:none;display:grid;place-items:center;padding:0;color:var(--theme-text);cursor:pointer}
.settings-fixed-head button svg{width:22px;height:22px;display:block}
.settings-fixed-head strong{text-align:center;color:var(--theme-primary);font-size:14px;font-weight:800}
.setting-group.settings-subpage {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}
.settings-subpage > summary {
  display: none !important;
}
.settings-subpage .group-body {
  padding: 8px 0 18px !important;
  border-top: 0 !important;
}

/* 设置项输入控件：短内容尽量缩窄并靠右 */
.settings .field > input.input,
.settings .field > select.input {
  width: min(100%, 220px);
  justify-self: end;
  text-align: right;
}
.settings .field > input[type="date"],
.settings .field > input[type="time"] {
  width: min(100%, 220px);
  justify-self: end;
  text-align: right;
}
.settings .field > input[type="number"] {
  width: min(100%, 220px);
  justify-self: end;
  text-align: right;
}
.settings .field > input[type="color"].color-input,
.settings .field > input.color-input {
  width: min(100%, 220px) !important;
  min-width: 0;
  justify-self: end;
  padding: 3px;
}
.settings .field > select.input {
  padding-right: 24px;
  text-align-last: right;
}
.settings .field.custom-font-field > input.input {
  width: 100%;
  text-align: left;
}
.font-load-note {
  margin: -2px 0 2px;
  color: var(--theme-muted);
  font-size: 9px;
  line-height: 1.6;
}
.settings .interval-grid input[type="text"],
.settings .interval-grid input[type="number"],
.settings .interval-grid input[type="time"] {
  width: min(100%, 220px);
  margin-left: auto;
  text-align: right;
}.skin-editor-section{display:flex;flex-direction:column;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid var(--theme-border-soft)}
.skin-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.skin-section-head>div{display:flex;flex-direction:column;gap:2px}.skin-section-head strong{color:var(--theme-primary);font-size:12px}.skin-section-head span{color:var(--theme-muted);font-size:9px}.skin-section-head button,.skin-create button,.skin-delete{padding:7px 9px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-primary);font-size:9px;font-weight:800;cursor:pointer}
.skin-choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.skin-choice{min-width:0;padding:8px;border:1px solid var(--theme-border-soft);border-radius:11px;background:var(--theme-surface);display:flex;align-items:center;gap:6px}.skin-choice.active{border-color:var(--theme-primary);background:var(--theme-soft)}.skin-choice label{flex:1;min-width:0;display:flex;align-items:center;gap:6px;cursor:pointer}.skin-choice input{accent-color:var(--theme-primary)}.skin-choice label span{min-width:0;display:flex;flex-direction:column;gap:2px}.skin-choice strong{overflow:hidden;color:var(--theme-text-strong);font-size:9.5px;text-overflow:ellipsis;white-space:nowrap}.skin-choice small{color:var(--theme-muted);font-size:8px}.skin-delete{color:var(--theme-accent-warm)!important;background:var(--theme-danger-surface)!important}
.frame-target-switch { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.frame-target-switch button { flex: 1; min-width: 76px; }
.frame-target-switch button.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.frame-target-switch select { flex: 1 1 150px; min-width: 0; padding: 7px 9px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-surface); color: var(--theme-text); font: inherit; font-size: 9px; }.theme-frame-preview { display: flex; align-items: center; gap: 14px; padding: 12px; border: 1px solid var(--theme-border-soft); border-radius: 14px; background: var(--theme-soft); }
.theme-frame-avatar { position: relative; flex: none; width: 86px; height: 86px; border-radius: 50%; background: var(--theme-primary); color: var(--theme-inverse); display: grid; place-items: center; overflow: visible; font-size: 22px; font-weight: 800; }
.theme-frame-avatar > img:first-child { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.theme-frame-image { position: absolute; top: 50%; left: 50%; width: 120%; height: 120%; max-width: none; object-fit: contain; border-radius: 0; transform-origin: center; pointer-events: none; z-index: 3; }
.theme-frame-preview-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.theme-frame-preview-copy strong { color: var(--theme-text-strong); font-size: 11px; }
.theme-frame-preview-copy small { color: var(--theme-muted); font-size: 9px; line-height: 1.5; }
.frame-adjust-grid { display: flex; flex-direction: column; gap: 8px; }
.frame-adjust-grid > label { display: grid; grid-template-columns: 44px minmax(0,1fr) 48px; align-items: center; gap: 8px; color: var(--theme-text); font-size: 9px; }
.frame-adjust-grid input[type="range"] { width: 100%; accent-color: var(--theme-primary); }
.frame-adjust-grid strong { color: var(--theme-primary); font-size: 9px; text-align: right; }
.frame-scale-buttons { display: flex; gap: 6px; }
.frame-scale-buttons button { flex: 1; }.frame-preset-save { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; margin-top: 10px; }.frame-preset-save input { min-width: 0; padding: 8px 10px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-soft); color: var(--theme-text); font: inherit; font-size: 9.5px; }.frame-preset-save button { padding: 8px 10px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-primary); color: var(--theme-inverse); font-size: 9px; font-weight: 800; cursor: pointer; white-space: nowrap; }.frame-preset-save button:disabled { opacity: .45; cursor: default; }.frame-preset-hint { margin: -2px 0 3px; color: var(--theme-muted); font-size: 8.5px; line-height: 1.5; }.skin-code-preview summary{color:var(--theme-muted);font-size:9px;cursor:pointer}.skin-code-preview textarea,.skin-create textarea,.skin-create input{width:100%;margin-top:6px;padding:8px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:9.5px;resize:vertical}.skin-create{display:flex;flex-direction:column;gap:6px}
@media(max-width:560px){.skin-choice-list{grid-template-columns:1fr}}
@media(max-width:380px){.frame-preset-save{grid-template-columns:1fr}.frame-preset-save button{width:100%}}
.splash-settings-page { gap: 12px; }
.splash-preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.splash-preset-card { min-width: 0; padding: 10px; border: 1px solid var(--theme-border-soft); border-radius: 12px; background: var(--theme-surface); display: flex; align-items: center; gap: 8px; cursor: pointer; }
.splash-preset-card.active { border-color: var(--theme-primary); background: var(--theme-soft); }
.splash-preset-card input { accent-color: var(--theme-primary); }
.splash-preset-card span { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.splash-preset-card strong { color: var(--theme-text-strong); font-size: 10px; }
.splash-preset-card small { color: var(--theme-muted); font-size: 8.5px; line-height: 1.45; }
.splash-preset-card i { flex: none; color: var(--theme-primary); font-size: 12px; font-style: normal; }
.splash-preview-frame { width: 100%; overflow: hidden; border-radius: 16px; background: #090a10; }
.splash-editor-section { gap: 10px; }
.splash-color-grid, .splash-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.splash-textarea { width: 100%; min-height: 70px; padding: 9px 10px; border: 1px solid var(--theme-border-soft); border-radius: 10px; background: var(--theme-soft); color: var(--theme-text); font: inherit; font-size: 10px; line-height: 1.6; resize: vertical; box-sizing: border-box; }
.splash-image-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.splash-scheme-save { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.splash-scheme-save input { min-width: 0; padding: 9px 10px; border: 1px solid var(--theme-border-soft); border-radius: 10px; background: var(--theme-soft); color: var(--theme-text); font: inherit; font-size: 10px; }
.splash-scheme-save button, .splash-scheme-item button { padding: 8px 10px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-soft); color: var(--theme-primary); font-size: 9px; font-weight: 800; cursor: pointer; }
.splash-scheme-save button { background: var(--theme-primary); color: var(--theme-inverse); }
.splash-scheme-list { display: flex; flex-direction: column; gap: 7px; }
.splash-scheme-item { display: flex; align-items: center; gap: 7px; padding: 9px 10px; border: 1px solid var(--theme-border-soft); border-radius: 10px; background: var(--theme-surface); }
.splash-scheme-item > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.splash-scheme-item strong { overflow: hidden; color: var(--theme-text-strong); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.splash-scheme-item small { color: var(--theme-muted); font-size: 8.5px; }
.splash-scheme-item .danger-text { color: var(--theme-accent-warm); }
@media (max-width: 560px) {
  .splash-preset-grid, .splash-color-grid, .splash-field-grid { grid-template-columns: 1fr; }
  .splash-scheme-save { grid-template-columns: 1fr; }
}
.custom-font-textarea{min-height:76px;resize:vertical;font-family:monospace;line-height:1.5}
.font-preset-save{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:8px}.font-preset-save input{min-width:0;padding:8px 9px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.font-preset-save button{border:0;border-radius:9px;background:var(--theme-primary);color:var(--theme-inverse);font-size:9px;font-weight:800;cursor:pointer}
.font-preset-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}.font-preset-item{display:flex;align-items:stretch;gap:5px;padding:5px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-soft)}.font-preset-item.active{border-color:var(--theme-primary)}.font-preset-apply{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:5px 7px;border:0;background:transparent;color:var(--theme-text);text-align:left;cursor:pointer}.font-preset-apply strong{font-size:10px}.font-preset-apply small{overflow:hidden;color:var(--theme-muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.font-preset-delete{flex:none;width:32px;border:0;border-radius:9px;background:var(--theme-danger-surface,var(--theme-soft));color:var(--theme-accent-warm);font-size:9px;font-weight:800;cursor:pointer}
</style>
