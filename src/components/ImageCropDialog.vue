<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { cropState, completeCrop, cancelCrop } from '../image-crop'

const task = computed(() => cropState.task)
const title = computed(() => task.value?.options?.title || '裁剪图片')
const shape = computed(() => task.value?.options?.shape || 'rect')
const imageEl = ref(null)
const stageEl = ref(null)
const imageBox = ref(null)
const crop = ref(null)
const activeRatio = ref(null)
let drag = null

const ratioOptions = computed(() => {
  const options = task.value?.options || {}
  if (options.lockAspect) return []
  return options.aspects || [
    { label: '自由', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
  ]
})

const cropStyle = computed(() => crop.value ? {
  left: crop.value.left + 'px',
  top: crop.value.top + 'px',
  width: crop.value.width + 'px',
  height: crop.value.height + 'px',
} : null)

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function updateImageBox() {
  const img = imageEl.value
  const stage = stageEl.value
  if (!img || !stage) return
  const imgRect = img.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  if (!imgRect.width || !imgRect.height) return
  imageBox.value = {
    left: imgRect.left - stageRect.left,
    top: imgRect.top - stageRect.top,
    width: imgRect.width,
    height: imgRect.height,
  }
}

function resetCrop(forcedRatio) {
  if (!imageBox.value) return
  const box = imageBox.value
  const ratio = forcedRatio ?? activeRatio.value ?? box.width / box.height
  const maxW = box.width * 0.82
  const maxH = box.height * 0.82
  let width = maxW
  let height = width / ratio
  if (height > maxH) {
    height = maxH
    width = height * ratio
  }
  crop.value = {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  }
}

function onImageLoad() {
  nextTick(() => {
    updateImageBox()
    resetCrop()
  })
}

function applyRatio(option) {
  activeRatio.value = option.value
  if (!imageBox.value) return
  const ratio = option.value || imageBox.value.width / imageBox.value.height
  resetCrop(ratio)
}

function startMove(event) {
  if (!crop.value) return
  event.preventDefault()
  drag = { mode: 'move', startX: event.clientX, startY: event.clientY, crop: { ...crop.value } }
  addDragListeners()
}
function startResize(event, corner) {
  if (!crop.value || !imageBox.value) return
  event.preventDefault()
  event.stopPropagation()
  drag = { mode: 'resize', corner, crop: { ...crop.value } }
  addDragListeners()
}

function addDragListeners() {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function removeDragListeners() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function endDrag() {
  drag = null
  removeDragListeners()
}

function onPointerMove(event) {
  if (!drag || !crop.value || !imageBox.value || !stageEl.value) return
  const box = imageBox.value
  if (drag.mode === 'move') {
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    crop.value = {
      ...drag.crop,
      left: clamp(drag.crop.left + dx, box.left, box.left + box.width - drag.crop.width),
      top: clamp(drag.crop.top + dy, box.top, box.top + box.height - drag.crop.height),
    }
    return
  }

  const stageRect = stageEl.value.getBoundingClientRect()
  const px = event.clientX - stageRect.left
  const py = event.clientY - stageRect.top
  const start = drag.crop
  const corner = drag.corner
  const xDir = corner.includes('e') ? 1 : -1
  const yDir = corner.includes('s') ? 1 : -1
  const anchorX = xDir > 0 ? start.left : start.left + start.width
  const anchorY = yDir > 0 ? start.top : start.top + start.height
  const maxW = xDir > 0 ? box.left + box.width - anchorX : anchorX - box.left
  const maxH = yDir > 0 ? box.top + box.height - anchorY : anchorY - box.top
  const min = Math.max(28, Math.min(box.width, box.height) * 0.08)
  let width = Math.max(min, (px - anchorX) * xDir)
  let height = Math.max(min, (py - anchorY) * yDir)
  const ratio = activeRatio.value

  if (ratio) {
    if (width / height > ratio) height = width / ratio
    else width = height * ratio
    width = Math.min(width, maxW)
    height = width / ratio
    if (height > maxH) {
      height = maxH
      width = height * ratio
    }
  } else {
    width = Math.min(width, maxW)
    height = Math.min(height, maxH)
  }

  crop.value = {
    left: xDir > 0 ? anchorX : anchorX - width,
    top: yDir > 0 ? anchorY : anchorY - height,
    width,
    height,
  }
}

function applyCrop() {
  const img = imageEl.value
  const current = crop.value
  const box = imageBox.value
  const currentTask = task.value
  if (!img || !current || !box || !currentTask) return
  const scaleX = img.naturalWidth / box.width
  const scaleY = img.naturalHeight / box.height
  const sx = (current.left - box.left) * scaleX
  const sy = (current.top - box.top) * scaleY
  const sw = current.width * scaleX
  const sh = current.height * scaleY
  const maxSide = currentTask.options.maxSide || 1600
  const outputScale = Math.min(1, maxSide / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * outputScale))
  canvas.height = Math.max(1, Math.round(sh * outputScale))
  const ctx = canvas.getContext('2d')
  if (!currentTask.options.transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const mimeType = currentTask.options.mimeType || (currentTask.options.transparent ? 'image/png' : 'image/jpeg')
  completeCrop(canvas.toDataURL(mimeType, currentTask.options.quality || 0.84))
}

function onKeydown(event) {
  if (event.key === 'Escape' && task.value) cancelCrop()
}

watch(
  () => task.value?.id,
  async () => {
    activeRatio.value = task.value?.options?.aspectRatio ?? null
    crop.value = null
    imageBox.value = null
    await nextTick()
    if (imageEl.value?.complete) onImageLoad()
  }
)

watch(
  () => !!task.value,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onMounted(() => {
  window.addEventListener('resize', updateImageBox)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  removeDragListeners()
  window.removeEventListener('resize', updateImageBox)
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>
<template>
  <teleport to="body">
    <transition name="crop-fade">
      <div v-if="task" class="crop-layer" @click.self="cancelCrop">
        <div class="crop-dialog">
          <header class="crop-head">
            <div>
              <strong>{{ title }}</strong>
              <span>拖动裁剪框，或用四角调整范围</span>
            </div>
            <button class="crop-close" type="button" aria-label="关闭" @click="cancelCrop">×</button>
          </header>

          <div ref="stageEl" class="crop-stage">
            <img ref="imageEl" class="crop-source" :src="task.url" alt="" draggable="false" @load="onImageLoad" />
            <div
              v-if="crop"
              class="crop-box"
              :class="{ circle: shape === 'circle' }"
              :style="cropStyle"
              @pointerdown="startMove"
            >
              <span class="crop-grid"></span>
              <span class="crop-handle nw" @pointerdown="startResize($event, 'nw')"></span>
              <span class="crop-handle ne" @pointerdown="startResize($event, 'ne')"></span>
              <span class="crop-handle sw" @pointerdown="startResize($event, 'sw')"></span>
              <span class="crop-handle se" @pointerdown="startResize($event, 'se')"></span>
            </div>
          </div>

          <div v-if="ratioOptions.length" class="ratio-row">
            <button
              v-for="option in ratioOptions"
              :key="option.label"
              type="button"
              :class="{ active: activeRatio === option.value }"
              @click="applyRatio(option)"
            >{{ option.label }}</button>
          </div>

          <div class="crop-actions">
            <button class="crop-cancel" type="button" @click="cancelCrop">取消</button>
            <button class="crop-confirm" type="button" @click="applyCrop">使用这张</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
<style scoped>
.crop-layer {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(var(--theme-overlay-rgb), 0.5);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.crop-dialog {
  width: min(720px, 100%);
  max-height: calc(100dvh - 36px);
  padding: 16px;
  border: 2px solid var(--theme-border);
  border-radius: 22px;
  background: var(--theme-surface);
  box-shadow: 0 24px 60px rgba(var(--theme-overlay-rgb), 0.32);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.crop-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.crop-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.crop-head strong {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.crop-head span {
  color: var(--theme-accent);
  font-size: 10.5px;
  font-weight: 600;
}

.crop-close {
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.crop-stage {
  position: relative;
  width: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 14px;
  background:
    linear-gradient(45deg, var(--theme-bg-tint) 25%, transparent 25%),
    linear-gradient(-45deg, var(--theme-bg-tint) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--theme-bg-tint) 75%),
    linear-gradient(-45deg, transparent 75%, var(--theme-bg-tint) 75%),
    #ffffff;
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  user-select: none;
}

.crop-source {
  display: block;
  max-width: 100%;
  max-height: 62vh;
  pointer-events: none;
}

.crop-box {
  position: absolute;
  z-index: 2;
  border: 2px solid #ffffff;
  box-sizing: border-box;
  box-shadow: 0 0 0 9999px rgba(var(--theme-overlay-rgb), 0.58);
  cursor: move;
  touch-action: none;
}

.crop-box.circle {
  border-radius: 50%;
}

.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, transparent 33.333%, rgba(255, 255, 255, 0.5) 33.333%, rgba(255, 255, 255, 0.5) calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, rgba(255, 255, 255, 0.5) 66.666%, rgba(255, 255, 255, 0.5) calc(66.666% + 1px), transparent calc(66.666% + 1px)),
    linear-gradient(to bottom, transparent 33.333%, rgba(255, 255, 255, 0.5) 33.333%, rgba(255, 255, 255, 0.5) calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, rgba(255, 255, 255, 0.5) 66.666%, rgba(255, 255, 255, 0.5) calc(66.666% + 1px), transparent calc(66.666% + 1px));
}

.crop-box.circle .crop-grid {
  border-radius: 50%;
  overflow: hidden;
}

.crop-handle {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid var(--theme-primary);
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(var(--theme-primary-rgb), 0.3);
  touch-action: none;
}
.crop-handle.nw { left: -10px; top: -10px; cursor: nwse-resize; }
.crop-handle.ne { right: -10px; top: -10px; cursor: nesw-resize; }
.crop-handle.sw { left: -10px; bottom: -10px; cursor: nesw-resize; }
.crop-handle.se { right: -10px; bottom: -10px; cursor: nwse-resize; }.ratio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.ratio-row button {
  padding: 7px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: #ffffff;
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ratio-row button.active {
  border-color: var(--theme-accent);
  background: var(--theme-pale);
  color: var(--theme-primary);
}

.crop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.crop-cancel,
.crop-confirm {
  padding: 10px 18px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.crop-cancel {
  border: 1px solid var(--theme-border);
  background: #ffffff;
  color: var(--theme-text);
}

.crop-confirm {
  border: 0;
  background: var(--theme-primary);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(var(--theme-primary-rgb), 0.28);
}

.crop-fade-enter-active,
.crop-fade-leave-active {
  transition: opacity 0.18s ease;
}
.crop-fade-enter-from,
.crop-fade-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .crop-layer { padding: 10px; }
  .crop-dialog { padding: 12px; border-radius: 18px; }
  .crop-source { max-height: 54vh; }
  .crop-head span { display: none; }
}
</style>