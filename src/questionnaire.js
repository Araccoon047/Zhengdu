/**
 * 问卷 · 解析与作答
 *
 * 全部在本地完成，不接任何 AI / 后端：
 *   1. 把 OCR 出来的文字（或手打文字）解析成题目
 *   2. 每道题按类型用 Math.random() 随机作答
 *
 * 支持三种题型：
 *   yesno  —— 是 / 否
 *   single —— 单选（A/B/C/D…）
 *   multi  —— 多选（随机 1~n-1 个）
 */

export const QUESTION_TYPES = [
  { id: 'yesno', label: '是 / 否' },
  { id: 'single', label: '单选' },
  { id: 'multi', label: '多选' },
]

export const QUESTION_TYPE_LABEL = Object.fromEntries(
  QUESTION_TYPES.map((item) => [item.id, item.label])
)

const STORAGE_KEY = 'zhengdu_questionnaire_v1'
const MAX_ITEMS = 20

export function makeId(prefix = 'qn') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/* ------------------------------------------------------------------ */
/* 文本 → 题目                                                         */
/* ------------------------------------------------------------------ */

const RE_QUESTION_NO = /^(?:\(?(\d{1,2})\)?\s*[.、)]|([①②③④⑤⑥⑦⑧⑨⑩]))\s*/
const RE_OPTION = /^(?:([A-Ha-h])\s*[.、)]|([①②③④⑤⑥⑦⑧⑨⑩]))\s*/
const OPTION_CIRCLED = { '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4, '⑥': 5, '⑦': 6, '⑧': 7, '⑨': 8, '⑩': 9 }
const CHECK_MARKS = /[□☐☑☒✓✔■◻◼◆◇]\s*$/g
const MULTI_HINTS = /多选|可多选|至少选|最多选|选择所有|选出所有|勾选所有/

function normalizeLine(line) {
  let value = String(line || '')
    .replace(/\u00a0|\u3000/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[．]/g, '.')
    .replace(CHECK_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()

  // OCR 常在汉字之间插空格（「进入 对 方 房间 前」），这里把中文之间的空格吃掉。
  // 只处理「中文 + 空格 + 中文/中文标点」，不会动「A. 幸福」这种字母开头的选项。
  for (let i = 0; i < 4; i += 1) {
    const next = value
      .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
      .replace(/([\u4e00-\u9fff])\s+(?=[,.;:!?()、。，；：！？])/g, '$1')
      .replace(/([,.;:!?()、。，；：！？])\s+(?=[\u4e00-\u9fff])/g, '$1')
    if (next === value) break
    value = next
  }
  // OCR 会把「？」认成 ” 之类的孤立引号，清掉句尾与括号前的残留
  value = value
    .replace(/[”"'’]\s*(?=[(\[])/g, '')
    .replace(/\s*[”"'’]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return value
}

function isNoiseLine(line) {
  if (!line) return true
  if (/^第?\s*\d+\s*页/.test(line)) return true
  if (/^\d+\s*\/\s*\d+$/.test(line)) return true
  if (/^[-—=_·.\s]+$/.test(line)) return true
  if (/^(姓名|性别|年龄|日期|班级|部门)\s*[:：]?/.test(line) && line.length <= 12) return true
  return line.length <= 1
}

const RE_IMAGE = /!\[[^\]]*\]\(([^)]+)\)|(https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s)]*)?)/gi

function extractImages(line) {
  const images = []
  const text = String(line || '').replace(RE_IMAGE, (match, markdownUrl, bareUrl) => {
    const url = String(markdownUrl || bareUrl || '').trim()
    if (url) images.push(url)
    return ' '
  })
  return { text, images }
}

function optionIndex(letter, circled) {
  if (letter) return letter.toUpperCase().charCodeAt(0) - 65
  if (circled && OPTION_CIRCLED[circled] != null) return OPTION_CIRCLED[circled]
  return 0
}

/** 把「题干 A. 选项 B. 选项」这种挤在一行的写法拆开 */
function splitInlineOptions(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    // OCR 经常丢失选项间的换行：苹果B.香蕉 / 苹果C香蕉
    .replace(/([\u4e00-\u9fff。！？!?：:；;）)])([A-H])\s*[.、)]\s*/g, '$1\n$2. ')
    .replace(/([\u4e00-\u9fff。！？!?：:；;）)])([A-H])(?=[\u4e00-\u9fff])/g, '$1\n$2. ')
    // 带点号的选项：A. / A、 / A)
    .replace(/([^\n])\s+([A-H])\s*[.、)]\s*/g, '$1\n$2. ')
    // OCR 有时会漏掉点号：「…（多选） A 一起看电影」
    .replace(/([^\n])\s+([A-H])\s+(?=[\u4e00-\u9fff])/g, '$1\n$2. ')
    .replace(/([^\n])\s+([①②③④⑤⑥⑦⑧⑨⑩])\s*/g, '$1\n$2 ')
}

/**
 * 解析问卷文本。
 * @returns {{ id: string, title: string, type: 'yesno'|'single'|'multi', options: { key: string, text: string }[] }[]}
 */
