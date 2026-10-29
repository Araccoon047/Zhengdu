<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { store, go, requestGroupCreate } from './store'
import { saveSettingsNow, settings } from './settings'
import { loadStickerLibrary } from './stickers'
import { backgroundLayerStyle } from './background-style'
import { normalizeImageUrl } from './image-utils'
import { resolveAvatarFrameSkinCss } from './avatar-frame-style'
import {
  chatState,
  closeChat,
  dismissNotification,
  openChat,
  openGroup,
  startChatEngine,
  stopChatEngine,
  saveChatDataNow,
} from './chat'
import { flushPersistence } from './persistence'
import { startMomentsEngine, stopMomentsEngine } from './moments'
import { startMailboxEngine, stopMailboxEngine } from './mailbox'
import { startAvatarEngine, stopAvatarEngine } from './avatar-lib'
import { startWishlistEngine, stopWishlistEngine } from './wishlist'
import { syncKeepAlive } from './keep-alive'
import { isNativeApp, notifyNativeReady } from './native-bridge'
import { splashPresetById } from './splash'
import LaunchSplash from './components/LaunchSplash.vue'
import HomeView from './views/HomeView.vue'
import LineGlyph from './components/LineGlyph.vue'
import WelcomeNoticeDialog from './components/WelcomeNoticeDialog.vue'

// 非首页模块按需加载，避免启动时一次性解析所有 APP 和组件。
const SmsView = defineAsyncComponent(() => import('./views/SmsView.vue'))
const AlbumView = defineAsyncComponent(() => import('./views/AlbumView.vue'))
const MusicView = defineAsyncComponent(() => import('./views/MusicView.vue'))
const JourneyView = defineAsyncComponent(() => import('./views/JourneyView.vue'))
const MomentsView = defineAsyncComponent(() => import('./views/MomentsView.vue'))
const SettingsView = defineAsyncComponent(() => import('./views/SettingsView.vue'))
const ProfileView = defineAsyncComponent(() => import('./views/ProfileView.vue'))
const StatsView = defineAsyncComponent(() => import('./views/StatsView.vue'))
const TarotView = defineAsyncComponent(() => import('./views/TarotView.vue'))
const MailboxView = defineAsyncComponent(() => import('./views/MailboxView.vue'))
const PomodoroView = defineAsyncComponent(() => import('./views/PomodoroView.vue'))
const QuestionnaireView = defineAsyncComponent(() => import('./views/QuestionnaireView.vue'))
const PeriodView = defineAsyncComponent(() => import('./views/PeriodView.vue'))
const AccountingView = defineAsyncComponent(() => import('./views/AccountingView.vue'))
const MemoryView = defineAsyncComponent(() => import('./views/MemoryView.vue'))
const WishlistView = defineAsyncComponent(() => import('./views/WishlistView.vue'))
const AvatarLibView = defineAsyncComponent(() => import('./views/AvatarLibView.vue'))
const FeatureHubView = defineAsyncComponent(() => import('./views/FeatureHubView.vue'))
const ImageCropDialog = defineAsyncComponent(() => import('./components/ImageCropDialog.vue'))
const CallWindow = defineAsyncComponent(() => import('./components/CallWindow.vue'))
const MusicFloat = defineAsyncComponent(() => import('./components/MusicFloat.vue'))
const PomodoroFloat = defineAsyncComponent(() => import('./components/PomodoroFloat.vue'))
const CardLibraryDialog = defineAsyncComponent(() => import('./components/CardLibraryDialog.vue'))
import { AVATAR_FRAME_BASE_CSS, BUBBLE_BASE_CSS, BUILTIN_AVATAR_FRAME_SKINS, BUILTIN_BUBBLE_SKINS } from './theme/skins'

const views = {
  home: HomeView,
  sms: SmsView,
  album: AlbumView,
  music: MusicView,
  journey: JourneyView,
  moments: MomentsView,
  settings: SettingsView,
  profile: ProfileView,
  stats: StatsView,
  tarot: TarotView,
  mail: MailboxView,
  pomodoro: PomodoroView,
  questionnaire: QuestionnaireView,
  period: PeriodView,
  accounting: AccountingView,
  memory: MemoryView,
  avatarLib: AvatarLibView,
  wishlist: WishlistView,
  featureHub: FeatureHubView,
  cardLibrary: CardLibraryDialog,
}

