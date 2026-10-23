<script setup>
import { computed } from 'vue'
import { store, go } from '../store'
import { formatRemain, modeName, pomoState, startPause, totalMsOf } from '../pomodoro'

const visible = computed(() =>
  pomoState.running && store.page !== 'pomodoro'
)
const display = computed(() => formatRemain(pomoState.remainMs))
const progress = computed(() => {
  const total = totalMsOf()
  return Math.max(0, Math.min(100, (1 - pomoState.remainMs / total) * 100))
})
const label = computed(() => `${modeName()}中`)

function openPomo() {
  go('pomodoro')
}
</script>

<template>
  <transition name="pomo-float">
    <div v-if="visible" class="pomo-float" role="status">
      <button class="pf-main" type="button" @click="openPomo">
        <span class="pf-dot"></span>
        <strong>{{ display }}</strong>
        <span class="pf-label">{{ label }}</span>
      </button>
      <button class="pf-pause" type="button" aria-label="暂停专注" @click="startPause">暂停</button>
      <span class="pf-bar"><i :style="{ width: `${progress}%` }"></i></span>
    </div>
  </transition>
</template>

<style scoped>
.pomo-float {
  position: fixed;
  top: 56px;
  left: 50%;
  z-index: 240;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 8px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-surface);
  box-shadow: 0 8px 22px rgba(var(--theme-overlay-rgb), 0.14);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
  overflow: hidden;
}
.pf-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--theme-text);
  font: inherit;
  cursor: pointer;
}
.pf-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-primary);
  animation: pf-pulse 1.8s ease-in-out infinite;
}
.pf-main strong {
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.4px;
}
.pf-label {
  color: var(--theme-muted);
  font-size: 8px;
  letter-spacing: 0.6px;
}
.pf-pause {
  padding: 3px 9px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font: inherit;
  font-size: 8.5px;
  font-weight: 700;
  cursor: pointer;
}
.pf-bar {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 3px;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-soft);
}
.pf-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--theme-primary);
  transition: width 0.4s linear;
}
@keyframes pf-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}
.pomo-float-enter-active,
.pomo-float-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.pomo-float-enter-from,
.pomo-float-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
