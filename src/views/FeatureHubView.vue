<script setup>
import { computed, ref } from 'vue'
import { go, requestChatTool, requestSettingsSection } from '../store'
import { FEATURE_HUB_GROUPS, filterHubItems } from '../feature-hub-data'

const keyword = ref('')
const tip = ref('')
let tipTimer = 0

const groups = computed(() =>
  FEATURE_HUB_GROUPS.map((group) => ({
    ...group,
    items: filterHubItems(group.items, keyword.value),
  })).filter((group) => group.items.length)
)

const total = computed(() => FEATURE_HUB_GROUPS.reduce((n, g) => n + g.items.length, 0))

function flash(message) {
  tip.value = message
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => { tip.value = '' }, 2200)
}

function open(item) {
  if (item.tool) {
    requestChatTool(item.tool)
    go('sms')
    return
  }
  if (item.page) {
    if (item.section) requestSettingsSection(item.section)
    else go(item.page)
    return
  }
  flash(item.where || '该功能尚未实现')
}
</script>

<template>
  <section class="feature-hub">
    <header class="hub-head">
      <div>
        <strong>功能大全</strong>
        <span>{{ total }} 个条目 · 按分类查找</span>
      </div>
      <button type="button" class="hub-back" @click="go('settings')">返回设置</button>
    </header>

    <div class="hub-search">
      <input v-model="keyword" type="text" placeholder="搜索功能，如：拍一拍 / 邀请 / 词典" autocomplete="off" />
      <button v-if="keyword" type="button" @click="keyword = ''">清除</button>
    </div>

    <div class="hub-body">
      <section v-for="group in groups" :key="group.id" class="hub-group">
        <h3>{{ group.label }}<small>{{ group.hint }}</small></h3>
        <div class="hub-list">
          <button
            v-for="item in group.items"
            :key="item.n"
            type="button"
            class="hub-item"
            :class="{ muted: !item.page && !item.tool }"
            @click="open(item)"
          >
            <span class="hub-text">
              <strong>{{ item.n }}</strong>
              <small>{{ item.d }}</small>
            </span>
            <i>›</i>
          </button>
        </div>
      </section>

      <div v-if="!groups.length" class="hub-empty">没有匹配的功能，换个关键词试试。</div>
    </div>

    <div v-if="tip" class="hub-tip">{{ tip }}</div>
  </section>
</template>

<style scoped>
.feature-hub {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 16px 40px;
  color: var(--theme-text);
}

.hub-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.hub-head strong {
  display: block;
  font-size: 19px;
  letter-spacing: 0.5px;
}
.hub-head span {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--theme-muted, #8a8a8a);
}
.hub-back {
  flex: none;
  min-height: 30px;
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 10px;
  border: 1px solid var(--theme-border);
  background: #fff;
  color: var(--theme-text);
  cursor: pointer;
}

.hub-search {
  display: flex;
  gap: 8px;
  align-items: center;
}
.hub-search input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  font-size: 12.5px;
  border-radius: 12px;
  border: 1px solid var(--theme-border);
  background: #fff;
  color: var(--theme-text);
  outline: none;
}
.hub-search input:focus {
  border-color: var(--theme-primary, #111);
}
.hub-search button {
  flex: none;
  min-height: 38px;
  padding: 0 12px;
  font-size: 11.5px;
  border-radius: 12px;
  border: 1px solid var(--theme-border);
  background: #fff;
  color: var(--theme-text);
  cursor: pointer;
}

.hub-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hub-group h3 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 2px 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--theme-muted, #8a8a8a);
}
.hub-group h3 small {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.3px;
  opacity: 0.8;
}

.hub-list {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  background: #fff;
}

.hub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 0;
  padding: 13px 14px;
  text-align: left;
  background: #fff;
  border: none;
  border-top: 1px solid var(--theme-border);
  border-radius: 0;
  cursor: pointer;
  transition: background 0.14s ease;
}
.hub-item:first-child {
  border-top: none;
}
.hub-item:active {
  background: rgba(0, 0, 0, 0.035);
}
.hub-item.muted {
  opacity: 0.62;
}

.hub-text {
  flex: 1;
  min-width: 0;
}
.hub-text strong {
  display: block;
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.35;
}
.hub-text small {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--theme-muted, #8a8a8a);
}

.hub-item i {
  flex: none;
  font-style: normal;
  font-size: 16px;
  color: #c4c4c4;
}

.hub-empty {
  padding: 40px 0;
  text-align: center;
  font-size: 12px;
  color: #c0c0c0;
}

.hub-tip {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  max-width: 82vw;
  padding: 10px 16px;
  border-radius: 99px;
  background: rgba(17, 17, 17, 0.92);
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  z-index: 90;
}
</style>
