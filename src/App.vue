<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { store, go, requestGroupCreate } from './store'
import { settings } from './settings'
import { loadStickerLibrary } from './stickers'
import { backgroundLayerStyle } from './background-style'
import {
  chatState,
  closeChat,
  dismissNotification,
  openChat,
  openGroup,
  startChatEngine,
  stopChatEngine,
} from './chat'
import { startMomentsEngine, stopMomentsEngine } from './moments'
import { startMailboxEngine, stopMailboxEngine } from './mailbox'
import { startAvatarEngine, stopAvatarEngine } from './avatar-lib'
import { syncKeepAlive } from './keep-alive'
import HomeView from './views/HomeView.vue'
import SmsView from './views/SmsView.vue'
import AlbumView from './views/AlbumView.vue'
import MusicView from './views/MusicView.vue'
import JourneyView from './views/JourneyView.vue'
import MomentsView from './views/MomentsView.vue'
import SettingsView from './views/SettingsView.vue'
import ProfileView from './views/ProfileView.vue'
import StatsView from './views/StatsView.vue'
import TarotView from './views/TarotView.vue'
import MailboxView from './views/MailboxView.vue'
import PomodoroView from './views/PomodoroView.vue'
import QuestionnaireView from './views/QuestionnaireView.vue'
import PeriodView from './views/PeriodView.vue'
import AccountingView from './views/AccountingView.vue'
import MemoryView from './views/MemoryView.vue'
import AvatarLibView from './views/AvatarLibView.vue'
import FeatureHubView from './views/FeatureHubView.vue'
import ImageCropDialog from './components/ImageCropDialog.vue'
import CallWindow from './components/CallWindow.vue'
import MusicFloat from './components/MusicFloat.vue'
import PomodoroFloat from './components/PomodoroFloat.vue'
import CardLibraryDialog from './components/CardLibraryDialog.vue'
import LineGlyph from './components/LineGlyph.vue'
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
  featureHub: FeatureHubView,
  cardLibrary: CardLibraryDialog,
}

