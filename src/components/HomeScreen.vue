<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'
import { store, openSoftware } from '../store'

const now = ref(new Date())
let timer = null

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const hm = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const dateText = computed(() => {
  const d = now.value
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`
})

const softwares = [
  { id: 'sms', type: 'sms', label: '短信' },
  { id: 'album', type: 'album', label: '相册' },
  { id: 'music', type: 'music', label: '音乐' },
]

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="home">
    <div class="home-widget">
      <div class="home-time">{{ hm }}</div>
      <div class="home-date">{{ dateText }}</div>
      <div class="home-kaomoji">(･∞･ﾐэ )Э 淡海 · 微风</div>
    </div>

    <div class="app-grid">
      <AppIcon
        v-for="s in softwares"
        :key="s.id"
        :type="s.type"
        :label="s.label"
        :badge="s.id === 'sms' ? store.unreadSms : 0"
        @click="openSoftware(s.id)"
      />
    </div>

    <div class="dock">
      <AppIcon
        v-for="s in softwares"
        :key="'dock-' + s.id"
        :type="s.type"
        :badge="s.id === 'sms' ? store.unreadSms : 0"
        compact
        @click="openSoftware(s.id)"
      />
    </div>
  </div>
</template>
