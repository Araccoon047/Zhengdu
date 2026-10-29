import { reactive, watch } from 'vue'
import { createDefaultChatToolSettings, normalizeChatToolSettings } from './chat-tools'
import { createDefaultAiSettings, normalizeAiSettings } from './ai'
import { createDefaultSplashSettings, normalizeSplashSettings } from './splash'

const STORAGE_KEY = 'zhengdu_custom_settings_v1'

export const DEFAULT_REPLY_CARDS = []

export const CONTACT_AUTO_DEFAULTS = Object.freeze({
  callsAllowed: true,
  incomingRingSeconds: 30,
  allowReject: true,
  rejectChance: 30,
  rejectChanceRandom: false,
  noAnswerEnd: true,
  noAnswerSeconds: 30,
  noAnswerChance: 30,
  noAnswerChanceRandom: false,
  forbidContactHangup: false,
  contactHangupChance: 30,
  contactHangupChanceRandom: false,
  momentsScheduledEnabled: false,
  momentsScheduledTime: '12:00',
  momentsCardMin: 8,
  momentsCardMax: 10,
  momentsLikeDelay: 30,
  momentsLikeUnit: 'seconds',
  momentsCommentDelay: 60,
  momentsCommentUnit: 'seconds',
  momentsReplyMyComment: true,
  momentsReplyDelay: 30,
  momentsReplyUnit: 'seconds',
  momentsFavoriteEnabled: false,
  momentsFavoriteChance: 50,
  momentsFavoriteRandom: false,
  letterCardMax: 25,
  letterCardMin: 1,
  letterWriteChance: 100,
  letterWriteChanceRandom: false,
  letterReplyChance: 100,
  letterReplyChanceRandom: false,
  noReplyChance: 0,
  noReplyChanceRandom: false,
  replyDelayMinSeconds: 4,
  replyDelayMaxSeconds: 7,
  replyMessageMin: 1,
  replyMessageMax: 1,
  touchChance: 5,
  touchChanceRandom: false,
  stickerChance: 10,
  stickerChanceRandom: false,
  photoChance: 5,
  photoChanceRandom: false,
  emojiChance: 5,
  emojiChanceRandom: false,
  kaomojiChance: 5,
  kaomojiChanceRandom: false,
  quoteChance: 30,
  quoteChanceRandom: false,
  customCardChance: 80,
  customCardChanceRandom: false,
  systemCardChance: 20,
  systemCardChanceRandom: false,
  multiCardEnabled: true,
  multiCardChance: 100,
  multiCardChanceRandom: false,
  multiCardMin: 1,
  multiCardMax: 2,
  multiCardJoin: 'space',
  dictionaryEnabled: false,
  groupDictionaryEnabled: false,
  letterDictionaryEnabled: false,
  momentsDictionaryEnabled: false,
  otherDictionaryEnabled: false,
  dictionaryChance: 25,
  dictionaryChanceRandom: false,
  dictionaryMin: 2,
  dictionaryMax: 5,
  dictionaryMulti: true,
  dictionarySingleBubble: false,
  groupReplyChance: 100,
  groupReplyChanceRandom: false,
  groupReplyCardMin: 1,
  groupReplyCardMax: 1,
  proactiveMessageChance: 40,
  proactiveMessageChanceRandom: false,
  proactiveMessageMin: 1,
  proactiveMessageMax: 1,
  proactiveGiftChance: 10,
  proactiveGiftChanceRandom: false,
  proactiveTransferChance: 10,
  proactiveTransferChanceRandom: false,
  proactiveLocationChance: 10,
  proactiveLocationChanceRandom: false,
  proactiveNudgeChance: 10,
  proactiveNudgeChanceRandom: false,
  proactiveCallChance: 10,
  proactiveCallChanceRandom: false,
  momentsLikeChance: 60,
  momentsLikeChanceRandom: false,
  momentsCommentChance: 70,
  momentsCommentChanceRandom: false,
  momentsReplyChance: 60,
  momentsReplyChanceRandom: false,
  diaryEnabled: true,
  diaryMessageEnabled: true,
  diaryMessageCardMin: 3,
  diaryMessageCardMax: 8,
  diaryQuoteEnabled: true,
  diaryQuoteCardMin: 3,
  diaryQuoteCardMax: 8,
  diaryMoodEnabled: true,
})

