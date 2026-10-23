<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LineGlyph from '../components/LineGlyph.vue'
import MusicWidgetCard from '../components/MusicWidgetCard.vue'
import { store, go } from '../store'
import { homeSession } from '../link-status'
import { settings, defaultSettings } from '../settings'
import { appIconSrc } from '../app-icons'
import { backgroundLayerStyle } from '../background-style'
import { closeChat, primaryContact, drawTaTodayCards } from '../chat'

const GRID_GAP = 18
const PAGE_COLUMNS = 4
const PAGE_ROWS = 8
const now = ref(new Date())
const activePage = ref(store.homePage || 0)
const layoutEditing = ref(false)
const draggingId = ref('')
const dragOffset = ref({ x: 0, y: 0 })
let clockTimer = null
let touchStart = null

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function timeAtOffset(date, offsetMinutes) {
  return formatTime(new Date(date.getTime() + offsetMinutes * 60_000))
}

const myTime = computed(() => formatTime(now.value))
const hisTime = computed(() => timeAtOffset(now.value, homeSession.timeOffsetMinutes))
const hearts = computed(() => homeSession.hearts)
const anniversaryTextColor = computed(() =>
  settings.siteTheme === 'default' &&
  settings.anniversaryTextColor === defaultSettings.anniversaryTextColor
    ? 'var(--theme-accent)'
    : settings.anniversaryTextColor
)
const anniversaryCountColor = computed(() =>
  settings.siteTheme === 'default' &&
  settings.anniversaryCountColor === defaultSettings.anniversaryCountColor
    ? 'var(--theme-primary)'
    : settings.anniversaryCountColor
)

function parseLocalDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : new Date(2026, 9, 18)
}

const anniversary = computed(() => {
  const anniversaryDate = parseLocalDate(settings.anniversaryDate)
  const today = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  const dayMs = 86_400_000
  if (settings.anniversaryMode === 'until') {
    let target = new Date(today.getFullYear(), anniversaryDate.getMonth(), anniversaryDate.getDate())
    if (target.getTime() < today.getTime()) {
      target = new Date(today.getFullYear() + 1, anniversaryDate.getMonth(), anniversaryDate.getDate())
    }
    return {
      days: Math.max(0, Math.round((target.getTime() - today.getTime()) / dayMs)),
      unit: '天',
    }
  }
  return {
    days: Math.max(0, Math.floor((today.getTime() - anniversaryDate.getTime()) / dayMs)),
    unit: '天',
  }
})

const anniversaryTitle = computed(() => settings.anniversaryTitle || '我们在一起已经')
const chatContact = computed(() => primaryContact())
const anniversaryBackgroundStyle = computed(() =>
  backgroundLayerStyle(settings.anniversaryBackground, settings.anniversaryBackgroundOpacity)
)

const anniversaryTitleEffectiveColor = computed(
  () => settings.anniversaryCardTextColor || anniversaryTextColor.value
)
const anniversaryCountEffectiveColor = computed(
  () => settings.anniversaryCardTextColor || anniversaryCountColor.value
)
const anniversaryCardStyle = computed(() =>
  settings.anniversaryCardColor ? { '--home-card-color': settings.anniversaryCardColor } : {}
)
const timeCardStyle = computed(() => ({
  ...(settings.timeCardColor ? { '--home-card-color': settings.timeCardColor } : {}),
  ...(settings.timeCardTextColor ? { '--home-card-text': settings.timeCardTextColor } : {}),
}))
const linkCardStyle = computed(() => ({
  ...(settings.linkStatusCardColor ? { '--home-card-color': settings.linkStatusCardColor } : {}),
  ...(settings.linkStatusCardTextColor
    ? { '--home-card-text': settings.linkStatusCardTextColor }
    : {}),
}))
const TA_TODAY_KEY = 'zhengdu_ta_today_v1'
function taTodayDateKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function loadTaTodayCards() {
  try {
    const saved = JSON.parse(localStorage.getItem(TA_TODAY_KEY) || 'null')
    if (saved && saved.date === taTodayDateKey() && Array.isArray(saved.cards) && saved.cards.length) {
      return saved.cards
    }
  } catch {}
  const min = Math.max(1, Math.min(3, Number(settings.taTodayCardMin) || 1))
  const max = Math.max(min, Math.min(3, Number(settings.taTodayCardMax) || 3))
  const cards = drawTaTodayCards(min, max)
  try { localStorage.setItem(TA_TODAY_KEY, JSON.stringify({ date: taTodayDateKey(), cards })) } catch {}
  return cards
}
const taTodayCards = ref(loadTaTodayCards())
const taTodayCardStyle = computed(() => ({
  ...(settings.taTodayCardColor ? { '--home-card-color': settings.taTodayCardColor } : {}),
  ...(settings.taTodayCardTextColor ? { '--home-card-text': settings.taTodayCardTextColor } : {}),
}))
function parseCardRatio(value, fallback) {
  const match = String(value ?? '').trim().match(/^([1-4])\s*[xX×]\s*([1-8])$/)
  return match ? { w: Number(match[1]), h: Number(match[2]) } : fallback
}

