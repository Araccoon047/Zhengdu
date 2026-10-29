import systemCardsData from './data/system-cards.json'
import { settings } from './settings'
import { isSystemCardGroupDeleted } from './system-card-pool'

const DEFAULT_CATEGORY_KEYS = ['dict', 'dict_ext']
let cacheKey = ''
let cacheEntries = []

export function dictionaryEntriesFor(categoryKeys = DEFAULT_CATEGORY_KEYS) {
  const keys = [...new Set((Array.isArray(categoryKeys) ? categoryKeys : [categoryKeys]).filter(Boolean))]
  const locked = new Set(settings.systemLockedCardGroups || [])
  const hidden = new Set(settings.systemHiddenCardIds || [])
  const edits = settings.systemCardEdits || {}
  const deleted = new Set(settings.systemDeletedCardGroups || [])
  const custom = (settings.systemCustomCards || []).filter((card) => keys.includes(card?.categoryKey) && !hidden.has(card.id))
  const nextCacheKey = [keys.join('|'), [...locked].join('|'), [...deleted].join('|'), [...hidden].join('|'), JSON.stringify(edits), JSON.stringify(custom)].join('::')
  if (nextCacheKey === cacheKey) return cacheEntries
  const categories = (systemCardsData.categories || []).filter((category) => keys.includes(category.key))
  const rows = categories.flatMap((category) => {
    const categoryLabel = category.key === 'dict_ext' ? '词典扩展词库' : '词典'
    return (category.groups || []).flatMap((group, groupIndex) => {
      if (locked.has(`${category.key}:${groupIndex}`) || isSystemCardGroupDeleted(category, groupIndex)) return []
      return (group.cards || []).flatMap((sourceText, cardIndex) => {
        const id = `${category.key}:${groupIndex}:${cardIndex}`
        if (hidden.has(id)) return []
        const text = String(edits[id] || sourceText || '').trim()
        if (!text) return []
        return [{
          id,
          text,
          categoryKey: category.key,
          categoryLabel,
          groupKey: String(groupIndex),
          groupName: group.name || '未分组',
          custom: false,
        }]
      })
    })
  })
  const customRows = custom
    .filter((card) => !locked.has(`${card.categoryKey}:${card.groupIndex}`) && !isSystemCardGroupDeleted(card.categoryKey, card.groupIndex))
    .map((card) => {
      const category = categories.find((item) => item.key === card.categoryKey)
      return {
        id: card.id,
        text: String(card.text || '').trim(),
        categoryKey: card.categoryKey,
        categoryLabel: card.categoryKey === 'dict_ext' ? '词典扩展词库' : '词典',
        groupKey: `custom-${card.groupIndex}`,
        groupName: `自定义 · ${category?.groups?.[card.groupIndex]?.name || '未分组'}`,
        custom: true,
      }
    })
    .filter((card) => card.text)
  cacheKey = nextCacheKey
  cacheEntries = [...customRows, ...rows]
  return cacheEntries
}

export function dictionaryCardsFor(categoryKeys = DEFAULT_CATEGORY_KEYS) {
  return dictionaryEntriesFor(categoryKeys).map((entry) => entry.text)
}