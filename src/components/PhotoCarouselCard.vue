<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { listCarouselPhotos } from '../album-store'
import { settings } from '../settings'
import { go, store } from '../store'

const photos = ref([])
const index = ref(0)
const loading = ref(true)
let timer = null
let refreshTimer = null

const speedSeconds = computed(() => Math.max(1, Math.min(20, Number(settings.photoCarouselSpeed) || 4.5)))
const photoSize = computed(() => `${Math.max(35, Math.min(90, Number(settings.photoCarouselPhotoSize) || 76))}%`)
const preloadedImages = []
const slides = computed(() => {
  const total = photos.value.length
  if (!total) return []
  const offsets = total <= 3 ? [-1, 0, 1] : [-2, -1, 0, 1, 2]
  const seen = new Set()
  return offsets
    .map((offset) => {
      const photoIndex = (index.value + offset + total) % total
      if (seen.has(photoIndex)) return null
      seen.add(photoIndex)
      const distance = Math.abs(offset)
      const shift = distance === 0 ? 0 : Math.sign(offset) * (distance === 1 ? 102 : 185)
      return {
        photo: photos.value[photoIndex],
        key: photos.value[photoIndex].id,
        current: distance === 0,
        style: {
          zIndex: String(20 - distance),
          opacity: distance === 0 ? '1' : String(distance === 1 ? '0.66' : '0.24'),
          transform: `translate(-50%, -50%) translateX(${shift}%) translateY(${distance * 1.5}%) scale(${1 - distance * 0.14})`,
        },
      }
    })
    .filter(Boolean)
})

function preloadPhotos(list) {
  preloadedImages.length = 0
  for (const photo of list) {
    const image = new Image()
    image.decoding = 'async'
    image.src = photo.src
    image.decode?.().catch(() => {})
    preloadedImages.push(image)
  }
}

async function refreshPhotos() {
  try {
    const next = await listCarouselPhotos()
    preloadPhotos(next)
    photos.value = next
    if (!next.length) index.value = 0
    else if (index.value >= next.length) index.value = 0
  } catch {
    photos.value = []
  } finally {
    loading.value = false
  }
}

function advance() {
  if (photos.value.length > 1) index.value = (index.value + 1) % photos.value.length
}

function restartTimer() {
  clearInterval(timer)
  timer = setInterval(advance, speedSeconds.value * 1000)
}

function openAlbum() {
  store.albumCollectionId = 'carousel'
  go('album')
}

watch([speedSeconds, () => photos.value.length], restartTimer)

onMounted(() => {
  refreshPhotos()
  restartTimer()
  refreshTimer = setInterval(refreshPhotos, 12000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(refreshTimer)
})
</script>

<template>
  <button
    class="photo-carousel-card"
    type="button"
    aria-label="打开轮播合集"
    :style="{ '--photo-size': photoSize, '--carousel-speed': `${speedSeconds}s`, '--carousel-transition': '0.92s' }"
    @click="openAlbum"
  >
    <span v-if="slides.length" class="circular-stage" aria-hidden="true">
      <img
        v-for="slide in slides"
        :key="slide.key"
        class="circular-slide"
        :class="{ current: slide.current }"
        :src="slide.photo.src"
        :alt="slide.photo.name || '相册照片'"
        :style="slide.style"
        loading="eager"
        decoding="async"
        draggable="false"
      />
    </span>
    <span v-else class="photo-carousel-empty">
      <b>{{ loading ? '正在读取轮播合集…' : '照片轮播' }}</b>
      <small>{{ loading ? '' : '去轮播合集添加照片' }}</small>
    </span>

  </button>
</template>

<style scoped>
.photo-carousel-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 18px;
  overflow: hidden;
  background: transparent;
  display: block;
  cursor: pointer;
  container-type: size;
  isolation: isolate;
}
.circular-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  contain: layout paint;
}
.circular-slide {
  position: absolute;
  top: 50%;
  left: 50%;
  width: auto;
  height: var(--photo-size);
  max-width: 88%;
  aspect-ratio: 1;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.88);
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(var(--theme-shadow-rgb), 0.18);
  backface-visibility: hidden;
  transform-origin: 50% 50%;
  transition:
    transform var(--carousel-transition) cubic-bezier(0.16, 1, 0.3, 1),
    opacity var(--carousel-transition) cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
  user-select: none;
}
.photo-carousel-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--theme-text);
}
.photo-carousel-empty b { font-size: 12px; letter-spacing: 0.06em; }
.photo-carousel-empty small { color: var(--theme-muted); font-size: 8px; }
</style>