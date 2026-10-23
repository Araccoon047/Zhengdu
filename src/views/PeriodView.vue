<script setup>
import { computed, ref, watch } from 'vue'

const RECORDS_KEY = 'zhengdu_period_records_v1'
const CONFIG_KEY = 'zhengdu_period_config_v1'
const DAILY_KEY = 'zhengdu_period_daily_v1'
const FLOWS = ['少量', '中等', '较多']
const SYMPTOMS = ['腹痛', '腰酸', '疲惫', '头痛', '情绪波动', '乳房胀痛', '长痘', '食欲变化']
const MOODS = ['平静', '开心', '烦躁', '低落', '敏感', '疲惫']

function pad(value) { return String(value).padStart(2, '0') }
function dayKey(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function parseDay(value) { const [year, month, day] = String(value).split('-').map(Number); return new Date(year, month - 1, day) }
function addDays(value, count) { const date = parseDay(value); date.setDate(date.getDate() + count); return dayKey(date) }
function diffDays(start, end) { return Math.round((parseDay(end) - parseDay(start)) / 86400000) }
function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback } catch { return fallback } }

const records = ref(loadJson(RECORDS_KEY, []))
const config = ref({ cycleLength: 28, periodLength: 5, ...loadJson(CONFIG_KEY, {}) })
const daily = ref(loadJson(DAILY_KEY, {}))
const today = dayKey()
const selectedDate = ref(today)
const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const settingsOpen = ref(false)
const dayOpen = ref(false)
const configDraft = ref({ ...config.value })
const dayDraft = ref(emptyDayDraft())
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

function emptyDayDraft() {
  return { flow: '', symptoms: [], temperature: '', mood: '', note: '' }
}
function sortedStarts() { return records.value.map((item) => item.start).filter(Boolean).sort() }
function cycleStats() {
  const starts = sortedStarts()
  const lengths = []
  for (let index = 1; index < starts.length; index += 1) {
    const length = diffDays(starts[index - 1], starts[index])
    if (length >= 15 && length <= 60) lengths.push(length)
  }
  const recent = lengths.slice(-6)
  const sorted = [...recent].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Number(config.value.cycleLength) || 28
  const average = recent.length ? recent.reduce((sum, item) => sum + item, 0) / recent.length : median
  return { lengths, recent, median, average }
}
const stats = computed(() => cycleStats())
const latestRecord = computed(() => [...records.value].filter((item) => item.start).sort((a, b) => b.start.localeCompare(a.start))[0] || null)
const activeRecord = computed(() => records.value.find((item) => item.start <= today && (!item.end || item.end >= today)) || null)
const predictedStart = computed(() => {
  const latest = sortedStarts().slice(-1)[0]
  return latest ? addDays(latest, Math.max(15, Math.round(stats.value.median))) : ''
})
const predictedEnd = computed(() => predictedStart.value ? addDays(predictedStart.value, Math.max(1, Number(config.value.periodLength) || 5) - 1) : '')
const daysUntilNext = computed(() => predictedStart.value ? diffDays(today, predictedStart.value) : null)
const statusTitle = computed(() => {
  if (activeRecord.value) return '经期进行中'
  if (daysUntilNext.value === 0) return '预计今天开始'
  if (daysUntilNext.value > 0) return `距离预计经期还有 ${daysUntilNext.value} 天`
  return '记录第一次经期后开始预测'
})
const statusSub = computed(() => activeRecord.value ? `本次从 ${activeRecord.value.start} 开始${activeRecord.value.end ? `，${activeRecord.value.end} 结束` : ''}` : predictedStart.value ? `预计 ${predictedStart.value} 至 ${predictedEnd.value}` : '点击“今天开始”建立第一条记录')
const phaseProgress = computed(() => {
  if (!predictedStart.value) return 0
  const latest = sortedStarts().slice(-1)[0]
  const total = Math.max(1, diffDays(latest, predictedStart.value))
  return Math.max(0, Math.min(100, diffDays(latest, today) / total * 100))
})