const cardSizes = computed(() => ({
  'anniversary-card': parseCardRatio(settings.anniversaryCardSize, { w: 4, h: 2 }),
  'time-card': parseCardRatio(settings.timeCardSize, { w: 2, h: 1 }),
  'link-card': parseCardRatio(settings.linkStatusCardSize, { w: 2, h: 1 }),
  'ta-today-card': parseCardRatio(settings.taTodayCardSize, { w: 2, h: 2 }),
  'music-widget': { w: 4, h: 2 },
}))

function getItemSize(id) {
  return cardSizes.value[id] || { w: 1, h: 1 }
}

function areaIsFree(page, x, y, w, h, occupied, ignoreId = '') {
  if (x < 0 || y < 0 || x + w > PAGE_COLUMNS || y + h > PAGE_ROWS) return false
  return !occupied.some((item) => {
    if (item.id === ignoreId || item.page !== page) return false
    return x < item.x + item.w && x + w > item.x && y < item.y + item.h && y + h > item.y
  })
}

function findNearestFreePosition(page, targetX, targetY, w, h, occupied, ignoreId = '') {
  let best = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let y = 0; y <= PAGE_ROWS - h; y += 1) {
    for (let x = 0; x <= PAGE_COLUMNS - w; x += 1) {
      if (!areaIsFree(page, x, y, w, h, occupied, ignoreId)) continue
      const score = (x - targetX) ** 2 + (y - targetY) ** 2
      if (score < bestScore) {
        best = { x, y }
        bestScore = score
      }
    }
  }
  return best
}

const resolvedLayout = computed(() => {
  const occupied = [[], []]
  const result = new Map()
  const saved = [...(settings.homeLayout || [])].sort(
    (a, b) => a.page - b.page || a.y - b.y || a.x - b.x
  )
  for (const item of saved) {
    const size = getItemSize(item.id)
    const page = Math.max(0, Math.min(1, Number(item.page) || 0))
    const targetX = Math.max(0, Math.min(PAGE_COLUMNS - size.w, Number(item.x) || 0))
    const targetY = Math.max(0, Math.min(PAGE_ROWS - size.h, Number(item.y) || 0))
    const position =
      findNearestFreePosition(page, targetX, targetY, size.w, size.h, occupied[page]) || {
        x: targetX,
        y: targetY,
      }
    const placed = { id: item.id, page, x: position.x, y: position.y, ...size }
    occupied[page].push(placed)
    result.set(item.id, placed)
  }
  return result
})

function itemGridStyle(id) {
  const item = resolvedLayout.value.get(id)
  if (!item) return {}
  return {
    gridColumn: `${item.x + 1} / span ${item.w}`,
    gridRow: `${item.y + 1} / span ${item.h}`,
  }
}

function itemStyle(id) {
  const style = [itemGridStyle(id)]
  if (draggingId.value === id) {
    style.push({
      transform: `translate3d(${dragOffset.value.x}px, ${dragOffset.value.y}px, 0)`,
      zIndex: 80,
      transition: 'none',
    })
  }
  return style
}

