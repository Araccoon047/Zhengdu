<script setup>
import { computed, onMounted, ref } from 'vue'
import divination from '../data/divination-data.json'
import { chatState, contactDisplayName, primaryContact, sendOutgoing } from '../chat'
import { settings } from '../settings'

const HISTORY_KEY = 'zhengdu_divination_history_v1'
const FACES_KEY = 'zhengdu_divination_faces_v1'
const mode = ref('tarot')
const count = ref(3)
const question = ref('')
const autoSend = ref(false)
const drawing = ref(false)
const result = ref(null)
const targetId = ref('')
const history = ref([])
const faces = ref({})
const galleryOpen = ref(false)
const faceMode = ref('tarot')

const decks = { tarot: divination.TAROT, lenormand: divination.LENO }
const iconMaps = { tarot: divination.TAROT_ICONS, lenormand: divination.LENO_ICONS }
const labels = divination.MODE_LABELS
const counts = [1, 3, 7]
const contacts = computed(() => chatState.contacts || [])
const currentDeck = computed(() => decks[mode.value] || [])
const galleryDeck = computed(() => decks[faceMode.value] || [])
const modeName = computed(() => mode.value === 'tarot' ? '塔罗' : '雷诺曼')

function parse(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function loadData() {
  history.value = parse(HISTORY_KEY)
  try { faces.value = JSON.parse(localStorage.getItem(FACES_KEY) || '{}') } catch { faces.value = {} }
}
function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(0, 100)))
}
function saveFaces() {
  localStorage.setItem(FACES_KEY, JSON.stringify(faces.value))
}
function shuffle(items) {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}
function faceKey(cardMode, name) { return `${cardMode}|${name}` }
function iconOf(card) {
  return iconMaps[mode.value]?.[card.icon] || ''
}
function faceOf(card, cardMode = mode.value) {
  return faces.value[faceKey(cardMode, card.name)] || ''
}
function cardMeaning(card) { return card.rev ? card.neg : card.pos }
function makeSummary(cards) {
  if (cards.length === 1) return cards[0].detail
  const joined = cards.map((card) => `${card.name}${card.rev ? '（逆）' : ''}：${cardMeaning(card)}`).join('；')
  return `${joined}。综合来看，顺着最让你安心的方向行动。`
}
function drawCards() {
  if (drawing.value) return
  drawing.value = true
  result.value = null
  setTimeout(() => {
    const picked = shuffle(currentDeck.value).slice(0, count.value).map((card) => {
      const rev = Math.random() < 0.5
      return { ...card, rev, meaning: rev ? card.neg : card.pos }
    })
    const record = {
      id: Date.now(),
      mode: mode.value,
      count: count.value,
      question: question.value.trim(),
      targetId: targetId.value,
      summary: makeSummary(picked),
      cards: picked,
      createdAt: Date.now(),
    }
    result.value = record
    history.value = [record, ...history.value].slice(0, 100)
    saveHistory()
    drawing.value = false
    if (autoSend.value) sendResult(record)
  }, 760)
}
function resultText(record) {
  const parts = record.cards.map((card, index) => {
    const label = labels[record.mode]?.[record.cards.length]?.[index] || `第${index + 1}张`
    return `${label}：${card.name}${card.rev ? '（逆）' : ''}｜${card.meaning}`
  })
  return [`占卜 · ${record.mode === 'tarot' ? '塔罗' : '雷诺曼'} ${record.cards.length} 张`, record.question ? `问题：${record.question}` : '', ...parts, `综合：${record.summary}`].filter(Boolean).join('\n')
}
function sendResult(record) {
  const contact = targetId.value ? contacts.value.find((item) => item.id === targetId.value) : primaryContact()
  if (!contact) return
  sendOutgoing({ type: 'text', text: resultText(record) }, { targetKind: 'contact', targetId: contact.id, scheduleReply: true })
}
async function copyResult(record) {
  try { await navigator.clipboard.writeText(resultText(record)) } catch {}
}
function viewHistory(record) { result.value = record }
function deleteHistory(id) {
  history.value = history.value.filter((item) => item.id !== id)
  saveHistory()
  if (result.value?.id === id) result.value = null
}
function uploadFace(event, card, cardMode) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    faces.value[faceKey(cardMode, card.name)] = String(reader.result || '')
    saveFaces()
  }
  reader.readAsDataURL(file)
}
function clearFace(card, cardMode) {
  const key = faceKey(cardMode, card.name)
  const next = { ...faces.value }
  delete next[key]
  faces.value = next
  saveFaces()
}
function timeText(ts) {
  const d = new Date(Number(ts) || Date.now())
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
onMounted(loadData)
</script>

<template>
  <section class="divine">
    <div class="setup-card">
      <div class="mode-row">
        <button :class="{ active: mode === 'tarot' }" @click="mode = 'tarot'; result = null">塔罗</button>
        <button :class="{ active: mode === 'lenormand' }" @click="mode = 'lenormand'; result = null">雷诺曼</button>
      </div>
      <div class="mode-row count-row">
        <button v-for="value in counts" :key="value" :class="{ active: count === value }" @click="count = value">
          {{ value }} 张
        </button>
      </div>
      <div class="target-row">
        <button :class="{ active: targetId === '' }" @click="targetId = ''">不选对象</button>
        <button v-for="contact in contacts" :key="contact.id" :class="{ active: targetId === contact.id }" @click="targetId = contact.id">
          {{ contactDisplayName(contact) }}
        </button>
      </div>
      <input v-model="question" class="question" type="text" placeholder="写下你的问题（可选）" />
      <label class="switch-row"><span>抽完自动发到聊天</span><input v-model="autoSend" type="checkbox" /></label>
      <button class="draw-btn" type="button" :disabled="drawing" @click="drawCards">
        {{ drawing ? '正在洗牌…' : result ? '重新抽牌' : '抽牌' }}
      </button>
    </div>

    <div v-if="drawing" class="drawing-stage">
      <span v-for="index in 12" :key="index" class="shuffle-card" :style="{ '--i': index }"></span>
      <strong>正在洗牌</strong>
    </div>

    <div v-else-if="result" class="result-wrap">
      <div class="spread" :class="'count-' + result.cards.length">
        <article v-for="(card, index) in result.cards" :key="card.name + index" class="drawn-card">
          <span class="position">{{ labels[result.mode]?.[result.cards.length]?.[index] || `第${index + 1}张` }}</span>
          <div class="card-face">
            <img v-if="faceOf(card, result.mode)" :src="faceOf(card, result.mode)" alt="" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" v-html="iconMaps[result.mode]?.[card.icon] || ''"></svg>
            <strong>{{ card.name }}{{ card.rev ? '（逆）' : '' }}</strong>
          </div>
          <p>{{ card.meaning }}</p>
        </article>
      </div>
      <div class="summary">{{ result.summary }}</div>
      <div v-if="result.question" class="question-line">问：{{ result.question }}</div>
      <div class="result-actions">
        <button type="button" @click="sendResult(result)">发给 {{ targetId ? contactDisplayName(contacts.find((c) => c.id === targetId)) : 'TA' }}</button>
        <button type="button" @click="copyResult(result)">复制文字</button>
      </div>
    </div>

    <div v-else class="empty">点击上方按钮开始抽牌</div>

    <button class="gallery-toggle" type="button" @click="galleryOpen = !galleryOpen">{{ galleryOpen ? '收起牌面图鉴' : '牌面图鉴与自定义' }}</button>
    <div v-if="galleryOpen" class="gallery-panel">
      <div class="mode-row">
        <button :class="{ active: faceMode === 'tarot' }" @click="faceMode = 'tarot'">塔罗 78</button>
        <button :class="{ active: faceMode === 'lenormand' }" @click="faceMode = 'lenormand'">雷诺曼 40</button>
      </div>
      <div class="gallery-grid">
        <article v-for="card in galleryDeck" :key="card.name" class="gallery-item">
          <span class="gallery-thumb">
            <img v-if="faceOf(card, faceMode)" :src="faceOf(card, faceMode)" alt="" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" v-html="iconMaps[faceMode]?.[card.icon] || ''"></svg>
          </span>
          <strong>{{ card.name }}</strong>
          <label class="upload">上传<input type="file" accept="image/*" @change="uploadFace($event, card, faceMode)" /></label>
          <button v-if="faceOf(card, faceMode)" type="button" @click="clearFace(card, faceMode)">恢复</button>
        </article>
      </div>
    </div>

    <div class="history-card">
      <div class="history-head"><strong>占卜记录</strong><button v-if="history.length" type="button" @click="history = []; saveHistory()">清空</button></div>
      <div v-if="!history.length" class="empty small">还没有占卜记录</div>
      <article v-for="item in history" :key="item.id" class="history-row">
        <button class="history-main" type="button" @click="viewHistory(item)">
          <strong>{{ item.mode === 'tarot' ? '塔罗' : '雷诺曼' }} · {{ item.cards.length }} 张</strong>
          <span>{{ timeText(item.createdAt) }}</span>
          <small>{{ item.question || item.cards.map((card) => card.name).join('、') }}</small>
        </button>
        <button class="delete" type="button" @click="deleteHistory(item.id)">删除</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.divine{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px;padding-bottom:12px}
.setup-card,.history-card,.gallery-panel{padding:14px;border-radius:18px;background:var(--theme-surface);border:1px solid var(--theme-border-soft)}
.mode-row,.target-row,.result-actions{display:flex;gap:7px;flex-wrap:wrap}
.mode-row button,.target-row button,.result-actions button,.gallery-toggle,.history-head button,.gallery-item button{border:0;border-radius:10px;padding:8px 12px;background:var(--theme-soft);color:var(--theme-text);font-weight:700;cursor:pointer}
.mode-row button.active,.target-row button.active{background:var(--theme-primary);color:#fff}
.count-row{margin-top:8px}.target-row{margin-top:8px}
.question{width:100%;margin-top:10px;padding:11px 12px;border:1px solid var(--theme-border-soft);border-radius:12px;background:#fff;color:var(--theme-text-strong)}
.switch-row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:var(--theme-text);font-size:12px}
.draw-btn{width:100%;margin-top:12px;padding:13px;border:0;border-radius:14px;background:var(--theme-primary);color:#fff;font-size:15px;font-weight:800;cursor:pointer}
.drawing-stage{min-height:280px;display:grid;place-items:center;position:relative;overflow:hidden;border-radius:18px;background:var(--theme-surface)}
.drawing-stage strong{position:absolute;bottom:18px;color:var(--theme-text)}
.shuffle-card{position:absolute;width:52px;height:80px;border-radius:9px;background:var(--theme-primary);border:2px solid #ffffff;transform:rotate(calc((var(--i) - 6) * 8deg)) translateY(calc((var(--i) - 6) * 2px));animation:shuffle .8s ease-in-out infinite alternate;animation-delay:calc(var(--i) * -40ms)}
@keyframes shuffle{to{transform:translate(calc((var(--i) - 6) * 7px),-12px) rotate(calc((var(--i) - 6) * -7deg)) scale(.92)}}
.spread{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.spread.count-1{grid-template-columns:minmax(180px,260px);justify-content:center}
.spread.count-7{grid-template-columns:repeat(4,minmax(0,1fr))}
.drawn-card{display:flex;flex-direction:column;align-items:center;gap:6px}
.position{font-size:10px;padding:3px 8px;border-radius:999px;background:var(--theme-soft);color:var(--theme-muted)}
.card-face{width:100%;aspect-ratio:1;border-radius:14px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--theme-soft);color:var(--theme-primary);text-align:center;overflow:hidden}
.card-face img{width:100%;height:100%;object-fit:cover;border-radius:10px}
.card-face svg{width:32px;height:32px}.card-face strong{font-size:12px;color:var(--theme-text-strong)}
.drawn-card p{margin:0;font-size:10.5px;line-height:1.55;text-align:center;color:var(--theme-text)}
.summary{margin-top:12px;padding:12px;border-radius:12px;background:var(--theme-surface);color:var(--theme-text);font-size:12px;line-height:1.7}
.question-line{margin-top:8px;text-align:center;color:var(--theme-muted);font-size:11px}
.empty{min-height:150px;display:grid;place-items:center;color:var(--theme-muted);font-size:12px}.empty.small{min-height:80px}
.gallery-toggle{background:transparent;color:var(--theme-primary)}
.gallery-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;max-height:460px;overflow:auto;margin-top:10px}
.gallery-item{display:flex;flex-direction:column;align-items:center;gap:5px;padding:7px;border-radius:11px;background:var(--theme-surface)}
.gallery-thumb{width:100%;aspect-ratio:1;display:grid;place-items:center;border-radius:9px;background:var(--theme-soft);color:var(--theme-primary)}.gallery-thumb img{width:100%;height:100%;object-fit:cover;border-radius:9px}.gallery-thumb svg{width:24px;height:24px}
.gallery-item strong{font-size:10px;text-align:center}.gallery-item label,.gallery-item button{font-size:9px;padding:4px 7px}.gallery-item input{display:none}
.history-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.history-row{display:flex;align-items:center;gap:8px;border-top:1px solid var(--theme-border-soft);padding:8px 0}
.history-main{flex:1;border:0;background:transparent;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;color:var(--theme-text);cursor:pointer}.history-main span,.history-main small{font-size:10px;color:var(--theme-muted)}
.delete{background:var(--theme-danger-surface)!important;color:var(--theme-accent-warm)!important}
@media(max-width:560px){.spread,.spread.count-7{grid-template-columns:repeat(3,minmax(0,1fr))}.gallery-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>