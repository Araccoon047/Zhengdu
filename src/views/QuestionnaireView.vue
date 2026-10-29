<script setup>
import { computed, onUnmounted, ref } from 'vue'
import {
  QUESTION_TYPES,
  answerQuestionnaire,
  formatAnswersOnly,
  makeId,
  parseQuestionnaire,
  loadQuestionnaires,
  removeQuestionnaire,
  saveQuestionnaire,
} from '../questionnaire'
import { contactDisplayName, primaryContact, sendIncomingText } from '../chat'

const stage = ref('list')
const items = ref(loadQuestionnaires())
const draftText = ref('')
const questions = ref([])
const rows = ref([])
const activeId = ref('')
const source = ref('manual')
const notice = ref('')
const copied = ref(false)
const timingMode = ref('perQuestion')
const perQuestionSeconds = ref(10)
const totalTimeValue = ref(2)
const totalTimeUnit = ref('minute')
const thinking = ref(false)
const thinkingRemaining = ref(0)
const thinkingTotal = ref(0)
const thinkingIndex = ref(1)
let thinkingTimer = null

const contactName = computed(() => contactDisplayName(primaryContact()) || 'TA')
const answeredAt = computed(() => {
  const item = items.value.find((entry) => entry.id === activeId.value)
  return item?.createdAt ? formatTime(item.createdAt) : ''
})

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now())
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function startCompose() {
  stage.value = 'compose'
  source.value = 'manual'
  activeId.value = ''
  draftText.value = ''
  questions.value = []
  notice.value = ''
}

function backToList() {
  clearInterval(thinkingTimer)
  thinkingTimer = null
  thinking.value = false
  stage.value = 'list'
  notice.value = ''
  copied.value = false
}

function parseDraft() {
  const list = parseQuestionnaire(draftText.value)
  if (!list.length) {
    notice.value = '没有解析出题目，确认每题以「1.」「1、」开头，或句尾带问号'
    return
  }
  questions.value = list
  notice.value = `解析出 ${list.length} 道题，可以逐题调整题型与选项`
  stage.value = 'preview'
}

function addQuestion() {
  questions.value.push({
    id: makeId('q'),
    title: '',
    type: 'yesno',
    options: [],
  })
}

function removeQuestion(index) {
  questions.value.splice(index, 1)
}

function onTypeChange(question) {
  if (question.type === 'yesno') {
    question.options = []
    return
  }
  if (!question.options.length) {
    question.options = [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
    ]
  }
}

function addOption(question) {
  const key = String.fromCharCode(65 + question.options.length)
  question.options.push({ key, text: '' })
}

function removeOption(question, index) {
  question.options.splice(index, 1)
  question.options.forEach((option, position) => {
    option.key = String.fromCharCode(65 + position)
  })
}

