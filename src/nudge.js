import { settings } from './settings'
import systemCardsData from './data/system-cards.json'
import { systemCardGroupRows } from './system-card-pool'

export const DEFAULT_NUDGE_SYMBOLS = ['✦', '✧', '♡', '❋', '❤']

export const DEFAULT_NUDGE_TEXTS = [
  '揉了揉你的头',
  '摸了摸你的头',
  '拍了拍你的头',
  '拍了拍你的肩膀',
  '蹭了蹭你',
  '亲了一下你的脸',
]

export function allNudgeSymbols() {
  return [
    ...new Set([
      ...DEFAULT_NUDGE_SYMBOLS,
      ...(Array.isArray(settings.customNudgeSymbols) ? settings.customNudgeSymbols : []),
    ]),
  ].filter(Boolean)
}

export function allNudgeTexts() {
  const touchCategory = (systemCardsData.categories || []).find((category) => category.key === 'touch')
  const defaultNudgeIndex = touchCategory?.groups?.findIndex((group) => group.name === '默认拍一拍') ?? -1
  const systemTexts = defaultNudgeIndex >= 0
    ? systemCardGroupRows(touchCategory, defaultNudgeIndex).map((row) => row.text)
    : []
  return [
    ...new Set([
      ...systemTexts,
      ...(Array.isArray(settings.customNudgeTexts) ? settings.customNudgeTexts : []),
    ]),
  ].filter(Boolean)
}

export function outgoingNudgeText(text, symbol, targetName) {
  const phrase = String(text || '').trim() || DEFAULT_NUDGE_TEXTS[0]
  const mark = String(symbol || '').trim() || DEFAULT_NUDGE_SYMBOLS[0]
  const target = String(targetName || '').trim() || '你'
  return `${mark}我${phrase.split('你').join(target)}${mark}`
}

export function incomingNudgeText(contactName, text, symbol) {
  const phrase = String(text || '').trim() || DEFAULT_NUDGE_TEXTS[0]
  const mark = String(symbol || '').trim() || DEFAULT_NUDGE_SYMBOLS[0]
  const name = String(contactName || '').trim() || 'TA'
  return `${mark}${name}${phrase}${mark}`
}

export function randomIncomingNudge(contactName) {
  const texts = allNudgeTexts()
  const symbols = allNudgeSymbols()
  if (!texts.length) return `${String(contactName || 'TA').trim() || 'TA'}拍了拍你`
  return incomingNudgeText(
    contactName,
    texts[Math.floor(Math.random() * texts.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  )
}