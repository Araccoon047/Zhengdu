<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { store } from '../store'
import { settings } from '../settings'
import {
  currentTrack, formatMusicTime, musicState, musicSettings,
  playNext, playPrev, setMusicMode, toggleFavorite,
  togglePlay, closeFloat, reopenFloat, toggleFloatMin, MUSIC_MODES,
} from '../music-player'

const POS_KEY = 'zhengdu_music_float_pos_v1'
const position = ref(loadPosition())
const dragging = ref(false)
let startX = 0
let startY = 0
let originX = 0
let originY = 0

const widgetPage = computed(() => {
  const item = (settings.homeLayout || []).find((entry) => entry.id === 'music-widget')
  return item ? Number(item.page) || 0 : -1
})
const hidden = computed(() =>
  !musicSettings.floatEnabled ||
  musicState.floatClosed ||
  !currentTrack.value ||
  store.page === 'music' ||
  (store.page === 'home' && Number(store.homePage || 0) === widgetPage.value)
)
const progress = computed(() => musicState.duration > 0 ? Math.min(100, musicState.currentTime / musicState.duration * 100) : 0)
const modeLabel = computed(() => MUSIC_MODES.find((mode) => mode.id === musicState.mode)?.label || '列表播放')
const isFavorite = computed(() => currentTrack.value && musicState.favorites.includes(currentTrack.value.id))

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || '{}')
    return { left: Math.max(4, Number(saved.left) || 12), top: Math.max(4, Number(saved.top) || 84) }
  } catch { return { left: 12, top: 84 } }
}
function savePosition() {
  try { localStorage.setItem(POS_KEY, JSON.stringify(position.value)) } catch {}
}
function clampPosition() {
  const el = document.querySelector('.music-float')
  const width = el?.offsetWidth || 230
  const height = el?.offsetHeight || 110
  position.value = {
    left: Math.max(4, Math.min(window.innerWidth - width - 4, position.value.left)),
    top: Math.max(4, Math.min(window.innerHeight - height - 4, position.value.top)),
  }
  savePosition()
}
function startDrag(event) {
  if (event.button > 0 || event.target.closest('button')) return
  const el = event.currentTarget.closest('.music-float')
  if (!el) return
  const rect = el.getBoundingClientRect()
  startX = event.clientX
  startY = event.clientY
  originX = rect.left
  originY = rect.top
  dragging.value = true
  window.addEventListener('pointermove', moveDrag, { passive: false })
  window.addEventListener('pointerup', stopDrag, { once: true })
}
function moveDrag(event) {
  if (!dragging.value) return
  event.preventDefault()
  position.value = { left: originX + event.clientX - startX, top: originY + event.clientY - startY }
  clampPosition()
}
function stopDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', moveDrag)
  savePosition()
}
function cycleMode() {
  const modes = MUSIC_MODES.map((item) => item.id)
  setMusicMode(modes[(modes.indexOf(musicState.mode) + 1) % modes.length])
}
function dismissFloat() {
  closeFloat()
}
function restoreFloat() {
  reopenFloat()
}

watch(() => musicSettings.floatEnabled, (enabled) => { if (enabled) reopenFloat() })
watch(hidden, (value) => { if (!value) requestAnimationFrame(clampPosition) })
onMounted(() => {
  window.addEventListener('resize', clampPosition)
  clampPosition()
})
onUnmounted(() => {
  window.removeEventListener('resize', clampPosition)
  window.removeEventListener('pointermove', moveDrag)
})

defineExpose({ restoreFloat })
</script>

<template>
  <transition name="music-float-pop">
    <aside
      v-if="!hidden"
      class="music-float"
      :class="{ min: musicState.floatMin, dragging }"
      :style="{ left: position.left + 'px', top: position.top + 'px' }"
      @pointerdown="startDrag"
    >
      <template v-if="!musicState.floatMin">
        <button class="float-collapse" type="button" title="收起小框" @click="toggleFloatMin">⌄</button>
        <div class="float-head"><span>正在播放</span><button type="button" title="关闭" @click="dismissFloat">×</button></div>