const current = computed(() => views[store.page] || HomeView)

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
const activeAvatarFrameSkin = computed(
  () => avatarFrameOptions.value.find((skin) => skin.id === settings.avatarFrameSkin) || BUILTIN_AVATAR_FRAME_SKINS[0]
)
const bubbleSkinCss = computed(() => BUBBLE_BASE_CSS + (activeBubbleSkin.value?.css || ''))
const avatarFrameSkinCss = computed(() => AVATAR_FRAME_BASE_CSS + (activeAvatarFrameSkin.value?.css || ''))
watch(
  () => [settings.chatBubbleSkin, settings.avatarFrameSkin],
  () => {
    document.documentElement.dataset.bubbleSkin = activeBubbleSkin.value?.id || 'default'
    document.documentElement.dataset.avatarFrameSkin = activeAvatarFrameSkin.value?.id || 'none'
  },
  { immediate: true }
)
const dockHovered = ref(null)
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
watch(
  () => settings.siteFont,
  (font) => {
    document.documentElement.dataset.font = font
  },
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

const homeBackgroundStyle = computed(() => {
  if (store.page !== 'home') return null
  return backgroundLayerStyle(settings.homeBackground, settings.homeBackgroundOpacity)
})

function openNotification() {
  const notice = chatState.notification
  if (!notice) return
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

onMounted(() => {
  startChatEngine()
  startMomentsEngine()
  startMailboxEngine()
  startAvatarEngine()
  loadStickerLibrary().catch(() => {})
})

onUnmounted(() => {
  stopChatEngine()
  stopMomentsEngine()
  stopMailboxEngine()
  stopAvatarEngine()
})
</script>

<template>
  <component :is="'style'" v-if="bubbleSkinCss">{{ bubbleSkinCss }}</component>
  <component :is="'style'" v-if="avatarFrameSkinCss">{{ avatarFrameSkinCss }}</component>
  <div class="site-stage" :class="['stage-' + store.view, { 'stage-chat-detail': isChatDetail }]">
    <div
      class="echoes-app-shell echoes-app"
      :class="['view-' + store.view, { 'chat-detail': isChatDetail, 'moments-page': store.page === 'moments' }]"
    >
      <div
        v-if="homeBackgroundStyle"
        class="app-custom-background"
        :style="homeBackgroundStyle"
      ></div>
      <div v-if="!homeBackgroundStyle" class="echoes-app-overlay echoes-app-glow"></div>

      <header v-if="showAppBar" class="app-topbar">
        <button class="app-topbar-back" type="button" aria-label="返回" @click="handleBack"><LineGlyph type="back" /></button>
        <h1>{{ appTitle }}</h1>
        <button
          v-if="store.page === 'sms' && !isChatDetail"
          class="app-topbar-action"
          type="button"
          aria-label="发起群聊"
          @click="requestGroupCreate"
        >+</button>
        <span v-else class="app-topbar-spacer"></span>
      </header>

      <main
        class="echoes-page site-main"
        :class="{
          'is-home': store.page === 'home',
          'is-chat-detail': isChatDetail,
          'is-moments': store.page === 'moments',
          'is-card-library': store.page === 'cardLibrary',
          'no-dock': !showDock,
        }"
      >
        <transition name="page" mode="out-in">
          <component :is="current" :key="store.page" />
        </transition>
      </main>

      <nav v-if="showDock" class="global-dock">
        <div class="dock-tilt" :class="{ 'has-hover': dockHovered }">
          <button
            v-for="item in dockItems"
            :key="item.id"
            type="button"
            class="dock-button"
            :class="{ active: store.page === item.id }"
            :aria-label="item.label"
            @mouseenter="dockHovered = item.id"
            @mouseleave="dockHovered = null"
            @click="goDock(item.id)"
          >
            <span class="dock-icon">
              <LineGlyph :type="item.icon" />
            </span>
            <span class="dock-label">{{ item.label }}</span>
          </button>
        </div>
      </nav>

      <transition name="toast">
        <button
          v-if="chatState.notification"
          class="message-toast"
          type="button"
          aria-live="polite"
          @click="openNotification"
        >
          <span
            class="toast-avatar"
            :style="{ background: chatState.notification.color }"
          >
            <img
              v-if="chatState.notification.avatarImage"
              :src="chatState.notification.avatarImage"
              alt=""
            />
            <template v-else>{{ chatState.notification.avatar }}</template>
          </span>
          <span class="toast-main">
            <strong>{{ chatState.notification.name }}</strong>
            <span>{{ chatState.notification.text }}</span>
          </span>
        </button>
      </transition>

      <CallWindow />
      <MusicFloat />
      <PomodoroFloat />
      <ImageCropDialog />
    </div>
  </div>
</template>

<style scoped>
.app-topbar {
  flex: none;
  position: sticky;
  top: 0;
  z-index: 25;
  width: 100%;
  height: 50px;
  display: grid;
  grid-template-columns: 50px 1fr 50px;
  align-items: center;
  border-bottom: 1px solid var(--theme-border);
  background: rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.app-topbar-back {
  width: 36px;
  height: 36px;
  margin-left: 10px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.app-topbar h1 {
  margin: 0;
  text-align: center;
  color: var(--theme-primary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.app-topbar-spacer {
  width: 36px;
}

.app-topbar-action {
  width: 36px;
  height: 36px;
  margin-right: 10px;
  justify-self: end;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.global-dock {
  position: absolute;
  left: 50%;
  right: auto;
  bottom: 14px;
  z-index: 30;
  width: min(300px, calc(100% - 28px));
  transform: translateX(-50%);
  perspective: 900px;
}

.dock-tilt {
  width: 100%;
  min-height: 76px;
  padding: 14px 22px 20px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 15px 40px rgba(var(--theme-primary-rgb), 0.2);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 12px;
  transform-style: preserve-3d;
  transition: transform 0.28s ease-out;
  will-change: transform;
}

.dock-button {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 42px;
  padding: 3px 4px;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--dock-color, var(--theme-muted));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
  transition: color 0.18s ease, opacity 0.18s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dock-icon { display: grid; place-items: center; transition: transform 0.22s ease; }
.dock-icon svg { width: 27px; height: 27px; display: block; }
.dock-label {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translate(-50%, 5px);
  color: var(--theme-text-strong);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.dock-button:hover,
.dock-button.active { color: var(--dock-active-color, var(--theme-primary)); transform: translateZ(48px) scale(1.24); }
.dock-button:hover .dock-label,
.dock-button.active .dock-label { color: var(--dock-active-color, var(--theme-primary)); opacity: 1; transform: translate(-50%, 0); }
.dock-tilt.has-hover .dock-button:not(:hover):not(.active) { opacity: 0.48; transform: scale(0.92); }

@media (prefers-reduced-motion: reduce) {
  .dock-tilt { transform: none !important; }
  .dock-button, .dock-icon, .dock-label { transition: none; }
}

.echoes-app-shell.moments-page .app-topbar {
  background: #ffffff;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.site-main.is-card-library {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 !important;
  overflow-y: auto;
}

.site-main.is-card-library > section {
  min-height: 100%;
}
.site-main.is-moments {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 !important;
  overflow-y: auto;
}

.site-main.is-moments > section {
  min-height: 100%;
}
.view-site .app-topbar {
  position: sticky;
  top: 0;
  z-index: 80;
  height: calc(50px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  box-shadow: 0 8px 22px rgba(var(--theme-primary-rgb), 0.1);
}

.view-phone .global-dock {
  bottom: calc(14px + env(safe-area-inset-bottom));
  height: auto;
  padding: 0;
}

.view-site .global-dock {
  position: fixed;
  bottom: calc(18px + env(safe-area-inset-bottom));
  height: auto;
  padding: 0;
}

.app-custom-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
}

.view-site .app-custom-background {
  position: fixed;
  width: 100%;
  height: 100%;
}

.message-toast {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 90;
  transform: translateX(-50%);
  width: min(330px, calc(100vw - 36px));
  padding: 11px 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid var(--theme-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 36px rgba(var(--theme-primary-rgb), 0.24);
  text-align: left;
  cursor: pointer;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.view-site .message-toast {
  position: fixed;
  top: 18px;
  right: 18px;
  left: auto;
  transform: none;
}

.toast-avatar {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
}

.toast-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.toast-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toast-main strong {
  font-size: 12px;
  color: var(--theme-primary);
}

.toast-main > span {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 11.5px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
.global-dock { bottom: 8px; width: min(260px, calc(100% - 20px)); perspective: none; }
.dock-tilt { min-height: 54px; padding: 8px 16px 14px; border-radius: 18px; background: rgba(255,255,255,.9); box-shadow: 0 5px 16px rgba(var(--theme-primary-rgb), .13); backdrop-filter: blur(10px); transform: none !important; }
.dock-button { min-height: 36px; transform: none !important; }
.dock-button:hover, .dock-button.active, .dock-tilt.has-hover .dock-button:not(:hover):not(.active) { transform: none !important; }
.dock-button:hover .dock-icon, .dock-button.active .dock-icon { transform: translateY(-1px) scale(1.06); }
.view-phone .global-dock { bottom: calc(8px + env(safe-area-inset-bottom)); }
.view-site .global-dock { bottom: calc(10px + env(safe-area-inset-bottom)); }
</style>
