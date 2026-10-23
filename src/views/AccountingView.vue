<script setup>
import { computed, ref, watch } from 'vue'

const RECORDS_KEY = 'zhengdu_accounting_records_v1'
const CATEGORIES_KEY = 'zhengdu_accounting_categories_v1'
const BUDGET_KEY = 'zhengdu_accounting_budget_v1'
const defaultCategories = [
  { id: 'food', name: '餐饮', type: 'expense', icon: '食', color: '#efb0a6' },
  { id: 'transport', name: '交通', type: 'expense', icon: '行', color: '#9ebbd5' },
  { id: 'shopping', name: '购物', type: 'expense', icon: '购', color: '#d3b2d8' },
  { id: 'fun', name: '娱乐', type: 'expense', icon: '乐', color: '#e7c98f' },
  { id: 'health', name: '医疗', type: 'expense', icon: '医', color: '#a9cfbd' },
  { id: 'home', name: '居住', type: 'expense', icon: '家', color: '#b9b1d9' },
  { id: 'contact', name: '通讯', type: 'expense', icon: '讯', color: '#9dc9c9' },
  { id: 'other-expense', name: '其他', type: 'expense', icon: '其', color: '#c6c6c6' },
  { id: 'salary', name: '工资', type: 'income', icon: '薪', color: '#9ccc9d' },
  { id: 'parttime', name: '兼职', type: 'income', icon: '兼', color: '#9fc7d7' },
  { id: 'redpacket', name: '红包', type: 'income', icon: '红', color: '#e3a7a7' },
  { id: 'invest', name: '投资', type: 'income', icon: '投', color: '#d4bd8a' },
  { id: 'other-income', name: '其他', type: 'income', icon: '其', color: '#c6c6c6' },
]
function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback } catch { return fallback } }
function pad(value) { return String(value).padStart(2, '0') }
function dayKey(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }

const records = ref(loadJson(RECORDS_KEY, []))
const categories = ref(loadJson(CATEGORIES_KEY, defaultCategories))
const budget = ref(Number(loadJson(BUDGET_KEY, 0)) || 0)
const cursor = ref(new Date())
const viewMode = ref('month')
const search = ref('')
const editorOpen = ref(false)
const settingsOpen = ref(false)
const categoryOpen = ref(false)
const editingId = ref('')
const draft = ref(emptyDraft())
const budgetDraft = ref(String(budget.value || ''))
const categoryDraft = ref({ name: '', type: 'expense' })

function emptyDraft() {
  return { type: 'expense', amount: '', category: 'food', date: dayKey(), note: '' }
}
function resetDraft() {
  draft.value = emptyDraft()
  editingId.value = ''
}
function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: dayKey(start), end: dayKey(end) }
}
function weekRange(date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (current.getDay() + 6) % 7
  const start = new Date(current); start.setDate(current.getDate() - weekday)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  return { start: dayKey(start), end: dayKey(end) }
}
function yearRange(date) { return { start: `${date.getFullYear()}-01-01`, end: `${date.getFullYear()}-12-31` } }
const range = computed(() => viewMode.value === 'week' ? weekRange(cursor.value) : viewMode.value === 'year' ? yearRange(cursor.value) : monthRange(cursor.value))
const periodLabel = computed(() => {
  if (viewMode.value === 'year') return `${cursor.value.getFullYear()}年`
  if (viewMode.value === 'week') return `${range.value.start} 至 ${range.value.end}`
  return `${cursor.value.getFullYear()}年${cursor.value.getMonth() + 1}月`
})
const periodRecords = computed(() => records.value.filter((item) => item.date >= range.value.start && item.date <= range.value.end))
const filteredRecords = computed(() => {
  const query = search.value.trim().toLowerCase()
  return periodRecords.value
    .filter((item) => !query || `${item.note} ${categoryName(item.category)} ${item.amount}`.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.createdAt) - Number(a.createdAt))
})
const expense = computed(() => periodRecords.value.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0))
const income = computed(() => periodRecords.value.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0))
const balance = computed(() => income.value - expense.value)
const budgetProgress = computed(() => budget.value > 0 ? Math.min(100, expense.value / budget.value * 100) : 0)
const categoryRanking = computed(() => {
  const map = new Map()
  periodRecords.value.filter((item) => item.type === 'expense').forEach((item) => {
    map.set(item.category, (map.get(item.category) || 0) + Number(item.amount || 0))
  })
  return [...map.entries()].map(([id, amount]) => ({ id, amount, name: categoryName(id), color: categoryById(id)?.color || '#c6c6c6' })).sort((a, b) => b.amount - a.amount).slice(0, 8)
})
const groupedRecords = computed(() => {
  const groups = new Map()
  filteredRecords.value.forEach((item) => { if (!groups.has(item.date)) groups.set(item.date, []); groups.get(item.date).push(item) })
  return [...groups.entries()].map(([date, items]) => ({ date, items, total: items.reduce((sum, item) => sum + (item.type === 'expense' ? -1 : 1) * Number(item.amount || 0), 0) }))
})
const availableCategories = computed(() => categories.value.filter((item) => item.type === draft.value.type))
const expenseCategories = computed(() => categories.value.filter((item) => item.type === 'expense'))