const current = computed(() => views[store.page] || HomeView)
const WELCOME_NOTICE_KEY = 'zhengdu_welcome_notice_seen_v1'
const welcomeNoticeOpen = ref((() => {
  try { return localStorage.getItem(WELCOME_NOTICE_KEY) !== '1' } catch { return true }
})())
function closeWelcomeNotice() {
  welcomeNoticeOpen.value = false
  try { localStorage.setItem(WELCOME_NOTICE_KEY, '1') } catch {}
}
const launchSplashVisible = ref(false)
const launchSplashReady = ref(false)
const splashPreviewRequest = (() => {
  if (typeof window === 'undefined') return ''
  const requested = new URLSearchParams(window.location.search).get('splash') || ''
  return requested && splashPresetById(requested).kind !== 'none' ? requested : ''
})()
const activeSplashPresetId = computed(() => splashPreviewRequest || settings.splashPreset)
const activeSplashPreset = computed(() => splashPresetById(activeSplashPresetId.value))
const activeSplashConfig = computed(() =>
  settings.splashConfigs?.[activeSplashPresetId.value] || activeSplashPreset.value.defaults || {}
)
let launchSplashTimer = null

const dockItems = [
  { id: 'home', label: '主页', icon: 'home' },
  { id: 'settings', label: '设置', icon: 'settings' },
  { id: 'profile', label: '我的', icon: 'user' },
]
const bubbleSkinOptions = computed(() => [...BUILTIN_BUBBLE_SKINS, ...(settings.customBubbleSkins || [])])
const avatarFrameOptions = computed(() => [...BUILTIN_AVATAR_FRAME_SKINS, ...(settings.customAvatarFrameSkins || [])])
const activeBubbleSkin = computed(
  () => bubbleSkinOptions.value.find((skin) => skin.id === settings.chatBubbleSkin) || BUILTIN_BUBBLE_SKINS[0]
)
const activeUserAvatarFrameSkin = computed(
  () => avatarFrameOptions.value.find((skin) => skin.id === settings.userAvatarFrameSkin) || BUILTIN_AVATAR_FRAME_SKINS[0]
)
const contactAvatarFrameSkinIds = computed(() => [
  ...new Set(chatState.contacts.map((contact) => String(contact.avatarFrameSkin || 'none')).filter((id) => id !== 'none')),
])
function normalizeSkinCssImages(css) {
  return String(css || '').replace(/url\(\s*(['"]?)(https?:\/\/[^)'"\s]+)\1\s*\)/gi, (match, quote, url) => {
    const normalized = normalizeImageUrl(url, { proxyHttp: true })
    return normalized ? `url("${normalized.replace(/"/g, '%22')}")` : match
  })
}

// 基础样式会先隐藏伪元素，避免主题自带贴图叠到皮肤上。
// 当前皮肤只要声明了实际的 ::before / ::after 内容，就显式恢复显示。
function enableDecorativePseudos(css) {
  return String(css || '').replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selectors, body) => {
    if (!selectors.includes('::before') && !selectors.includes('::after')) return rule
    const content = body.match(/content\s*:\s*([^;]+)/i)?.[1]?.trim() || ''
    if (!content || /^none\b/i.test(content)) return rule
    if (/display\s*:\s*none/i.test(body)) return rule
    return `${selectors}{display:block!important;${body}}`
  })
}

function scopeAvatarFrameCss(css, side, scopeSuffix = '') {
  const targetClass = (side === 'user' ? '.echoes-avatar-user' : '.echoes-avatar-other') + scopeSuffix
  return String(css || '').replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selectors, body) => {
    const selectorList = selectors.split(',').map((item) => item.trim()).filter(Boolean)
    if (!selectorList.some((selector) => selector.includes('.echoes-avatar-'))) return rule
    const scoped = [...new Set(selectorList.map((selector) =>
      selector.replaceAll('.echoes-avatar-user', targetClass).replaceAll('.echoes-avatar-other', targetClass)
    ))]
    return scoped.length ? `${scoped.join(',')}{${body}}` : ''
  })
}

