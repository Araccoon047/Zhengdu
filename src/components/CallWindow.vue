<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { store } from '../store'
import { avatarFrameStyle } from '../avatar-frame-style'
import LineGlyph from './LineGlyph.vue'
import {
  answerIncomingCall,
  chatState,
  contactById,
  contactDisplayName,
  declineIncomingCall,
  hangupCall,
  toggleCallExpanded,
  endGroupCall,
  groupById,
  joinGroupCall,
  leaveGroupCall,
} from '../chat'

const windowRef = ref(null)
const position = ref(null)
const dragging = ref(false)
let dragOffsetX = 0
let dragOffsetY = 0

const call = computed(() => chatState.call)
const contact = computed(() => contactById(call.value?.contactId))
const group = computed(() => groupById(call.value?.groupId))
const isGroup = computed(() => Boolean(call.value?.groupId))
const expanded = computed(() => Boolean(call.value?.expanded))
const participantCount = computed(() => (
  (call.value?.joinedMemberIds?.length || 0) + (call.value?.userJoined ? 1 : 0)
))
const callLabel = computed(() => (call.value?.kind === 'video' ? '视频通话' : '语音通话'))
const callName = computed(() => (
  isGroup.value ? group.value?.name || call.value?.groupName || '群通话' : contactDisplayName(contact.value)
))
const statusText = computed(() => {
  if (!call.value) return '';
  const people = isGroup.value ? ` · ${participantCount.value} 人` : ''
  if (call.value.status === '通话中') return `通话中${people} · ${formatDuration(call.value.seconds)}`
  return `${call.value.status}${people}`
})
function callBounds() {
  const shellWidth = store.view === 'phone' ? Math.min(430, window.innerWidth) : window.innerWidth
  const left = store.view === 'phone' ? Math.max(0, (window.innerWidth - shellWidth) / 2) : 0
  return { left, right: left + shellWidth }
}
const windowStyle = computed(() => {
  if (!position.value) {
    const bounds = callBounds()
    return {
      right: `${Math.max(18, window.innerWidth - bounds.right + 18)}px`,
      bottom: '18px',
    }
  }
  return { left: `${position.value.x}px`, top: `${position.value.y}px` }
})

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function finishCurrentCall() {
  if (isGroup.value) leaveGroupCall()
  else hangupCall()
}

function endCurrentGroupCall() {
  if (isGroup.value) endGroupCall()
  else hangupCall()
}

function joinCurrentGroupCall() {
  joinGroupCall()
}


function clampPosition() {
  const element = windowRef.value
  if (!element || !position.value) return
  const rect = element.getBoundingClientRect()
  const bounds = callBounds()
  const minX = bounds.left + 6
  const maxX = Math.max(minX, bounds.right - rect.width - 6)
  const maxY = Math.max(6, window.innerHeight - rect.height - 6)
  position.value = {
    x: Math.min(maxX, Math.max(minX, position.value.x)),
    y: Math.min(maxY, Math.max(6, position.value.y)),
  }
}

function startDrag(event) {
  if (event.button !== 0 || event.target.closest('button')) return
  const element = windowRef.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  position.value = { x: rect.left, y: rect.top }
  dragOffsetX = event.clientX - rect.left
  dragOffsetY = event.clientY - rect.top
  dragging.value = true
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function onDrag(event) {
  if (!dragging.value) return
  const element = windowRef.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const bounds = callBounds()
  const minX = bounds.left + 6
  const maxX = Math.max(minX, bounds.right - rect.width - 6)
  const maxY = Math.max(6, window.innerHeight - rect.height - 6)
  position.value = {
    x: Math.min(maxX, Math.max(minX, event.clientX - dragOffsetX)),
    y: Math.min(maxY, Math.max(6, event.clientY - dragOffsetY)),
  }
}

function stopDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onDrag)
}

watch(
  () => expanded.value,
  async () => {
    await nextTick()
    clampPosition()
  }
)

