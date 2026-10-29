import { isNativeApp, requestNativeJson } from './native-bridge.js'

export const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'zhipu',
    name: '智谱',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
  },
  {
    id: 'custom',
    name: '自定义智能体（OpenAI 兼容）',
    endpoint: '',
    model: '',
  },
]

const LANGUAGE_PROMPT_NAMES = {
  zh: '简体中文',
  ja: '日语',
  ko: '韩语',
  ru: '俄语',
  ar: '阿拉伯语',
  th: '泰语',
  en: '英语',
}

export function createDefaultAiSettings() {
  return {
    enabled: false,
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
    apiKey: '',
    authMode: 'bearer',
    temperature: 0.7,
    maxTokens: 500,
    useChatInterpret: true,
    useMailInterpret: true,
    useMomentsInterpret: true,
    rolePrompt: '',
  }
}

export function normalizeAiSettings(source = {}) {
  const defaults = createDefaultAiSettings()
  const value = source && typeof source === 'object' ? source : {}
  const provider = AI_PROVIDERS.some((item) => item.id === value.provider)
    ? value.provider
    : defaults.provider
  return {
    enabled: Boolean(value.enabled),
    provider,
    endpoint: String(value.endpoint ?? defaults.endpoint).trim(),
    model: String(value.model ?? defaults.model).trim(),
    apiKey: String(value.apiKey ?? '').trim(),
    authMode: value.authMode === 'api-key' ? 'api-key' : 'bearer',
    temperature: Math.min(2, Math.max(0, Number(value.temperature) || defaults.temperature)),
    maxTokens: Math.min(4000, Math.max(50, Math.round(Number(value.maxTokens) || defaults.maxTokens))),
    useChatInterpret: value.useChatInterpret !== false,
    useMailInterpret: value.useMailInterpret !== false,
    useMomentsInterpret: value.useMomentsInterpret !== false,
    rolePrompt: String(value.rolePrompt ?? '').trim().slice(0, 1000),
  }
}

export function isAiConfigured(config) {
  return Boolean(config?.enabled && config?.endpoint && config?.model && config?.apiKey)
}

export function isAiScopeEnabled(config, scope) {
  if (!isAiConfigured(config)) return false
  if (scope === 'chat') return config.useChatInterpret !== false
  if (scope === 'mail') return config.useMailInterpret !== false
  if (scope === 'moments') return config.useMomentsInterpret !== false
  return false
}

function buildInterpretationPrompt(config) {
  const extra = String(config?.rolePrompt || '').trim()
  return [
    '你是角色内容解读助手，只能根据提供的人物背景设定，以该角色的口吻解释给定内容在情境中的含义。',
    '不要改写原文，不要续写剧情，不要替用户做选择，不要生成新的聊天消息，也不要讨论概率、抽卡或系统设定。',
    '解读要简洁、自然、贴合角色关系和背景。如果背景信息不足，请明确说明只能做有限解读。',
    extra ? `补充口吻要求：${extra}` : '',
  ].filter(Boolean).join('\n')
}

function buildTranslationPrompt(sourceLanguage, targetLanguage) {
  const sourceName = LANGUAGE_PROMPT_NAMES[sourceLanguage] || sourceLanguage
  const targetName = LANGUAGE_PROMPT_NAMES[targetLanguage] || targetLanguage
  return [
    `你是专业翻译。请把用户给出的${sourceName}文本准确翻译成${targetName}。`,
    '只输出译文，不要解释、不要总结、不要扩写，也不要添加原文没有的信息。',
    '保留原文的语气、人名、专有名词、标点、换行和分段。',
  ].join('\n')
}

function extractCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim()
  }
  const fallback = data?.output_text || data?.response || ''
  return typeof fallback === 'string' ? fallback.trim() : ''
}

async function requestAiCompletion(config, payload = {}) {
  if (!isAiConfigured(config)) {
    throw new Error('请先在设置 → AI接入中填写并启用 API')
  }
  const endpoint = String(config.endpoint || '').trim()
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error('AI 接口地址必须以 http:// 或 https:// 开头')
  }

  const headers = {
    'Content-Type': 'application/json',
  }
  if (config.authMode === 'api-key') headers['api-key'] = config.apiKey
  else headers.Authorization = `Bearer ${config.apiKey}`

  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: payload.systemPrompt },
      { role: 'user', content: payload.userPrompt },
    ],
    temperature: Number(payload.temperature ?? config.temperature) || 0.7,
    max_tokens: Number(payload.maxTokens ?? config.maxTokens) || 500,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    let raw = ''
    let responseOk = false
    let responseStatus = 0
    let responseStatusText = ''

    if (isNativeApp()) {
      const nativeResult = await requestNativeJson(endpoint, headers, JSON.stringify(requestBody))
      raw = nativeResult.body
      responseStatus = nativeResult.status
      responseOk = responseStatus >= 200 && responseStatus < 300
      responseStatusText = responseOk ? 'OK' : '请求失败'
    } else {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      })
      raw = await response.text()
      responseOk = response.ok
      responseStatus = response.status
      responseStatusText = response.statusText
    }

    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    if (!responseOk) {
      const message = data?.error?.message || data?.message || raw.slice(0, 220) || responseStatusText
      throw new Error(`AI 接口请求失败（${responseStatus}）：${message}`)
    }
    const text = extractCompletionText(data)
    if (!text) throw new Error('AI 接口没有返回可用内容')
    return text
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('AI 请求超时，请检查网络或接口地址')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestAiInterpretation(config, payload = {}) {
  const characterName = String(payload.characterName || 'TA').trim()
  const backstory = String(payload.backstory || '').trim() || '未填写角色背景设定'
  const contentType = String(payload.contentType || '内容').trim()
  const content = String(payload.content || '').trim()
  if (!content) throw new Error('没有可解读的内容')

  return requestAiCompletion(config, {
    systemPrompt: buildInterpretationPrompt(config),
    userPrompt: [
      `角色名称：${characterName}`,
      `角色背景设定：${backstory}`,
      `解读类型：${contentType}`,
      `需要解读的原文：${content}`,
      '请只返回一段以角色口吻写出的解读文字。',
    ].join('\n\n'),
    temperature: Number(config?.temperature) || 0.7,
    maxTokens: Number(config?.maxTokens) || 500,
  })
}

export async function requestAiTranslation(config, payload = {}) {
  if (!isAiConfigured(config)) {
    throw new Error('请先在设置 → AI接入中填写并启用 API')
  }
  const text = String(payload.text || '').trim()
  if (!text) throw new Error('没有可翻译的文字')
  const sourceLanguage = String(payload.sourceLanguage || 'en')
  const targetLanguage = String(payload.targetLanguage || 'zh')

  return requestAiCompletion(config, {
    systemPrompt: buildTranslationPrompt(sourceLanguage, targetLanguage),
    userPrompt: text,
    temperature: 0,
    maxTokens: Math.max(300, Number(config.maxTokens) || 500),
  })
}