const homeApps = [
  { id: 'album', label: '相册', glyph: 'album' },
  { id: 'journey', label: '日历', glyph: 'journey' },
  { id: 'music', label: '音乐', glyph: 'music' },
  { id: 'sms', label: '聊天', glyph: 'sms' },
  { id: 'moments', label: '朋友圈', glyph: 'moments' },
  { id: 'stats', label: '消息统计', glyph: 'stats' },
  { id: 'mail', label: '信箱', glyph: 'mail' },
  { id: 'pomodoro', label: '番茄钟', glyph: 'pomodoro' },
  { id: 'tarot', label: '塔罗牌', glyph: 'tarot' },
  { id: 'questionnaire', label: '问卷', glyph: 'questionnaire' },
  { id: 'period', label: '经期记录', glyph: 'period' },
  { id: 'accounting', label: '记账', glyph: 'accounting' },
  { id: 'memory', label: '纪念日', glyph: 'heart' },
  { id: 'avatarLib', label: '头像库', glyph: 'user' },
]

function appsForPage(page) {
  return homeApps
    .filter((app) => resolvedLayout.value.get(app.id)?.page === page)
    .sort((a, b) => {
      const first = resolvedLayout.value.get(a.id)
      const second = resolvedLayout.value.get(b.id)
      return first.y - second.y || first.x - second.x
    })
}

const pageOneApps = computed(() => appsForPage(0))
const pageTwoApps = computed(() => appsForPage(1))
const gridStyle = computed(() => ({
  '--grid-gap': `${GRID_GAP}px`,
}))

const pageTrackStyle = computed(() => ({
  transform: `translate3d(-${activePage.value * 50}%, 0, 0)`,
}))


function setPage(index) {
  activePage.value = Math.max(0, Math.min(1, index))
  store.homePage = activePage.value
}

let dragState = null

function toggleLayoutEditing() {
  layoutEditing.value = !layoutEditing.value
  if (!layoutEditing.value) cleanupDrag()
}

function beginDrag(event, id) {
  if (!layoutEditing.value || event.button > 0) return
  const grid = event.currentTarget.closest('.bento-grid')
  const item = resolvedLayout.value.get(id)
  if (!grid || !item) return
  event.preventDefault()
  dragState = {
    id,
    grid,
    page: item.page,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  }
  draggingId.value = id
  dragOffset.value = { x: 0, y: 0 }
  document.body.classList.add('home-dragging')
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  } catch {}
  window.addEventListener('pointermove', handleDragMove, { passive: false })
  window.addEventListener('pointerup', finishDrag)
  window.addEventListener('pointercancel', cleanupDrag)
}

function gridForPage(page) {
  return document.querySelector(`.home-page[data-home-page="${page}"] .bento-grid`)
}

function switchDragPage(nextPage) {
  if (!dragState || activePage.value === nextPage) return
  const viewport = document.querySelector('.home-viewport')
  const width = viewport?.getBoundingClientRect().width || window.innerWidth
  const direction = nextPage > activePage.value ? -1 : 1
  dragState.startX += direction * width
  setPage(nextPage)
  dragState.page = nextPage
  dragState.grid = gridForPage(nextPage) || dragState.grid
}

function handleDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  event.preventDefault()
  const viewport = document.querySelector('.home-viewport')
  const rect = viewport?.getBoundingClientRect()
  if (rect) {
    const edge = Math.min(54, rect.width * 0.14)
    if (event.clientX <= rect.left + edge && activePage.value > 0) {
      switchDragPage(0)
    } else if (event.clientX >= rect.right - edge && activePage.value < 1) {
      switchDragPage(1)
    }
  }
  dragOffset.value = {
    x: event.clientX - dragState.startX,
    y: event.clientY - dragState.startY,
  }
}

function finishDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const id = dragState.id
  const page = activePage.value
  const grid = gridForPage(page) || dragState.grid
  const rect = grid.getBoundingClientRect()
  const columnStep = (rect.width - GRID_GAP * 3) / PAGE_COLUMNS + GRID_GAP
  const rowStep = (rect.height - GRID_GAP * 7) / PAGE_ROWS + GRID_GAP
  const size = getItemSize(id)
  const pointerX = Math.floor((event.clientX - rect.left) / columnStep)
  const pointerY = Math.floor((event.clientY - rect.top) / rowStep)
  const targetX = Math.max(0, Math.min(PAGE_COLUMNS - size.w, pointerX))
  const targetY = Math.max(0, Math.min(PAGE_ROWS - size.h, pointerY))
  const items = [...resolvedLayout.value.values()].map((item) => ({ ...item }))
  const dragged = items.find((item) => item.id === id)
  if (dragged) {
    dragged.page = page
    dragged.x = targetX
    dragged.y = targetY
    const overlaps = (first, second) =>
      first.page === second.page &&
      first.x < second.x + second.w &&
      first.x + first.w > second.x &&
      first.y < second.y + second.h &&
      first.y + first.h > second.y
    const collided = items.filter((item) => item.id !== id && overlaps(dragged, item))
    const occupied = items.filter((item) => !collided.includes(item))
    let movedAll = true
    for (const item of collided) {
      const itemSize = getItemSize(item.id)
      const position = findNearestFreePosition(
        page,
        item.x,
        item.y,
        itemSize.w,
        itemSize.h,
        occupied
      )
      if (!position) {
        movedAll = false
        break
      }
      item.x = position.x
      item.y = position.y
      occupied.push({ ...item, ...itemSize })
    }
    if (movedAll) {
      settings.homeLayout = items.map((item) => ({
        id: item.id,
        page: item.page,
        x: item.x,
        y: item.y,
      }))
    }
  }
  cleanupDrag()
}
function cleanupDrag() {
  window.removeEventListener('pointermove', handleDragMove)
  window.removeEventListener('pointerup', finishDrag)
  window.removeEventListener('pointercancel', cleanupDrag)
  document.body.classList.remove('home-dragging')
  draggingId.value = ''
  dragOffset.value = { x: 0, y: 0 }
  dragState = null
}

function handleTouchStart(event) {
  if (layoutEditing.value || event.touches.length !== 1) return
  const touch = event.touches[0]
  touchStart = { x: touch.clientX, y: touch.clientY }
}

function handleTouchEnd(event) {
  if (layoutEditing.value) return
  if (!touchStart) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - touchStart.x
  const dy = touch.clientY - touchStart.y
  touchStart = null
  if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.2) return
  setPage(dx < 0 ? 1 : 0)
}

function handleTouchCancel() {
  touchStart = null
}

function openApp(id) {
  if (layoutEditing.value) return
  if (id === 'sms') closeChat()
  go(id)
}

function updateNow() {
  now.value = new Date()
}

function handleVisibilityChange() {
  if (!document.hidden) updateNow()
}

