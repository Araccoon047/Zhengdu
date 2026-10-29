<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { imageProxyUrl, normalizeImageUrl } from '../image-utils'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  loading: { type: String, default: 'lazy' },
})
const emit = defineEmits(['load', 'error'])

const currentSrc = ref('')
const originalSrc = ref('')
const failed = ref(false)
let triedProxy = false
let fallbackTimer = null

function clearFallbackTimer() {
  clearTimeout(fallbackTimer)
  fallbackTimer = null
}

function startFallbackTimer() {
  clearFallbackTimer()
  if (!/^https?:\/\//i.test(originalSrc.value)) return
  fallbackTimer = setTimeout(() => {
    if (!failed.value && !triedProxy) {
      triedProxy = true
      currentSrc.value = imageProxyUrl(originalSrc.value)
    }
  }, 5500)
}

function reset() {
  clearFallbackTimer()
  failed.value = false
  triedProxy = false
  originalSrc.value = normalizeImageUrl(props.src, { proxyHttp: true })
  currentSrc.value = originalSrc.value
  startFallbackTimer()
}

watch(() => props.src, reset, { immediate: true })
onUnmounted(clearFallbackTimer)

function handleLoad(event) {
  clearFallbackTimer()
  emit('load', event)
}

function handleError(event) {
  clearFallbackTimer()
  if (!triedProxy && /^https?:\/\//i.test(originalSrc.value)) {
    triedProxy = true
    currentSrc.value = imageProxyUrl(originalSrc.value)
    fallbackTimer = setTimeout(() => {
      if (!failed.value) {
        failed.value = true
        emit('error', event)
      }
    }, 5500)
    return
  }
  failed.value = true
  emit('error', event)
}
</script>

<template>
  <img
    v-if="currentSrc && !failed"
    v-bind="$attrs"
    :src="currentSrc"
    :alt="alt"
    :loading="loading"
    decoding="async"
    referrerpolicy="no-referrer"
    @load="handleLoad"
    @error="handleError"
  />
  <span v-else v-bind="$attrs" class="safe-image-fallback" :title="alt || '图片无法加载'">
    <b>图片无法加载</b>
    <small>请使用 HTTPS 图片直链</small>
  </span>
</template>

<style scoped>
.safe-image-fallback {
  min-width: 76px;
  min-height: 76px;
  padding: 8px;
  border: 1px dashed var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-align: center;
  font-size: 8.5px;
  line-height: 1.35;
}
.safe-image-fallback b { color: var(--theme-text); font-size: 9.5px; }
.safe-image-fallback small { font-size: 8px; }
</style>