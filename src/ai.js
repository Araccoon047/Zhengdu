import { isNativeApp, requestNativeJson } from './native-bridge'

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

function buildSystemPrompt(config) {
  const extra = String(config?.rolePrompt || '').trim()
  return [
    '你是角色内容解读助手，只能根据提供的人物背景设定，以该角色的口吻解释给定内容在情境中的含义。',
    '不要改写原文，不要续写剧情，不要替用户做选择，不要生成新的聊天消息，也不要讨论概率、抽卡或系统设定。',
    '解读要简洁、自然、贴合角色关系和背景。如果背景信息不足，请明确说明只能做有限解读。',
    extra ? `补充口吻要求：${extra}` : '',
  ].filter(Boolean).join('\n')
}

export async function requestAiInterpretation(config, payload = {}) {
  if (!isAiConfigured(config)) {
    throw new Error('请先在设置 → AI接入中填写并启用 API')
  }
  const endpoint = String(config.endpoint || '').trim()
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error('AI 接口地址必须以 http:// 或 https:// 开头')
  }
  const characterName = String(payload.characterName || 'TA').trim()
  const backstory = String(payload.backstory || '').trim() || '未填写角色背景设定'
  const contentType = String(payload.contentType || '内容').trim()
  const content = String(payload.content || '').trim()
  if (!content) throw new Error('没有可解读的内容')

  const headers = {
    'Content-Type': 'application/json',
  }
  if (config.authMode === 'api-key') headers['api-key'] = config.apiKey
  else headers.Authorization = `Bearer ${config.apiKey}`

  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: buildSystemPrompt(config) },
      {
        role: 'user',
        content: [
          `角色名称：${characterName}`,
          `角色背景设定：${backstory}`,
          `解读类型：${contentType}`,
          `需要解读的原文：${content}`,
          '请只返回一段以角色口吻写出的解读文字。',
        ].join('\n\n'),
      },
    ],
    temperature: Number(config.temperature) || 0.7,
    max_tokens: Number(config.maxTokens) || 500,
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
    const text =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      data?.response ||
      ''
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('AI 接口没有返回可用的解读内容')
    }
    return text.trim()
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('AI 请求超时，请检查网络或接口地址')
    throw error  } finally {
    clearTimeout(timeout)
  }
}