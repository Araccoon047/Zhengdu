<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { store } from '../store'
import { settings } from '../settings'
import {
  currentTrack, formatMusicTime, musicSettings, musicState, MUSIC_MODES,
  playNext, playPrev, playTrack, reopenFloat, seekMusic,
  setMusicMode, toggleFavorite, togglePlay,
} from '../music-player'

const POS_KEY = 'zhengdu_music_orb_pos_v2'
const ORB_SIZE = 48
const position = ref(loadPosition())
const panelOpen = ref(false)
const dragging = ref(false)
const listRef = ref(null)
const avatarBubble = ref({ side: '', text: '' })
let avatarBubbleTimer = 0
let moved = false
let startX = 0
let startY = 0
let originLeft = 0
let originTop = 0

const hidden = computed(() =>
  !musicSettings.floatEnabled ||
  !currentTrack.value ||
  store.page === 'music'
)
const progress = computed(() => musicState.duration > 0
  ? Math.min(100, musicState.currentTime / musicState.duration * 100)
  : 0)
const currentMode = computed(() => MUSIC_MODES.find((mode) => mode.id === musicState.mode) || MUSIC_MODES[3])
const modeLabel = computed(() => currentMode.value.label)
const modeIcon = computed(() => currentMode.value.icon)
const isFavorite = computed(() => Boolean(currentTrack.value && musicState.favorites.includes(currentTrack.value.id)))
const tracks = computed(() => musicState.library)
const playerBubble = computed(() => {
  if (!currentTrack.value) return '还没有选择歌曲'
  return `${musicState.playing ? '正在陪你听' : '等你一起听'}《${currentTrack.value.name}》`
})
const contactAvatar = computed(() => settings.opponentAvatarImage || '')
const userAvatar = computed(() => settings.anniversaryAvatarB || '')
const contactInitial = computed(() => String(settings.opponentAvatar || settings.opponentName || 'TA').slice(0, 1))
const userInitial = computed(() => String(settings.userName || '我').slice(0, 1))
const floatNudgeTexts = computed(() => {
  const saved = Array.isArray(musicSettings.floatNudgeTexts) ? musicSettings.floatNudgeTexts : []
  return saved.map((text) => String(text || '').trim()).filter(Boolean).slice(0, 4)
})
const floatOpacityStyle = computed(() => {
  const opacity = Math.min(1, Math.max(0.2, (Number(musicSettings.floatOpacity) || 92) / 100))
  return {
    '--float-panel-opacity': opacity.toFixed(2),
    '--float-orb-opacity': Math.min(1, 0.28 + opacity * 0.58).toFixed(2),
  }
})