export function parseQuestionnaire(text) {
  const raw = splitInlineOptions(text)
  const lines = raw
    .split('\n')
    .map((line) => {
      const extracted = extractImages(line)
      return { line: normalizeLine(extracted.text), images: extracted.images }
    })
    .filter((entry) => entry.images.length || !isNoiseLine(entry.line))
  const questions = []
  let current = null
  let pendingImages = []

  // 首行是「问卷标题」这类没有题号、没有问号的短句，且第二行就是题号 → 丢掉标题
  if (
    lines.length > 1 &&
    !RE_QUESTION_NO.test(lines[0].line) &&
    !/[?？]$/.test(lines[0].line) &&
    lines[0].line.length <= 24 &&
    RE_QUESTION_NO.test(lines[1].line)
  ) {
    lines.shift()
  }

  function flush() {
    if (!current) return
    const title = current.title.replace(/\s+/g, ' ').trim()
    if (!title) {
      current = null
      return
    }
    let { type, options } = current
    if (options.length >= 2) {
      type = MULTI_HINTS.test(title) ? 'multi' : 'single'
    } else {
      // 只有一个「选项」的多半是 OCR 把题干后半句切开了，拼回去
      if (options.length === 1) {
        current.title = `${title} ${options[0].text}`.trim()
      }
      options = []
      type = 'yesno'
    }
    questions.push({
      id: makeId('q'),
      title: current.title,
      type,
      images: [...new Set(current.images || [])],
      options: options.map((option, index) => ({
        key: option.key || String.fromCharCode(65 + index),
        text: option.text,
      })),
    })
    current = null
  }

  lines.forEach((entry) => {
    const line = entry.line
    if (!line) {
      if (current) current.images.push(...entry.images)
      else pendingImages.push(...entry.images)
      return
    }
    const optionMatch = line.match(RE_OPTION)
    const questionMatch = line.match(RE_QUESTION_NO)

    // 选项行：要有当前题，且不是「题号 + 长句」的误判
    if (optionMatch && current && !(questionMatch && line.replace(RE_OPTION, '').length > 18)) {
      const index = optionIndex(optionMatch[1], optionMatch[2])
      const text = line.replace(RE_OPTION, '').trim()
      if (text) current.options[index] = { key: String.fromCharCode(65 + index), text }
      if (entry.images.length) current.images.push(...entry.images)
      return
    }

    const isQuestion = Boolean(questionMatch) || /[?？]$/.test(line) || /^【.+】$/.test(line)

    if (isQuestion) {
      flush()
      const title = line.replace(RE_QUESTION_NO, '').replace(/^【|】$/g, '').trim()
      current = { title, options: [], type: 'single', images: [...pendingImages, ...entry.images] }
      pendingImages = []
      return
    }

    if (current) {
      current.title = `${current.title} ${line}`.trim()
      current.images.push(...entry.images)
    } else {
      current = { title: line, options: [], type: 'single', images: [...pendingImages, ...entry.images] }
      pendingImages = []
    }
  })
  flush()

  return questions
    .map((question) => ({
      ...question,
      options: question.options.filter((option) => option && option.text),
    }))
    .filter((question) => question.title && question.title.length >= 2)
}

/* ------------------------------------------------------------------ */
/* 随机作答                                                            */
/* ------------------------------------------------------------------ */

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * 单题作答。多选会随机选 1 ~ n-1 个（至少留一个不选，看起来更像真人）。
 * @returns {{ questionId, type, picks: { key, text }[], display: string }}
 */
export function answerQuestion(question) {
  if (!question) return { questionId: '', type: 'yesno', picks: [], display: '—' }

  if (question.type === 'yesno') {
    const text = Math.random() < 0.5 ? '是' : '否'
    return { questionId: question.id, type: 'yesno', picks: [{ key: '', text }], display: text }
  }

  const options = (question.options || []).filter((option) => option && option.text)
  if (!options.length) {
    return { questionId: question.id, type: question.type, picks: [], display: '—' }
  }

  if (question.type === 'multi') {
    const maxPick = options.length > 2 ? options.length - 1 : options.length
    const count = 1 + Math.floor(Math.random() * maxPick)
    const shuffled = [...options].sort(() => Math.random() - 0.5)
    const picks = shuffled.slice(0, count).sort((a, b) => String(a.key).localeCompare(String(b.key)))
    return {
      questionId: question.id,
      type: 'multi',
      picks,
      display: picks.map((option) => `${option.key}. ${option.text}`).join('、'),
    }
  }

  const pick = pickOne(options)
  return {
    questionId: question.id,
    type: 'single',
    picks: [pick],
    display: `${pick.key}. ${pick.text}`,
  }
}

/** 整份问卷作答 */
export function answerQuestionnaire(questions) {
  return (questions || []).map((question, index) => ({
    index: index + 1,
    question,
    answer: answerQuestion(question),
  }))
}

/** 拼成可直接复制的纯文本，例如「1. 是」「2. A. 幸福」 */
export function formatAnswerSheet(rows, options = {}) {
  const withTitle = options.withTitle !== false
  return (rows || [])
    .map((row) => {
      const head = `${row.index}. ${row.answer.display}`
      return withTitle ? `${row.index}. ${row.question.title}\n${head}` : head
    })
    .join('\n\n')
}

/** 只要答案的紧凑版：1. 是 / 2. A. 幸福 */
export function formatAnswersOnly(rows) {
  return (rows || []).map((row) => `${row.index}. ${row.answer.display}`).join('\n')
}

/* ------------------------------------------------------------------ */
/* 本地存储                                                            */
/* ------------------------------------------------------------------ */

export function loadQuestionnaires() {
  if (typeof localStorage === 'undefined') return []
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveQuestionnaire(item) {
  if (typeof localStorage === 'undefined') return []
  const list = loadQuestionnaires().filter((entry) => entry.id !== item.id)
  const next = [item, ...list].slice(0, MAX_ITEMS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 存储满时忽略 */
  }
  return next
}

export function removeQuestionnaire(id) {
  if (typeof localStorage === 'undefined') return []
  const next = loadQuestionnaires().filter((entry) => entry.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 忽略 */
  }
  return next
}
