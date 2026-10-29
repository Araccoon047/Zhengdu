import { isAiConfigured, isAiScopeEnabled, requestAiTranslation } from './ai.js'
import { isNativeApp, requestNativeJson } from './native-bridge.js'

const LANGUAGE_NAMES = {
  zh: '中文',
  ja: '日语',
  ko: '韩语',
  ru: '俄语',
  ar: '阿拉伯语',
  th: '泰语',
  en: '英语',
  und: '未知语言',
}

const NETWORK_TARGETS = {
  zh: 'en',
  ja: 'zh-CN',
  ko: 'zh-CN',
  ru: 'zh-CN',
  ar: 'zh-CN',
  th: 'zh-CN',
  en: 'zh-CN',
}

const LOCAL_TARGETS = {
  zh: 'en',
  ja: 'zh',
  ko: 'zh',
  ru: 'zh',
  ar: 'zh',
  th: 'zh',
  en: 'zh',
}

const NETWORK_TIMEOUT_MS = 12000

export function detectLanguage(value) {
  const text = String(value || '')
  if (!text.trim()) return 'und'
  if (/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/u.test(text)) return 'ja'
  if (/[\uac00-\ud7af\u1100-\u11ff]/u.test(text)) return 'ko'
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru'
  if (/[\u0600-\u06ff\u0750-\u077f]/u.test(text)) return 'ar'
  if (/[\u0e00-\u0e7f]/u.test(text)) return 'th'
  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(text)) return 'zh'
  if (/[A-Za-z\u00c0-\u024f]/u.test(text)) return 'en'
  return 'und'
}

export function languageLabel(language) {
  return LANGUAGE_NAMES[language] || LANGUAGE_NAMES.und
}

export function translationTargetFor(language) {
  return LOCAL_TARGETS[language] || 'zh'
}

export function hasTranslatableText(value) {
  const text = String(value || '').replace(
    /\[(图片|表情包|语音|转账|红包|文件|视频|位置|链接)\]/g,
    ''
  )
  return /\p{L}/u.test(text)
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function cleanTranslation(value) {
  return decodeHtmlEntities(value).replace(/\r\n/g, '\n').trim()
}

function withTimeout(promise, timeoutMs, message) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

async function translateLocally(text, sourceLanguage, targetLanguage) {
  if (typeof window === 'undefined' || !window.Translator?.create) {
    throw new Error('当前浏览器没有提供本地翻译')
  }
  const translator = await withTimeout(
    window.Translator.create({ sourceLanguage, targetLanguage }),
    15000,
    '本地翻译初始化超时'
  )
  try {
    const translated = await withTimeout(
      translator.translate(text),
      20000,
      '本地翻译超时'
    )
    const result = cleanTranslation(translated)
    if (!result) throw new Error('本地翻译没有返回结果')
    return result
  } finally {
    try {
      await translator.destroy?.()
    } catch {
      // Some translator implementations do not expose a usable destroy method.
    }
  }
}

async function readNetworkResponse(url) {
  if (isNativeApp()) {
    const nativeResult = await requestNativeJson(url, { Accept: 'application/json' }, '')
    if (nativeResult.status < 200 || nativeResult.status >= 300) {
      throw new Error(`在线翻译请求失败（${nativeResult.status}）`)
    }
    return nativeResult.body
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`在线翻译请求失败（${response.status}）`)
    return body
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('在线翻译请求超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function parseJson(body) {
  try {
    return JSON.parse(body)
  } catch {
    throw new Error('在线翻译返回了无法识别的数据')
  }
}

async function translateWithGoogle(text, sourceLanguage, targetLanguage) {
  const source = sourceLanguage === 'zh' ? 'zh-CN' : sourceLanguage
  const target = targetLanguage === 'zh' ? 'zh-CN' : targetLanguage
  const url = 'https://translate.googleapis.com/translate_a/single'
    + '?client=gtx&dt=t'
    + `&sl=${encodeURIComponent(source)}`
    + `&tl=${encodeURIComponent(target)}`
    + `&q=${encodeURIComponent(text)}`
  const data = parseJson(await readNetworkResponse(url))
  const result = Array.isArray(data?.[0])
    ? data[0].map((part) => (Array.isArray(part) ? part[0] : '')).filter(Boolean).join('')
    : ''
  const cleaned = cleanTranslation(result)
  if (!cleaned) throw new Error('在线翻译没有返回结果')
  return cleaned
}

async function translateWithMyMemory(text, sourceLanguage, targetLanguage) {
  const source = sourceLanguage === 'zh' ? 'zh-CN' : sourceLanguage
  const target = targetLanguage === 'zh' ? 'zh-CN' : targetLanguage
  const url = 'https://api.mymemory.translated.net/get'
    + `?q=${encodeURIComponent(text)}`
    + `&langpair=${encodeURIComponent(`${source}|${target}`)}`
  const data = parseJson(await readNetworkResponse(url))
  const directResult = cleanTranslation(data?.responseData?.translatedText)
  const matchedResult = Array.isArray(data?.matches)
    ? data.matches.map((item) => cleanTranslation(item?.translation)).find(Boolean) || ''
    : ''
  const result = directResult || matchedResult
  if (!result || /PLEASE SELECT TWO DISTINCT LANGUAGES/i.test(result)) {
    throw new Error('备用在线翻译没有返回结果')
  }
  return result
}

function failureMessage(failures) {
  const aiWasAttempted = failures.some((item) => item.provider === 'AI')
  if (aiWasAttempted) {
    return '翻译失败：本地翻译、在线翻译和 AI 备用翻译均未能返回结果，请检查网络或 AI 设置。'
  }
  return '翻译失败：本地翻译和在线翻译暂不可用。请检查网络，或在“设置 → AI接入”中配置 AI 作为备用翻译。'
}

export async function translateText(value, options = {}) {
  const text = String(value || '').trim()
  if (!text) throw new Error('这条消息没有可翻译的文字内容')
  if (!hasTranslatableText(text)) throw new Error('这条消息只有图片、表情或符号，没有可翻译的文字内容')

  const sourceLanguage = detectLanguage(text)
  const targetLanguage = translationTargetFor(sourceLanguage)
  const failures = []

  try {
    const translated = await translateLocally(text, sourceLanguage, targetLanguage)
    return { text: translated, sourceLanguage, targetLanguage, provider: 'local' }
  } catch (error) {
    failures.push({ provider: 'local', error })
  }

  try {
    const translated = await translateWithMyMemory(text, sourceLanguage, targetLanguage)
    return { text: translated, sourceLanguage, targetLanguage, provider: 'mymemory' }
  } catch (error) {
    failures.push({ provider: 'mymemory', error })
  }

  try {
    const translated = await translateWithGoogle(text, sourceLanguage, targetLanguage)
    return { text: translated, sourceLanguage, targetLanguage, provider: 'google' }
  } catch (error) {
    failures.push({ provider: 'google', error })
  }

  const aiConfig = options.aiConfig
  if (isAiConfigured(aiConfig) && isAiScopeEnabled(aiConfig, 'chat')) {
    try {
      const translated = await requestAiTranslation(aiConfig, {
        text,
        sourceLanguage,
        targetLanguage,
      })
      return { text: translated, sourceLanguage, targetLanguage, provider: 'ai' }
    } catch (error) {
      failures.push({ provider: 'AI', error })
    }
  }

  const error = new Error(failureMessage(failures))
  error.attempts = failures
  throw error
}