const calendarCells = computed(() => {
  const year = cursor.value.getFullYear()
  const month = cursor.value.getMonth()
  const first = new Date(year, month, 1)
  const total = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= total; day += 1) {
    const key = dayKey(new Date(year, month, day))
    const period = records.value.some((item) => key >= item.start && key <= (item.end || addDays(item.start, Math.max(1, Number(config.value.periodLength) || 5) - 1)))
    const predicted = predictedStart.value && key >= predictedStart.value && key <= predictedEnd.value && !period
    cells.push({ key, day, period, predicted, today: key === today, selected: key === selectedDate.value, hasDaily: Boolean(daily.value[key]) })
  }
  return cells
})
const history = computed(() => [...records.value].sort((a, b) => b.start.localeCompare(a.start)))
const selectedDaily = computed(() => daily.value[selectedDate.value] || emptyDayDraft())

function moveMonth(offset) { cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + offset, 1) }
function monthLabel() { return `${cursor.value.getFullYear()}年${cursor.value.getMonth() + 1}月` }
function markStart() {
  if (activeRecord.value) {
    window.alert('当前已经有进行中的经期记录，请先标记结束。')
    return
  }
  const record = { id: `period-${Date.now()}`, start: today, end: '', createdAt: Date.now() }
  records.value.push(record)
  selectedDate.value = today
}
function markEnd() {
  const open = [...records.value].filter((item) => !item.end && item.start <= today).sort((a, b) => b.start.localeCompare(a.start))[0]
  if (!open) {
    window.alert('没有可结束的经期记录。')
    return
  }
  open.end = today
}
function deleteRecord(record) {
  if (!window.confirm(`删除 ${record.start} 的经期记录？`)) return
  records.value = records.value.filter((item) => item.id !== record.id)
}
function selectDate(cell) {
  if (!cell) return
  selectedDate.value = cell.key
}
function selectAndRecord(cell) {
  if (!cell) return
  selectedDate.value = cell.key
  openDay()
}
function openDay() {
  const existing = daily.value[selectedDate.value] || emptyDayDraft()
  dayDraft.value = { ...existing, symptoms: [...(existing.symptoms || [])] }
  dayOpen.value = true
}
function toggleSymptom(symptom) {
  dayDraft.value.symptoms = dayDraft.value.symptoms.includes(symptom)
    ? dayDraft.value.symptoms.filter((item) => item !== symptom)
    : [...dayDraft.value.symptoms, symptom]
}
function saveDay() {
  daily.value = { ...daily.value, [selectedDate.value]: { ...dayDraft.value } }
  dayOpen.value = false
}
function deleteDay() {
  const next = { ...daily.value }
  delete next[selectedDate.value]
  daily.value = next
  dayOpen.value = false
}
function openSettings() {
  configDraft.value = { ...config.value }
  settingsOpen.value = true
}
function saveSettings() {
  config.value = {
    cycleLength: Math.min(60, Math.max(15, Number(configDraft.value.cycleLength) || 28)),
    periodLength: Math.min(14, Math.max(1, Number(configDraft.value.periodLength) || 5)),
  }
  settingsOpen.value = false
}
watch(records, (value) => localStorage.setItem(RECORDS_KEY, JSON.stringify(value)), { deep: true })
watch(config, (value) => localStorage.setItem(CONFIG_KEY, JSON.stringify(value)), { deep: true })
watch(daily, (value) => localStorage.setItem(DAILY_KEY, JSON.stringify(value)), { deep: true })
</script>