watch(
  () => store.view,
  async () => {
    await nextTick()
    clampPosition()
  }
)

onMounted(() => {
  window.addEventListener('resize', clampPosition)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('resize', clampPosition)
})
</script>

<template>
  <transition name="call-window-pop">
    <div
      v-if="call && (contact || group)"
      ref="windowRef"
      class="call-window"
      :class="[expanded ? 'is-expanded' : 'is-collapsed', { dragging, 'is-group': isGroup }]"
      :style="windowStyle"
    >
      <template v-if="expanded">
        <div class="call-window-head" @pointerdown="startDrag">
          <span>{{ isGroup ? `群${callLabel}` : callLabel }}</span>
          <button type="button" aria-label="收起通话窗口" @click.stop="toggleCallExpanded">−</button>
        </div>
        <div class="call-window-body">
          <span class="call-window-avatar echoes-avatar-other" :data-avatar-frame-skin-id="isGroup ? 'none' : contact.avatarFrameSkin || 'none'" :style="{ background: isGroup ? (group.color || 'var(--theme-primary)') : contact.color }">
            <img v-if="isGroup ? group.avatarImage : contact.avatarImage" :src="isGroup ? group.avatarImage : contact.avatarImage" alt="" />
            <template v-else>{{ isGroup ? (group.avatar || '群') : contact.avatar }}</template>
            <img v-if="!isGroup && contact.avatarFrame" class="call-avatar-frame" :src="contact.avatarFrame" :style="avatarFrameStyle(contact)" alt="" />
          </span>
          <strong class="call-window-name">{{ callName }}</strong>
          <span class="call-window-status">{{ statusText }}</span>
          <div v-if="isGroup && call.direction === 'incoming' && call.status !== '通话中'" class="call-window-actions">
            <button class="accept" type="button" @click="answerIncomingCall">接听</button>
            <button class="decline" type="button" @click="declineIncomingCall">拒绝</button>
          </div>
          <div v-else-if="isGroup" class="call-window-actions group-call-actions">
            <button v-if="!call.userJoined" class="accept" type="button" @click="joinCurrentGroupCall">加入通话</button>
            <button v-else class="decline" type="button" @click="finishCurrentCall">退出通话</button>
            <button class="end-group" type="button" @click="endCurrentGroupCall">结束</button>
          </div>
          <div v-else-if="call.direction === 'incoming' && call.status !== '通话中'" class="call-window-actions">
            <button class="accept" type="button" @click="answerIncomingCall">接听</button>
            <button class="decline" type="button" @click="declineIncomingCall">拒绝</button>
          </div>
          <button v-else class="hangup-call" type="button" aria-label="结束通话" title="结束通话" @click="hangupCall">
            <LineGlyph type="phone" />
          </button>
        </div>
      </template>

      <div v-else class="collapsed-call" @pointerdown="startDrag">
        <span class="collapsed-icon">{{ isGroup ? '群' : (call.kind === 'video' ? '▣' : '☎') }}</span>
        <span class="collapsed-copy">
          <strong>{{ callName }}</strong>
          <small>{{ statusText }}</small>
        </span>
        <button type="button" aria-label="展开通话窗口" @click.stop="toggleCallExpanded">⌃</button>
        <button v-if="!isGroup || call.userJoined" class="collapsed-hangup" type="button" aria-label="退出或结束通话" @click.stop="finishCurrentCall">×</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.call-window {
  position: fixed;
  z-index: 240;
  width: 220px;
  border: 2px solid var(--theme-border);
  border-radius: 22px;
  background: var(--theme-surface);
  box-shadow: 0 20px 52px rgba(var(--theme-overlay-rgb), 0.28);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  overflow: hidden;
  user-select: none;
  touch-action: none;
}

.call-window.dragging {
  cursor: grabbing;
}

.call-window-head {
  height: 38px;
  padding: 0 10px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--theme-border-soft);
  color: var(--theme-accent);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: grab;
}