<div class="float-main"><span class="float-cover"><img v-if="currentTrack?.cover" :src="currentTrack.cover" alt="" /><template v-else>♪</template></span><div class="float-copy"><strong>{{ currentTrack?.name }}</strong><small>{{ currentTrack?.artist }}</small></div></div>
        <div class="float-progress"><i :style="{ width: progress + '%' }"></i></div>
        <div class="float-times"><span>{{ formatMusicTime(musicState.currentTime) }}</span><span>{{ formatMusicTime(musicState.duration) }}</span></div>
        <div class="float-controls">
          <button type="button" :title="modeLabel" @click="cycleMode">↻</button>
          <button type="button" title="上一首" @click="playPrev">‹</button>
          <button type="button" class="float-play" title="播放或暂停" @click="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
          <button type="button" title="下一首" @click="playNext">›</button>
          <button type="button" :class="{ liked: isFavorite }" title="收藏" @click="currentTrack && toggleFavorite(currentTrack.id)">♥</button>
        </div>
      </template>
      <div v-else class="float-mini">
        <button type="button" class="mini-play" @click="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
        <span class="mini-name">{{ currentTrack?.name }}</span>
        <button type="button" class="mini-expand" title="展开小框" @click="toggleFloatMin">⌃</button>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.music-float{position:fixed;z-index:230;width:230px;padding:8px 9px 9px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface);color:var(--theme-text);touch-action:none;cursor:grab}
.music-float.dragging{cursor:grabbing;opacity:.94}.music-float.min{width:auto;max-width:230px;padding:5px 6px}
.float-collapse{position:absolute;right:6px;top:4px;width:20px;height:20px;padding:0;border:0;background:transparent;color:var(--theme-muted);cursor:pointer}
.float-head{display:flex;align-items:center;justify-content:space-between;padding-right:18px;color:var(--theme-muted);font-size:8px;font-weight:800;letter-spacing:.1em}.float-head button{width:18px;height:18px;padding:0;border:0;background:transparent;color:var(--theme-muted);font-size:14px;cursor:pointer}
.float-main{display:flex;align-items:center;gap:7px;margin-top:4px;min-width:0}.float-cover{flex:none;width:38px;height:38px;border-radius:50%;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;background:var(--theme-soft);color:var(--theme-primary);font-size:16px}.float-cover img{width:100%;height:100%;object-fit:cover;border-radius:50%}.float-copy{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}.float-copy strong,.float-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.float-copy strong{color:var(--theme-text-strong);font-size:12.5px}.float-copy small{color:var(--theme-muted);font-size:9px}
.float-progress{height:2px;margin-top:6px;border-radius:99px;background:var(--theme-border-soft);overflow:hidden}.float-progress i{display:block;height:100%;background:var(--theme-primary)}
.float-times{display:flex;justify-content:space-between;margin-top:2px;color:var(--theme-muted);font-size:6.5px}
.float-controls{display:flex;align-items:center;justify-content:space-between;margin-top:5px}.float-controls button,.float-mini button{width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--theme-muted);font-size:12px;cursor:pointer}.float-controls button:hover{color:var(--theme-primary)}.float-controls button.liked{color:#e05555}.float-controls .float-play{width:34px;height:34px;background:var(--theme-primary);color:var(--theme-inverse);font-size:9px}
.float-mini{display:flex;align-items:center;gap:6px;min-width:0}.mini-play{flex:none;background:var(--theme-primary)!important;color:var(--theme-inverse)!important;font-size:8px!important}.mini-name{max-width:150px;overflow:hidden;color:var(--theme-text-strong);font-size:9px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.mini-expand{flex:none}
.music-float-pop-enter-active,.music-float-pop-leave-active{transition:opacity .16s ease,transform .16s ease}.music-float-pop-enter-from,.music-float-pop-leave-to{opacity:0;transform:translateY(7px) scale(.97)}
@media(max-width:900px){.music-float{width:215px}}
@media(prefers-reduced-motion:reduce){.music-float-pop-enter-active,.music-float-pop-leave-active{transition:none}}
</style>