function extendDecoratedCardCss(css) {
  return String(css || '').replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selectors, body) => {
    if (!selectors.includes('::before') && !selectors.includes('::after')) return rule
    const extras = []
    if (selectors.includes('.echoes-bubble-user')) {
      extras.push(selectors.replaceAll('.echoes-bubble-user', '.decorated-card.from-me'))
    }
    if (selectors.includes('.echoes-bubble-other')) {
      extras.push(selectors.replaceAll('.echoes-bubble-other', '.decorated-card.from-other'))
    }
    if (!extras.length) return rule
    return `${rule}\n${[...new Set(extras)].join(',')}{${body}}`
  })
}

const bubbleSkinCss = computed(() =>
  BUBBLE_BASE_CSS + extendDecoratedCardCss(
    enableDecorativePseudos(normalizeSkinCssImages(activeBubbleSkin.value?.css || ''))
  )
)
const avatarFrameSkinCss = computed(() => {
  const userCss = enableDecorativePseudos(
    normalizeSkinCssImages(scopeAvatarFrameCss(resolveAvatarFrameSkinCss(activeUserAvatarFrameSkin.value), 'user'))
  )
  const contactCss = contactAvatarFrameSkinIds.value.map((skinId) => {
    const skin = avatarFrameOptions.value.find((item) => item.id === skinId)
    if (!skin) return ''
    const attribute = `[data-avatar-frame-skin-id="${skinId.replace(/"/g, '\\"')}"]`
    return enableDecorativePseudos(
      normalizeSkinCssImages(scopeAvatarFrameCss(resolveAvatarFrameSkinCss(skin), 'contact', attribute))
    )
  }).filter(Boolean).join('\n')
  return AVATAR_FRAME_BASE_CSS + userCss + contactCss
})
watch(
  () => [
    settings.chatBubbleSkin,
    settings.userAvatarFrameSkin,
    settings.contactAvatarFrameSkin,
    ...chatState.contacts.map((contact) => `${contact.id}:${contact.avatarFrameSkin || 'none'}`),
  ],
  () => {
    document.documentElement.dataset.bubbleSkin = activeBubbleSkin.value?.id || 'default'
    document.documentElement.dataset.userAvatarFrameSkin = activeUserAvatarFrameSkin.value?.id || 'none'
    document.documentElement.dataset.contactAvatarFrameSkin = 'per-contact'
    document.documentElement.dataset.avatarFrameSkin = 'independent'
  },
  { immediate: true }
)
const dockHovered = ref(null)
const anniversaryReminder = ref('')
const appTitles = {
  sms: '聊天',
  album: '相册',
  music: '音乐',
  journey: '日历',
  moments: '朋友圈',
  stats: '消息统计',
  tarot: '塔罗牌',
  mail: '信箱',
  pomodoro: '番茄钟',
  questionnaire: '问卷',
  period: '经期记录',
  accounting: '记账',
  memory: '纪念日',
  avatarLib: '头像库',
  wishlist: '我想要这个！',
  cardLibrary: '字卡库',
}
const isChatDetail = computed(
  () => store.page === 'sms' && Boolean(chatState.activeId || chatState.activeGroupId)
)
const showAppBar = computed(() =>
  Boolean(appTitles[store.page]) && !isChatDetail.value
)
const appTitle = computed(() => appTitles[store.page] || '')
const showDock = computed(() => ['home', 'settings', 'profile'].includes(store.page))