onMounted(() => {
  updateNow()
  clockTimer = setInterval(updateNow, 1000)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  cleanupDrag()
  if (clockTimer) clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <section class="home" :class="{ 'layout-editing': layoutEditing }">
    <div
      class="home-viewport"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <div class="home-track" :style="pageTrackStyle">
        <div class="home-page" data-home-page="0" :aria-hidden="activePage !== 0" :inert="activePage !== 0">
          <div class="bento-grid" :style="gridStyle">
      <div
        class="echoes-character-card day-card home-item"
        :class="{ dragging: draggingId === 'anniversary-card' }"
        :style="[itemStyle('anniversary-card'), anniversaryCardStyle]"
        @pointerdown="beginDrag($event, 'anniversary-card')"
      >
        <div
          v-if="settings.anniversaryBackground"
          class="day-bg"
          :style="anniversaryBackgroundStyle"
        />
        <div class="day-info-panel">
          <div class="avatar-pair">
            <span class="day-avatar">
              <span class="day-avatar-core">
                <img
                  v-if="settings.anniversaryAvatarA"
                  :src="settings.anniversaryAvatarA"
                  alt="纪念日头像一"
                />
                <span v-else>♡</span>
              </span>
              <img
                v-if="chatContact?.avatarFrame"
                class="day-avatar-frame"
                :src="chatContact.avatarFrame"
                alt=""
              />
            </span>
            <span class="day-avatar">
              <span class="day-avatar-core">
                <img
                  v-if="settings.anniversaryAvatarB"
                  :src="settings.anniversaryAvatarB"
                  alt="纪念日头像二"
                />
                <span v-else>♡</span>
              </span>
              <img
                v-if="settings.userAvatarFrame"
                class="day-avatar-frame"
                :src="settings.userAvatarFrame"
                alt=""
              />
            </span>
          </div>
          <div class="day-title" :style="{ color: anniversaryTitleEffectiveColor }">
            {{ anniversaryTitle }}
          </div>
          <div class="day-count" :style="{ color: anniversaryCountEffectiveColor }">
            <strong>{{ anniversary.days }}</strong>
            <span :style="{ color: anniversaryTitleEffectiveColor }">{{ anniversary.unit }}</span>
          </div>
        </div>
      </div>

      <button
        v-for="widget in pageOneApps"
        :key="widget.id"
        :data-app-id="widget.id"
        class="entry home-item"
        :class="{ dragging: draggingId === widget.id }"
        :style="itemStyle(widget.id)"
        type="button"
        @pointerdown="beginDrag($event, widget.id)"
        @click="openApp(widget.id)"
      >
        <span class="entry-ui">
          <img
            v-if="appIconSrc(settings, widget.id)"
            class="custom-app-icon"
            :src="appIconSrc(settings, widget.id)"
            :alt="widget.label"
          />
          <span v-else class="entry-tile">
            <LineGlyph :type="widget.glyph" />
          </span>
          <span v-if="widget.id === 'sms' && store.unreadSms" class="entry-badge">
            {{ store.unreadSms > 9 ? '9+' : store.unreadSms }}
          </span>
        </span>
        <span class="entry-label">{{ widget.label }}</span>
      </button>

      <div
        class="echoes-character-card time-card home-item"
        :class="{ dragging: draggingId === 'time-card' }"
        :style="[itemStyle('time-card'), timeCardStyle]"
        @pointerdown="beginDrag($event, 'time-card')"
      >
        <div class="ts-top">
          <div class="ts-cell">
            <span class="ts-kicker">他的时间</span>
            <span class="ts-value">{{ hisTime }}</span>
          </div>
          <span class="ts-line" />
          <div class="ts-cell">
            <span class="ts-kicker">我的时间</span>
            <span class="ts-value">{{ myTime }}</span>
          </div>
        </div>
      </div>

      <div
        class="echoes-character-card link-card home-item"
        :class="{ dragging: draggingId === 'link-card' }"
        :style="[itemStyle('link-card'), linkCardStyle]"
        @pointerdown="beginDrag($event, 'link-card')"
      >
        <span class="ts-kicker">链接状态</span>
        <span
          class="ts-status link-hearts"
          role="img"
          :aria-label="`链接状态：${hearts} / 5 颗爱心`"
        >
          <span
            v-for="index in 5"
            :key="index"
            :class="['link-heart', { lit: index <= hearts }]"
            aria-hidden="true"
          >♥</span>
        </span>
      </div>
      <div
        v-if="resolvedLayout.get('music-widget')?.page === 0"
        class="music-widget-home home-item"
        :class="{ dragging: draggingId === 'music-widget' }"
        :style="itemStyle('music-widget')"
        @pointerdown="beginDrag($event, 'music-widget')"
      >
        <MusicWidgetCard />
      </div>
      <div
        v-if="resolvedLayout.get('ta-today-card')?.page === 0"
        class="echoes-character-card ta-today-card home-item"
        :class="{ dragging: draggingId === 'ta-today-card' }"
        :style="[itemStyle('ta-today-card'), taTodayCardStyle]"
        @pointerdown="beginDrag($event, 'ta-today-card')"
      >
        <span class="ta-today-kicker">今天 TA 想对你说</span>
        <div class="ta-today-list">
          <p v-for="(card, index) in taTodayCards" :key="index">{{ card }}</p>
        </div>
      </div>

    </div>
        </div>

        <div class="home-page" data-home-page="1" :aria-hidden="activePage !== 1" :inert="activePage !== 1">
          <div class="bento-grid" :style="gridStyle">
            <button
              v-for="widget in pageTwoApps"
              :key="widget.id"
              :data-app-id="widget.id"
              class="entry home-item"
              :class="{ dragging: draggingId === widget.id }"
              :style="itemStyle(widget.id)"
              type="button"
              @pointerdown="beginDrag($event, widget.id)"
              @click="openApp(widget.id)"
            >
              <span class="entry-ui">
                <img
                  v-if="appIconSrc(settings, widget.id)"
                  class="custom-app-icon"
                  :src="appIconSrc(settings, widget.id)"
                  :alt="widget.label"
                />
                <span v-else class="entry-tile">
                  <LineGlyph :type="widget.glyph" />
                </span>
              </span>
              <span class="entry-label">{{ widget.label }}</span>
            </button>
            <div
              v-if="resolvedLayout.get('music-widget')?.page === 1"
              class="music-widget-home home-item"
              :class="{ dragging: draggingId === 'music-widget' }"
              :style="itemStyle('music-widget')"
              @pointerdown="beginDrag($event, 'music-widget')"
            >
              <MusicWidgetCard />
            </div>
            <div
              v-if="resolvedLayout.get('ta-today-card')?.page === 1"
              class="echoes-character-card ta-today-card home-item"
              :class="{ dragging: draggingId === 'ta-today-card' }"
              :style="[itemStyle('ta-today-card'), taTodayCardStyle]"
              @pointerdown="beginDrag($event, 'ta-today-card')"
            >
              <span class="ta-today-kicker">今天 TA 想对你说</span>
              <div class="ta-today-list">
                <p v-for="(card, index) in taTodayCards" :key="index">{{ card }}</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    <div class="home-pager">
      <div class="pager-tabs" role="tablist" aria-label="主页分页">
        <button
          v-for="pageIndex in 2"
          :key="pageIndex"
          class="pager-dot"
          :class="{ active: activePage === pageIndex - 1 }"
          type="button"
          role="tab"
          :aria-label="`第 ${pageIndex} 页`"
          :aria-selected="activePage === pageIndex - 1"
          @click="setPage(pageIndex - 1)"
        />
      </div>
      <button
        class="layout-edit-toggle"
        :class="{ active: layoutEditing }"
        type="button"
        :aria-pressed="layoutEditing"
        @click="toggleLayoutEditing"
      >
        {{ layoutEditing ? '完成' : '整理' }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.home{position:relative;width:100%;max-width:520px;height:100%;min-height:0;margin:0 auto;display:flex;flex-direction:column}
.home-viewport{flex:1 1 auto;width:100%;min-height:0;overflow:hidden;touch-action:pan-y}
.home-track{width:200%;height:100%;display:flex;align-items:stretch;transition:transform .38s cubic-bezier(.22,.72,.2,1);will-change:transform}
.home-page{flex:0 0 50%;width:50%;height:100%;min-width:0}
.home-pager{display:flex;align-items:center;justify-content:center;gap:8px;padding:2px 0 3px}
.pager-tabs{display:flex;align-items:center;justify-content:center;gap:2px}
.layout-edit-toggle{height:22px;padding:0 9px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-soft);color:var(--theme-text);font-size:10px;font-weight:700;cursor:pointer;transition:background .2s ease,color .2s ease}
.layout-edit-toggle.active{background:var(--theme-primary);color:#fff}
.view-site .home-pager{position:absolute;left:50%;bottom:-36px;z-index:31;transform:translateX(-50%);padding:4px 9px;border:1px solid rgba(255,255,255,.72);border-radius:999px;background:rgba(255,255,255,.82);box-shadow:0 5px 16px rgba(var(--theme-primary-rgb),.12);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.pager-dot{width:20px;height:20px;padding:0;border:0;border-radius:999px;background:transparent;box-shadow:none;display:grid;place-items:center;cursor:pointer}
.pager-dot::after{content:"";display:block;width:7px;height:7px;border-radius:999px;background:var(--theme-border);transition:width .24s ease,background .24s ease}
.pager-dot.active::after{width:18px;background:var(--theme-primary)}
.bento-grid{width:100%;height:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(8,minmax(0,1fr));gap:var(--grid-gap);justify-content:center;align-items:stretch;margin:0}
.day-card{position:relative;grid-column:span 4;grid-row:span 2;min-width:0;padding:0;overflow:hidden;border:0!important;border-radius:28px;background:var(--theme-bg-deep)!important}
.day-bg{position:absolute;top:0;right:0;bottom:0;left:0;z-index:0;background-size:cover;background-position:center;background-repeat:no-repeat}
.day-info-panel{position:absolute;right:0;bottom:0;left:0;z-index:2;height:62%;padding:clamp(26px,7vw,36px) clamp(10px,2.8vw,18px) clamp(6px,1.6vw,10px);border:0;border-radius:24px 24px 0 0;background:#fffffff0;box-shadow:inset 0 1px #ffffffe6;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:visible}
.avatar-pair{position:absolute;top:0;left:50%;z-index:3;display:flex;align-items:center;justify-content:center;gap:clamp(9px,2.5vw,14px);transform:translate(-50%,-50%)}
.day-avatar{position:relative;width:clamp(44px,11vw,58px);aspect-ratio:1;flex:none;display:grid;place-items:center}
.day-avatar-core{width:100%;height:100%;border:3px solid rgba(255,255,255,.96);border-radius:50%;background:var(--theme-surface);display:grid;place-items:center;overflow:hidden;color:var(--theme-muted);font-size:22px;font-weight:500;box-shadow:0 6px 18px rgba(var(--theme-primary-rgb),.2),0 0 0 1px rgba(var(--theme-border-rgb),.75)}
.day-avatar-core>img{width:100%;height:100%;object-fit:cover}
.day-avatar-frame{position:absolute;top:50%;left:50%;z-index:2;width:112%;height:112%;max-width:none;object-fit:contain;border-radius:0;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 3px 6px rgba(var(--theme-primary-rgb),.16))}
.day-title{position:relative;z-index:1;max-width:94%;text-align:center;font-size:clamp(10px,2.5vw,13px);font-weight:700;line-height:1.35;letter-spacing:.06em;color:var(--theme-accent)}
.day-count{position:relative;z-index:1;margin-top:3px;display:flex;align-items:baseline;justify-content:center;gap:5px;color:var(--theme-primary)}
.day-count strong{font-size:clamp(28px,7.5vw,46px);font-weight:300;line-height:.95;letter-spacing:-.02em}
.day-count span{font-size:clamp(9px,2.2vw,11px);font-weight:700;color:var(--app-icon-color)}
.entry{position:relative;width:100%;height:100%;min-width:0;min-height:0;padding:0;border:0;background:none;box-shadow:none;filter:none;display:grid;place-items:center;cursor:pointer;container-type:size}
.entry-ui{width:min(92cqw,92cqh);height:min(92cqw,92cqh);overflow:hidden;border:1px solid var(--theme-border-soft);border-radius:20px;background:#fff;box-shadow:none;filter:none;display:grid;place-items:center;position:relative;transition:transform .16s ease,background .16s ease}
.entry:hover .entry-ui{background:var(--theme-surface);transform:translateY(-2px)}
.entry:active .entry-ui{transform:scale(.95)}
.home-item{position:relative;transition:transform .18s ease,opacity .18s ease,filter .18s ease}
.layout-editing .home-item{touch-action:none;user-select:none;cursor:grab}
.layout-editing .home-item::after{content:"";position:absolute;inset:2px;z-index:20;border:1px dashed rgba(var(--theme-primary-rgb),.45);border-radius:inherit;pointer-events:none}
.layout-editing .entry::after{border-radius:20px}
.music-widget-home{min-width:0;min-height:0;overflow:hidden;border-radius:20px}
.home-item.dragging{opacity:.82;cursor:grabbing;filter:none;box-shadow:0 12px 28px rgba(var(--theme-overlay-rgb),.16);will-change:transform}
:global(body.home-dragging) .home-track{transition:none!important}
.custom-app-icon{width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit}
.entry-tile{width:34px;height:34px;display:grid;place-items:center;color:var(--app-icon-color)}
.entry-tile svg{width:30px;height:30px;display:block}
.entry-label{position:absolute;top:calc(50% + min(46cqw,46cqh) + 2px);left:0;width:100%;max-width:100%;overflow:hidden;font-size:9.5px;font-weight:700;line-height:1;color:var(--theme-text);text-align:center;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
.entry-badge{position:absolute;top:4px;right:4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:var(--theme-accent-warm);color:#fff;font-size:9px;font-weight:800;line-height:17px;text-align:center;box-shadow:0 3px 8px rgba(var(--theme-accent-warm-rgb),.35)}
.time-card,.link-card{grid-column:span 2;grid-row:span 1;min-width:0;width:100%;overflow:hidden;border-radius:20px}
.time-card{padding:8px 10px;display:flex;align-items:center}
.link-card{padding:8px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.ta-today-card{grid-column:span 2;grid-row:span 2;min-width:0;width:100%;overflow:hidden;border-radius:20px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;container-type:size}
.ta-today-kicker{font-size:12px;font-weight:700;letter-spacing:.12em;color:var(--home-card-text,var(--theme-muted))}
.ta-today-list{display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden}
.ta-today-list p{margin:0;font-size:clamp(14px,min(4.5cqw,7cqh),17px);line-height:1.45;color:var(--home-card-text,var(--theme-text));overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ts-top{width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
.ts-cell{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;text-align:center}
.ts-kicker{font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--app-icon-color)}
.ts-value{font-size:clamp(17px,5vw,23px);font-weight:300;letter-spacing:.02em;color:var(--theme-primary);line-height:1.1}
.ts-line{width:1px;height:30px;background:var(--theme-border)}
.link-card .ts-kicker{font-size:10px;letter-spacing:.12em}
.ts-status{display:flex;align-items:center;justify-content:center;gap:7px;font-size:14px;font-weight:700;color:var(--theme-text-strong)}
.ts-status.link-hearts{gap:7px;min-height:24px}
.link-heart{display:inline-block;color:var(--theme-bg-deep);font-size:20px;line-height:1;text-shadow:none;transition:color .2s ease,transform .2s ease}
.link-heart.lit{color:#ff8fa3;animation:heart-breathe-73a7abe4 2.2s ease-in-out infinite;transform-origin:center;will-change:opacity,transform}
.link-heart.lit:nth-child(2){animation-delay:-.45s}
.link-heart.lit:nth-child(3){animation-delay:-.9s}
.link-heart.lit:nth-child(4){animation-delay:-1.35s}
.link-heart.lit:nth-child(5){animation-delay:-1.8s}
@keyframes heart-breathe-73a7abe4{0%,to{opacity:.7;transform:translateY(0) scale(.96);text-shadow:none}
50%{opacity:1;transform:translateY(-1px) scale(1.1);text-shadow:none}
}
@media(prefers-reduced-motion:reduce){.link-heart.lit{animation:none;opacity:1;transform:translateY(-1px) scale(1.03);text-shadow:none}
}
.home-dock{margin-top:auto;display:flex;justify-content:center;gap:4px;width:fit-content;margin-left:auto;margin-right:auto;border:2px solid var(--theme-border);border-radius:999px;background:#ffffffd9;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 4px 16px rgba(var(--theme-accent-rgb),.15)}
.dock-item{padding:9px 18px;border:0;border-radius:999px;background:transparent;color:var(--theme-text);font-size:12px;font-weight:700;letter-spacing:.04em;cursor:pointer;transition:background .16s ease,color .16s ease}
.dock-item:hover{background:var(--theme-soft)}
.dock-item.active{background:var(--theme-pale);color:var(--theme-primary)}
@media(prefers-reduced-motion:reduce){.home-track{transition:none}.pager-dot::after{transition:none}}
@media(max-width:560px){.day-card{border-radius:24px}
.entry-ui{border-radius:17px}
.entry-tile{width:30px;height:30px}
.entry-tile svg{width:30px;height:30px}
.entry-label{font-size:9px}
.time-status{border-radius:20px;padding:9px 12px}
}

/* 主页组件卡片：无外框、无外部泛光，并按卡片比例自适应文字 */
.day-card,.time-card,.link-card,.ta-today-card{border:0!important;box-shadow:none!important;filter:none!important;container-type:size}
.day-card{background:var(--home-card-color,var(--theme-bg-deep))!important}
.time-card,.link-card,.ta-today-card{background:var(--home-card-color,#fff)!important}
.day-info-panel{height:66%;padding:clamp(18px,14cqh,42px) clamp(8px,4cqw,20px) clamp(5px,4cqh,12px);justify-content:center}
.avatar-pair{gap:clamp(5px,min(4cqw,8cqh),14px)}
.day-avatar{width:clamp(30px,min(14cqw,26cqh),64px)}
.day-title{font-size:clamp(9px,min(3.6cqw,6cqh),15px)}
.day-count strong{font-size:clamp(20px,min(15cqw,22cqh),52px)}
.time-card .ts-kicker,.link-card .ts-kicker{color:var(--home-card-text,var(--theme-muted))}
.time-card .ts-value{color:var(--home-card-text,var(--theme-primary));font-size:clamp(14px,min(10cqw,23cqh),27px)}
.link-card .ts-status{color:var(--home-card-text,var(--theme-text-strong))}
.link-heart{font-size:clamp(16px,min(6cqw,20cqh),26px)}
.time-card .ts-line{height:clamp(18px,42cqh,36px)}</style>
