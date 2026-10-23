<script setup>
import { computed, ref } from 'vue'
import calendarData from '../data/calendar-data.json'
import systemCardsData from '../data/system-cards.json'
import { primaryContact, contactDisplayName } from '../chat'
import { settings, CONTACT_AUTO_DEFAULTS } from '../settings'

const KEY = 'zhengdu_calendar_v1'
const TEST_SEED_KEY = 'zhengdu_calendar_test_seed_v2'
const MOODS = calendarData.MOODS
const ACTIVITIES = calendarData.ACTIVITIES
const MOOD_ICONS = calendarData.MOOD_ICONS
const DIARY_DICTIONARY_CARDS = (() => {
  const category = (systemCardsData.categories || []).find((item) => item.key === 'dict')
  return (category?.groups || []).flatMap((group) => group.cards || []).filter(Boolean)
})()

function localKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function yesterdayKey() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return localKey(date)
}
function seedYesterdayDiary(state) {
  const key = yesterdayKey()
  const existing = state.days[key] && typeof state.days[key] === 'object' ? state.days[key] : {}
  const contact = primaryContact()
  const sourceCards = Array.isArray(contact?.cards) && contact.cards.length ? contact.cards : settings.replyCards
  const pool = (sourceCards || []).map((card) => typeof card === 'string' ? card : card?.text).filter(Boolean)
  const takeCards = (count, offset = 0) => {
    if (!pool.length) return '今天也想对你说点什么...'
    return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]).join('  ')
  }
  state.days[key] = {
    ...existing,
    mood: '想念',
    cat: '想念',
    desc: '今天有些想你。',
    activity: '看着窗外',
    message: takeCards(5, 0),
    quote: takeCards(4, 2),
    testSeed: true,
  }
  if (!state.firstUse || state.firstUse > key) state.firstUse = key
  try {
    localStorage.setItem(KEY, JSON.stringify({ firstUse: state.firstUse, days: state.days }))
    localStorage.setItem(TEST_SEED_KEY, '1')
    return key
  } catch {
    return ''
  }
}
function loadState() {
  let result = { firstUse: localKey(), days: {} }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    result = {
      firstUse: saved.firstUse || localKey(),
      days: saved.days && typeof saved.days === 'object' ? saved.days : {},
    }
  } catch {}
  let previewDate = ''
  try {
    if (localStorage.getItem(TEST_SEED_KEY) !== '1') previewDate = seedYesterdayDiary(result)
  } catch {}
  return { ...result, previewDate }
}
const state = ref(loadState())
const today = new Date()
const todayKey = localKey(today)
const initialDate = new Date(`${state.value.previewDate || todayKey}T00:00:00`)
const selectedDate = ref(state.value.previewDate || todayKey)
const cursor = ref(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
const moodOpen = ref(false)
const editOpen = ref(false)
const editField = ref('')
const editValue = ref('')
const moodDraft = ref('')
const moodNote = ref('')
const moodMonth = ref(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
const diaryPermissions = computed(() => {
  const contact = primaryContact()
  const stored = contact?.id ? settings.contactAutoSettings?.[contact.id] : null
  const merged = { ...CONTACT_AUTO_DEFAULTS, ...(stored || {}) }
  const quoteEnabled = stored && stored.diaryQuoteEnabled === undefined && stored.diaryMemoEnabled !== undefined
    ? stored.diaryMemoEnabled !== false
    : merged.diaryQuoteEnabled !== false
  const clampCards = (value, fallback) => Math.min(20, Math.max(1, Math.round(Number(value) || fallback)))
  const messageCardMin = clampCards(merged.diaryMessageCardMin, 3)
  const quoteCardMin = clampCards(merged.diaryQuoteCardMin, 3)
  return {
    enabled: merged.diaryEnabled !== false,
    message: merged.diaryMessageEnabled !== false,
    messageCardMin,
    messageCardMax: Math.max(messageCardMin, clampCards(merged.diaryMessageCardMax, 8)),
    quote: quoteEnabled,
    quoteCardMin,
    quoteCardMax: Math.max(quoteCardMin, clampCards(merged.diaryQuoteCardMax, 8)),
    mood: merged.diaryMoodEnabled !== false,
    dictionary: merged.otherDictionaryEnabled === true,
  }
})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const moods = MOODS
const cardsPool = computed(() => {
  const contact = primaryContact()
  const cards = Array.isArray(contact?.cards) ? contact.cards : []
  const fromContact = cards.map((card) => typeof card === 'string' ? card : card?.text).filter(Boolean)
  if (fromContact.length) return fromContact
  return (settings.replyCards || []).map((card) => typeof card === 'string' ? card : card?.text).filter(Boolean)
})
const firstUseDate = computed(() => new Date(`${state.value.firstUse}T00:00:00`))
const selected = computed(() => new Date(`${selectedDate.value}T00:00:00`))
const selectedDay = computed(() => state.value.days[selectedDate.value] || null)
const isFuture = computed(() => selected.value > new Date(today.getFullYear(), today.getMonth(), today.getDate()))
const isBeforeFirstUse = computed(() => !isFuture.value && selected.value < firstUseDate.value)
const canEditToday = computed(() => selectedDate.value === todayKey)

function hash(text) {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}
function pick(list, seed) { return list[hash(seed) % list.length] }
function cardMessage(seed, minCount = 3, maxCount = 8, separator = '  ') {
  const pool = diaryPermissions.value.dictionary && DIARY_DICTIONARY_CARDS.length
    ? DIARY_DICTIONARY_CARDS
    : cardsPool.value
  if (!pool.length) return '今天也想对你说点什么...'
  const min = Math.max(1, Math.min(minCount, maxCount))
  const max = Math.max(min, maxCount)
  const count = min + hash(seed + 'count') % (max - min + 1)
  const selectedCards = []
  for (let index = 0; index < count; index += 1) {
    selectedCards.push(pool[hash(seed + index) % pool.length])
  }
  return selectedCards.join(separator)
}
function taMood(dateKey) {
  return pick(MOODS, `ta-mood-${dateKey}`)
}
function ensureDayRecord(dateKey) {
  let entry = state.value.days[dateKey]
  if (!entry || typeof entry !== 'object') {
    entry = { myMessage: '', memo: '', myMood: '', myMoodNote: '' }
    state.value.days[dateKey] = entry
  }
  return entry
}
function ensureDay(dateKey) {
  const entry = ensureDayRecord(dateKey)
  const permissions = diaryPermissions.value
  let changed = false
  if (permissions.enabled) {
    if (!entry.activity) {
      entry.activity = pick(ACTIVITIES, `activity-${dateKey}`)
      changed = true
    }
    if (permissions.mood && !entry.mood) {
      const mood = taMood(dateKey)
      Object.assign(entry, { mood: mood.mood, cat: mood.cat, desc: mood.desc })
      changed = true
    }
    if (permissions.message && !entry.message) {
      entry.message = cardMessage(`message-${dateKey}`, permissions.messageCardMin, permissions.messageCardMax)
      changed = true
    }
    if (permissions.quote && !entry.quote) {
      entry.quote = cardMessage(`quote-${dateKey}`, permissions.quoteCardMin, permissions.quoteCardMax)
      changed = true
    }
  }
  if (changed) saveState()
  return entry
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify({ firstUse: state.value.firstUse, days: state.value.days }))
}
const currentEntry = computed(() => {
  if (isFuture.value || isBeforeFirstUse.value) return null
  return selectedDay.value || ensureDay(selectedDate.value)
})
function moodIcon(cat) { return MOOD_ICONS[cat] || MOOD_ICONS['平静'] }
function monthLabel(date) { return `${date.getFullYear()}年${date.getMonth() + 1}月` }
function moveMonth(offset) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + offset, 1)
}
const calendarCells = computed(() => {
  const year = cursor.value.getFullYear()
  const month = cursor.value.getMonth()
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => ({ blank: true, key: `b-${Math.random()}` }))
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day)
    const key = localKey(date)
    cells.push({ day, key, today: key === todayKey, selected: key === selectedDate.value, recorded: Boolean(state.value.days[key]) })
  }
  return cells
})
function selectDate(cell) {
  if (cell.blank) return
  selectedDate.value = cell.key
}
function openEdit(field) {
  if (!canEditToday.value) return
  const entry = currentEntry.value
  editField.value = field
  editValue.value = entry?.[field] || ''
  editOpen.value = true
}
function saveEdit() {
  if (!canEditToday.value) return
  const entry = currentEntry.value
  if (entry) entry[editField.value] = editValue.value.trim()
  saveState()
  editOpen.value = false
}
function openMoodDiary() {
  moodOpen.value = true
  moodMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
  const entry = state.value.days[todayKey]
  moodDraft.value = entry?.myMood || ''
  moodNote.value = entry?.myMoodNote || ''
}
function saveMood() {
  const entry = ensureDayRecord(todayKey)
  entry.myMood = moodDraft.value
  entry.myMoodNote = moodNote.value.trim()
  saveState()
}
const moodMonthCells = computed(() => {
  const year = moodMonth.value.getFullYear()
  const month = moodMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const total = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(year, month, day)
    const key = localKey(date)
    const mine = state.value.days[key]?.myMood || ''
    const canWriteMood = diaryPermissions.value.enabled && diaryPermissions.value.mood && key <= todayKey
    const savedMood = state.value.days[key]?.mood || ''
    cells.push({ day, key, mine, ta: canWriteMood ? (savedMood || taMood(key).mood) : '' })
  }
  return cells
})
const moodCurvePoints = computed(() => {
  const recorded = moodMonthCells.value
    .filter((cell) => cell?.mine)
    .map((cell, index) => {
      const moodIndex = Math.max(0, MOODS.findIndex((mood) => mood.mood === cell.mine))
      return `${18 + index * (264 / Math.max(1, moodMonthCells.value.length - 1))},${104 - moodIndex * 4}`
    })
  return recorded.join(' ')
})
const moodStats = computed(() => {
  const counts = new Map()
  for (const cell of moodMonthCells.value) {
    if (!cell?.mine) continue
    counts.set(cell.mine, (counts.get(cell.mine) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
})
function moveMoodMonth(offset) {
  moodMonth.value = new Date(moodMonth.value.getFullYear(), moodMonth.value.getMonth() + offset, 1)
}
function selectedDateLabel() {
  return `${selected.value.getFullYear()}年${selected.value.getMonth() + 1}月${selected.value.getDate()}日`
}
</script>

<template>
  <section v-if="!moodOpen" class="calendar-app">
    <div class="calendar-card glass">
      <div class="month-head">
        <button type="button" @click="moveMonth(-1)">‹</button>
        <strong>{{ monthLabel(cursor) }}</strong>
        <button type="button" @click="moveMonth(1)">›</button>
      </div>
      <div class="weekday-row"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
      <div class="calendar-grid">
        <button
          v-for="cell in calendarCells"
          :key="cell.key"
          type="button"
          class="day-cell"
          :class="{ blank: cell.blank, today: cell.today, selected: cell.selected, recorded: cell.recorded }"
          @click="selectDate(cell)"
        >
          <span v-if="!cell.blank">{{ cell.day }}</span>
        </button>
      </div>
    </div>

    <button class="mood-entry glass" type="button" @click="openMoodDiary">
      <span><strong>心情日记</strong><small>每日心情 · 月度曲线</small></span>
      <span>进入 ›</span>
    </button>

    <template v-if="currentEntry">
      <article class="info-card glass">
        <header>
          <span>{{ selectedDateLabel() }}</span>
          <b v-if="diaryPermissions.enabled && diaryPermissions.mood && currentEntry.cat">{{ currentEntry.cat }}</b>
        </header>
        <div v-if="!diaryPermissions.enabled" class="diary-disabled-note">该联系人已关闭心情日记写入。</div>
        <div v-if="diaryPermissions.enabled && diaryPermissions.mood && currentEntry.mood" class="mood-row">
          <span class="mood-icon" v-html="moodIcon(currentEntry.cat)"></span>
          <div><strong>{{ currentEntry.mood }}</strong><p>{{ currentEntry.desc }}</p></div>
        </div>
        <div v-if="diaryPermissions.enabled && currentEntry.activity" class="activity"><small>TA 正在</small><span>{{ currentEntry.activity }}</span></div>
        <section v-if="diaryPermissions.enabled && diaryPermissions.message && currentEntry.message"><h3>留言</h3><p>{{ currentEntry.message }}</p></section>
        <section v-if="diaryPermissions.enabled && diaryPermissions.quote && currentEntry.quote"><h3>情话</h3><p>{{ currentEntry.quote }}</p></section>

      </article>

      <article class="info-card glass">
        <section>
          <div class="section-head"><h3>我的留言</h3><button v-if="canEditToday" type="button" @click="openEdit('myMessage')">编辑</button></div>
          <p>{{ currentEntry.myMessage || '今天想说点什么...' }}</p>
        </section>
        <section>
          <div class="section-head"><h3>备忘</h3><button v-if="canEditToday" type="button" @click="openEdit('memo')">编辑</button></div>
          <p>{{ currentEntry.memo || '暂无备忘' }}</p>
        </section>
        <section>
          <div class="section-head"><h3>心情</h3><button v-if="canEditToday" type="button" @click="openMoodDiary">记录</button></div>
          <p>{{ currentEntry.myMood || '今天还没记录心情' }}</p>
        </section>
      </article>
    </template>
    <div v-else class="empty glass">{{ isFuture ? '这一天还没有内容，等到了那天再来看看吧' : '开始使用之前的日子，没有留下内容' }}</div>

    <div v-if="editOpen" class="dialog-layer" @click.self="editOpen = false">
      <div class="dialog-card">
        <h3>{{ editField === 'memo' ? '编辑备忘' : '编辑我的留言' }}</h3>
        <textarea v-model="editValue" rows="5" maxlength="500"></textarea>
        <div><button type="button" @click="editOpen = false">取消</button><button class="primary" type="button" @click="saveEdit">保存</button></div>
      </div>
    </div>
  </section>

  <section v-else class="mood-diary">
    <div class="mood-top">
      <button type="button" @click="moodOpen = false">‹ 返回日历</button>
      <strong>心情日记</strong>
      <span></span>
    </div>
    <div class="glass mood-editor">
      <h3>今天的心情</h3>
      <div class="mood-picker">
        <button v-for="mood in moods" :key="mood.mood" type="button" :class="{ active: moodDraft === mood.mood }" @click="moodDraft = mood.mood">
          {{ mood.mood }}
        </button>
      </div>
      <textarea v-model="moodNote" rows="3" maxlength="300" placeholder="写一点今天的心情…"></textarea>
      <button class="save-mood" type="button" @click="saveMood">保存今天的心情</button>
    </div>
    <div class="glass mood-month">
      <div class="month-head"><button type="button" @click="moveMoodMonth(-1)">‹</button><strong>{{ monthLabel(moodMonth) }}</strong><button type="button" @click="moveMoodMonth(1)">›</button></div>
      <div class="mood-week"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
      <div class="mood-grid">
        <template v-for="(cell, index) in moodMonthCells" :key="cell?.key || 'blank-' + index">
          <span v-if="!cell" class="mood-cell blank"></span>
          <span v-else class="mood-cell"><b>{{ cell.day }}</b><small>{{ cell.mine || '—' }}</small><em>{{ cell.ta }}</em></span>
        </template>
      </div>
      <svg class="mood-curve" viewBox="0 0 300 120" role="img" aria-label="月度心情曲线">
        <polyline v-if="moodCurvePoints" :points="moodCurvePoints" fill="none" stroke="var(--theme-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>      <div class="mood-stats">
        <span v-for="item in moodStats" :key="item[0]">{{ item[0] }} {{ item[1] }} 天</span>
        <span v-if="!moodStats.length">这个月还没有心情记录</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calendar-app,.mood-diary{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:12px;padding-bottom:14px}
.glass{border-radius:18px;padding:14px;background:var(--theme-surface);border:1px solid var(--theme-border-soft);box-shadow:none}
.month-head{display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:12px}
.month-head button{width:30px;height:30px;border:0;border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);font-size:20px;cursor:pointer}
.month-head strong{min-width:120px;text-align:center;color:var(--theme-text-strong)}
.weekday-row,.mood-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;color:var(--theme-muted);font-size:10px;text-align:center}
.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:6px}
.day-cell{aspect-ratio:1;border:0;border-radius:10px;background:transparent;color:var(--theme-text);position:relative;cursor:pointer}
.day-cell.blank{pointer-events:none}.day-cell.today{box-shadow:inset 0 0 0 1px var(--theme-primary)}.day-cell.selected{background:var(--theme-primary);color:#fff}
.day-cell.recorded::after{content:"";position:absolute;bottom:4px;left:50%;width:4px;height:4px;border-radius:50%;background:var(--theme-accent-warm);transform:translateX(-50%)}
.mood-entry{display:flex;align-items:center;justify-content:space-between;text-align:left;color:var(--theme-text);cursor:pointer}
.mood-entry span:first-child{display:flex;flex-direction:column;gap:3px}.mood-entry small{color:var(--theme-muted);font-size:10px}
.info-card header{display:flex;justify-content:space-between;align-items:center;color:var(--theme-muted);font-size:11px}.info-card header b{padding:3px 9px;border-radius:999px;background:var(--theme-soft);color:var(--theme-primary)}
.mood-row{display:flex;align-items:center;gap:12px;margin:14px 0}.mood-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:var(--theme-primary);color:#fff}.mood-icon :deep(svg){width:26px;height:26px}
.mood-row strong{font-size:18px;color:var(--theme-text-strong)}.mood-row p{margin:3px 0 0;font-size:11px;color:var(--theme-muted)}
.activity{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--theme-text);padding:8px 0}.activity small{color:var(--theme-muted)}
.info-card section{padding-top:11px;margin-top:11px;border-top:1px solid var(--theme-border-soft)}.info-card h3{margin:0 0 6px;font-size:11px;color:var(--theme-muted);letter-spacing:.08em}.info-card p{margin:0;color:var(--theme-text);font-size:12.5px;line-height:1.7;white-space:pre-wrap}
.section-head{display:flex;justify-content:space-between;align-items:center}.section-head button,.mood-top button{border:0;background:transparent;color:var(--theme-primary);cursor:pointer;font-size:11px}
.diary-disabled-note{padding:12px 0 2px;color:var(--theme-muted);font-size:12px}.empty{min-height:140px;display:grid;place-items:center;text-align:center;color:var(--theme-muted);font-size:12px}
.dialog-layer{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:16px;background:rgba(var(--theme-overlay-rgb),.36)}
.dialog-card{width:min(460px,100%);padding:16px;border-radius:16px;background:var(--theme-surface);display:flex;flex-direction:column;gap:10px}.dialog-card textarea,.mood-editor textarea{width:100%;padding:10px;border:1px solid var(--theme-border-soft);border-radius:10px;background:#fff;color:var(--theme-text);resize:vertical}.dialog-card>div{display:flex;justify-content:flex-end;gap:8px}.dialog-card button,.save-mood{border:0;border-radius:9px;padding:8px 12px;background:var(--theme-soft);color:var(--theme-primary);cursor:pointer}.dialog-card .primary,.save-mood{background:var(--theme-primary);color:#fff}
.mood-top{display:grid;grid-template-columns:90px 1fr 90px;align-items:center;color:var(--theme-text-strong)}.mood-top button{text-align:left}
.mood-editor h3,.mood-month h3{margin:0 0 10px;color:var(--theme-text-strong);font-size:13px}.mood-picker{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.mood-picker button{border:0;border-radius:999px;padding:6px 10px;background:var(--theme-soft);color:var(--theme-text);cursor:pointer}.mood-picker button.active{background:var(--theme-primary);color:#fff}
.mood-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:6px}.mood-cell{min-height:48px;border-radius:9px;background:var(--theme-soft);padding:5px;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:9px}.mood-cell b{color:var(--theme-text-strong)}.mood-cell small{color:var(--theme-primary)}.mood-cell em{font-style:normal;color:var(--theme-muted)}.mood-cell.blank{background:transparent}
.mood-stats{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;color:var(--theme-muted);font-size:10px}
@media(max-width:560px){.calendar-app,.mood-diary{gap:9px}.glass{padding:12px}.mood-cell{min-height:42px;padding:4px}.mood-picker button{font-size:10px}}

.mood-curve{width:100%;height:120px;margin-top:10px;border-radius:10px;background:var(--theme-soft)}</style>