import systemCardsData from './data/system-cards.json'
import { settings } from './settings'
import { SYSTEM_GIFT_GROUPS } from './gift-data'

const EXTRA_CATEGORIES = [
  { key: 'gift', label: '礼物', groups: SYSTEM_GIFT_GROUPS },
]

function categoryForKey(categoryOrKey) {
  if (categoryOrKey && typeof categoryOrKey === 'object') return categoryOrKey
  return [...(systemCardsData.categories || []), ...EXTRA_CATEGORIES]
    .find((category) => category.key === categoryOrKey) || null
}

export function systemCardGroupKey(categoryKey, groupIndex) {
  return `${categoryKey}:${groupIndex}`
}

export function isSystemCardGroupLocked(categoryKey, groupIndex) {
  return (settings.systemLockedCardGroups || []).includes(systemCardGroupKey(categoryKey, groupIndex))
}

export function isSystemCardGroupDeleted(categoryOrKey, groupIndex) {
  const category = categoryForKey(categoryOrKey)
  const categoryKey = category?.key || String(categoryOrKey || '')
  const key = systemCardGroupKey(categoryKey, groupIndex)
  if ((settings.systemDeletedCardGroups || []).includes(key)) return true
  const group = category?.groups?.[groupIndex]
  if (!group) return false
  const hidden = new Set(settings.systemHiddenCardIds || [])
  const defaultIds = (group.cards || []).map((_, cardIndex) => `${categoryKey}:${groupIndex}:${cardIndex}`)
  const customIds = (settings.systemCustomCards || [])
    .filter((card) => card.categoryKey === categoryKey && Number(card.groupIndex) === groupIndex)
    .map((card) => card.id)
  const ids = [...defaultIds, ...customIds]
  return ids.length > 0 && ids.every((id) => hidden.has(id))
}

export function systemCardGroupRows(categoryOrKey, groupIndex, options = {}) {
  const category = categoryForKey(categoryOrKey)
  const group = category?.groups?.[groupIndex]
  if (!category || !group) return []
  if (isSystemCardGroupDeleted(category, groupIndex)) return []
  if (options.respectLocked !== false && isSystemCardGroupLocked(category.key, groupIndex)) return []
  const hidden = new Set(settings.systemHiddenCardIds || [])
  const edits = settings.systemCardEdits || {}
  const rows = (group.cards || []).flatMap((sourceText, cardIndex) => {
    const id = `${category.key}:${groupIndex}:${cardIndex}`
    if (hidden.has(id)) return []
    const text = String(edits[id] || sourceText || '').trim()
    return text ? [{
      id,
      text,
      groupKey: String(groupIndex),
      groupName: group.name || `分组 ${groupIndex + 1}`,
      categoryKey: category.key,
      categoryLabel: category.label || category.key,
      custom: false,
    }] : []
  })
  const customRows = (settings.systemCustomCards || [])
    .filter((card) => card.categoryKey === category.key && Number(card.groupIndex) === groupIndex && !hidden.has(card.id))
    .map((card) => ({
      id: card.id,
      text: String(card.text || '').trim(),
      groupKey: String(groupIndex),
      groupName: `自定义 · ${group.name || `分组 ${groupIndex + 1}`}`,
      categoryKey: category.key,
      categoryLabel: category.label || category.key,
      custom: true,
    }))
    .filter((card) => card.text)
  return [...customRows, ...rows]
}

export function systemCategoryRows(categoryOrKey, options = {}) {
  const category = categoryForKey(categoryOrKey)
  if (!category) return []
  return (category.groups || []).flatMap((_, groupIndex) => systemCardGroupRows(category, groupIndex, options))
}

export function systemCategoryTexts(categoryKey, options = {}) {
  return [...new Set(systemCategoryRows(categoryKey, options).map((row) => row.text).filter(Boolean))]
}

export function systemCategoryHasVisibleGroups(categoryOrKey) {
  const category = categoryForKey(categoryOrKey)
  if (!category) return false
  return (category.groups || []).some((_, groupIndex) => !isSystemCardGroupDeleted(category, groupIndex))
}