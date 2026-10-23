<script setup>
import { ref, computed } from 'vue'
import { settings } from '../settings'

// 其他纪念日存储键（主纪念日复用 settings.anniversaryDate 与首页卡片联立）
const MEMORIALS_KEY = 'zhengdu_memorials_v1'
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const REL_LABELS = { love: '恋爱纪念日', family: '亲情纪念日', friend: '友情纪念日' }
const REL_VERBS = { love: '在一起', family: '相识', friend: '相识' }

function pad(n) { return n < 10 ? '0' + n : '' + n }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function normDateStr(v) {
  const s = String(v == null ? '' : v).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  if (!m) m = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(s)
  if (!m) return ''
  const y = +m[1], mo = +m[2], d = +m[3]
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  return `${y}-${pad(mo)}-${pad(d)}`
}
function parseDate(v) {
  const ds = normDateStr(v)
  if (!ds) return null
  const [y, m, d] = ds.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function day0(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function loadJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback } catch { return fallback }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const extras = ref(loadJson(MEMORIALS_KEY, []).filter((it) => it && typeof it.name === 'string' && normDateStr(it.date)))

// ---------- 主纪念日 ----------
const relLabel = computed(() => REL_LABELS[settings.anniversaryType] || REL_LABELS.love)
const loveDate = computed(() => normDateStr(settings.anniversaryDate))
const loveDays = computed(() => {
  const start = parseDate(settings.anniversaryDate)
  if (!start) return null
  return Math.max(0, Math.floor((day0(new Date()) - start) / 86400000))
})
const loveDateText = computed(() => {
  const ds = loveDate.value
  if (!ds) return ''
  const role = (settings.anniversaryRole || '').trim()
  const who = role ? `和${role}` : '我们'
  const verb = REL_VERBS[settings.anniversaryType] || REL_VERBS.love
  return `${ds.split('-').join('.')} 起 · ${who}${verb}`
})
const loveDateBtnText = computed(() => {
  const ds = loveDate.value
  if (!ds) return '点击设置日期'
  const [y, m, d] = ds.split('-')
  return `${y} 年 ${+m} 月 ${+d} 日`
})

// 某个日期的「下次同月同日」距今天还有几天
function nextOccurrence(dateObj) {
  const now = day0(new Date())
  const ann = new Date(now.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  if (ann.getTime() < now.getTime()) ann.setFullYear(ann.getFullYear() + 1)
  const days = Math.ceil((ann.getTime() - now.getTime()) / 86400000)
  return { date: ann, days, label: `${ann.getMonth() + 1} 月 ${ann.getDate()} 日` }
}
// 下一个纪念日：主纪念日 + 其他纪念日里，下次同月同日最近的一个
const nextMemorial = computed(() => {
  const candidates = []
  const main = parseDate(settings.anniversaryDate)
  if (main) candidates.push({ name: relLabel.value, occ: nextOccurrence(main) })
  for (const it of extras.value) {
    const d = parseDate(it.date)
    if (d) candidates.push({ name: it.name, occ: nextOccurrence(d) })
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => a.occ.days - b.occ.days || a.occ.date - b.occ.date)
  return candidates[0]
})

// ---------- 其他纪念日 ----------
function extraDayLabel(it) {
  const target = parseDate(it.date)
  if (!target) return ''
  const diff = Math.round((day0(target) - day0(new Date())) / 86400000)
  if (it.type === 'count' || diff > 0) {
    return diff > 0 ? `还有 ${diff} 天` : '就是今天'
  }
  return `已 ${Math.abs(diff)} 天`
}
function removeExtra(index) {
  extras.value.splice(index, 1)
  saveJson(MEMORIALS_KEY, extras.value)
}

// ---------- 关系类型 / 称呼 ----------
function setRelType(type) {
  settings.anniversaryType = type
}
function onRoleInput(event) {
  settings.anniversaryRole = String(event.target.value || '').trim().slice(0, 12)
}

// ---------- 月历（两个弹层共用渲染） ----------
function calCells(viewY, viewM, selDate) {
  const today = todayStr()
  const days = new Date(viewY, viewM + 1, 0).getDate()
  const startWd = new Date(viewY, viewM, 1).getDay()
  const cells = []
  for (let i = 0; i < startWd; i += 1) cells.push(null)
  for (let d = 1; d <= days; d += 1) {
    const ds = `${viewY}-${pad(viewM + 1)}-${pad(d)}`
    cells.push({ day: d, date: ds, today: ds === today, selected: ds === selDate })
  }
  return cells
}
function calTitle(viewY, viewM) {
  return `${viewY} 年 ${viewM + 1} 月`
}
function shiftMonth(y, m, delta) {
  m += delta
  while (m < 0) { m += 12; y -= 1 }
  while (m > 11) { m -= 12; y += 1 }
  return { y, m }
}

// 添加纪念日弹层
const addOpen = ref(false)
const addName = ref('')
const addType = ref('auto')
const addSel = ref('')
const addView = ref({ y: 0, m: 0 })
const addCells = computed(() => calCells(addView.value.y, addView.value.m, addSel.value))
function openAdd() {
  const now = new Date()
  addView.value = { y: now.getFullYear(), m: now.getMonth() }
  addSel.value = todayStr()
  addName.value = ''
  addType.value = 'auto'
  addOpen.value = true
}
function addMove(delta) {
  addView.value = shiftMonth(addView.value.y, addView.value.m, delta)
}
function pickAdd(ds) {
  addSel.value = ds
}
function confirmAdd() {
  const name = addName.value.trim()
  if (!name) return
  if (!addSel.value) return
  const type = addType.value === 'auto'
    ? (new Date(addSel.value + 'T00:00:00').getTime() > Date.now() ? 'count' : 'ann')
    : addType.value
  extras.value.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, date: addSel.value, type })
  saveJson(MEMORIALS_KEY, extras.value)
  addOpen.value = false
}

