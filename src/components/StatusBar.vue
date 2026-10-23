<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const time = ref('')
let timer = null

function format(d) {
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function tick() {
  time.value = format(new Date())
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span>{{ time }}</span>
      <span class="status-carrier">争渡</span>
    </div>

    <div class="status-right">
      <!-- 信号 -->
      <svg viewBox="0 0 20 13" aria-hidden="true">
        <rect x="0" y="9" width="3" height="4" rx="1" fill="currentColor" />
        <rect x="5" y="6.5" width="3" height="6.5" rx="1" fill="currentColor" />
        <rect x="10" y="4" width="3" height="9" rx="1" fill="currentColor" />
        <rect x="15" y="1.5" width="3" height="11.5" rx="1" fill="currentColor" opacity=".4" />
      </svg>

      <!-- WiFi -->
      <svg viewBox="0 0 18 13" aria-hidden="true">
        <path d="M1.2 4.4a11.6 11.6 0 0 1 15.6 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" />
        <path d="M4.4 7.5a7.2 7.2 0 0 1 9.2 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" />
        <circle cx="9" cy="10.9" r="1.3" fill="currentColor" />
      </svg>

      <!-- 电量 -->
      <svg viewBox="0 0 26 13" aria-hidden="true">
        <rect x="0.8" y="1.2" width="21" height="10.6" rx="3" stroke="currentColor" stroke-width="1.4" fill="none" />
        <rect x="3.2" y="3.6" width="14" height="6.8" rx="1.6" fill="currentColor" />
        <path d="M23.4 4.5v4a2.1 2.1 0 0 0 0-4Z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>
