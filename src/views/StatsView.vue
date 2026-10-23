<script setup>
import { computed } from 'vue'
import { chatState, contactDisplayName } from '../chat'

const contacts = computed(() => chatState.contacts)
const groups = computed(() => chatState.groups)

const total = computed(() =>
  contacts.value.reduce((sum, contact) => sum + (contact.messages?.length || 0), 0)
)

const types = computed(() => {
  const counts = { text: 0, transfer: 0, redpacket: 0, photo: 0, call: 0, other: 0 }
  for (const contact of contacts.value) {
    for (const message of contact.messages || []) {
      const type = message.type || 'text'
      if (type in counts) counts[type] += 1
      else counts.other += 1
    }
  }
  return counts
})

const max = computed(() =>
  Math.max(1, ...contacts.value.map((contact) => contact.messages?.length || 0))
)

const chips = computed(() => [
  { label: '文字', value: types.value.text },
  { label: '转账', value: types.value.transfer },
  { label: '红包', value: types.value.redpacket },
  { label: '图片', value: types.value.photo },
  { label: '通话', value: types.value.call },
])

const overallCardLeaderboard = computed(() => {
  const counts = new Map()
  const conversations = [...contacts.value, ...groups.value]
  for (const conversation of conversations) {
    for (const message of conversation.messages || []) {
      if (message.from !== 'other' || message.recalled) continue
      if (message.type && message.type !== 'text') continue
      const text = String(message.text || '').trim()
      if (!text) continue
      counts.set(text, (counts.get(text) || 0) + 1)
    }
  }
  const items = [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'zh-CN'))
    .slice(0, 10)
  return {
    items,
    maxCount: items[0]?.count || 1,
  }
})
const textLeaderboards = computed(() =>
  contacts.value
    .map((contact) => {
      const counts = new Map()
      for (const message of contact.messages || []) {
        if (message.from !== 'other' || message.recalled) continue
        if (message.type && message.type !== 'text') continue
        const text = String(message.text || '').trim()
        if (!text) continue
        counts.set(text, (counts.get(text) || 0) + 1)
      }
      const items = [...counts.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'zh-CN'))
        .slice(0, 10)
      return {
        id: contact.id,
        name: contactDisplayName(contact),
        avatar: contact.avatar || contact.note?.slice(0, 1) || 'T',
        avatarImage: contact.avatarImage || '',
        color: contact.color || 'var(--theme-primary)',
        items,
        maxCount: items[0]?.count || 1,
      }
    })
    .filter((contact) => contact.items.length)
)
</script>

<template>
  <section class="stats">
    <div class="echoes-character-card hero">
      <div class="hero-num">{{ total }}</div>
      <div class="hero-label">条消息 · {{ contacts.length }} 个会话</div>
    </div>

    <div class="chips">
      <div v-for="chip in chips" :key="chip.label" class="chip echoes-character-card">
        <strong>{{ chip.value }}</strong>
        <span>{{ chip.label }}</span>
      </div>
    </div>

    <div class="echoes-character-card list">
      <div class="list-head">按会话</div>
      <div v-for="contact in contacts" :key="contact.id" class="row">
        <span class="avatar" :style="{ background: contact.color }">
          <img v-if="contact.avatarImage" :src="contact.avatarImage" alt="" />
          <template v-else>{{ contact.avatar }}</template>
        </span>
        <div class="row-main">
          <div class="row-top">
            <span class="name">{{ contactDisplayName(contact) }}</span>
            <span class="count">{{ contact.messages?.length || 0 }}</span>
          </div>
          <div class="bar">
            <i :style="{ width: Math.round(((contact.messages?.length || 0) / max) * 100) + '%' }"></i>
          </div>
        </div>
      </div>

      <div v-if="!contacts.length" class="empty">还没有消息数据。</div>
    </div>

    <div class="echoes-character-card text-stats">
      <div class="list-head">文字统计</div>
      <div class="text-stats-sub">按联系人统计 TA 最常用的字卡 · 前 10 名</div>

      <div v-if="!textLeaderboards.length" class="empty">还没有联系人文字消息。</div>

      <div v-for="contact in textLeaderboards" :key="contact.id" class="leaderboard">
        <div class="leaderboard-head">
          <span class="avatar small" :style="{ background: contact.color }">
            <img v-if="contact.avatarImage" :src="contact.avatarImage" alt="" />
            <template v-else>{{ contact.avatar }}</template>
          </span>
          <strong>{{ contact.name }}</strong>
          <span class="leaderboard-total">Top {{ contact.items.length }}</span>
        </div>

        <ol class="rank-list">
          <li v-for="(item, index) in contact.items" :key="item.text" class="rank-item">
            <span class="rank-no" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="rank-main">
              <span class="rank-text">{{ item.text }}</span>
              <span class="rank-bar">
                <i :style="{ width: Math.round((item.count / contact.maxCount) * 100) + '%' }"></i>
              </span>
            </span>
            <span class="rank-count">{{ item.count }} 次</span>
          </li>
        </ol>
      </div>
    </div>
    </section>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
}

.hero {
  padding: 26px 20px;
  text-align: center;
}

.hero-num {
  font-size: 44px;
  font-weight: 300;
  line-height: 1;
  color: var(--theme-primary);
  letter-spacing: 0.02em;
}

.hero-label {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-muted);
}

.chips {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.chip {
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border-radius: 14px;
}

.chip strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--theme-primary);
}

.chip span {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--theme-muted);
}

.list,
.text-stats {
  padding: 16px;
}

.list-head {
  margin-bottom: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--theme-muted);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.avatar.small {
  width: 28px;
  height: 28px;
  font-size: 11px;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.name {
  font-size: 12px;
  font-weight: 700;
  color: var(--theme-text-strong);
}

.count {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-accent);
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--theme-soft);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--theme-primary);
}

.text-stats-sub {
  margin: -4px 0 14px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--theme-muted);
}

.leaderboard {
  padding: 12px 0 2px;
  border-top: 1px dashed var(--theme-border-soft);
}

.leaderboard:first-of-type {
  border-top: 0;
}

.leaderboard-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}

.leaderboard-head strong {
  flex: 1;
  min-width: 0;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.leaderboard-total {
  color: var(--theme-muted);
  font-size: 9.5px;
  font-weight: 700;
}

.rank-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rank-no {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 9.5px;
  font-weight: 800;
}

.rank-no.top {
  background: var(--theme-pale);
  color: var(--theme-primary);
}

.rank-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rank-text {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--theme-soft);
  overflow: hidden;
}

.rank-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--theme-primary);
}

.rank-count {
  flex: none;
  min-width: 42px;
  text-align: right;
  color: var(--theme-accent);
  font-size: 10px;
  font-weight: 700;
}

.empty {
  padding: 20px 0;
  text-align: center;
  font-size: 11px;
  color: var(--theme-muted);
}
</style>