function categoryById(id) { return categories.value.find((item) => item.id === id) }
function categoryName(id) { return categoryById(id)?.name || '其他' }
function formatMoney(value) { return Number(value || 0).toFixed(2) }
function movePeriod(offset) {
  const date = new Date(cursor.value)
  if (viewMode.value === 'year') date.setFullYear(date.getFullYear() + offset)
  else if (viewMode.value === 'week') date.setDate(date.getDate() + offset * 7)
  else date.setMonth(date.getMonth() + offset)
  cursor.value = date
}
function openEditor(record = null) {
  if (record) {
    editingId.value = record.id
    draft.value = { ...record, amount: String(record.amount) }
  } else resetDraft()
  editorOpen.value = true
}
function changeType(type) {
  draft.value.type = type
  draft.value.category = categories.value.find((item) => item.type === type)?.id || ''
}
function saveRecord() {
  const amount = Number(draft.value.amount)
  if (!Number.isFinite(amount) || amount <= 0) return
  const record = {
    id: editingId.value || `account-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: draft.value.type,
    amount,
    category: draft.value.category || availableCategories.value[0]?.id || '',
    date: draft.value.date || dayKey(),
    note: draft.value.note.trim(),
    createdAt: Date.now(),
  }
  records.value = editingId.value ? records.value.map((item) => item.id === editingId.value ? record : item) : [record, ...records.value]
  editorOpen.value = false
  resetDraft()
}
function deleteRecord(record) {
  if (!window.confirm('删除这条记账记录？')) return
  records.value = records.value.filter((item) => item.id !== record.id)
}
function saveBudget() {
  budget.value = Math.max(0, Number(budgetDraft.value) || 0)
  settingsOpen.value = false
}
function addCategory() {
  const name = categoryDraft.value.name.trim()
  if (!name) return
  const category = { id: `cat-${Date.now()}`, name, type: categoryDraft.value.type, icon: Array.from(name)[0] || '记', color: '#c7b9d9' }
  categories.value.push(category)
  categoryDraft.value = { name: '', type: categoryDraft.value.type }
}
function deleteCategory(category) {
  if (defaultCategories.some((item) => item.id === category.id)) return
  if (!window.confirm(`删除分类「${category.name}」？已有记录会保留分类名称。`)) return
  categories.value = categories.value.filter((item) => item.id !== category.id)
}
watch(records, (value) => localStorage.setItem(RECORDS_KEY, JSON.stringify(value)), { deep: true })
watch(categories, (value) => localStorage.setItem(CATEGORIES_KEY, JSON.stringify(value)), { deep: true })
watch(budget, (value) => localStorage.setItem(BUDGET_KEY, JSON.stringify(value)))
</script>

<template>
  <section class="accounting-app">
    <div class="acc-overview">
      <div class="acc-period-head">
        <button type="button" @click="movePeriod(-1)">‹</button>
        <div><strong>{{ periodLabel }}</strong><span>记账概览</span></div>
        <button type="button" @click="movePeriod(1)">›</button>
        <button type="button" class="acc-cog" @click="settingsOpen = true">⚙</button>
      </div>
      <div class="acc-mode-tabs"><button v-for="mode in [['week','周'],['month','月'],['year','年']]" :key="mode[0]" type="button" :class="{ active: viewMode === mode[0] }" @click="viewMode = mode[0]">{{ mode[1] }}</button></div>
      <div class="acc-numbers"><div><span>支出</span><strong>¥{{ formatMoney(expense) }}</strong></div><div><span>收入</span><strong>¥{{ formatMoney(income) }}</strong></div><div><span>结余</span><strong :class="{ negative: balance < 0 }">¥{{ formatMoney(balance) }}</strong></div></div>
      <div v-if="budget" class="acc-budget"><div><span>本月预算 ¥{{ formatMoney(budget) }}</span><strong>{{ budgetProgress.toFixed(0) }}%</strong></div><div class="acc-budget-bar"><i :class="{ over: expense > budget }" :style="{ width: budgetProgress + '%' }"></i></div></div>
    </div>

    <div class="acc-card"><div class="acc-card-title">分类排行 · 支出</div><div v-if="categoryRanking.length" class="acc-ranking"><div v-for="item in categoryRanking" :key="item.id" class="acc-rank-row"><span class="acc-rank-dot" :style="{ background: item.color }"></span><span class="acc-rank-name">{{ item.name }}</span><div class="acc-rank-track"><i :style="{ width: Math.max(6, item.amount / categoryRanking[0].amount * 100) + '%', background: item.color }"></i></div><strong>¥{{ formatMoney(item.amount) }}</strong></div></div><div v-else class="acc-empty">暂无支出记录</div></div>

    <div class="acc-card">
      <div class="acc-list-head"><strong>收支明细</strong><input v-model="search" type="search" placeholder="搜索记录" /><button type="button" @click="openEditor()">＋ 记一笔</button></div>
      <div v-if="!groupedRecords.length" class="acc-empty">还没有记账记录，点击“记一笔”开始。</div>
      <section v-for="group in groupedRecords" :key="group.date" class="acc-day">
        <header><strong>{{ group.date }}</strong><span :class="{ negative: group.total < 0 }">{{ group.total >= 0 ? '+' : '' }}{{ formatMoney(group.total) }}</span></header>
        <article v-for="record in group.items" :key="record.id" class="acc-record">
          <span class="acc-record-icon" :style="{ background: categoryById(record.category)?.color || '#ccc' }">{{ categoryById(record.category)?.icon || '记' }}</span>
          <span class="acc-record-copy"><strong>{{ record.note || categoryName(record.category) }}</strong><small>{{ categoryName(record.category) }}</small></span>
          <strong class="acc-record-amount" :class="{ income: record.type === 'income' }">{{ record.type === 'income' ? '+' : '-' }}¥{{ formatMoney(record.amount) }}</strong>
          <span class="acc-record-actions"><button type="button" @click="openEditor(record)">编辑</button><button type="button" @click="deleteRecord(record)">删除</button></span>
        </article>
      </section>
    </div>

    <div v-if="editorOpen" class="acc-layer" @click.self="editorOpen = false">
      <section class="acc-modal"><header><strong>{{ editingId ? '编辑记录' : '记一笔' }}</strong><button type="button" @click="editorOpen = false">×</button></header><div class="acc-type-tabs"><button type="button" :class="{ active: draft.type === 'expense' }" @click="changeType('expense')">支出</button><button type="button" :class="{ active: draft.type === 'income' }" @click="changeType('income')">收入</button></div><label><span>金额</span><input v-model="draft.amount" type="number" min="0.01" step="0.01" /></label><label><span>分类</span><select v-model="draft.category"><option v-for="category in availableCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label><span>日期</span><input v-model="draft.date" type="date" /></label><label><span>备注</span><input v-model="draft.note" type="text" maxlength="80" placeholder="写点说明（可选）" /></label><div class="acc-modal-actions"><button type="button" @click="editorOpen = false">取消</button><button type="button" class="primary" @click="saveRecord">保存</button></div></section>
    </div>

    <div v-if="settingsOpen" class="acc-layer" @click.self="settingsOpen = false">
      <section class="acc-modal compact"><header><strong>记账设置</strong><button type="button" @click="settingsOpen = false">×</button></header><label><span>月度预算</span><input v-model="budgetDraft" type="number" min="0" step="0.01" placeholder="0 表示不设置" /></label><button type="button" class="acc-secondary" @click="categoryOpen = true">管理分类</button><div class="acc-modal-actions"><button type="button" @click="settingsOpen = false">取消</button><button type="button" class="primary" @click="saveBudget">保存</button></div></section>
    </div>

    <div v-if="categoryOpen" class="acc-layer" @click.self="categoryOpen = false">
      <section class="acc-modal"><header><strong>记账分类</strong><button type="button" @click="categoryOpen = false">×</button></header><div class="acc-category-create"><input v-model="categoryDraft.name" type="text" maxlength="12" placeholder="新分类名称" /><select v-model="categoryDraft.type"><option value="expense">支出</option><option value="income">收入</option></select><button type="button" @click="addCategory">添加</button></div><div class="acc-category-list"><span v-for="category in categories" :key="category.id" class="acc-category-chip"><i :style="{ background: category.color }"></i>{{ category.name }}<button v-if="!defaultCategories.some((item) => item.id === category.id)" type="button" @click="deleteCategory(category)">×</button></span></div></section>
    </div>
  </section>
</template>

<style scoped>
.accounting-app{max-width:700px;margin:0 auto;display:flex;flex-direction:column;gap:10px;padding-bottom:16px;color:var(--theme-text)}
.acc-overview,.acc-card{padding:13px;border:1px solid var(--theme-border-soft);border-radius:15px;background:var(--theme-surface)}.acc-overview{background:var(--theme-soft)}.acc-period-head{display:flex;align-items:center;gap:9px}.acc-period-head>div{flex:1;text-align:center;display:flex;flex-direction:column;gap:2px}.acc-period-head strong{color:var(--theme-text-strong);font-size:14px}.acc-period-head span{color:var(--theme-muted);font-size:8.5px}.acc-period-head button{width:29px;height:29px;border:0;border-radius:50%;background:var(--theme-surface);color:var(--theme-primary);cursor:pointer}.acc-period-head .acc-cog{margin-left:3px}.acc-mode-tabs{display:flex;justify-content:center;gap:5px;margin:9px 0}.acc-mode-tabs button{padding:5px 11px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-surface);color:var(--theme-muted);font-size:8.5px;cursor:pointer}.acc-mode-tabs button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}.acc-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.acc-numbers div{padding:8px;border-radius:10px;background:var(--theme-surface);display:flex;flex-direction:column;gap:3px}.acc-numbers span{color:var(--theme-muted);font-size:8px}.acc-numbers strong{color:var(--theme-text-strong);font-size:13px}.acc-numbers strong.negative{color:var(--theme-accent-warm)}
.acc-budget{margin-top:8px}.acc-budget>div:first-child{display:flex;justify-content:space-between;color:var(--theme-muted);font-size:8.5px}.acc-budget-bar{height:5px;margin-top:5px;border-radius:99px;background:var(--theme-border-soft);overflow:hidden}.acc-budget-bar i{display:block;height:100%;background:var(--theme-primary)}.acc-budget-bar i.over{background:var(--theme-accent-warm)}
.acc-card-title{color:var(--theme-primary);font-size:11px;font-weight:800;margin-bottom:8px}.acc-ranking{display:flex;flex-direction:column;gap:7px}.acc-rank-row{display:flex;align-items:center;gap:7px}.acc-rank-dot{width:8px;height:8px;border-radius:50%;flex:none}.acc-rank-name{width:48px;color:var(--theme-text);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.acc-rank-track{flex:1;height:5px;border-radius:99px;background:var(--theme-soft);overflow:hidden}.acc-rank-track i{display:block;height:100%;border-radius:inherit}.acc-rank-row strong{width:68px;text-align:right;color:var(--theme-text-strong);font-size:9px}
.acc-list-head{display:flex;align-items:center;gap:7px}.acc-list-head>strong{color:var(--theme-primary);font-size:11px}.acc-list-head input{flex:1;min-width:0;padding:7px 8px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font-size:9.5px}.acc-list-head button,.acc-secondary,.acc-modal-actions button,.acc-category-create button{padding:7px 10px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-primary);font-size:9px;font-weight:800;cursor:pointer}.acc-day{margin-top:10px}.acc-day>header{display:flex;justify-content:space-between;color:var(--theme-muted);font-size:8.5px;padding:6px 2px}.acc-day>header span{color:var(--theme-primary)}.acc-day>header span.negative{color:var(--theme-accent-warm)}.acc-record{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--theme-border-soft)}.acc-record-icon{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;color:var(--theme-inverse);font-size:10px;font-weight:800}.acc-record-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.acc-record-copy strong{overflow:hidden;color:var(--theme-text-strong);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.acc-record-copy small{color:var(--theme-muted);font-size:8px}.acc-record-amount{flex:none;color:var(--theme-accent-warm);font-size:10px}.acc-record-amount.income{color:var(--theme-positive)}.acc-record-actions{display:flex;gap:3px}.acc-record-actions button{padding:3px 5px;border:0;background:transparent;color:var(--theme-muted);font-size:8px;cursor:pointer}.acc-empty{min-height:90px;display:grid;place-items:center;color:var(--theme-muted);font-size:9.5px}
.acc-layer{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:14px;background:rgba(var(--theme-overlay-rgb),.34);backdrop-filter:blur(5px)}.acc-modal{width:min(430px,100%);max-height:84dvh;overflow:auto;padding:14px;border:1px solid var(--theme-border);border-radius:16px;background:var(--theme-surface);display:flex;flex-direction:column;gap:10px}.acc-modal header{display:flex;align-items:center;justify-content:space-between}.acc-modal header strong{color:var(--theme-primary);font-size:13px}.acc-modal header button{border:0;background:transparent;color:var(--theme-muted);font-size:18px}.acc-modal label{display:flex;flex-direction:column;gap:5px;color:var(--theme-text);font-size:9.5px}.acc-modal input,.acc-modal select{padding:8px 9px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.acc-type-tabs{display:flex;gap:5px}.acc-type-tabs button{flex:1;padding:7px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-muted);font-size:10px;cursor:pointer}.acc-type-tabs button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}.acc-modal-actions{display:flex;justify-content:flex-end;gap:7px}.acc-modal-actions .primary{border:0;background:var(--theme-primary);color:var(--theme-inverse)}.acc-category-create{display:flex;gap:5px;flex-wrap:wrap}.acc-category-create input{flex:1;min-width:100px}.acc-category-create select{width:70px}.acc-category-list{display:flex;flex-wrap:wrap;gap:5px}.acc-category-chip{display:flex;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;background:var(--theme-soft);color:var(--theme-text);font-size:8.5px}.acc-category-chip i{width:7px;height:7px;border-radius:50%}.acc-category-chip button{border:0;background:transparent;color:var(--theme-muted);cursor:pointer}
@media(max-width:560px){.accounting-app{padding:0 7px 12px}.acc-rank-name{width:38px}.acc-record-actions{flex-direction:column}.acc-record-actions button{padding:2px 3px}}
</style>