<script setup>
import { computed, ref } from 'vue'
import {
  POMO_MODES,
  addPraise,
  formatRemain,
  modeName,
  pomoState,
  removePraise,
  resetPomo,
  setPomoDuration,
  setPomoMode,
  startPause,
  toggleBell,
  toggleSendToChat,
  totalMsOf,
} from '../pomodoro'

const RING_CIRCUMFERENCE = 2 * Math.PI * 88
const settingsOpen = ref(false)
const praiseDraft = ref('')
const notice = ref('')

const total = computed(() => totalMsOf(pomoState.mode))
const progress = computed(() => {
  const ratio = 1 - pomoState.remainMs / total.value
  return Math.max(0, Math.min(1, ratio))
})
const dashOffset = computed(() => RING_CIRCUMFERENCE * (1 - progress.value))
const display = computed(() => formatRemain(pomoState.remainMs))
const stateText = computed(() => {
  if (pomoState.running) return pomoState.mode === 'focus' ? '专注中…' : '休息中…'
  if (pomoState.remainMs < total.value) return '已暂停'
  return `准备${modeName()}`
})
const startLabel = computed(() => {
  if (pomoState.running) return '暂停'
  return pomoState.remainMs < total.value ? '继续' : '开始'
})

function chooseMode(mode) {
  setPomoMode(mode)
}

function changeDuration(mode, event) {
  const value = Number(event.target.value)
  setPomoDuration(mode, value)
  event.target.value = pomoState.durations[mode]
}

function submitPraise() {
  const text = praiseDraft.value.trim()
  if (!text) return
  if (!addPraise(text)) {
    notice.value = '这句已经有了'
    return
  }
  praiseDraft.value = ''
  notice.value = '已添加'
}
</script>

