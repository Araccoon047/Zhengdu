import { settings } from './settings'

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
  return [
    ...new Set([
      ...DEFAULT_NUDGE_TEXTS,
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
  return incomingNudgeText(
    contactName,
    texts[Math.floor(Math.random() * texts.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  )
}