function currentTimingSettings() {
  return {
    mode: timingMode.value === 'total' ? 'total' : 'perQuestion',
    perQuestionSeconds: Math.max(1, Math.round(Number(perQuestionSeconds.value) || 10)),
    totalValue: Math.max(1, Math.round(Number(totalTimeValue.value) || 1)),
    totalUnit: totalTimeUnit.value === 'second' ? 'second' : 'minute',
  }
}
function prepareUsableQuestions() {
  const usable = questions.value.filter((question) => question.title.trim())
  if (!usable.length) {
    notice.value = '至少需要一道有题干的题目'
    return []
  }
  usable.forEach((question) => {
    question.options = (question.options || []).filter((option) => option.text.trim())
    if (question.type !== 'yesno' && question.options.length < 2) {
      question.type = 'yesno'
      question.options = []
    }
  })
  return usable
}
function finishAnswer(usable, timing) {
  rows.value = answerQuestionnaire(usable)
  const item = {
    id: activeId.value || makeId('qn'),
    title: usable[0].title.slice(0, 24) || '问卷',
    source: source.value,
    questions: usable,
    rows: rows.value,
    timing,
    createdAt: Date.now(),
  }
  activeId.value = item.id
  items.value = saveQuestionnaire(item)
  stage.value = 'result'
  notice.value = ''
  copied.value = false
  thinking.value = false
}
function startThinking(usable, timing) {
  clearInterval(thinkingTimer)
  const questionCount = usable.length
  const totalSeconds = timing.mode === 'total'
    ? timing.totalValue * (timing.totalUnit === 'minute' ? 60 : 1)
    : questionCount * timing.perQuestionSeconds
  thinkingTotal.value = Math.max(1, totalSeconds)
  thinkingRemaining.value = thinkingTotal.value
  thinkingIndex.value = 1
  thinking.value = true
  stage.value = 'thinking'
  const startedAt = Date.now()
  thinkingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    thinkingRemaining.value = Math.max(0, thinkingTotal.value - elapsed)
    if (timing.mode === 'total') {
      thinkingIndex.value = Math.min(questionCount, Math.max(1, Math.floor(elapsed / thinkingTotal.value * questionCount) + 1))
    } else {
      thinkingIndex.value = Math.min(questionCount, Math.max(1, Math.floor(elapsed / timing.perQuestionSeconds) + 1))
    }
    if (thinkingRemaining.value <= 0) {
      clearInterval(thinkingTimer)
      thinkingTimer = null
      finishAnswer(usable, timing)
    }
  }, 250)
}
function runAnswer() {
  const usable = prepareUsableQuestions()
  if (!usable.length) return
  questions.value = usable
  startThinking(usable, currentTimingSettings())
}
function cancelThinking() {
  clearInterval(thinkingTimer)
  thinkingTimer = null
  thinking.value = false
  stage.value = 'preview'
  notice.value = '已取消本次作答'
}



function reAnswer() {
  if (!questions.value.length) return
  const item = items.value.find((entry) => entry.id === activeId.value)
  const timing = item?.timing || currentTimingSettings()
  timingMode.value = timing.mode === 'total' ? 'total' : 'perQuestion'
  perQuestionSeconds.value = timing.perQuestionSeconds || 10
  totalTimeValue.value = timing.totalValue || 2
  totalTimeUnit.value = timing.totalUnit || 'minute'
  startThinking(questions.value, timing)
}



async function copyAnswers() {
  const text = formatAnswersOnly(rows.value)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    notice.value = '答案已复制'
  } catch {
    notice.value = '复制失败，可以长按选择文字手动复制'
  }
}

function sendToChat() {
  if (!rows.value.length) return
  const text = `问卷答案：\n${formatAnswersOnly(rows.value)}`
  if (sendIncomingText(text)) {
    notice.value = `已让 ${contactName.value} 发到聊天里`
  } else {
    notice.value = '发送失败，请先打开聊天'
  }
}

function openItem(item) {
  activeId.value = item.id
  questions.value = item.questions || []
  rows.value = item.rows?.length ? item.rows : answerQuestionnaire(questions.value)
  source.value = item.source || 'manual'
  stage.value = 'result'
  notice.value = ''
  const timing = item.timing || {}
  timingMode.value = timing.mode === 'total' ? 'total' : 'perQuestion'
  perQuestionSeconds.value = timing.perQuestionSeconds || 10
  totalTimeValue.value = timing.totalValue || 2
  totalTimeUnit.value = timing.totalUnit || 'minute'
}

function deleteItem(item, event) {
  event?.stopPropagation?.()
  items.value = removeQuestionnaire(item.id)
  if (activeId.value === item.id) backToList()
}

function editAgain() {
  stage.value = 'preview'
  notice.value = '修改后点「让 TA 作答」会重新出结果'
}
onUnmounted(() => clearInterval(thinkingTimer))
</script>