// 主纪念日选日期弹层
const dateOpen = ref(false)
const dateSel = ref('')
const dateView = ref({ y: 0, m: 0 })
const dateCells = computed(() => calCells(dateView.value.y, dateView.value.m, dateSel.value))
function openDate() {
  const cur = loveDate.value || todayStr()
  const [y, m] = cur.split('-').map(Number)
  dateView.value = { y, m: m - 1 }
  dateSel.value = cur
  dateOpen.value = true
}
function dateMove(delta) {
  dateView.value = shiftMonth(dateView.value.y, dateView.value.m, delta)
}
function pickDate(ds) {
  dateSel.value = ds
}
function confirmDate() {
  const ds = normDateStr(dateSel.value)
  if (!ds) return
  settings.anniversaryDate = ds
  dateOpen.value = false
}
</script>

<template>
  <section class="mem-app">
    <!-- 主纪念日 -->
    <div class="mem-card">
      <div class="mem-label">{{ relLabel }}</div>
      <div class="mem-type-row">
        <button type="button" class="mem-pill" :class="{ sel: settings.anniversaryType === 'love' }" @click="setRelType('love')">爱情向</button>
        <button type="button" class="mem-pill" :class="{ sel: settings.anniversaryType === 'family' }" @click="setRelType('family')">亲情向</button>
        <button type="button" class="mem-pill" :class="{ sel: settings.anniversaryType === 'friend' }" @click="setRelType('friend')">友情向</button>
      </div>
      <input
        type="text"
        class="mem-input"
        placeholder="关系称呼（选填）如：姐姐 / 女儿 / 妈妈 / 朋友"
        maxlength="12"
        :value="settings.anniversaryRole"
        @input="onRoleInput"
      />
      <button type="button" class="mem-date-btn" :data-set="loveDate ? '1' : '0'" @click="openDate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mem-date-ico"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <span>{{ loveDateBtnText }}</span>
      </button>
      <div class="mem-days"><b>{{ loveDays == null ? '—' : loveDays }}</b> 天</div>
      <div class="mem-date-txt">{{ loveDateText }}</div>
    </div>

    <!-- 下一个纪念日 -->
    <div class="mem-card">
      <div class="mem-label">下一个纪念日</div>
      <div v-if="nextMemorial" class="mem-next">
        <strong>{{ nextMemorial.name }}</strong>
        <span>还有 {{ nextMemorial.occ.days }} 天 · {{ nextMemorial.occ.label }}</span>
      </div>
      <div v-else class="mem-empty">设置日期后，这里会显示最近的纪念日。</div>
    </div>

    <!-- 其他纪念日 -->
    <div class="mem-card">
      <div class="mem-label">其他纪念日</div>
      <div class="mem-tip">未来日期按倒数日显示，过去日期按纪念日显示</div>
      <div v-if="!extras.length" class="mem-empty">还没有其他纪念日。</div>
      <div v-for="(it, index) in extras" :key="it.id || index" class="mem-extra">
        <span class="me-name">{{ it.name }}</span>
        <span class="me-date">{{ it.date.split('-').join('.') }}</span>
        <span class="me-days" :class="{ count: it.type === 'count' || extraDayLabel(it).startsWith('还有') }">{{ extraDayLabel(it) }}</span>
        <button type="button" class="me-del" @click="removeExtra(index)">✕</button>
      </div>
      <button type="button" class="mem-add" @click="openAdd">+ 添加纪念日</button>
    </div>

    <!-- 添加纪念日弹层 -->
    <div v-if="addOpen" class="mem-layer" @click.self="addOpen = false">
      <section class="mem-modal">
        <header><strong>添加纪念日 / 倒数日</strong><button type="button" @click="addOpen = false">×</button></header>
        <input type="text" class="mem-input" placeholder="名称（如：在一起一周年 / 生日）" maxlength="24" v-model="addName" />
        <div class="mem-cal">
          <div class="mem-cal-nav">
            <button type="button" @click="addMove(-12)">«</button>
            <button type="button" @click="addMove(-1)">‹</button>
            <strong class="mem-cal-title">{{ calTitle(addView.y, addView.m) }}</strong>
            <button type="button" @click="addMove(1)">›</button>
            <button type="button" @click="addMove(12)">»</button>
          </div>
          <div class="mem-cal-wd"><span v-for="w in WEEKDAYS" :key="w">{{ w }}</span></div>
          <div class="mem-cal-grid">
            <template v-for="(cell, index) in addCells" :key="index">
              <span v-if="!cell" class="mem-cell blank"></span>
              <button v-else type="button" class="mem-cell" :class="{ today: cell.today, sel: cell.selected }" @click="pickAdd(cell.date)">{{ cell.day }}</button>
            </template>
          </div>
        </div>
        <div class="mem-type-row">
          <button type="button" class="mem-pill" :class="{ sel: addType === 'auto' }" @click="addType = 'auto'">自动</button>
          <button type="button" class="mem-pill" :class="{ sel: addType === 'ann' }" @click="addType = 'ann'">纪念日</button>
          <button type="button" class="mem-pill" :class="{ sel: addType === 'count' }" @click="addType = 'count'">倒数日</button>
        </div>
        <div class="mem-modal-actions">
          <button type="button" @click="addOpen = false">取消</button>
          <button type="button" class="primary" :disabled="!addName.trim() || !addSel" @click="confirmAdd">添加</button>
        </div>
      </section>
    </div>

    <!-- 主纪念日选日期弹层 -->
    <div v-if="dateOpen" class="mem-layer" @click.self="dateOpen = false">
      <section class="mem-modal">
        <header><strong>选择日期</strong><button type="button" @click="dateOpen = false">×</button></header>
        <div class="mem-cal">
          <div class="mem-cal-nav">
            <button type="button" @click="dateMove(-12)">«</button>
            <button type="button" @click="dateMove(-1)">‹</button>
            <strong class="mem-cal-title">{{ calTitle(dateView.y, dateView.m) }}</strong>
            <button type="button" @click="dateMove(1)">›</button>
            <button type="button" @click="dateMove(12)">»</button>
          </div>
          <div class="mem-cal-wd"><span v-for="w in WEEKDAYS" :key="w">{{ w }}</span></div>
          <div class="mem-cal-grid">
            <template v-for="(cell, index) in dateCells" :key="index">
              <span v-if="!cell" class="mem-cell blank"></span>
              <button v-else type="button" class="mem-cell" :class="{ today: cell.today, sel: cell.selected }" @click="pickDate(cell.date)">{{ cell.day }}</button>
            </template>
          </div>
        </div>
        <div class="mem-modal-actions">
          <button type="button" @click="dateOpen = false">取消</button>
          <button type="button" class="primary" :disabled="!dateSel" @click="confirmDate">确定</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.mem-app {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 32px;
}
.mem-card {
  padding: 16px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: var(--theme-surface);
  box-shadow: 0 2px 10px rgba(var(--theme-overlay-rgb), 0.05);
}
.mem-label {
  font-size: 11px;
  color: var(--theme-muted);
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.mem-type-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.mem-pill {
  flex: 1;
  padding: 8px 0;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.mem-pill.sel {
  background: var(--theme-primary);
  border-color: var(--theme-primary);
  color: var(--theme-inverse);
}
.mem-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 13px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  font-size: 13px;
  color: var(--theme-text);
  outline: none;
  margin-bottom: 10px;
}
.mem-input:focus {
  border-color: var(--theme-primary);
}
.mem-date-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 11px 14px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.mem-date-btn[data-set='1'] {
  font-weight: 700;
}
.mem-date-ico {
  width: 18px;
  height: 18px;
  opacity: 0.75;
  flex-shrink: 0;
}
.mem-days {
  font-size: 38px;
  font-weight: 800;
  color: var(--theme-primary);
  margin-top: 10px;
}
.mem-days b {
  font-size: 46px;
}
.mem-date-txt {
  font-size: 12px;
  color: var(--theme-muted);
  margin-top: 4px;
}
.mem-next {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mem-next strong {
  font-size: 16px;
  color: var(--theme-text);
}
.mem-next span {
  font-size: 13px;
  color: var(--theme-primary);
  font-weight: 700;
}
.mem-tip {
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--theme-soft);
  font-size: 11px;
  color: var(--theme-muted);
  line-height: 1.6;
  margin-bottom: 10px;
}
.mem-empty {
  font-size: 12px;
  color: var(--theme-muted);
  padding: 8px 0;
}
.mem-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-surface);
  margin-bottom: 8px;
}
.me-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.me-date {
  font-size: 11px;
  color: var(--theme-muted);
}
.me-days {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text);
}
.me-days.count {
  color: #e05555;
}
.me-del {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.me-del:active {
  background: rgba(224, 85, 85, 0.15);
  color: #e05555;
}
.mem-add {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.mem-layer {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.mem-modal {
  width: min(320px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  padding: 16px;
  border-radius: 18px;
  background: var(--theme-surface);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}
.mem-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.mem-modal header strong {
  font-size: 14px;
  color: var(--theme-text);
}
.mem-modal header button {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 14px;
  cursor: pointer;
}
.mem-cal {
  background: var(--theme-soft);
  border-radius: 14px;
  padding: 10px 8px 8px;
  margin-bottom: 10px;
}
.mem-cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.mem-cal-nav button {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--theme-surface);
  color: var(--theme-muted);
  cursor: pointer;
}
.mem-cal-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-text);
}
.mem-cal-wd {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}
.mem-cal-wd span {
  font-size: 10px;
  color: var(--theme-muted);
  text-align: center;
  padding: 3px 0;
}
.mem-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.mem-cell {
  aspect-ratio: 1;
  border: none;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--theme-text);
  background: transparent;
  cursor: pointer;
}
.mem-cell.blank {
  cursor: default;
}
.mem-cell.today {
  box-shadow: inset 0 0 0 1px var(--theme-primary);
  color: var(--theme-primary);
  font-weight: 700;
}
.mem-cell.sel {
  background: var(--theme-primary);
  color: var(--theme-inverse);
  font-weight: 700;
}
.mem-modal-actions {
  display: flex;
  gap: 10px;
}
.mem-modal-actions button {
  flex: 1;
  padding: 11px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.mem-modal-actions button.primary {
  background: var(--theme-primary);
  border-color: var(--theme-primary);
  color: var(--theme-inverse);
}
.mem-modal-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