<template>
  <section class="pomo">
    <div class="pomo-tabs" role="tablist" aria-label="番茄钟模式">
      <button
        v-for="mode in POMO_MODES"
        :key="mode.id"
        type="button"
        class="pomo-tab"
        :class="{ active: pomoState.mode === mode.id }"
        @click="chooseMode(mode.id)"
      >
        {{ mode.name }}
        <small>{{ pomoState.durations[mode.id] }}</small>
      </button>
    </div>

    <div class="pomo-card">
      <div class="pomo-dial">
        <svg class="pomo-ring" viewBox="0 0 200 200">
          <circle class="ring-bg" cx="100" cy="100" r="88" />
          <circle
            class="ring-fill"
            cx="100"
            cy="100"
            r="88"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
            :class="{ running: pomoState.running }"
          />
        </svg>
        <div class="pomo-center">
          <span class="pomo-state">{{ stateText }}</span>
          <strong>{{ display }}</strong>
          <span class="pomo-caption">
            {{ pomoState.mode === 'focus' ? '保持专注' : '放松一下' }}
          </span>
        </div>
      </div>

      <div class="pomo-actions">
        <button class="primary" type="button" @click="startPause">{{ startLabel }}</button>
        <button type="button" @click="resetPomo">重置</button>
      </div>
    </div>

    <div class="pomo-msg">“{{ pomoState.message }}”</div>

    <div class="pomo-stats">
      今日 🍅 × {{ pomoState.today.count }}
      <span>·</span>
      累计 {{ pomoState.total }} 个
    </div>

    <button class="pomo-settings-toggle" type="button" @click="settingsOpen = !settingsOpen">
      {{ settingsOpen ? '收起设置' : '时长与偏好' }}
    </button>

    <div v-if="settingsOpen" class="pomo-settings">
      <div class="pomo-row" v-for="mode in POMO_MODES" :key="mode.id">
        <span>{{ mode.name }}时长</span>
        <label>
          <input
            :value="pomoState.durations[mode.id]"
            type="number"
            min="1"
            max="180"
            @change="changeDuration(mode.id, $event)"
          />
          <small>分钟</small>
        </label>
      </div>

      <div class="pomo-row">
        <span>结束铃声</span>
        <button class="pomo-chip" :class="{ on: pomoState.bellEnabled }" type="button" @click="toggleBell">
          {{ pomoState.bellEnabled ? '开' : '关' }}
        </button>
      </div>

      <div class="pomo-row">
        <span>完成发到聊天</span>
        <button class="pomo-chip" :class="{ on: pomoState.sendToChat }" type="button" @click="toggleSendToChat">
          {{ pomoState.sendToChat ? '开' : '关' }}
        </button>
      </div>

      <div class="pomo-praise">
        <div class="pomo-praise-head">
          <span>夸夸字卡</span>
          <small>专注完成后随机说一句</small>
        </div>
        <div class="pomo-praise-list">
          <button
            v-for="text in pomoState.praises"
            :key="text"
            type="button"
            class="pomo-praise-item"
            title="点击删除"
            @click="removePraise(text)"
          >
            {{ text }}<i>×</i>
          </button>
        </div>
        <div class="pomo-praise-add">
          <input v-model="praiseDraft" type="text" maxlength="40" placeholder="加一句你自己的" @keydown.enter.prevent="submitPraise" />
          <button type="button" :disabled="!praiseDraft.trim()" @click="submitPraise">添加</button>
        </div>
        <p v-if="notice" class="pomo-notice">{{ notice }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pomo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 12px 40px;
}
.pomo-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: var(--theme-soft);
}
.pomo-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--theme-muted);
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}
.pomo-tab small {
  font-size: 8px;
  opacity: 0.7;
}
.pomo-tab.active {
  background: var(--theme-surface);
  color: var(--theme-primary);
  box-shadow: 0 4px 12px rgba(var(--theme-overlay-rgb), 0.1);
}
.pomo-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: var(--theme-surface);
  box-shadow: 0 8px 24px rgba(var(--theme-overlay-rgb), 0.06);
}
.pomo-dial {
  position: relative;
  width: min(250px, 68vw);
  aspect-ratio: 1;
}
.pomo-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg {
  fill: none;
  stroke: var(--theme-soft);
  stroke-width: 10;
}
.ring-fill {
  fill: none;
  stroke: var(--theme-primary);
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.35s linear;
}
.pomo-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.pomo-state {
  color: var(--theme-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
}
.pomo-center strong {
  color: var(--theme-primary);
  font-size: clamp(38px, 12vw, 56px);
  font-weight: 300;
  line-height: 1;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.pomo-caption {
  color: var(--theme-muted);
  font-size: 9px;
}
.pomo-actions {
  display: flex;
  gap: 9px;
}
.pomo-actions button {
  min-width: 88px;
  padding: 9px 18px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.pomo-actions .primary {
  border: 0;
  background: var(--theme-primary);
  color: var(--theme-inverse);
  box-shadow: 0 7px 16px rgba(var(--theme-overlay-rgb), 0.16);
}
.pomo-msg {
  padding: 10px 12px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font-size: 10px;
  line-height: 1.7;
  text-align: center;
}
.pomo-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--theme-muted);
  font-size: 9.5px;
}
.pomo-stats span {
  opacity: 0.5;
}
.pomo-settings-toggle {
  align-self: center;
  padding: 5px 12px;
  border: 1px dashed var(--theme-border-soft);
  border-radius: 999px;
  background: transparent;
  color: var(--theme-muted);
  font: inherit;
  font-size: 9px;
  cursor: pointer;
}
.pomo-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-surface);
}
.pomo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pomo-row > span {
  color: var(--theme-text);
  font-size: 9.5px;
}
.pomo-row label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pomo-row input {
  width: 58px;
  padding: 5px 7px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 8px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 9.5px;
  text-align: center;
}
.pomo-row small {
  color: var(--theme-muted);
  font-size: 8px;
}
.pomo-chip {
  min-width: 42px;
  padding: 4px 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font: inherit;
  font-size: 8.5px;
  cursor: pointer;
}
.pomo-chip.on {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: var(--theme-inverse);
}
.pomo-praise {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px solid var(--theme-border-soft);
}
.pomo-praise-head {
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.pomo-praise-head span {
  color: var(--theme-text);
  font-size: 9.5px;
}
.pomo-praise-head small {
  color: var(--theme-muted);
  font-size: 8px;
}
.pomo-praise-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.pomo-praise-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 8.5px;
  cursor: pointer;
}
.pomo-praise-item i {
  color: var(--theme-muted);
  font-style: normal;
  font-size: 10px;
}
.pomo-praise-item:hover i {
  color: #c26a5e;
}
.pomo-praise-add {
  display: flex;
  gap: 6px;
}
.pomo-praise-add input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 8px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 9px;
}
.pomo-praise-add button {
  flex: none;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--theme-primary);
  color: var(--theme-inverse);
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}
.pomo-praise-add button:disabled {
  opacity: 0.4;
}
.pomo-notice {
  margin: 0;
  color: var(--theme-muted);
  font-size: 8.5px;
}
@media (max-width: 560px) {
  .pomo {
    padding: 4px 8px 34px;
  }
}
</style>