<template>
  <section class="qn-app">
    <!-- 历史列表 -->
    <template v-if="stage === 'list'">
      <div class="qn-hero">
        <div class="qn-hero-head">
          <span class="qn-kicker">QUESTIONNAIRE</span>
          <h2>问卷</h2>
        </div>
        <p>
          把题目按行输入，是/否、单选、多选都由 {{ contactName }} 随机作答。
          全部在本机完成，不联网、不接 AI。
        </p>
        <div class="qn-hero-actions">
          <button class="qn-btn primary" type="button" @click="startCompose()">开始录入题目</button>
        </div>
      </div>

      <div v-if="notice" class="qn-notice">{{ notice }}</div>

      <div v-if="items.length" class="qn-history">
        <div class="qn-section-title">答过的问卷</div>
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="qn-history-row"
          @click="openItem(item)"
        >
          <span class="qn-history-main">
            <strong>{{ item.title }}</strong>
            <small>{{ item.questions?.length || 0 }} 题 · {{ formatTime(item.createdAt) }}</small>
          </span>
          <span class="qn-history-del" role="button" aria-label="删除" @click="deleteItem(item, $event)">×</span>
        </button>
      </div>
      <div v-else class="qn-empty">
        <strong>还没有问卷</strong>
        <span>输入几道题试试，比如「1. 通常在十二点前入睡」。</span>
      </div>
    </template>

    <!-- 录入 -->
    <template v-else-if="stage === 'compose'">
      <header class="qn-page-head">
        <button type="button" class="qn-back" @click="backToList">←</button>
        <div>
          <strong>录入题目</strong>
          <small>每行一题，选项写在题目下面</small>
        </div>
      </header>

      <div class="qn-card">
        <label class="qn-field">
          <span>题目内容</span>
          <textarea
            v-model="draftText"
            rows="10"
            spellcheck="false"
            placeholder="1. 进入对方房间前是否会敲门&#10;2. 通常在十二点前入睡&#10;&#10;或者带选项：&#10;3. 你认为这段关系怎么样&#10;A. 幸福&#10;B. 平淡&#10;C. 痛苦"
          ></textarea>
        </label>

        <p class="qn-tip">
          支持「1. / 1、/ (1) / ①」题号，「A. / A、/ ①」选项。
          没有选项的题会当作是/否题；题干里写「多选」会自动变成多选。
        </p>

        <div class="qn-actions">
          <button class="qn-btn" type="button" @click="backToList">取消</button>
          <button class="qn-btn primary" type="button" :disabled="!draftText.trim()" @click="parseDraft">
            解析成题目
          </button>
        </div>
      </div>

      <div v-if="notice" class="qn-notice">{{ notice }}</div>
    </template>

    <!-- 题目确认 -->
    <template v-else-if="stage === 'preview'">
      <header class="qn-page-head">
        <button type="button" class="qn-back" @click="backToList">←</button>
        <div>
          <strong>确认题目</strong>
          <small>共 {{ questions.length }} 题，可改题型与选项</small>
        </div>
      </header>

      <div class="qn-qlist">
        <article v-for="(question, index) in questions" :key="question.id" class="qn-qcard">
          <header class="qn-qhead">
            <span class="qn-no">{{ index + 1 }}</span>
            <select v-model="question.type" class="qn-type" @change="onTypeChange(question)">
              <option v-for="type in QUESTION_TYPES" :key="type.id" :value="type.id">{{ type.label }}</option>
            </select>
            <button class="qn-del" type="button" aria-label="删除这道题" @click="removeQuestion(index)">×</button>
          </header>

          <input v-model="question.title" class="qn-title-input" type="text" placeholder="题干" maxlength="200" />

          <div v-if="question.images?.length" class="qn-image-grid">
            <figure v-for="(image, imageIndex) in question.images" :key="image + imageIndex">
              <img :src="image" alt="题目图片" />
              <button type="button" aria-label="删除题目图片" @click="question.images.splice(imageIndex, 1)">×</button>
            </figure>
          </div>

          <div v-if="question.type !== 'yesno'" class="qn-options">
            <div v-for="(option, optionIndex) in question.options" :key="option.key" class="qn-option-row">
              <span class="qn-opt-key">{{ option.key }}</span>
              <input v-model="option.text" type="text" placeholder="选项内容" maxlength="80" />
              <button type="button" aria-label="删除选项" @click="removeOption(question, optionIndex)">×</button>
            </div>
            <button class="qn-add-option" type="button" :disabled="question.options.length >= 8" @click="addOption(question)">
              ＋ 选项
            </button>
          </div>
          <p v-else class="qn-yesno-hint">将会随机回答「是」或「否」</p>
        </article>

        <button class="qn-add-question" type="button" @click="addQuestion">＋ 添加一道题</button>
      </div>

      <div v-if="notice" class="qn-notice">{{ notice }}</div>

      <section class="qn-timing-card">
        <div class="qn-timing-head"><strong>问答时间</strong><span>可逐题计时，也可设定整份问卷总时间</span></div>
        <div class="qn-timing-modes">
          <button type="button" :class="{ active: timingMode === 'perQuestion' }" @click="timingMode = 'perQuestion'">按问题计时</button>
          <button type="button" :class="{ active: timingMode === 'total' }" @click="timingMode = 'total'">按总时间计时</button>
        </div>
        <label v-if="timingMode === 'perQuestion'" class="qn-time-row"><span>每个问题思考时间</span><div><input v-model.number="perQuestionSeconds" type="number" min="1" max="3600" /><b>秒</b></div></label>
        <div v-else class="qn-time-row"><span>整份问卷总时间</span><div><input v-model.number="totalTimeValue" type="number" min="1" max="86400" /><select v-model="totalTimeUnit"><option value="second">秒</option><option value="minute">分钟</option></select></div></div>
      </section>
      <div class="qn-sticky">
        <button class="qn-btn" type="button" @click="backToList">取消</button>
        <button class="qn-btn primary" type="button" @click="runAnswer">让 {{ contactName }} 作答</button>
      </div>
    </template>

    <!-- 结果 -->
    <!-- 思考计时 -->
    <template v-else-if="stage === 'thinking'">
      <header class="qn-page-head">
        <button type="button" class="qn-back" @click="cancelThinking">←</button>
        <div><strong>正在作答</strong><small>第 {{ thinkingIndex }} / {{ questions.length }} 题</small></div>
      </header>
      <section class="qn-thinking">
        <span class="qn-thinking-orb"><i></i><i></i><i></i></span>
        <strong>{{ contactName }} 正在思考第 {{ thinkingIndex }} 题</strong>
        <b>{{ thinkingRemaining }} 秒</b>
        <div class="qn-thinking-progress"><i :style="{ width: ((thinkingTotal - thinkingRemaining) / thinkingTotal * 100) + '%' }"></i></div>
        <button type="button" class="qn-btn" @click="cancelThinking">取消作答</button>
      </section>
    </template>

    <template v-else>
      <header class="qn-page-head">
        <button type="button" class="qn-back" @click="backToList">←</button>
        <div>
          <strong>问卷结果</strong>
          <small>{{ contactName }} 作答 · {{ rows.length }} 题 {{ answeredAt ? `· ${answeredAt}` : '' }}</small>
        </div>
      </header>

      <div class="qn-result">
        <article v-for="row in rows" :key="row.question.id" class="qn-answer-card">
          <div class="qn-answer-head">
            <span class="qn-no">{{ row.index }}</span>
            <p>{{ row.question.title }}</p>
          </div>
          <div class="qn-answer-line" :class="{ multi: row.answer.type === 'multi' }">
            {{ row.answer.display }}
          </div>
        </article>
      </div>

      <div v-if="notice" class="qn-notice">{{ notice }}</div>

      <div class="qn-result-actions">
        <button class="qn-btn" type="button" @click="reAnswer">换一组答案</button>
        <button class="qn-btn" type="button" @click="editAgain">改题目</button>
        <button class="qn-btn" type="button" @click="copyAnswers">{{ copied ? '已复制' : '复制答案' }}</button>
        <button class="qn-btn" type="button" @click="sendToChat">发到聊天</button>
      </div>
      <button class="qn-link" type="button" @click="startCompose()">再来一份新问卷</button>
    </template>
  </section>