watch(
  () => store.view,
  (view) => {
    document.documentElement.dataset.viewMode = view
  },
  { immediate: true }
)
watch(
  () => settings.siteTheme,
  (theme) => {
    document.documentElement.dataset.siteTheme = theme
  },
  { immediate: true }
)
function inferCustomFontFamily(input, configured) {
  const clean = String(configured || '').replace(/["'\\;{}]/g, '').trim().slice(0, 80)
  if (clean && clean !== 'ZhengduCustomFont') return clean
  const text = String(input || '')
  const queryMatch = text.match(/[?&]family=([^&:]+)/i)
  if (queryMatch) {
    const family = decodeURIComponent(queryMatch[1].replace(/\+/g, ' ')).split(',')[0].trim()
    if (family) return family.slice(0, 80)
  }
  const faceMatch = text.match(/font-family\s*:\s*["']?([^;"'}]+)/i)
  if (faceMatch) {
    const family = faceMatch[1].trim()
    if (family && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(family)) return family.slice(0, 80)
  }
  return 'ZhengduCustomFont'
}
function applyCustomFont() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  let style = document.getElementById('zhengdu-custom-font')
  let link = document.getElementById('zhengdu-custom-font-link')
  if (!style) {
    style = document.createElement('style')
    style.id = 'zhengdu-custom-font'
    document.head.appendChild(style)
  }
  if (!link) {
    link = document.createElement('link')
    link.id = 'zhengdu-custom-font-link'
    link.rel = 'stylesheet'
  }
  const input = String(settings.customFontUrl || '').trim()
  const family = inferCustomFontFamily(input, settings.customFontFamily)
  root.style.setProperty('--custom-font-family', `"${family}"`)
  style.textContent = ''
  link.remove()
  if (input) {
    const cssText = /@(?:font-face|import|charset)/i.test(input)
    const stylesheet = /^https?:\/\//i.test(input) && (/\.css(?:[?#]|$)/i.test(input) || /fonts\.(?:googleapis\.com|loli\.net|bunny\.net)\/css/i.test(input))
    if (cssText) {
      style.textContent = input
    } else if (stylesheet) {
      link.href = input
      document.head.appendChild(link)
    } else {
      style.textContent = `@font-face { font-family: "${family}"; src: url("${input.replace(/"/g, '\\"')}"); font-display: swap; }`
    }
  }
  root.dataset.font = settings.siteFont
  root.dataset.customFontReady = settings.siteFont === 'custom' && input ? 'true' : 'false'
}

watch(
  () => [settings.siteFont, settings.customFontUrl, settings.customFontFamily],
  applyCustomFont,
  { immediate: true }
)

watch(
  () => settings.keepAliveEnabled,
  () => syncKeepAlive(),
  { immediate: true }
)
function hexToRgb(color) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(String(color || ''))
  if (!match) return ''
  const value = Number.parseInt(match[1], 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}

function applyUserThemeColors() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const textColor = settings.themeTextColor || ''
  const appIconColor = settings.themeAppIconColor || ''
  const dockColor = settings.themeDockColor || ''
  const vars = {
    '--theme-text': textColor,
    '--theme-text-strong': textColor,
    '--theme-text-rgb': hexToRgb(textColor),
    '--app-icon-color': appIconColor,
    '--dock-color': dockColor,
    '--dock-active-color': dockColor,
  }
  for (const [name, value] of Object.entries(vars)) {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }
}

watch(
  () => [settings.themeTextColor, settings.themeAppIconColor, settings.themeDockColor],
  applyUserThemeColors,
  { immediate: true }
)
function checkAnniversaryReminder() {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(settings.anniversaryDate || ''))
  if (!match) return
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const base = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  let target = new Date(today.getFullYear(), base.getMonth(), base.getDate())
  if (settings.anniversaryMode !== 'until' && target < today) {
    target = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
  }
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (![0, 1, 2].includes(days)) return
  const dateLabel = `${target.getMonth() + 1}月${target.getDate()}日`
  const title = String(settings.anniversaryTitle || '纪念日').trim()
  const years = target.getFullYear() - base.getFullYear()
  if (days === 2) anniversaryReminder.value = `距离 ${dateLabel} 还有两天`
  else if (days === 1) anniversaryReminder.value = `距离 ${dateLabel} 还有一天`
  else anniversaryReminder.value = years > 0
    ? `今天是 ${dateLabel} · ${title} ${years} 周年`
    : `今天是 ${dateLabel} · ${title}`
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const key = `zhengdu_anniversary_reminder_${todayKey}`
  try {
    if (localStorage.getItem(key) === anniversaryReminder.value) anniversaryReminder.value = ''
  } catch {
    /* localStorage 不可用时仍显示提醒 */
  }
}

function dismissAnniversaryReminder() {
  if (!anniversaryReminder.value) return
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const key = `zhengdu_anniversary_reminder_${todayKey}`
  try { localStorage.setItem(key, anniversaryReminder.value) } catch {}
  anniversaryReminder.value = ''
}

function handleBack() {
  if (store.page === 'cardLibrary') {
    store.cardLibraryContactId = null
    go('profile')
    return
  }
  if (store.page === 'sms' && (chatState.activeId || chatState.activeGroupId)) {
    closeChat()
    return
  }
  go('home')
}

function goDock(page) {
  if (store.page === 'sms' && page !== 'sms') closeChat()
  go(page)
}

function enterAppFromSplash() {
  if (!launchSplashVisible.value || !launchSplashReady.value) return
  launchSplashVisible.value = false
}
const homeBackgroundStyle = computed(() => {
  if (store.page !== 'home') return null
  return backgroundLayerStyle(settings.homeBackground, settings.homeBackgroundOpacity)
})

function openNotification() {
  const notice = chatState.notification
  if (!notice) return
  if (notice.actionPage === 'moments') {
    go('moments')
    dismissNotification()
    return
  }
  if (notice.actionPage === 'mail') {
    go('mail')
    dismissNotification()
    return
  }
  if (notice.actionPage === 'music') {
    go('music')
    dismissNotification()
    return
  }
  if (notice.actionPage === 'wishlist') {
    go('wishlist')
    if (notice.actionId) window.dispatchEvent(new CustomEvent('zhengdu:wish-order', { detail: { id: notice.actionId } }))
    dismissNotification()
    return
  }
  if (!notice.contactId) {
    go('home')
    dismissNotification()
    return
  }
  go('sms')
  if (notice.conversationType === 'group') openGroup(notice.contactId)
  else openChat(notice.contactId)
  dismissNotification()
}

watch(
  () => store.unreadSms,
  (count) => {
    document.title = count ? `(${count}) 争渡` : '争渡'
  },
  { immediate: true }
)

const flushBeforeExit = () => {
  saveChatDataNow()
  saveSettingsNow()
  flushPersistence()
}
const onVisibilityHidden = () => {
  if (document.visibilityState === 'hidden') flushBeforeExit()
}


onMounted(() => {
  window.addEventListener('pagehide', flushBeforeExit)
  window.addEventListener('beforeunload', flushBeforeExit)
  document.addEventListener('visibilitychange', onVisibilityHidden)
  if (splashPreviewRequest) store.view = 'phone'
  if ((isNativeApp() || splashPreviewRequest) && activeSplashPreset.value.kind !== 'none') {
    launchSplashVisible.value = true
    launchSplashReady.value = false
    launchSplashTimer = window.setTimeout(() => {
      launchSplashReady.value = true
    }, 2600)
  }
  window.__zhengduNativeBack = () => {
    if (store.page === 'cardLibrary') {
      store.cardLibraryContactId = null
      go('profile')
      return true
    }
    if (store.page === 'sms' && (chatState.activeId || chatState.activeGroupId)) {
      closeChat()
      return true
    }
    if (store.page !== 'home') {
      go('home')
      return true
    }
    return false
  }
  notifyNativeReady()
  checkAnniversaryReminder()
  startChatEngine()
  startMomentsEngine()
  startMailboxEngine()
  startAvatarEngine()
  startWishlistEngine()
  loadStickerLibrary().catch(() => {})
})

onUnmounted(() => {
  saveChatDataNow()
  saveSettingsNow()
  flushPersistence()
  window.removeEventListener('pagehide', flushBeforeExit)
  window.removeEventListener('beforeunload', flushBeforeExit)
  document.removeEventListener('visibilitychange', onVisibilityHidden)
  if (launchSplashTimer) window.clearTimeout(launchSplashTimer)
  delete window.__zhengduNativeBack
  stopChatEngine()
  stopMomentsEngine()
  stopMailboxEngine()
  stopAvatarEngine()
  stopWishlistEngine()
})
</script>

<template>
   <transition name="launch-splash-fade">     <LaunchSplash       v-if="launchSplashVisible"       :preset-id="activeSplashPresetId"       :config="activeSplashConfig"       :ready="launchSplashReady"       @enter="enterAppFromSplash"     />   </transition>   <WelcomeNoticeDialog v-if="welcomeNoticeOpen" @close="closeWelcomeNotice" />   <component :is="'style'" v-if="bubbleSkinCss">{{ bubbleSkinCss }}</component>   <component :is="'style'" v-if="avatarFrameSkinCss">{{ avatarFrameSkinCss }}</component>   <div class="site-stage" :class="['stage-' + store.view, { 'stage-chat-detail': isChatDetail }]">     <div       class="echoes-app-shell echoes-app"       :class="['view-' + store.view, { 'chat-detail': isChatDetail, 'moments-page': store.page === 'moments' }]"     >       <div         v-if="homeBackgroundStyle"         class="app-custom-background"         :style="homeBackgroundStyle"       ></div>       <div v-if="!homeBackgroundStyle" class="echoes-app-overlay echoes-app-glow"></div>        <button v-if="anniversaryReminder" class="anniversary-reminder" type="button" @click="dismissAnniversaryReminder">         <span>✦ {{ anniversaryReminder }}</span>         <b aria-hidden="true">×</b>       </button>        <header v-if="showAppBar" class="app-topbar">         <button class="app-topbar-back" type="button" aria-label="返回" @click="handleBack"><LineGlyph type="back" /></button>         <h1>{{ appTitle }}</h1>         <button           v-if="store.page === 'sms' && !isChatDetail"           class="app-topbar-action"           type="button"           aria-label="发起群聊"           @click="requestGroupCreate"         >+</button>         <span v-else class="app-topbar-spacer"></span>       </header>        <main         class="echoes-page site-main"         :class="{           'is-home': store.page === 'home',           'is-chat-detail': isChatDetail,           'is-moments': store.page === 'moments',           'is-card-library': store.page === 'cardLibrary',           'no-dock': !showDock,         }"       >         <transition name="page" mode="out-in">           <component :is="current" :key="store.page" />         </transition>       </main>        <nav v-if="showDock" class="global-dock">         <div class="dock-tilt" :class="{ 'has-hover': dockHovered }">           <button             v-for="item in dockItems"             :key="item.id"             type="button"             class="dock-button"             :class="{ active: store.page === item.id }"             :aria-label="item.label"             @mouseenter="dockHovered = item.id"             @mouseleave="dockHovered = null"             @click="goDock(item.id)"           >             <span class="dock-icon">               <LineGlyph :type="item.icon" />             </span>             <span class="dock-label">{{ item.label }}</span>           </button>         </div>       </nav>        <transition name="toast">         <button           v-if="chatState.notification"           class="message-toast"           type="button"           aria-live="polite"           @click="openNotification"         >           <span             class="toast-avatar"             :style="{ background: chatState.notification.color }"           >             <img               v-if="chatState.notification.avatarImage"               :src="chatState.notification.avatarImage"               alt=""             />             <template v-else>{{ chatState.notification.avatar }}</template>           </span>           <span class="toast-main">             <strong>{{ chatState.notification.name }}</strong>             <span>{{ chatState.notification.text }}</span>           </span>         </button>       </transition>        <CallWindow />       <MusicFloat />       <PomodoroFloat />       <ImageCropDialog />     </div>   </div> </template>

<style scoped>
 .app-topbar {   flex: none;   position: sticky;   top: 0;   z-index: 25;   width: 100%;   height: calc(52px + env(safe-area-inset-top));   padding-top: env(safe-area-inset-top);   display: grid;   grid-template-columns: 46px minmax(0, 1fr) 46px;   align-items: center;   border-bottom: 1px solid var(--theme-border);   background: rgba(255, 255, 255, 0.9);   -webkit-backdrop-filter: blur(12px);   backdrop-filter: blur(12px); }  .app-topbar-back {   width: 40px;   height: 40px;   aspect-ratio: 1;   margin-left: 4px;   padding: 0;   display: grid;   place-items: center;   border: 1px solid var(--theme-border);   border-radius: 50%;   background: var(--theme-soft);   color: var(--theme-primary);   font-size: 18px;   line-height: 1;   cursor: pointer; }  .app-topbar h1 {   margin: 0;   text-align: center;   color: var(--theme-primary);   font-size: 13px;   font-weight: 800;   letter-spacing: 0.12em; }  .app-topbar-spacer {   width: 36px; }  .app-topbar-action {   width: 40px;   height: 40px;   aspect-ratio: 1;   margin-right: 4px;   padding: 0;   display: grid;   place-items: center;   justify-self: end;   border: 1px solid var(--theme-border);   border-radius: 50%;   background: var(--theme-soft);   color: var(--theme-primary);   font-size: 20px;   line-height: 1;   cursor: pointer; }  .global-dock {   position: absolute;   left: 50%;   right: auto;   bottom: 14px;   z-index: 30;   width: min(300px, calc(100% - 28px));   transform: translateX(-50%);   perspective: 900px; }  .dock-tilt {   width: 100%;   min-height: 76px;   padding: 14px 22px 20px;   border: 1px solid rgba(255, 255, 255, 0.72);   border-radius: 25px;   background: rgba(255, 255, 255, 0.72);   box-shadow: 0 15px 40px rgba(var(--theme-primary-rgb), 0.2);   -webkit-backdrop-filter: blur(18px);   backdrop-filter: blur(18px);   display: flex;   align-items: center;   justify-content: space-around;   gap: 12px;   transform-style: preserve-3d;   transition: transform 0.28s ease-out;   will-change: transform; }  .dock-button {   position: relative;   flex: 1;   min-width: 0;   min-height: 42px;   padding: 3px 4px;   border: 0;   background: transparent;   box-shadow: none;   color: var(--dock-color, var(--theme-muted));   display: flex;   flex-direction: column;   align-items: center;   justify-content: center;   transform-style: preserve-3d;   transition: color 0.18s ease, opacity 0.18s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }  .dock-icon { display: grid; place-items: center; transition: transform 0.22s ease; } .dock-icon svg { width: 27px; height: 27px; display: block; } .dock-label {   position: absolute;   top: calc(100% + 2px);   left: 50%;   transform: translate(-50%, 5px);   color: var(--theme-text-strong);   font-size: 9px;   font-weight: 700;   line-height: 1;   white-space: nowrap;   opacity: 0;   pointer-events: none;   transition: opacity 0.2s ease, transform 0.2s ease; } .dock-button:hover, .dock-button.active { color: var(--dock-active-color, var(--theme-primary)); transform: translateZ(48px) scale(1.24); } .dock-button:hover .dock-label, .dock-button.active .dock-label { color: var(--dock-active-color, var(--theme-primary)); opacity: 1; transform: translate(-50%, 0); } .dock-tilt.has-hover .dock-button:not(:hover):not(.active) { opacity: 0.48; transform: scale(0.92); }  @media (prefers-reduced-motion: reduce) {   .dock-tilt { transform: none !important; }   .dock-button, .dock-icon, .dock-label { transition: none; } }  .echoes-app-shell.moments-page .app-topbar {   background: #ffffff;   -webkit-backdrop-filter: none;   backdrop-filter: none; }  .site-main.is-card-library {   width: 100%;   max-width: none;   margin: 0;   padding: 0 !important;   overflow-y: auto; }  .site-main.is-card-library > section {   min-height: 100%; } .site-main.is-moments {   width: 100%;   max-width: none;   margin: 0;   padding: 0 !important;   overflow-y: auto; }  .site-main.is-moments > section {   min-height: 100%; } .view-site .app-topbar {   position: sticky;   top: 0;   z-index: 80;   height: calc(50px + env(safe-area-inset-top));   padding-top: env(safe-area-inset-top);   box-shadow: 0 8px 22px rgba(var(--theme-primary-rgb), 0.1); }  .view-phone .global-dock {   bottom: calc(14px + env(safe-area-inset-bottom));   height: auto;   padding: 0; }  .view-site .global-dock {   position: fixed;   bottom: calc(18px + env(safe-area-inset-bottom));   height: auto;   padding: 0; }  .app-custom-background {   position: absolute;   inset: 0;   z-index: 0;   background-size: cover;   background-position: center;   background-repeat: no-repeat;   pointer-events: none; }  .view-site .app-custom-background {   position: fixed;   width: 100%;   height: 100%; }  .message-toast {   position: absolute;   top: 12px;   left: 50%;   z-index: 90;   transform: translateX(-50%);   width: min(330px, calc(100vw - 36px));   padding: 11px 13px;   display: flex;   align-items: center;   gap: 10px;   border: 2px solid var(--theme-border);   border-radius: 18px;   background: rgba(255, 255, 255, 0.96);   box-shadow: 0 14px 36px rgba(var(--theme-primary-rgb), 0.24);   text-align: left;   cursor: pointer;   -webkit-backdrop-filter: blur(12px);   backdrop-filter: blur(12px); }  .view-site .message-toast {   position: fixed;   top: 18px;   right: 18px;   left: auto;   transform: none; }  .toast-avatar {   flex: none;   width: 38px;   height: 38px;   border-radius: 50%;   display: grid;   place-items: center;   overflow: hidden;   color: #ffffff;   font-size: 14px;   font-weight: 800; }  .toast-avatar img {   width: 100%;   height: 100%;   object-fit: cover; }  .toast-main {   min-width: 0;   display: flex;   flex-direction: column;   gap: 2px; }  .toast-main strong {   font-size: 12px;   color: var(--theme-primary); }  .toast-main > span {   overflow: hidden;   color: var(--theme-text);   font-size: 11.5px;   line-height: 1.45;   text-overflow: ellipsis;   white-space: nowrap; }  .toast-enter-active, .toast-leave-active {   transition: opacity 0.2s ease; } .toast-enter-from, .toast-leave-to {   opacity: 0; } .global-dock { bottom: 8px; width: min(260px, calc(100% - 20px)); perspective: none; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; } .dock-tilt { min-height: 54px; padding: 8px 16px 14px; border: 0 !important; border-radius: 22px; background: rgba(255,255,255,.9); box-shadow: 0 5px 16px rgba(var(--theme-primary-rgb), .13); backdrop-filter: blur(10px); transform: none !important; } .dock-button { min-height: 36px; transform: none !important; } .dock-button:hover, .dock-button.active, .dock-tilt.has-hover .dock-button:not(:hover):not(.active) { transform: none !important; } .dock-button:hover .dock-icon, .dock-button.active .dock-icon { transform: translateY(-1px) scale(1.06); } .view-phone .global-dock { bottom: calc(8px + env(safe-area-inset-bottom)); } .view-site .global-dock { bottom: calc(10px + env(safe-area-inset-bottom)); } .anniversary-reminder {   position: absolute;   z-index: 82;   top: calc(env(safe-area-inset-top, 0px) + 8px);   left: 50%;   width: min(330px, calc(100% - 28px));   transform: translateX(-50%);   padding: 9px 12px;   border: 1px solid var(--theme-border-soft);   border-radius: 12px;   background: var(--theme-surface);   color: var(--theme-primary);   box-shadow: 0 5px 18px rgba(var(--theme-shadow-rgb), 0.12);   display: flex;   align-items: center;   justify-content: space-between;   gap: 10px;   font-size: 10px;   font-weight: 700;   text-align: left; } .anniversary-reminder b { flex: none; color: var(--theme-muted); font-size: 15px; } .launch-splash-fade-leave-active { transition: opacity .35s ease, transform .35s ease; } .launch-splash-fade-leave-to { opacity: 0; transform: scale(1.025); }
</style>