<template>
  <section class="period-app">
    <div class="period-status-card">
      <div class="period-status-head"><span class="period-status-icon">◌</span><div><strong>{{ statusTitle }}</strong><small>{{ statusSub }}</small></div><button type="button" class="period-cog" @click="openSettings">⚙</button></div>
      <div class="period-phase"><i :style="{ width: phaseProgress + '%' }"></i></div>
      <div class="period-actions"><button type="button" class="primary" @click="markStart">今天开始</button><button type="button" @click="markEnd">今天结束</button><button type="button" @click="openDay">记录今天</button></div>
    </div>

    <div class="period-card">
      <div class="period-month-head"><button type="button" @click="moveMonth(-1)">‹</button><strong>{{ monthLabel() }}</strong><button type="button" @click="moveMonth(1)">›</button></div>
      <div class="period-legend"><span><i class="dot period"></i>经期</span><span><i class="dot predicted"></i>预测</span><span><i class="dot daily"></i>有记录</span></div>
      <div class="period-weekdays"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
      <div class="period-grid">
        <template v-for="(cell, index) in calendarCells" :key="cell?.key || 'blank-' + index">
          <span v-if="!cell" class="period-day blank"></span>
          <button v-else type="button" class="period-day" :class="{ period: cell.period, predicted: cell.predicted, today: cell.today, selected: cell.selected, daily: cell.hasDaily }" @click="selectDate(cell)" @dblclick="selectAndRecord(cell)"><span>{{ cell.day }}</span></button>
        </template>
      </div>
      <div class="period-selected-note">选中：{{ selectedDate }}<button type="button" @click="openDay">{{ daily[selectedDate] ? '编辑记录' : '记录这一天' }}</button></div>
    </div>

    <div class="period-card">
      <div class="period-card-title">周期概览</div>
      <div class="period-stat-grid"><div><span>平均周期</span><strong>{{ stats.average.toFixed(1) }} 天</strong></div><div><span>中位周期</span><strong>{{ stats.median }} 天</strong></div><div><span>经期长度</span><strong>{{ config.periodLength }} 天</strong></div><div><span>规律性</span><strong>{{ stats.recent.length >= 3 ? '已具备参考' : '记录较少' }}</strong></div></div>
    </div>

    <div class="period-card">
      <div class="period-card-title">历史记录</div>
      <div v-if="!history.length" class="period-empty">还没有经期记录。</div>
      <div v-for="record in history" :key="record.id" class="period-history-row"><span>{{ record.start }} → {{ record.end || '进行中' }}</span><small>{{ record.end ? `共 ${diffDays(record.start, record.end) + 1} 天` : '尚未结束' }}</small><button type="button" @click="deleteRecord(record)">删除</button></div>
    </div>

    <div v-if="dayOpen" class="period-layer" @click.self="dayOpen = false">
      <section class="period-modal"><header><strong>{{ selectedDate }} 的经期记录</strong><button type="button" @click="dayOpen = false">×</button></header><label><span>经量</span><select v-model="dayDraft.flow"><option value="">未记录</option><option v-for="flow in FLOWS" :key="flow" :value="flow">{{ flow }}</option></select></label><div class="period-chip-group"><span>症状</span><button v-for="symptom in SYMPTOMS" :key="symptom" type="button" :class="{ active: dayDraft.symptoms.includes(symptom) }" @click="toggleSymptom(symptom)">{{ symptom }}</button></div><label><span>体温</span><input v-model="dayDraft.temperature" type="text" placeholder="例如 36.5℃" /></label><label><span>心情</span><select v-model="dayDraft.mood"><option value="">未记录</option><option v-for="mood in MOODS" :key="mood" :value="mood">{{ mood }}</option></select></label><label><span>备注</span><textarea v-model="dayDraft.note" rows="3" maxlength="500" /></label><div class="period-modal-actions"><button v-if="daily[selectedDate]" type="button" class="danger" @click="deleteDay">删除记录</button><button type="button" @click="dayOpen = false">取消</button><button type="button" class="primary" @click="saveDay">保存</button></div></section>
    </div>

    <div v-if="settingsOpen" class="period-layer" @click.self="settingsOpen = false">
      <section class="period-modal compact"><header><strong>周期设置</strong><button type="button" @click="settingsOpen = false">×</button></header><label><span>平均周期长度（天）</span><input v-model.number="configDraft.cycleLength" type="number" min="15" max="60" /></label><label><span>经期持续天数</span><input v-model.number="configDraft.periodLength" type="number" min="1" max="14" /></label><div class="period-modal-actions"><button type="button" @click="settingsOpen = false">取消</button><button type="button" class="primary" @click="saveSettings">保存</button></div></section>
    </div>
  </section>
</template>