</template>

<style scoped>
.qn-app {
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 4px 12px 40px;
}
.qn-hero {
  padding: 16px 15px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: var(--theme-surface);
  box-shadow: 0 6px 20px rgba(var(--theme-overlay-rgb), 0.06);
}
.qn-hero-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.qn-kicker {
  color: var(--theme-muted);
  font-size: 7.5px;
  letter-spacing: 2.2px;
}
.qn-hero h2 {
  margin: 0;
  color: var(--theme-text);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 1px;
}
.qn-hero p {
  margin: 9px 0 0;
  color: var(--theme-muted);
  font-size: 10px;
  line-height: 1.75;
}
.qn-hero-actions {
  display: flex;
  gap: 7px;
  margin-top: 13px;
}
.qn-btn {
  padding: 8px 13px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}
.qn-btn.primary {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: var(--theme-inverse);
}
.qn-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.qn-hero-actions .qn-btn {
  flex: 1;
}
.qn-notice {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-muted);
  font-size: 9px;
  line-height: 1.6;
}
.qn-section-title {
  margin: 2px 0 6px;
  color: var(--theme-muted);
  font-size: 8.5px;
  letter-spacing: 1px;
}
.qn-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qn-history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 11px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 12px;
  background: var(--theme-surface);
  text-align: left;
  cursor: pointer;
}
.qn-history-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.qn-history-main strong {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qn-history-main small {
  color: var(--theme-muted);
  font-size: 8.5px;
}
.qn-history-del {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--theme-muted);
  font-size: 14px;
}
.qn-history-del:hover {
  background: var(--theme-soft);
  color: #c26a5e;
}
.qn-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 22px 14px;
  border: 1px dashed var(--theme-border-soft);
  border-radius: 14px;
  text-align: center;
}
.qn-empty strong {
  color: var(--theme-text);
  font-size: 11px;
}
.qn-empty span {
  color: var(--theme-muted);
  font-size: 9px;
  line-height: 1.6;
}
.qn-page-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.qn-back {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 9px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font-size: 13px;
  cursor: pointer;
}
.qn-page-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.qn-page-head strong {
  color: var(--theme-text);
  font-size: 12.5px;
  font-weight: 800;
}
.qn-page-head small {
  color: var(--theme-muted);
  font-size: 8.5px;
}
.qn-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--theme-border);
  border-radius: 16px;
  background: var(--theme-surface);
}
.qn-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.qn-field > span {
  color: var(--theme-muted);
  font-size: 8.5px;
}
.qn-field textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 10.5px;
  line-height: 1.75;
  resize: vertical;
}
.qn-field textarea:focus {
  outline: none;
  border-color: var(--theme-primary);
}
.qn-tip {
  margin: 0;
  color: var(--theme-muted);
  font-size: 8.5px;
  line-height: 1.7;
}
.qn-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}
.qn-qlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qn-qcard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-surface);
}
.qn-qhead {
  display: flex;
  align-items: center;
  gap: 7px;
}
.qn-no {
  flex: none;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 8.5px;
  font-weight: 800;
}
.qn-type {
  margin-left: auto;
  padding: 3px 6px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 7px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 8.5px;
}
.qn-del {
  flex: none;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--theme-muted);
  font-size: 13px;
  cursor: pointer;
}
.qn-del:hover {
  color: #c26a5e;
}
.qn-title-input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 9px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 10px;
}
.qn-title-input:focus {
  outline: none;
  border-color: var(--theme-primary);
}
.qn-image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 7px 0; }
.qn-image-grid figure { position: relative; margin: 0; aspect-ratio: 1; overflow: hidden; border-radius: 9px; background: var(--theme-soft); }
.qn-image-grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
.qn-image-grid button { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; display: grid; place-items: center; font-size: 12px; }.qn-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-left: 25px;
}
.qn-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qn-opt-key {
  flex: none;
  width: 15px;
  color: var(--theme-muted);
  font-size: 8.5px;
  font-weight: 700;
}
.qn-option-row input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 8px;
  background: var(--theme-soft);
  color: var(--theme-text);
  font: inherit;
  font-size: 9.5px;
}
.qn-option-row input:focus {
  outline: none;
  border-color: var(--theme-primary);
}
.qn-option-row button {
  flex: none;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--theme-muted);
  cursor: pointer;
}
.qn-add-option {
  align-self: flex-start;
  padding: 3px 8px;
  border: 1px dashed var(--theme-border-soft);
  border-radius: 7px;
  background: transparent;
  color: var(--theme-muted);
  font: inherit;
  font-size: 8px;
  cursor: pointer;
}
.qn-yesno-hint {
  margin: 0 0 0 25px;
  color: var(--theme-muted);
  font-size: 8.5px;
}
.qn-add-question {
  padding: 9px;
  border: 1px dashed var(--theme-border-soft);
  border-radius: 11px;
  background: transparent;
  color: var(--theme-primary);
  font: inherit;
  font-size: 9.5px;
  cursor: pointer;
}
.qn-sticky {
  position: sticky;
  bottom: 12px;
  display: flex;
  gap: 7px;
  padding: 8px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-surface);
  box-shadow: 0 -6px 18px rgba(var(--theme-overlay-rgb), 0.1);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.qn-sticky .qn-btn {
  flex: 1;
}
.qn-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qn-answer-card {
  padding: 11px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-surface);
}
.qn-answer-head {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}
.qn-answer-head p {
  margin: 0;
  color: var(--theme-text);
  font-size: 10.5px;
  line-height: 1.65;
}
.qn-answer-line {
  margin: 8px 0 0 25px;
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.qn-answer-line.multi {
  font-size: 12px;
  letter-spacing: 0.2px;
}
.qn-result-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.qn-link {
  align-self: center;
  padding: 4px 8px;
  border: 0;
  background: none;
  color: var(--theme-muted);
  font: inherit;
  font-size: 9px;
  text-decoration: underline;
  cursor: pointer;
}
@media (max-width: 560px) {
  .qn-app {
    padding: 4px 8px 34px;
  }
  .qn-sticky {
    bottom: 10px;
  }
  .qn-result-actions {
    grid-template-columns: 1fr 1fr;
  }
}
.qn-timing-card{padding:12px;border:1px solid var(--theme-border-soft);border-radius:14px;background:var(--theme-surface);display:flex;flex-direction:column;gap:9px}.qn-timing-head{display:flex;flex-direction:column;gap:2px}.qn-timing-head strong{color:var(--theme-text-strong);font-size:11px}.qn-timing-head span{color:var(--theme-muted);font-size:8.5px}.qn-timing-modes{display:grid;grid-template-columns:1fr 1fr;gap:5px}.qn-timing-modes button{padding:7px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font-size:9px;font-weight:700}.qn-timing-modes button.active{background:var(--theme-primary);color:var(--theme-inverse);border-color:var(--theme-primary)}.qn-time-row{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--theme-text);font-size:9.5px}.qn-time-row>div{display:flex;align-items:center;gap:5px}.qn-time-row input,.qn-time-row select{width:78px;padding:7px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.qn-time-row b{color:var(--theme-muted);font-size:9px}.qn-thinking{min-height:340px;padding:24px 16px;border:1px solid var(--theme-border-soft);border-radius:18px;background:var(--theme-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center}.qn-thinking-orb{position:relative;width:74px;height:74px;display:grid;place-items:center}.qn-thinking-orb i{position:absolute;inset:0;border:1px solid var(--theme-primary);border-radius:50%;animation:qn-think 1.8s ease-out infinite;opacity:0}.qn-thinking-orb i:nth-child(2){animation-delay:.6s}.qn-thinking-orb i:nth-child(3){animation-delay:1.2s}@keyframes qn-think{0%{transform:scale(.35);opacity:.75}100%{transform:scale(1.2);opacity:0}}.qn-thinking strong{color:var(--theme-text-strong);font-size:14px}.qn-thinking>b{color:var(--theme-primary);font-size:28px}.qn-thinking-progress{width:min(240px,80%);height:5px;border-radius:99px;background:var(--theme-soft);overflow:hidden}.qn-thinking-progress i{display:block;height:100%;border-radius:inherit;background:var(--theme-primary);transition:width .25s linear}
</style>