.call-window-head button,
.collapsed-call button {
  width: 26px;
  height: 26px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.call-window-body {
  padding: 16px 14px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.call-window-avatar {
  position: relative;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  box-shadow: 0 8px 22px rgba(var(--theme-primary-rgb), 0.26);
}

.call-window-avatar > img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.call-window-avatar > .call-avatar-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 120%;
  max-width: none;
  border-radius: 0;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.call-window-name {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.call-window-status {
  min-height: 17px;
  color: var(--theme-accent);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.call-window-actions {
  width: 100%;
  margin-top: 6px;
  display: flex;
  gap: 8px;
}

.call-window-actions button,
.hangup-call {
  flex: 1;
  padding: 9px 10px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.call-window-actions .accept {
  background: var(--theme-positive);
}

.call-window-actions .decline,
.hangup-call {
  background: var(--theme-accent-warm);
}

.call-window-body > .hangup-call {
  flex: none;
  align-self: center;
  width: 46px;
  min-width: 46px;
  height: 46px;
  margin-top: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  line-height: 1;
}
.call-window-body > .hangup-call svg {
  width: 20px;
  height: 20px;
  display: block;
  transform: rotate(135deg);
}

.collapsed-call {
  width: 100%;
  height: 58px;
  padding: 7px 7px 7px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: grab;
}

.collapsed-icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--theme-pale);
  color: var(--theme-primary);
  font-size: 16px;
}

.collapsed-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collapsed-copy strong,
.collapsed-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collapsed-copy strong {
  color: var(--theme-primary);
  font-size: 11.5px;
}

.collapsed-copy small {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.collapsed-hangup {
  border-color: var(--theme-danger-border) !important;
  background: var(--theme-danger-surface) !important;
  color: var(--theme-accent-warm) !important;
  font-size: 17px !important;
}

.call-window-pop-enter-active,
.call-window-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.call-window-pop-enter-from,
.call-window-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@media (max-width: 560px) {
  .call-window {
    width: 205px;
  }
  .call-window.is-collapsed {
    width: 188px;
  }
}

.call-window-head button,
.collapsed-call button {
  display: grid !important;
  place-items: center !important;
  padding: 0 !important;
  line-height: 1 !important;
  box-shadow: none !important;
}
.call-window{width:224px;border:1px solid rgba(255,255,255,.2);border-radius:24px;background:rgba(12,14,19,.66)!important;box-shadow:0 16px 40px rgba(0,0,0,.22)!important;backdrop-filter:blur(22px) saturate(1.35)!important;-webkit-backdrop-filter:blur(22px) saturate(1.35)!important;color:#fff}
.call-window.is-collapsed{width:208px;border-radius:999px;background:rgba(8,10,14,.68)!important;box-shadow:0 8px 24px rgba(0,0,0,.2)!important}
.call-window-head{border-bottom-color:rgba(255,255,255,.12);color:rgba(255,255,255,.76)}
.call-window-head button,.collapsed-call button{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;box-shadow:none}
.call-window-name{color:#fff}.call-window-status{color:rgba(255,255,255,.68)}
.call-window-avatar{box-shadow:0 8px 22px rgba(0,0,0,.18)}
.call-window-actions{display:grid;grid-template-columns:1fr 1fr}.call-window-actions .end-group{background:rgba(255,255,255,.14)}
.collapsed-call{height:50px;padding:6px 7px 6px 8px;gap:7px}
.collapsed-icon{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:800}
.collapsed-copy strong{color:#fff}.collapsed-copy small{color:rgba(255,255,255,.62)}
.collapsed-hangup{background:rgba(255,78,94,.24)!important;border-color:rgba(255,108,120,.35)!important;color:#fff!important}
@media(max-width:560px){.call-window{width:min(224px,calc(100vw - 30px))}.call-window.is-collapsed{width:min(208px,calc(100vw - 30px))}}
</style>