function loadPosition() {
  const fallback = {
    left: Math.max(8, window.innerWidth - ORB_SIZE - 15),
    top: Math.max(8, Math.round(window.innerHeight * 0.2)),
  }
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || '{}')
    return {
      left: Number.isFinite(Number(saved.left)) ? Number(saved.left) : fallback.left,
      top: Number.isFinite(Number(saved.top)) ? Number(saved.top) : fallback.top,
    }
  } catch {
    return fallback
  }
}
function savePosition() {
  try { localStorage.setItem(POS_KEY, JSON.stringify(position.value)) } catch {}
}
function clampPosition() {
  position.value = {
    left: Math.max(6, Math.min(window.innerWidth - ORB_SIZE - 6, position.value.left)),
    top: Math.max(6, Math.min(window.innerHeight - ORB_SIZE - 6, position.value.top)),
  }
}
function openPanel() {
  panelOpen.value = true
}
function closePanel() {
  panelOpen.value = false
}
function startDrag(event) {
  if ((event.button !== undefined && event.button > 0) || panelOpen.value) return
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  startX = event.clientX
  startY = event.clientY
  originLeft = rect.left
  originTop = rect.top
  moved = false
  dragging.value = true
  window.addEventListener('pointermove', moveDrag, { passive: false })
  window.addEventListener('pointerup', stopDrag, { once: true })
  window.addEventListener('pointercancel', cancelDrag, { once: true })
}
function moveDrag(event) {
  if (!dragging.value) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (!moved && Math.hypot(dx, dy) < 6) return
  moved = true
  event.preventDefault()
  position.value = { left: originLeft + dx, top: originTop + dy }
  clampPosition()
}
function stopDrag() {
  if (!dragging.value) return
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointercancel', cancelDrag)
  dragging.value = false
  savePosition()
  if (!moved) openPanel()
  moved = false
}
function cancelDrag() {
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', stopDrag)
  dragging.value = false
  moved = false
}
function cycleMode() {
  const modes = MUSIC_MODES.map((item) => item.id)
  setMusicMode(modes[(modes.indexOf(musicState.mode) + 1) % modes.length])
}
function selectTrack(track) {
  if (track.id === musicState.currentId) togglePlay()
  else playTrack(track.id)
}
function toggleCurrentFavorite() {
  if (currentTrack.value) toggleFavorite(currentTrack.value.id)
}
function seekFromPointer(event) {
  if (!musicState.duration) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  seekMusic(ratio * musicState.duration)
}
function showAvatarTalk(side) {
  const lines = floatNudgeTexts.value.length ? floatNudgeTexts.value : ['拍了拍你']
  avatarBubble.value = { side, text: lines[Math.floor(Math.random() * lines.length)] }
  window.clearTimeout(avatarBubbleTimer)
  avatarBubbleTimer = window.setTimeout(() => {
    avatarBubble.value = { side: '', text: '' }
  }, 2000)
}
function scrollActiveTrack() {
  nextTick(() => {
    listRef.value?.querySelector('.cen-p-track-item.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
function restoreFloat() {
  reopenFloat()
  panelOpen.value = false
}
function handleKeydown(event) {
  if (event.key === 'Escape') closePanel()
}

watch(() => currentTrack.value?.id, scrollActiveTrack)
watch(hidden, (value) => {
  if (value) closePanel()
  else nextTick(clampPosition)
})
watch(() => musicSettings.floatEnabled, (enabled) => {
  if (enabled) restoreFloat()
})
onMounted(() => {
  window.addEventListener('resize', clampPosition)
  window.addEventListener('keydown', handleKeydown)
  clampPosition()
  scrollActiveTrack()
})
onUnmounted(() => {
  window.removeEventListener('resize', clampPosition)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', cancelDrag)
  window.clearTimeout(avatarBubbleTimer)
})

defineExpose({ restoreFloat })
</script>

<template>
  <transition name="cen-layer-fade">
    <div v-if="!hidden" class="cen-global-music-wrap" :style="floatOpacityStyle">
      <button
        class="cen-music-orb"
        :class="{ dragging, 'panel-open': panelOpen }"
        type="button"
        aria-label="打开悬浮音乐播放器"
        title="打开悬浮音乐播放器"
        :style="{ left: position.left + 'px', top: position.top + 'px' }"
        @pointerdown="startDrag"
      >
        <svg viewBox="0 0 24 24" class="cen-orb-icon" aria-hidden="true">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </button>

      <transition name="cen-panel-pop">
        <section
          v-if="panelOpen"
          class="cen-glass-player-panel"
          role="dialog"
          aria-modal="false"
          aria-label="悬浮音乐播放器"
        >
          <button class="cen-panel-close" type="button" aria-label="关闭播放器" title="关闭播放器" @click="closePanel">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>

          <div class="cen-p-avatars">
            <button class="cen-p-avatar-box" type="button" aria-label="和联系人互动" @click.stop="showAvatarTalk('contact')">
              <img v-if="contactAvatar" :src="contactAvatar" alt="" />
              <span v-else class="cen-avatar-initial">{{ contactInitial }}</span>
            </button>
            <div class="cen-heartbeat-zone" :class="{ paused: !musicState.playing }" aria-hidden="true">
              <svg viewBox="0 0 100 40" class="cen-beat-svg" preserveAspectRatio="none">
                <path d="M0,20 L25,20 L32,5 L40,35 L48,-5 L55,20 L100,20" class="cen-beat-line" />
              </svg>
              <svg viewBox="0 0 24 24" class="cen-white-heart">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <button class="cen-p-avatar-box" type="button" aria-label="和我的头像互动" @click.stop="showAvatarTalk('user')">
              <img v-if="userAvatar" :src="userAvatar" alt="" />
              <span v-else class="cen-avatar-initial">{{ userInitial }}</span>
            </button>
          </div>

          <div class="cen-p-bubble" :class="{ talking: avatarBubble.text }" :title="avatarBubble.text || playerBubble">{{ avatarBubble.text || playerBubble }}</div>

          <div ref="listRef" class="cen-p-tracklist">
            <button
              v-for="(track, index) in tracks"
              :key="track.id"
              class="cen-p-track-item"
              :class="{ active: track.id === musicState.currentId }"
              type="button"
              @click="selectTrack(track)"
            >
              <span class="cen-p-track-idx">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="cen-p-track-copy">
                <strong>{{ track.name }}</strong>
                <small>{{ track.artist || '未知歌手' }}</small>
              </span>
              <span v-if="track.id === musicState.currentId" class="cen-p-playing-dot" aria-hidden="true"></span>
            </button>
            <div v-if="!tracks.length" class="cen-p-empty">曲库里还没有歌曲</div>
          </div>

          <div class="cen-p-progress-wrap">
            <span class="cen-time-text">{{ formatMusicTime(musicState.currentTime) }}</span>
            <button class="cen-progress-touch" type="button" aria-label="调整播放进度" @click="seekFromPointer">
              <span class="cen-progress-bg"><i class="cen-progress-fill" :style="{ width: progress + '%' }"></i></span>
            </button>
            <span class="cen-time-text">{{ formatMusicTime(musicState.duration) }}</span>
          </div>

          <div class="cen-p-controls">
            <button class="cen-p-btn cen-p-mode" type="button" :aria-label="modeLabel" :title="modeLabel" @click="cycleMode">{{ modeIcon }}</button>
            <button class="cen-p-btn" type="button" aria-label="上一首" title="上一首" @click="playPrev">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>
            <button class="cen-p-btn cen-p-btn-play" type="button" :aria-label="musicState.playing ? '暂停' : '播放'" @click="togglePlay">
              <svg v-if="musicState.playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button class="cen-p-btn" type="button" aria-label="下一首" title="下一首" @click="playNext">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
            <button class="cen-p-btn cen-p-btn-like" :class="{ liked: isFavorite }" type="button" aria-label="收藏" title="收藏" @click="toggleCurrentFavorite">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            </button>
          </div>
          <span class="cen-design-credit">design by censy</span>
        </section>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.cen-global-music-wrap{position:fixed;inset:0;z-index:230;pointer-events:none;font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#303846}
.cen-global-music-wrap *{box-sizing:border-box;user-select:none}
.cen-music-orb{position:absolute;width:48px;height:48px;padding:0;border:1px solid rgba(255,255,255,.88);border-radius:50%;background:rgba(255,255,255,var(--float-orb-opacity,.82));-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);box-shadow:0 4px 16px rgba(128,136,148,.38),0 0 0 1px rgba(255,255,255,.5),inset 0 0 0 1px rgba(255,255,255,.35);display:grid;place-items:center;pointer-events:auto;cursor:grab;touch-action:none;transition:opacity .2s ease,transform .2s ease}
.cen-music-orb:active,.cen-music-orb.dragging{cursor:grabbing;transform:scale(.95)}
.cen-music-orb.panel-open{opacity:0;pointer-events:none;transform:scale(.86)}
.cen-orb-icon{width:24px;height:24px;fill:#596273;filter:drop-shadow(0 1px 2px rgba(255,255,255,.75));animation:cenOrbPulse 2s ease-in-out infinite}
@keyframes cenOrbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.cen-glass-player-panel{position:absolute;top:50%;left:50%;width:min(calc(100vw - 28px),360px);height:min(330px,calc(100dvh - 28px));max-height:calc(100dvh - 20px);padding:14px 14px 11px;border:1px solid rgba(255,255,255,.88);border-radius:20px;background:rgba(255,255,255,var(--float-panel-opacity,.92));-webkit-backdrop-filter:blur(18px) saturate(1.25);backdrop-filter:blur(18px) saturate(1.25);box-shadow:0 15px 40px rgba(0,0,0,.15),inset 0 0 0 1px rgba(255,255,255,.2);opacity:1;display:flex;flex-direction:column;pointer-events:auto;overflow:hidden;transform:translate(-50%,-50%);transition:opacity .28s ease,transform .32s cubic-bezier(.34,1.56,.64,1)}
.cen-panel-pop-enter-from,.cen-panel-pop-leave-to{opacity:0;transform:translate(-50%,-50%) scale(.9)}
.cen-panel-pop-enter-active,.cen-panel-pop-leave-active{transition:opacity .25s ease,transform .3s cubic-bezier(.34,1.56,.64,1)}
.cen-panel-close{position:absolute;top:9px;right:10px;z-index:20;width:26px;height:26px;padding:5px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#555;display:grid;place-items:center;cursor:pointer;opacity:.66;transition:opacity .2s,background .2s}
.cen-panel-close:hover{opacity:1;background:rgba(255,255,255,.4)}
.cen-panel-close svg{width:14px;height:14px;fill:currentColor}
.cen-p-avatars{display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:8px;padding:0 8px}
.cen-p-avatar-box{position:relative;z-index:5;width:48px;height:48px;flex:none;padding:0;border:2px solid rgba(255,255,255,.92);border-radius:50%;background:rgba(200,200,200,.3);box-shadow:0 4px 10px rgba(0,0,0,.1);display:grid;place-items:center;overflow:visible;cursor:pointer;color:#596273;font-size:18px;font-weight:800}
.cen-p-avatar-box>img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.cen-avatar-initial{width:100%;height:100%;border-radius:50%;background:rgba(255,255,255,.35);display:grid;place-items:center}
.cen-heartbeat-zone{position:relative;width:86px;height:36px;margin:0 11px;display:grid;place-items:center}
.cen-beat-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.cen-beat-line{fill:none;stroke:rgba(255,255,255,.9);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:200;stroke-dashoffset:200;filter:drop-shadow(0 0 3px rgba(255,255,255,.5));animation:cenLineFlow 1.8s linear infinite}
.cen-white-heart{position:relative;z-index:2;width:18px;height:18px;fill:#fff;filter:drop-shadow(0 0 5px rgba(255,255,255,.9));animation:cenHeartPulse 1s ease-in-out infinite}
.cen-heartbeat-zone.paused .cen-beat-line,.cen-heartbeat-zone.paused .cen-white-heart{animation-play-state:paused;opacity:.4;filter:none}
@keyframes cenLineFlow{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}
@keyframes cenHeartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.cen-p-bubble{flex:none;max-width:88%;margin:0 auto 7px;padding:6px 12px;border-radius:14px;background:rgba(255,255,255,.96);color:#4a4a4a;font-size:11px;font-weight:600;line-height:1.3;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.05)}
.cen-p-bubble.talking{background:rgba(255,255,255,.98);color:#303846}
.cen-p-tracklist{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;padding:1px 4px 2px 0;margin-bottom:6px}
.cen-p-tracklist::-webkit-scrollbar{width:4px}
.cen-p-tracklist::-webkit-scrollbar-thumb{border-radius:4px;background:rgba(255,255,255,.55)}
.cen-p-track-item{width:100%;display:flex;align-items:center;gap:7px;margin:0 0 4px;padding:7px 9px;border:1px solid transparent;border-radius:9px;background:rgba(255,255,255,.18);color:#555;text-align:left;cursor:pointer;transition:background .18s,border-color .18s,color .18s}
.cen-p-track-item:hover{background:rgba(255,255,255,.4)}
.cen-p-track-item.active{border-color:rgba(255,255,255,.62);background:rgba(255,255,255,.7);color:#20242a;font-weight:700}
.cen-p-track-idx{flex:none;width:22px;color:inherit;font-size:9px;text-align:center;opacity:.58}
.cen-p-track-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:1px}
.cen-p-track-copy strong,.cen-p-track-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cen-p-track-copy strong{font-size:11px;line-height:1.2}
.cen-p-track-copy small{font-size:8.5px;line-height:1.15;opacity:.68}
.cen-p-playing-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--theme-primary);box-shadow:none}
.cen-p-empty{padding:16px 8px;color:#68707b;font-size:10px;text-align:center}
.cen-p-progress-wrap{display:flex;align-items:center;flex:none;padding:0 2px 4px}
.cen-time-text{flex:none;width:34px;color:#5c6470;font-size:8.5px;text-align:center;opacity:.82}
.cen-progress-touch{flex:1;height:16px;margin:0 5px;padding:0;border:0;background:transparent;display:flex;align-items:center;cursor:pointer}
.cen-progress-bg{position:relative;width:100%;height:4px;border-radius:99px;background:rgba(255,255,255,.42);overflow:hidden}
.cen-progress-fill{display:block;height:100%;border-radius:inherit;background:var(--theme-primary);box-shadow:none;pointer-events:none}
.cen-p-controls{flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 4px 5px}
.cen-p-btn{width:32px;height:32px;padding:0;border:0;border-radius:50%;background:transparent;color:#596170;display:grid;place-items:center;cursor:pointer;transition:background .18s,color .18s,transform .18s}
.cen-p-btn:hover{background:rgba(255,255,255,.4);color:#303846}
.cen-p-btn svg{width:18px;height:18px;fill:currentColor}
.cen-p-mode{font-size:15px;font-weight:900;line-height:1}
.cen-p-btn-play{width:40px;height:40px;background:rgba(255,255,255,.64);color:#333}
.cen-p-btn-play:hover{background:rgba(255,255,255,.9)}
.cen-p-btn-play svg{width:22px;height:22px}
.cen-p-btn-like.liked{color:#ff4d4f}
.cen-p-btn-like.liked svg{fill:#ff4d4f}
.cen-design-credit{position:absolute;right:11px;bottom:3px;color:#555;font-size:6px;opacity:.36;pointer-events:none;letter-spacing:.02em}
.cen-layer-fade-enter-active,.cen-layer-fade-leave-active{transition:opacity .16s ease}
.cen-layer-fade-enter-from,.cen-layer-fade-leave-to{opacity:0}
@media(max-width:420px){
  .cen-glass-player-panel{width:calc(100vw - 22px);height:min(322px,calc(100dvh - 22px));padding:12px 12px 10px;border-radius:18px}
  .cen-p-avatar-box{width:44px;height:44px}
  .cen-heartbeat-zone{width:76px;margin:0 8px}
  .cen-p-track-item{padding:6px 7px}
  .cen-p-bubble{max-width:94%;padding:5px 9px;font-size:10px}
}
@media(max-height:380px){
  .cen-glass-player-panel{height:calc(100dvh - 18px);padding-top:9px}
  .cen-p-avatars{margin-bottom:5px}
  .cen-p-avatar-box{width:40px;height:40px}
  .cen-p-bubble{margin-bottom:4px;padding-block:4px}
}
@media(prefers-reduced-motion:reduce){
  .cen-orb-icon,.cen-beat-line,.cen-white-heart{animation:none}
  .cen-panel-pop-enter-active,.cen-panel-pop-leave-active,.cen-layer-fade-enter-active,.cen-layer-fade-leave-active{transition:none}
}
</style>