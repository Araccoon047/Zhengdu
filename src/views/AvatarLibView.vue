<script setup>
import { ref, computed } from 'vue'
import { settings } from '../settings'
import { primaryContact } from '../chat'
import { imageFileToDataUrl } from '../image-utils'
import ProbabilityField from '../components/ProbabilityField.vue'
import {
  getTaLib,
  getMeLib,
  addToTaLib,
  addToMeLib,
  removeFromTaLib,
  removeFromMeLib,
  applyTaAvatar,
  applyMeAvatar,
} from '../avatar-lib'

const tab = ref('ta')
const notice = ref('')
const taInput = ref(null)
const meInput = ref(null)

const taLib = ref(getTaLib())
const meLib = ref(getMeLib())
const taCurrent = computed(() => primaryContact()?.avatarImage || '')
const meCurrent = computed(() => settings.anniversaryAvatarB || '')

function refresh() {
  taLib.value = getTaLib()
  meLib.value = getMeLib()
}

async function onPickFile(event, kind) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const dataUrl = await imageFileToDataUrl(file, 360, 0.86)
    if (!dataUrl) {
      notice.value = '图片处理失败，请换一张试试'
      return
    }
    if (kind === 'ta') addToTaLib(dataUrl)
    else addToMeLib(dataUrl)
    refresh()
    notice.value = '已上传头像'
  } catch (e) {
    notice.value = e?.message || '上传失败'
  }
}

function clickTa(src) {
  applyTaAvatar(src)
  notice.value = '已更换 TA 的头像，各处已同步'
}
function clickMe(src) {
  applyMeAvatar(src)
  notice.value = '已更换我的头像，各处已同步'
}
function delTa(index) {
  removeFromTaLib(index)
  refresh()
}
function delMe(index) {
  removeFromMeLib(index)
  refresh()
}

function pickTa() { taInput.value?.click() }
function pickMe() { meInput.value?.click() }
</script>

<template>
  <section class="avlib-app">
    <div class="avlib-tabs">
      <button type="button" :class="{ active: tab === 'ta' }" @click="tab = 'ta'">TA 的头像库</button>
      <button type="button" :class="{ active: tab === 'me' }" @click="tab = 'me'">我的头像库</button>
    </div>

    <p v-if="notice" class="avlib-notice">{{ notice }}</p>

    <!-- TA 的头像库 -->
    <div v-if="tab === 'ta'" class="avlib-card">
      <div class="avlib-head">
        <strong>TA 的头像库</strong>
        <small>点图直接给 TA 换头像；TA 也会按频率自动换</small>
      </div>
      <div v-if="taLib.length" class="avlib-grid">
        <div v-for="(src, index) in taLib" :key="src" class="avlib-item" :class="{ current: src === taCurrent }">
          <img :src="src" alt="" @click="clickTa(src)" />
          <span v-if="src === taCurrent" class="avlib-badge">在用</span>
          <button type="button" class="avlib-del" @click="delTa(index)">✕</button>
        </div>
      </div>
      <div v-else class="avlib-empty">还没有 TA 的头像，上传几张吧。</div>
      <button type="button" class="avlib-upload" @click="pickTa">+ 上传 TA 的头像</button>
      <input ref="taInput" type="file" accept="image/*" hidden @change="onPickFile($event, 'ta')" />
    </div>

    <!-- 我的头像库 -->
    <div v-else class="avlib-card">
      <div class="avlib-head">
        <strong>我的头像库</strong>
        <small>点图直接给自己换头像；开启下方开关后，TA 也能按频率帮你换</small>
      </div>
      <div v-if="meLib.length" class="avlib-grid">
        <div v-for="(src, index) in meLib" :key="src" class="avlib-item" :class="{ current: src === meCurrent }">
          <img :src="src" alt="" @click="clickMe(src)" />
          <span v-if="src === meCurrent" class="avlib-badge">在用</span>
          <button type="button" class="avlib-del" @click="delMe(index)">✕</button>
        </div>
      </div>
      <div v-else class="avlib-empty">还没有我的头像，上传几张吧。</div>
      <button type="button" class="avlib-upload" @click="pickMe">+ 上传我的头像</button>
      <input ref="meInput" type="file" accept="image/*" hidden @change="onPickFile($event, 'me')" />
    </div>

    <!-- 设置 -->
    <div class="avlib-card avlib-settings">
      <div class="avlib-head">
        <strong>换头像设置</strong>
        <small>控制 TA 是否帮你换头像，以及多久换一次</small>
      </div>
      <label class="avlib-switch">
        <span>允许 TA 为我更换头像</span>
        <input v-model="settings.avatarAllowTaChange" type="checkbox" />
      </label>
      <div class="avlib-range">
        <label>
          <span>换头像频率 · 最少（天）</span>
          <input v-model.number="settings.avatarChangeMin" type="number" min="1" max="30" />
        </label>
        <label>
          <span>最多（天）</span>
          <input v-model.number="settings.avatarChangeMax" type="number" min="1" max="30" />
        </label>
      </div>
      <ProbabilityField
        v-model="settings.avatarChangeChance"
        v-model:random-value="settings.avatarChangeChanceRandom"
        label="换头像概率（%）"
      />
      <p class="avlib-hint">频率到达后按概率决定是否真的换头像；开启「完全随机」后概率固定 50/50。</p>
    </div>
  </section>
</template>

<style scoped>
.avlib-app {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 32px;
}
.avlib-tabs {
  display: flex;
  gap: 8px;
}
.avlib-tabs button {
  flex: 1;
  padding: 10px 0;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.avlib-tabs button.active {
  background: var(--theme-primary);
  border-color: var(--theme-primary);
  color: var(--theme-inverse);
}
.avlib-notice {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 12px;
}
.avlib-card {
  padding: 16px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: var(--theme-surface);
  box-shadow: 0 2px 10px rgba(var(--theme-overlay-rgb), 0.05);
}
.avlib-head {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 12px;
}
.avlib-head strong {
  font-size: 14px;
  color: var(--theme-text);
}
.avlib-head small {
  font-size: 11px;
  color: var(--theme-muted);
  line-height: 1.5;
}
.avlib-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.avlib-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid transparent;
}
.avlib-item.current {
  border-color: var(--theme-primary);
}
.avlib-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.avlib-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--theme-primary);
  color: var(--theme-inverse);
  font-size: 9px;
  font-weight: 700;
}
.avlib-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avlib-empty {
  padding: 20px 0;
  text-align: center;
  color: var(--theme-muted);
  font-size: 12px;
}
.avlib-upload {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.avlib-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 13px;
  color: var(--theme-text);
}
.avlib-range {
  display: flex;
  gap: 10px;
  margin: 6px 0;
}
.avlib-range label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--theme-muted);
}
.avlib-range input {
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 13px;
}
.avlib-hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--theme-muted);
  line-height: 1.6;
}
</style>