export const SITE_THEMES = [
  {
    id: 'default',
    name: '默认主题',
    description: '普通黑白配色',
    className: 'theme-default',
  },
  {
    id: 'echoes',
    name: 'echoes│淡海蓝章 by 淅沥沥',
    description: '淡海蓝主题',
    className: 'theme-echoes',
  },
  {
    id: 'glass',
    name: '毛玻璃',
    description: '半透明磨砂玻璃风格',
    className: 'theme-glass',
  },
  {
    id: 'peach',
    name: '芝芝桃',
    description: '粉桃色系聊天主题',
    className: 'theme-peach',
  },
  {
    id: 'thinCocoa',
    name: '薄巧 by 淅沥沥',
    description: '薄荷、奶咖、手绘头像框与薄巧气泡',
    className: 'theme-thin-cocoa',
  },
  {
    id: 'strawberryMilk',
    name: '白巧草莓乳',
    description: '草莓粉、奶油白与柔和暖色',
    className: 'theme-strawberry-milk',
  },
  {
    id: 'daidaiTu',
    name: 'eve全局 · 呆呆兔 by X000',
    description: '奶白半透明、兔子横幅与柔软圆气泡',
    className: 'theme-daidai-tu',
  },
  {
    id: 'berlinSnow',
    name: '柏林雪季',
    description: '冰白磨砂、细灰边框与旋转雪花',
    className: 'theme-berlin-snow',
  },
  {
    id: 'faintSilk',
    name: 'Faint Silk · 浅丝 by 落吟',
    description: '浅灰丝光、透明磨砂与克制细边',
    className: 'theme-faint-silk',
  },
]
export const DEFAULT_HOME_LAYOUT = [
  { id: 'anniversary-card', page: 0, x: 0, y: 0 },
  { id: 'album', page: 0, x: 0, y: 2 },
  { id: 'journey', page: 0, x: 1, y: 2 },
  { id: 'music', page: 0, x: 2, y: 2 },
  { id: 'sms', page: 0, x: 3, y: 2 },
  { id: 'time-card', page: 0, x: 0, y: 3 },
  { id: 'link-card', page: 0, x: 2, y: 3 },
  { id: 'moments', page: 0, x: 0, y: 4 },
  { id: 'stats', page: 0, x: 1, y: 4 },
  { id: 'mail', page: 0, x: 2, y: 4 },
  { id: 'pomodoro', page: 1, x: 0, y: 0 },
  { id: 'tarot', page: 1, x: 1, y: 0 },
  { id: 'questionnaire', page: 1, x: 2, y: 0 },
  { id: 'period', page: 1, x: 3, y: 0 },
  { id: 'accounting', page: 1, x: 0, y: 1 },
  { id: 'memory', page: 1, x: 1, y: 1 },
  { id: 'ta-today-card', page: 1, x: 2, y: 1 },
  { id: 'avatarLib', page: 1, x: 0, y: 2 },
  { id: 'wishlist', page: 2, x: 0, y: 2 },
  { id: 'music-widget', page: 1, x: 0, y: 4 },
  { id: 'photo-carousel-card', page: 2, x: 0, y: 0 },
]
export const defaultSettings = {
  siteTheme: 'echoes',
  siteFont: 'default',
  customFontUrl: '',
  customFontFamily: 'ZhengduCustomFont',
  customFontPresets: [],
  userName: '我',
  userBio: '一只淡海蓝的小手机',
  opponentName: '淅沥沥',
  opponentAvatar: '淅',
  opponentAvatarColor: 'var(--theme-primary)',
  opponentAvatarImage: '',
  userAvatarFrame: '',
  chatBackground: '',
  chatBackgroundOpacity: 60,
  homeBackground: '',
  homeBackgroundOpacity: 60,
  photoCarouselSpeed: 4.5,
  photoCarouselPhotoSize: 76,
  photoCarouselHeight: 2,
  momentsBackground: '',
  momentsBackgroundOpacity: 100,
  replyCards: [...DEFAULT_REPLY_CARDS],
  replyCardCountMin: 1,
  replyCardCountMax: 1,
  proactiveEnabled: false,
  proactiveLettersEnabled: false,
  momentsAutoPublishEnabled: false,
  momentsPublishChance: 35,
  momentsPublishChanceRandom: false,
  allowContactsMutualComments: false,
  randomInterval: false,
  minInterval: 5,
  maxInterval: 60,
  replyDelayMinSeconds: 4,
  replyDelayMaxSeconds: 7,
  typingIndicatorText: '正在挑选字卡',
  enterForNewline: false,
  customNudgeSymbols: [],
  customDiaryMoods: [],
  customNudgeTexts: [],
  letterMinInterval: 120,
  letterMaxInterval: 360,
  letterReplyMin: 1,
  letterReplyMax: 3,
  momentsMinInterval: 60,
  momentsMaxInterval: 120,
  audioCardWeight: 5,
  audioGuaranteeChance: 0,
  audioGuaranteeChanceRandom: false,
  songChance: 5,
  songChanceRandom: false,
  momentsInteractionChance: 80,
  momentsInteractionChanceRandom: false,
  inAppNotifications: true,
  chatNotifications: true,
  mailboxNotifications: true,
  momentsNotifications: true,
  customAppIcons: {},
  appIconTheme: 'default',
  customIconThemes: [],
  contactAutoSettings: {},
  chatTools: createDefaultChatToolSettings(),
  ai: createDefaultAiSettings(),
  ...createDefaultSplashSettings(),
  themeTextColor: '',
  themeAppIconColor: '',
  themeDockColor: '',
  chatBubbleSkin: 'default',
  userAvatarFrameSkin: 'none',
  contactAvatarFrameSkin: 'none',
  avatarFrameSkin: 'none',
  transferCardSkin: 'follow',
  statusBubbleSkin: 'follow',
  userAvatarFrameOffsetX: 0,
  userAvatarFrameOffsetY: 0,
  userAvatarFrameScale: 1,
  customBubbleSkins: [],
  customAvatarFrameSkins: [],
  anniversaryTitle: '我们在一起已经',
  anniversaryTextColor: '#69b1ff',
  anniversaryCountColor: '#4a90e2',
  anniversaryDate: '',
  anniversaryMode: 'since',
  // 纪念日关系类型（love 爱情向 / family 亲情向 / friend 友情向）与关系称呼（选填）
  anniversaryType: 'love',
  anniversaryRole: '',
  anniversaryShowAvatarFrames: true,
  anniversaryAvatarA: '',
  anniversaryAvatarB: '',
  anniversaryBackground: '',
    anniversaryBackgroundOpacity: 60,
  anniversaryCardSize: '4x2',
  timeCardSize: '2x1',
  linkStatusCardSize: '2x1',
  // 首页「今天 TA 想对你说」卡片
  taTodayCardSize: '2x2',
  taTodayCardColor: '',
  taTodayCardTextColor: '',
  taTodayCardMin: 1,
  taTodayCardMax: 3,
  // 头像库：允许 TA 为用户换头像 + 换头像频率（天）/概率
  avatarAllowTaChange: true,
  avatarChangeMin: 5,
  avatarChangeMax: 7,
  avatarChangeChance: 50,
  avatarChangeChanceRandom: false,
  // 后台保活：套壳 APP 时循环播放静音音频，防止切后台 JS 定时器被冻结
  keepAliveEnabled: false,
  homeLayout: DEFAULT_HOME_LAYOUT.map((item) => ({ ...item })),
  // 被锁定的系统预设字卡分组（'main:3' 这种 key），锁定的组不参与抽卡
  systemLockedCardGroups: [],
  systemDeletedCardGroups: [],
  systemHiddenCardIds: [],
  systemCardEdits: {},
  systemCustomCards: [],
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampDecimal(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10
}

function normalizeHexColor(value) {
  const color = String(value ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : ''
}
function normalizeCardSize(value, fallback) {
  const match = String(value ?? '')
    .trim()
    .match(/^([1-4])\s*[xX×]\s*([1-8])$/)
  if (!match) return fallback
  return `${Number(match[1])}x${Number(match[2])}`
}

function normalizeHomeLayout(savedLayout) {
  const savedById = new Map(
    (Array.isArray(savedLayout) ? savedLayout : [])
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => [item.id, item])
  )
  const retired = ['coin', 'checkin', 'askRecords']
  const hasRetired = retired.some((id) => savedById.has(id))
  const normalized = DEFAULT_HOME_LAYOUT.map((defaultItem) => {
    const saved = hasRetired ? {} : (savedById.get(defaultItem.id) || {})
    const legacyWishlistPage = defaultItem.id === 'wishlist' && Number(saved.page) === 1 && Number(saved.x) === 1 && Number(saved.y) === 2
    return {
      id: defaultItem.id,
      page: legacyWishlistPage ? 2 : clampNumber(saved.page, 0, 2, defaultItem.page),
      x: clampNumber(saved.x, 0, 3, defaultItem.x),
      y: clampNumber(saved.y, 0, 7, defaultItem.y),
    }
  })
  const defaultIds = new Set(DEFAULT_HOME_LAYOUT.map((item) => item.id))
  const optionalWidget = savedById.get('wish-widget')
  if (optionalWidget && !defaultIds.has('wish-widget')) {
    const legacyWidgetPage = Number(optionalWidget.page) === 1 && Number(optionalWidget.x) === 2 && Number(optionalWidget.y) === 2
    normalized.push({
      id: 'wish-widget',
      page: legacyWidgetPage ? 2 : clampNumber(optionalWidget.page, 0, 2, 2),
      x: legacyWidgetPage ? 1 : clampNumber(optionalWidget.x, 0, 3, 1),
      y: legacyWidgetPage ? 2 : clampNumber(optionalWidget.y, 0, 7, 2),
    })
  }
  return normalized
}
function normalizeCustomIconThemes(value) {
  const usedIds = new Set()
  return (Array.isArray(value) ? value : [])
    .slice(0, 20)
    .map((theme, index) => {
      if (!theme || typeof theme !== 'object') return null
      let id = String(theme.id || `custom-icon-${index + 1}`)
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
      if (!id.startsWith('custom-icon-')) id = `custom-icon-${id || index + 1}`
      while (usedIds.has(id)) id = `${id}-${index + 1}`
      usedIds.add(id)
      const icons =
        theme.icons && typeof theme.icons === 'object'
          ? Object.fromEntries(
              Object.entries(theme.icons).filter(
                ([key, icon]) => key && typeof icon === 'string' && icon
              )
            )
          : {}
      return {
        id,
        name: String(theme.name || `自定义图标主题 ${index + 1}`).trim().slice(0, 30),
        icons,
      }
    })
    .filter(Boolean)
}
function normalize(saved = {}) {
  const savedAnniversaryTitle = String(saved.anniversaryTitle ?? '').trim()
  const cards = Array.isArray(saved.replyCards)
    ? saved.replyCards.map((card) => String(card).trim()).filter(Boolean)
    : []

  const customNudgeTexts = [
    ...new Set(
      (Array.isArray(saved.customNudgeTexts) ? saved.customNudgeTexts : [])
        .map((text) => String(text || '').trim().slice(0, 80))
        .filter(Boolean)
    ),
  ]
  const customNudgeSymbols = [
    ...new Set(
      (Array.isArray(saved.customNudgeSymbols) ? saved.customNudgeSymbols : [])
        .map((symbol) => String(symbol || '').trim().slice(0, 8))
        .filter(Boolean)
    ),
  ]
  const customIconThemes = normalizeCustomIconThemes(saved.customIconThemes)
  const validIconThemeIds = ['default', 'ins-gray', ...customIconThemes.map((theme) => theme.id)]
  const legacyReplyMax = clampNumber(saved.maxReplyCards, 1, 10, 1)
  const legacyAvatarFrameSkin = String(saved.avatarFrameSkin || defaultSettings.avatarFrameSkin)
  const splashSettings = normalizeSplashSettings(saved)
  const replyCardCountMin = clampNumber(saved.replyCardCountMin, 1, 10, 1)
  const replyCardCountMax = Math.max(
    replyCardCountMin,
    clampNumber(saved.replyCardCountMax, 1, 10, legacyReplyMax)
  )
  return {
    siteTheme: SITE_THEMES.some((theme) => theme.id === saved.siteTheme) ? saved.siteTheme : 'echoes',
    siteFont: ['default', 'pixel', 'custom'].includes(saved.siteFont) ? saved.siteFont : 'default',
    customFontUrl: String(saved.customFontUrl ?? '').trim(),
    customFontFamily: String(saved.customFontFamily ?? 'ZhengduCustomFont').trim().slice(0, 80) || 'ZhengduCustomFont',
    customFontPresets: (Array.isArray(saved.customFontPresets) ? saved.customFontPresets : [])
      .filter((preset) => preset && preset.id && preset.name && typeof preset.url === 'string')
      .map((preset, index) => ({
        id: String(preset.id || `font-preset-${index + 1}`).slice(0, 80),
        name: String(preset.name || '').trim().slice(0, 30),
        url: String(preset.url || '').slice(0, 12000),
        family: String(preset.family || 'ZhengduCustomFont').trim().slice(0, 80) || 'ZhengduCustomFont',
      })).filter((preset) => preset.name && preset.url).slice(0, 30),
    userName: String(saved.userName ?? defaultSettings.userName).trim() || defaultSettings.userName,
    userBio: String(saved.userBio ?? defaultSettings.userBio).trim(),
    opponentName:
      String(saved.opponentName ?? defaultSettings.opponentName).trim() ||
      defaultSettings.opponentName,
    opponentAvatar:
      String(saved.opponentAvatar ?? defaultSettings.opponentAvatar).slice(0, 8) ||
      defaultSettings.opponentAvatar,
    opponentAvatarColor: (() => {
      const color = String(saved.opponentAvatarColor || '').trim()
      if (!color) return defaultSettings.opponentAvatarColor
      return ['#4a90e2', '#69b1ff', '#91caff'].includes(color.toLowerCase())
        ? 'var(--theme-primary)'
        : color
    })(),
    opponentAvatarImage:
      typeof saved.opponentAvatarImage === 'string' ? saved.opponentAvatarImage : '',
    userAvatarFrame:
      typeof saved.userAvatarFrame === 'string' ? saved.userAvatarFrame : '',
    chatBackground:
      typeof saved.chatBackground === 'string' ? saved.chatBackground : '',
    homeBackground:
      typeof saved.homeBackground === 'string' ? saved.homeBackground : '',
    homeBackgroundOpacity: clampNumber(saved.homeBackgroundOpacity, 0, 100, 60),
    photoCarouselSpeed: clampDecimal(saved.photoCarouselSpeed, 1, 20, 4.5),
    photoCarouselPhotoSize: clampNumber(saved.photoCarouselPhotoSize, 35, 90, 76),
    photoCarouselHeight: clampNumber(saved.photoCarouselHeight, 1, 4, 2),
    momentsBackground:
      typeof saved.momentsBackground === 'string' ? saved.momentsBackground : '',
    momentsBackgroundOpacity: 100,
    replyCards: cards.length ? cards : [...DEFAULT_REPLY_CARDS],
    replyCardCountMin,
    replyCardCountMax,
    proactiveEnabled: Boolean(saved.proactiveEnabled),
    proactiveLettersEnabled: Boolean(saved.proactiveLettersEnabled),
    momentsAutoPublishEnabled: Boolean(saved.momentsAutoPublishEnabled),
    momentsPublishChance: clampNumber(saved.momentsPublishChance, 0, 100, 35),
    momentsPublishChanceRandom: Boolean(saved.momentsPublishChanceRandom),
    allowContactsMutualComments: Boolean(saved.allowContactsMutualComments),
    randomInterval: Boolean(saved.randomInterval),
    minInterval: clampNumber(saved.minInterval, 1, 1440, defaultSettings.minInterval),
    maxInterval: clampNumber(saved.maxInterval, 1, 1440, defaultSettings.maxInterval),
    replyDelayMinSeconds: clampNumber(
      saved.replyDelayMinSeconds,
      1,
      120,
      defaultSettings.replyDelayMinSeconds
    ),
    replyDelayMaxSeconds: clampNumber(
      saved.replyDelayMaxSeconds,
      1,
      120,
      defaultSettings.replyDelayMaxSeconds
    ),
    typingIndicatorText:
      String(saved.typingIndicatorText ?? defaultSettings.typingIndicatorText).trim() ||
      defaultSettings.typingIndicatorText,
    enterForNewline: Boolean(saved.enterForNewline),
    customNudgeSymbols,
    customDiaryMoods: [
      ...new Set(
        (Array.isArray(saved.customDiaryMoods) ? saved.customDiaryMoods : [])
          .map((item) => String(item || '').trim().slice(0, 16))
          .filter(Boolean)
      ),
    ].slice(0, 30),
    customNudgeTexts,
    letterMinInterval: clampNumber(
      saved.letterMinInterval,
      1,
      1440,
      defaultSettings.letterMinInterval
    ),
    letterMaxInterval: clampNumber(
      saved.letterMaxInterval,
      1,
      1440,
      defaultSettings.letterMaxInterval
    ),
    letterReplyMin: clampNumber(saved.letterReplyMin, 1, 1440, defaultSettings.letterReplyMin),
    letterReplyMax: clampNumber(saved.letterReplyMax, 1, 1440, defaultSettings.letterReplyMax),
    momentsMinInterval: clampNumber(
      saved.momentsMinInterval,
      1,
      1440,
      defaultSettings.momentsMinInterval
    ),
    momentsMaxInterval: clampNumber(
      saved.momentsMaxInterval,
      1,
      1440,
      defaultSettings.momentsMaxInterval
    ),
    audioCardWeight: clampNumber(saved.audioCardWeight, 1, 99, defaultSettings.audioCardWeight),
    audioGuaranteeChanceRandom: Boolean(saved.audioGuaranteeChanceRandom),
    audioGuaranteeChance: clampNumber(
      saved.audioGuaranteeChance,
      0,
      100,
      defaultSettings.audioGuaranteeChance
    ),
    songChance: clampNumber(saved.songChance, 0, 100, defaultSettings.songChance),
    songChanceRandom: Boolean(saved.songChanceRandom),
    momentsInteractionChanceRandom: Boolean(saved.momentsInteractionChanceRandom),
    momentsInteractionChance: clampNumber(
      saved.momentsInteractionChance,
      0,
      100,
      defaultSettings.momentsInteractionChance
    ),
    chatNotifications: saved.chatNotifications === undefined ? true : Boolean(saved.chatNotifications),
    mailboxNotifications: saved.mailboxNotifications === undefined ? true : Boolean(saved.mailboxNotifications),
    momentsNotifications: saved.momentsNotifications === undefined ? true : Boolean(saved.momentsNotifications),
    inAppNotifications:
      saved.inAppNotifications === undefined
        ? defaultSettings.inAppNotifications
        : Boolean(saved.inAppNotifications),
    customAppIcons:
      saved.customAppIcons && typeof saved.customAppIcons === 'object'
        ? Object.fromEntries(
            Object.entries(saved.customAppIcons).filter(
              ([key, value]) => key && typeof value === 'string' && value
            )
          )
        : {},
    customIconThemes,
    contactAutoSettings:
      saved.contactAutoSettings && typeof saved.contactAutoSettings === 'object'
        ? saved.contactAutoSettings
        : {},
    chatTools: normalizeChatToolSettings(saved.chatTools),
    ai: normalizeAiSettings(saved.ai),
    ...splashSettings,
    appIconTheme: validIconThemeIds.includes(saved.appIconTheme)
      ? saved.appIconTheme
      : defaultSettings.appIconTheme,
    themeTextColor: normalizeHexColor(saved.themeTextColor),
    themeAppIconColor: normalizeHexColor(saved.themeAppIconColor),
    themeDockColor: normalizeHexColor(saved.themeDockColor),
    chatBubbleSkin: String(saved.chatBubbleSkin || defaultSettings.chatBubbleSkin),
    userAvatarFrameSkin: String(saved.userAvatarFrameSkin ?? legacyAvatarFrameSkin),
    contactAvatarFrameSkin: String(saved.contactAvatarFrameSkin ?? legacyAvatarFrameSkin),
    avatarFrameSkin: legacyAvatarFrameSkin,
    transferCardSkin: (['follow', 'seal', 'mono', 'maotaotao'].includes(saved.transferCardSkin) || SITE_THEMES.some((theme) => 'theme-' + theme.id === saved.transferCardSkin)) ? saved.transferCardSkin : 'follow',
    statusBubbleSkin: ['follow', 'seal', 'mono', 'maotaotao'].includes(saved.statusBubbleSkin) ? saved.statusBubbleSkin : 'follow',
    userAvatarFrameOffsetX: clampNumber(saved.userAvatarFrameOffsetX, -80, 80, 0),
    userAvatarFrameOffsetY: clampNumber(saved.userAvatarFrameOffsetY, -80, 80, 0),
    userAvatarFrameScale: clampDecimal(saved.userAvatarFrameScale, 0.5, 2, 1),
    customBubbleSkins: Array.isArray(saved.customBubbleSkins) ? saved.customBubbleSkins.filter((item) => item && item.id && item.name && typeof item.css === 'string').slice(0, 30) : [],
    customAvatarFrameSkins: Array.isArray(saved.customAvatarFrameSkins)
      ? saved.customAvatarFrameSkins
          .filter((item) => item && item.id && item.name && (typeof item.css === 'string' || typeof item.image === 'string'))
          .map((item) => ({
            id: String(item.id),
            name: String(item.name).slice(0, 24),
            description: String(item.description || '自定义头像框预设').slice(0, 60),
            css: typeof item.css === 'string' ? item.css : '',
            image: typeof item.image === 'string' ? item.image : '',
            offsetX: Math.max(-80, Math.min(80, Math.round(Number(item.offsetX) || 0))),
            offsetY: Math.max(-80, Math.min(80, Math.round(Number(item.offsetY) || 0))),
            scale: Math.max(0.5, Math.min(2, Number(item.scale) || 1)),
          }))
          .slice(0, 30)
      : [],
    anniversaryTitle:
      !savedAnniversaryTitle || savedAnniversaryTitle === '遇见你的那一天'
        ? defaultSettings.anniversaryTitle
        : savedAnniversaryTitle,
    anniversaryTextColor: /^#[0-9a-fA-F]{6}$/.test(
      String(saved.anniversaryTextColor ?? '')
    )
      ? String(saved.anniversaryTextColor)
      : defaultSettings.anniversaryTextColor,
    anniversaryCountColor: /^#[0-9a-fA-F]{6}$/.test(
      String(saved.anniversaryCountColor ?? '')
    )
      ? String(saved.anniversaryCountColor)
      : defaultSettings.anniversaryCountColor,
    anniversaryDate: (() => {
      const date = String(saved.anniversaryDate ?? '').trim()
      if (!date || date === '2026-10-18') return ''
      return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
    })(),    anniversaryMode: saved.anniversaryMode === 'until' ? 'until' : 'since',
    anniversaryType: ['love', 'family', 'friend'].includes(saved.anniversaryType)
      ? saved.anniversaryType
      : 'love',
    anniversaryRole: String(saved.anniversaryRole ?? '').trim().slice(0, 12),
    anniversaryShowAvatarFrames: saved.anniversaryShowAvatarFrames !== false,
    anniversaryAvatarA:
      typeof saved.anniversaryAvatarA === 'string' ? saved.anniversaryAvatarA : '',
    anniversaryAvatarB:
      typeof saved.anniversaryAvatarB === 'string' ? saved.anniversaryAvatarB : '',
    anniversaryBackground:
      typeof saved.anniversaryBackground === 'string' ? saved.anniversaryBackground : '',
    anniversaryBackgroundOpacity: clampNumber(saved.anniversaryBackgroundOpacity, 0, 100, 60),
    anniversaryCardColor: normalizeHexColor(saved.anniversaryCardColor),
    anniversaryCardTextColor: normalizeHexColor(saved.anniversaryCardTextColor),
    anniversaryCardSize: normalizeCardSize(saved.anniversaryCardSize, defaultSettings.anniversaryCardSize),
    taTodayCardSize: normalizeCardSize(saved.taTodayCardSize, defaultSettings.taTodayCardSize),
    taTodayCardColor: normalizeHexColor(saved.taTodayCardColor),
    taTodayCardTextColor: normalizeHexColor(saved.taTodayCardTextColor),
    taTodayCardMin: clampNumber(saved.taTodayCardMin, 1, 3, 1),
    taTodayCardMax: clampNumber(saved.taTodayCardMax, 1, 3, 3),
    avatarAllowTaChange: saved.avatarAllowTaChange !== false,
    avatarChangeMin: clampNumber(saved.avatarChangeMin, 1, 30, 5),
    avatarChangeMax: clampNumber(saved.avatarChangeMax, 1, 30, 7),
    avatarChangeChance: clampNumber(saved.avatarChangeChance, 0, 100, 50),
    avatarChangeChanceRandom: saved.avatarChangeChanceRandom === true,
    keepAliveEnabled: saved.keepAliveEnabled === true,
    timeCardColor: normalizeHexColor(saved.timeCardColor),
    timeCardTextColor: normalizeHexColor(saved.timeCardTextColor),
    timeCardSize: normalizeCardSize(saved.timeCardSize, defaultSettings.timeCardSize),
    linkStatusCardColor: normalizeHexColor(saved.linkStatusCardColor),
    linkStatusCardTextColor: normalizeHexColor(saved.linkStatusCardTextColor),
    linkStatusCardSize: normalizeCardSize(saved.linkStatusCardSize, defaultSettings.linkStatusCardSize),
    homeLayout: normalizeHomeLayout(saved.homeLayout),
    systemLockedCardGroups: [
      ...new Set(
        (Array.isArray(saved.systemLockedCardGroups) ? saved.systemLockedCardGroups : [])
          .map((key) => String(key || '').trim())
          .filter((key) => /^[a-z_]+:\d+$/.test(key))
      ),
    ],
    systemDeletedCardGroups: [
      ...new Set(
        (Array.isArray(saved.systemDeletedCardGroups) ? saved.systemDeletedCardGroups : [])
          .map((key) => String(key || '').trim())
          .filter((key) => /^[a-z_]+:\d+$/.test(key))
      ),
    ],
    systemHiddenCardIds: [
      ...new Set(
        (Array.isArray(saved.systemHiddenCardIds) ? saved.systemHiddenCardIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      ),
    ],
    systemCardEdits:
      saved.systemCardEdits && typeof saved.systemCardEdits === 'object'
        ? Object.fromEntries(
            Object.entries(saved.systemCardEdits)
              .map(([id, value]) => [String(id), String(value || '').trim()])
              .filter(([, value]) => value)
          )
        : {},
    systemCustomCards: (Array.isArray(saved.systemCustomCards) ? saved.systemCustomCards : [])
      .map((card) => ({
        id: String(card?.id || '').trim(),
        categoryKey: String(card?.categoryKey || 'main').trim() || 'main',
        groupIndex: Math.max(0, Math.round(Number(card?.groupIndex) || 0)),
        text: String(card?.text || '').trim(),
      }))
      .filter((card) => card.id && card.text),
  }
}

function load() {
  if (typeof localStorage === 'undefined') return normalize()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalize(raw ? JSON.parse(raw) : {})
  } catch (e) {
    return normalize()
  }
}

export const settings = reactive(load())

let saveTimer = null
function save() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('设置保存失败：', e)
  }
}

watch(
  settings,
  () => {
    if (typeof window === 'undefined') return
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(save, 120)
  },
  { deep: true }
)

export function saveSettingsNow() {
  clearTimeout(saveTimer)
  save()
}

export function resetReplyCards() {
  settings.replyCards = [...DEFAULT_REPLY_CARDS]
}

export function resetCustomSettings() {
  Object.assign(settings, normalize())
}