<style scoped>
.period-app{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-bottom:16px;color:var(--theme-text)}
.period-status-card,.period-card{padding:13px;border:1px solid var(--theme-border-soft);border-radius:15px;background:var(--theme-surface)}
.period-status-card{background:var(--theme-soft)}.period-status-head{display:flex;align-items:center;gap:10px}.period-status-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--theme-primary);color:var(--theme-inverse);font-size:23px}.period-status-head>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.period-status-head strong{color:var(--theme-text-strong);font-size:15px}.period-status-head small{overflow:hidden;color:var(--theme-muted);font-size:9.5px;text-overflow:ellipsis;white-space:nowrap}.period-cog{width:31px;height:31px;padding:0;border:1px solid var(--theme-border-soft);border-radius:50%;background:var(--theme-surface);color:var(--theme-primary);font-size:14px;cursor:pointer}
.period-phase{height:5px;margin:11px 0;border-radius:99px;background:var(--theme-border-soft);overflow:hidden}.period-phase i{display:block;height:100%;border-radius:inherit;background:var(--theme-primary)}.period-actions{display:flex;flex-wrap:wrap;gap:6px}.period-actions button,.period-modal-actions button,.period-selected-note button,.period-history-row button{padding:7px 10px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-surface);color:var(--theme-primary);font-size:9.5px;font-weight:800;cursor:pointer}.period-actions .primary,.period-modal-actions .primary{border:0;background:var(--theme-primary);color:var(--theme-inverse)}
.period-month-head{display:flex;align-items:center;justify-content:center;gap:18px}.period-month-head button{width:29px;height:29px;border:0;border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);cursor:pointer}.period-month-head strong{min-width:110px;text-align:center;color:var(--theme-text-strong);font-size:12px}.period-legend{display:flex;gap:12px;justify-content:center;margin:9px 0;color:var(--theme-muted);font-size:8.5px}.period-legend span{display:flex;align-items:center;gap:4px}.dot{width:7px;height:7px;border-radius:50%;display:inline-block}.dot.period{background:var(--theme-primary)}.dot.predicted{background:var(--theme-accent-warm)}.dot.daily{background:var(--theme-positive)}
.period-weekdays,.period-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.period-weekdays{color:var(--theme-muted);font-size:9px;text-align:center;margin-bottom:4px}.period-day{aspect-ratio:1;border:0;border-radius:50%;background:transparent;color:var(--theme-text);position:relative;font-size:10px;cursor:pointer}.period-day.blank{pointer-events:none}.period-day.period{background:var(--theme-primary);color:var(--theme-inverse)}.period-day.predicted{box-shadow:inset 0 0 0 1px var(--theme-accent-warm)}.period-day.today{outline:1px solid var(--theme-primary);outline-offset:1px}.period-day.selected{box-shadow:0 0 0 2px var(--theme-primary)}.period-day.daily::after{content:"";position:absolute;bottom:3px;left:50%;width:3px;height:3px;border-radius:50%;background:var(--theme-positive);transform:translateX(-50%)}
.period-selected-note{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:var(--theme-muted);font-size:9px}.period-card-title{color:var(--theme-primary);font-size:11px;font-weight:800;margin-bottom:9px}.period-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.period-stat-grid div{padding:8px;border-radius:10px;background:var(--theme-soft);display:flex;flex-direction:column;gap:3px}.period-stat-grid span{color:var(--theme-muted);font-size:8.5px}.period-stat-grid strong{color:var(--theme-text-strong);font-size:11px}.period-history-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--theme-border-soft);color:var(--theme-text);font-size:10px}.period-history-row small{color:var(--theme-muted);font-size:8.5px}.period-history-row button{margin-left:auto;padding:4px 7px;color:var(--theme-accent-warm)}.period-empty{min-height:80px;display:grid;place-items:center;color:var(--theme-muted);font-size:10px}
.period-layer{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:14px;background:rgba(var(--theme-overlay-rgb),.34);backdrop-filter:blur(5px)}.period-modal{width:min(440px,100%);max-height:84dvh;overflow:auto;padding:14px;border:1px solid var(--theme-border);border-radius:16px;background:var(--theme-surface);display:flex;flex-direction:column;gap:10px}.period-modal header{display:flex;align-items:center;justify-content:space-between}.period-modal header strong{color:var(--theme-primary);font-size:13px}.period-modal header button{border:0;background:transparent;font-size:18px;color:var(--theme-muted)}.period-modal label{display:flex;flex-direction:column;gap:5px;color:var(--theme-text);font-size:10px}.period-modal input,.period-modal select,.period-modal textarea{width:100%;padding:8px 9px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10.5px}.period-modal-actions{display:flex;justify-content:flex-end;gap:7px}.period-modal-actions .danger{color:var(--theme-accent-warm)}.period-chip-group{display:flex;flex-wrap:wrap;gap:5px}.period-chip-group>span{width:100%;color:var(--theme-text);font-size:10px}.period-chip-group button{padding:5px 8px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-soft);color:var(--theme-muted);font-size:8.5px;cursor:pointer}.period-chip-group button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}.period-modal.compact{gap:12px}
@media(max-width:560px){.period-app{padding:0 7px 12px}.period-status-card,.period-card{padding:11px}.period-day{font-size:9px}}
</style>