<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { contactById, contactDisplayName, updateContact } from '../chat'
import { settings } from '../settings'
import { store, go } from '../store'
import systemCardsData from '../data/system-cards.json'
import { SYSTEM_GIFT_GROUPS } from '../gift-data'
import {
  isSystemCardGroupDeleted,
  isSystemCardGroupLocked,
  systemCategoryHasVisibleGroups,
  systemCategoryRows,
  systemCardGroupRows,
} from '../system-card-pool'

const SYSTEM_PAGE_SIZE = 120
const contact = computed(() => contactById(store.cardLibraryContactId))
const groups = ref([])
const cards = ref([])
const selectedGroup = ref('all')
const search = ref('')
const newCardsText = ref('')
const newGroupName = ref('')
const status = ref('')
const importInput = ref(null)
const deleteGroupCandidate = ref(null)
const groupMenuId = ref('')
const editingGroupId = ref('')
const editingGroupName = ref('')
const draggingGroupId = ref('')
const suppressGroupClick = ref(false)
const libraryTab = ref('custom')
const composerOpen = ref(false)
const newGroupOpen = ref(false)

const giftSystemCategory = {
  key: 'gift',
  label: '礼物',
  usage: '礼物名称与礼物备注',
  cardCount: SYSTEM_GIFT_GROUPS.reduce((sum, group) => sum + (group.cards?.length || 0), 0),
  groups: SYSTEM_GIFT_GROUPS.map((group) => ({ name: group.name, cards: [...group.cards] })),
}
const allSystemCategories = [...(systemCardsData.categories || []), giftSystemCategory]
const visibleSystemCategories = computed(() => allSystemCategories.filter(systemCategoryHasVisibleGroups))
const systemCategoryOptions = computed(() => visibleSystemCategories.value.map((category) => ({
  ...category,
  visibleCount: systemCategoryRows(category, { respectLocked: false }).length,
})))
const systemCategoryKey = ref(allSystemCategories[0]?.key || '')
const systemGroupKey = ref('all')
const systemSearch = ref('')
const systemVisibleLimit = ref(SYSTEM_PAGE_SIZE)
const SYSTEM_LOCK_PAGE_SIZE = 8
const systemLockDialogOpen = ref(false)
const systemLockPage = ref(0)
const systemLockDraftKeys = ref([])
const systemComposerOpen = ref(false)
const systemCustomText = ref('')
const editingSystemCardId = ref('')
const editingSystemCardText = ref('')

let longPressTimer = null
let longPressStartY = 0
let longPressStartX = 0
let longPressPointerId = null
const fixedGroupTabs = [{ id: 'all', name: '全部' }, { id: 'ungrouped', name: '未分组' }]
const groupTabs = computed(() => [...fixedGroupTabs, ...groups.value])

const filteredCards = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (query) return cards.value.filter((card) => card.text.toLowerCase().includes(query))
  if (selectedGroup.value === 'all') return cards.value
  if (selectedGroup.value === 'ungrouped') return cards.value.filter((card) => !card.groupId)
  return cards.value.filter((card) => card.groupId === selectedGroup.value)
})

const customSections = computed(() => {
  const knownGroups = new Set(groups.value.map((group) => group.id))
  const buckets = new Map()
  filteredCards.value.forEach((card) => {
    const key = knownGroups.has(card.groupId) ? card.groupId : ''
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(card)
  })
  const sections = []
  groups.value.forEach((group) => {
    const items = buckets.get(group.id) || []
    if (items.length) sections.push({ key: group.id, name: group.name, cards: items })
  })
  const ungrouped = buckets.get('') || []
  if (ungrouped.length) sections.push({ key: 'ungrouped', name: '未分组', cards: ungrouped })
  return sections
})

const systemCategory = computed(
  () => visibleSystemCategories.value.find((category) => category.key === systemCategoryKey.value) || visibleSystemCategories.value[0] || null
)
function flattenSystemCategory(category) {
  return systemCategoryRows(category, { respectLocked: false })
}
const currentSystemCategoryRows = computed(() => flattenSystemCategory(systemCategory.value))
const allSystemRows = computed(() => visibleSystemCategories.value.flatMap(flattenSystemCategory))
const systemGroupOptions = computed(() => {
  const category = systemCategory.value
  if (!category) return [{ key: 'all', name: '全部分组', count: 0 }]
  return [
    {
      key: 'all',
      name: '全部分组',
      count: category.groups.reduce(
        (sum, _, index) => sum + systemCardGroupRows(category, index, { respectLocked: false }).length,
        0
      ),
    },
    ...category.groups.flatMap((group, index) => isSystemCardGroupDeleted(category, index)
      ? []
      : [{ key: String(index), name: group.name, count: systemCardGroupRows(category, index, { respectLocked: false }).length }]),
  ]
})
const systemFilteredRows = computed(() => {
  const query = systemSearch.value.trim().toLowerCase()
  if (query) return allSystemRows.value.filter((row) => row.text.toLowerCase().includes(query))
  if (systemGroupKey.value === 'all') return currentSystemCategoryRows.value
  return currentSystemCategoryRows.value.filter((row) => row.groupKey === systemGroupKey.value)
})
const systemDisplayRows = computed(() => systemFilteredRows.value.slice(0, systemVisibleLimit.value))
const systemSections = computed(() => {
  const query = systemSearch.value.trim()
  const buckets = new Map()
  systemDisplayRows.value.forEach((row) => {
    const key = `${row.categoryKey}-${row.groupKey}`
    if (!buckets.has(key)) {
      buckets.set(key, { key, name: query ? `${row.categoryLabel} · ${row.groupName}` : row.groupName, cards: [] })
    }
    buckets.get(key).cards.push(row)
  })
  return [...buckets.values()]
})
const activeGroupLabel = computed(() => {
  if (selectedGroup.value === 'all') return '全部字卡'
  if (selectedGroup.value === 'ungrouped') return '未分组'
  return groupName(selectedGroup.value)
})
const activeSystemGroupLabel = computed(
  () => systemGroupOptions.value.find((group) => group.key === systemGroupKey.value)?.name || '全部分组'
)

const editingGroup = computed(() => groups.value.find((group) => group.id === editingGroupId.value) || null)
const menuGroup = computed(() => groups.value.find((group) => group.id === groupMenuId.value) || null)
const selectedCustomGroup = computed(
  () => groups.value.find((group) => group.id === selectedGroup.value) || null
)
const selectedSystemGroup = computed(() => {
  const index = Number(systemGroupKey.value)
  if (!Number.isInteger(index) || index < 0) return null
  return systemCategory.value?.groups?.[index] || null
})
const selectedSystemGroupIndex = computed(() => Number(systemGroupKey.value))
const canLockSystemGroup = computed(() => Boolean(systemCategory.value?.groups?.length))
const systemCategoryLocked = computed(() => {
  const category = systemCategory.value
  if (!category) return false
  const indexes = category.groups
    .map((_, index) => index)
    .filter((index) => !isSystemCardGroupDeleted(category, index))
  return indexes.length > 0 && indexes.every((index) => isSystemGroupLocked(index))
})
const systemLockGroups = computed(() => {
  const category = systemCategory.value
  if (!category) return []
  return category.groups.flatMap((group, index) => isSystemCardGroupDeleted(category, index)
    ? []
    : [{
        key: `${category.key}:${index}`,
        name: group.name || `分组 ${index + 1}`,
        count: systemCardGroupRows(category, index, { respectLocked: false }).length,
      }])
})
const systemLockPageCount = computed(() => Math.max(1, Math.ceil(systemLockGroups.value.length / SYSTEM_LOCK_PAGE_SIZE)))
const systemLockPageGroups = computed(() => {
  const start = systemLockPage.value * SYSTEM_LOCK_PAGE_SIZE
  return systemLockGroups.value.slice(start, start + SYSTEM_LOCK_PAGE_SIZE)
})
const systemLockSelectedCount = computed(() => systemLockDraftKeys.value.length)
const effectiveSystemCardCount = computed(() => allSystemCategories.reduce(
  (sum, category) => sum + systemCategoryRows(category, { respectLocked: false }).length,
  0
))
const hasDeletedSystemCards = computed(
  () => Boolean((settings.systemHiddenCardIds || []).length || (settings.systemDeletedCardGroups || []).length)
)
const selectedSystemGroupIndexes = computed(() => systemLockDraftKeys.value
  .map((key) => Number(String(key).split(':').pop()))
  .filter((index) => Number.isInteger(index) && index >= 0))

function systemGroupLockKey(index) {
  const categoryKey = systemCategory.value?.key
  if (!categoryKey || !Number.isInteger(index) || index < 0) return ''
  return `${categoryKey}:${index}`
}
function isSystemGroupLocked(index) {
  const category = systemCategory.value
  return Boolean(category) && isSystemCardGroupLocked(category.key, index)
}
function toggleSystemGroupLock(index) {
  const key = systemGroupLockKey(index)
  if (!key) return
  const list = Array.isArray(settings.systemLockedCardGroups)
    ? [...settings.systemLockedCardGroups]
    : []
  const at = list.indexOf(key)
  if (at >= 0) {
    list.splice(at, 1)
    status.value = '已解锁该预设分组，字卡重新参与抽卡'
  } else {
    list.push(key)
    status.value = '已锁定该预设分组，TA 抽卡时不会用到这里'
  }
  settings.systemLockedCardGroups = list
}
function openSystemLockDialog() {
  const category = systemCategory.value
  if (!category) return
  const prefix = `${category.key}:`
  systemLockDraftKeys.value = (settings.systemLockedCardGroups || []).filter((key) => key.startsWith(prefix))
  systemLockPage.value = 0
  systemLockDialogOpen.value = true
}
function closeSystemLockDialog() {
  systemLockDialogOpen.value = false
  systemLockDraftKeys.value = []
  systemLockPage.value = 0
}
function toggleSystemLockDraft(key) {
  systemLockDraftKeys.value = systemLockDraftKeys.value.includes(key)
    ? systemLockDraftKeys.value.filter((item) => item !== key)
    : [...systemLockDraftKeys.value, key]
}
function toggleSystemLockPage() {
  const pageKeys = systemLockPageGroups.value.map((group) => group.key)
  const allSelected = pageKeys.every((key) => systemLockDraftKeys.value.includes(key))
  const next = new Set(systemLockDraftKeys.value)
  pageKeys.forEach((key) => allSelected ? next.delete(key) : next.add(key))
  systemLockDraftKeys.value = [...next]
}
function selectAllSystemLockGroups() {
  const allKeys = systemLockGroups.value.map((group) => group.key)
  const allSelected = allKeys.every((key) => systemLockDraftKeys.value.includes(key))
  systemLockDraftKeys.value = allSelected ? [] : allKeys
}
function clearSystemLockSelection() {
  systemLockDraftKeys.value = []
}
function applySystemLockSelection() {
  const category = systemCategory.value
  if (!category) return
  const prefix = `${category.key}:`
  const current = (settings.systemLockedCardGroups || []).filter((key) => !key.startsWith(prefix))
  settings.systemLockedCardGroups = [...new Set([...current, ...systemLockDraftKeys.value])]
  const count = systemLockSelectedCount.value
  status.value = count
    ? `已禁用「${category.label}」中的 ${count} 个分组，TA 将不再抽取这些字卡`
    : `已启用「${category.label}」中的全部分组`
  closeSystemLockDialog()
}
function deleteSystemLockSelection() {
  const category = systemCategory.value
  if (!category) return
  const indexes = selectedSystemGroupIndexes.value
  if (!indexes.length) {
    status.value = '请先勾选要删除的小分组'
    return
  }
  const groupNames = indexes.map((index) => category.groups[index]?.name).filter(Boolean)
  const defaultIds = indexes.flatMap((index) =>
    (category.groups[index]?.cards || []).map((_, cardIndex) => `${category.key}:${index}:${cardIndex}`)
  )
  const customIds = (settings.systemCustomCards || [])
    .filter((card) => card.categoryKey === category.key && indexes.includes(Number(card.groupIndex)))
    .map((card) => card.id)
  const total = defaultIds.length + customIds.length
  const message = `删除「${category.label}」中已选的 ${indexes.length} 个分组（${groupNames.join('、')}）？\n\n共 ${total} 张字卡会从字卡库移除。之后可在系统字卡工具栏点“恢复删除”找回。`
  if (!window.confirm(message)) return
  const hidden = new Set(settings.systemHiddenCardIds || [])
  ;[...defaultIds, ...customIds].forEach((id) => hidden.add(id))
  settings.systemHiddenCardIds = [...hidden]
  const edits = { ...(settings.systemCardEdits || {}) }
  defaultIds.forEach((id) => delete edits[id])
  settings.systemCardEdits = edits
  const deletedKeys = new Set(systemLockDraftKeys.value)
  settings.systemDeletedCardGroups = [...new Set([...(settings.systemDeletedCardGroups || []), ...deletedKeys])]
  settings.systemLockedCardGroups = (settings.systemLockedCardGroups || []).filter((key) => !deletedKeys.has(key))
  status.value = `已删除「${category.label}」中的 ${indexes.length} 个分组，共 ${total} 张字卡`
  closeSystemLockDialog()
}

function startEditSystemCard(card) {
  editingSystemCardId.value = card.id
  editingSystemCardText.value = card.text
}
function cancelEditSystemCard() {
  editingSystemCardId.value = ''
  editingSystemCardText.value = ''
}
function saveSystemCard(card) {
  const text = editingSystemCardText.value.trim()
  if (!text) return
  if (card.custom) {
    const target = (settings.systemCustomCards || []).find((item) => item.id === card.id)
    if (target) target.text = text
  } else {
    settings.systemCardEdits = {
      ...(settings.systemCardEdits || {}),
      [card.id]: text,
    }
  }
  status.value = '系统字卡已修改，保存设置后立即生效'
  cancelEditSystemCard()
}
function deleteSystemCard(card) {
  if (!window.confirm(`删除系统字卡「${card.text}」？`)) return
  if (card.custom) {
    settings.systemCustomCards = (settings.systemCustomCards || []).filter((item) => item.id !== card.id)
  } else {
    settings.systemHiddenCardIds = [...new Set([...(settings.systemHiddenCardIds || []), card.id])]
  }
  status.value = '已删除系统字卡，可随时在系统预设中恢复'
}
function restoreSystemCards() {
  settings.systemHiddenCardIds = []
  settings.systemDeletedCardGroups = []
  status.value = '已恢复所有被删除的系统字卡和分组'
}
function addSystemCard() {
  const text = systemCustomText.value.trim()
  if (!text) return
  const groupIndex = Number(systemGroupKey.value)
  settings.systemCustomCards = [
    ...(settings.systemCustomCards || []),
    {
      id: makeId('sys-custom'),
      categoryKey: systemCategory.value?.key || 'main',
      groupIndex: Number.isInteger(groupIndex) && groupIndex >= 0 ? groupIndex : 0,
      text,
    },
  ]
  systemCustomText.value = ''
  systemComposerOpen.value = false
  status.value = '已添加自定义系统字卡'
}
function toggleCustomGroupLock(group) {
  if (!group) return
  group.locked = !group.locked
  status.value = group.locked
    ? `已锁定「${group.name}」，该组字卡不会被 TA 抽到`
    : `已解锁「${group.name}」，该组字卡重新参与抽卡`
}
watch(
  () => contact.value?.id,
  () => {
    if (!contact.value) return
    groups.value = JSON.parse(JSON.stringify(contact.value.cardGroups || []))
    const savedCards = JSON.parse(JSON.stringify(contact.value.cards || []))
    cards.value = savedCards.length
      ? savedCards
      : settings.replyCards.map((text) => ({
          id: makeId('card'),
          text: String(text).trim(),
          groupId: groups.value.some((group) => group.id === 'basic') ? 'basic' : '',
        }))
    selectedGroup.value = 'all'
    search.value = ''
    newCardsText.value = ''
    newGroupName.value = ''
    status.value = ''
    deleteGroupCandidate.value = null
    groupMenuId.value = ''
    editingGroupId.value = ''
    editingGroupName.value = ''
    draggingGroupId.value = ''
    suppressGroupClick.value = false
    libraryTab.value = 'custom'
    composerOpen.value = false
    newGroupOpen.value = false
  },
  { immediate: true }
)
watch([systemCategoryKey, systemGroupKey, systemSearch], () => {
  systemVisibleLimit.value = SYSTEM_PAGE_SIZE
})
watch(visibleSystemCategories, (categories) => {
  if (!categories.some((category) => category.key === systemCategoryKey.value)) {
    systemCategoryKey.value = categories[0]?.key || ''
  }
}, { immediate: true })
watch(systemGroupOptions, (options) => {
  if (!options.some((group) => group.key === systemGroupKey.value)) systemGroupKey.value = 'all'
})

function groupInitial(name) {
  return Array.from(String(name || '').trim())[0] || '组'
}
function groupName(groupId) {
  if (!groupId) return '未分组'
  return groups.value.find((group) => group.id === groupId)?.name || '未分组'
}
function groupCount(groupId) {
  if (groupId === 'all') return cards.value.length
  if (groupId === 'ungrouped') return cards.value.filter((card) => !card.groupId).length
  return cards.value.filter((card) => card.groupId === groupId).length
}
function targetGroup() {
  return groups.value.some((group) => group.id === selectedGroup.value) ? selectedGroup.value : ''
}
function makeId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 6)
}
function existingTexts() {
  return new Set(cards.value.map((card) => card.text.trim()))
}
function addTexts(rawTexts, sourceLabel = '字卡') {
  const target = targetGroup()
  const seen = existingTexts()
  let added = 0
  let skipped = 0
  rawTexts.forEach((raw) => {
    const text = String(raw || '').trim()
    if (!text) return
    if (seen.has(text)) {
      skipped += 1
      return
    }
    seen.add(text)
    cards.value.push({ id: makeId('card'), text, groupId: target })
    added += 1
  })
  status.value = `已添加 ${added} 张${sourceLabel}${skipped ? `，自动跳过 ${skipped} 张重复字卡` : ''}`
}
function addCards() {
  addTexts(newCardsText.value.split(/\r?\n/))
  newCardsText.value = ''
}
function addGroup() {
  const name = newGroupName.value.trim()
  if (!name) return
  if (groups.value.some((group) => group.name === name)) {
    status.value = '已经有同名分组'
    return
  }
  const id = makeId('g')
  groups.value.push({ id, name })
  selectedGroup.value = id
  newGroupName.value = ''
  newGroupOpen.value = false
  status.value = `已创建分组「${name}」`
}
function isCustomGroup(group) {
  return groups.value.some((item) => item.id === group.id)
}
function clearLongPressTimer() {
  clearTimeout(longPressTimer)
  longPressTimer = null
}
function handleGroupClick(group) {
  if (suppressGroupClick.value) {
    suppressGroupClick.value = false
    return
  }
  selectedGroup.value = group.id
  groupMenuId.value = ''
  editingGroupId.value = ''
  editingGroupName.value = ''
}
function startGroupLongPress(group, event) {
  if (!isCustomGroup(group)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  clearLongPressTimer()
  longPressStartY = event.clientY
  longPressStartX = event.clientX
  longPressPointerId = event.pointerId
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    suppressGroupClick.value = true
    groupMenuId.value = group.id
    editingGroupId.value = ''
    editingGroupName.value = ''
    draggingGroupId.value = group.id
    window.addEventListener('pointermove', onGroupPointerMove, { passive: false })
    window.addEventListener('pointerup', finishGroupPress, { once: true })
    window.addEventListener('pointercancel', finishGroupPress, { once: true })
  }, 480)
}
function onGroupPressMove(event) {
  if (longPressTimer && (Math.abs(event.clientX - longPressStartX) > 8 || Math.abs(event.clientY - longPressStartY) > 8)) clearLongPressTimer()
}
function onGroupPointerMove(event) {
  if (!draggingGroupId.value) return
  event.preventDefault()
  const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-custom-group-id]')
  const targetId = targetElement?.dataset.customGroupId || ''
  if (!targetId || targetId === draggingGroupId.value) return
  const from = groups.value.findIndex((group) => group.id === draggingGroupId.value)
  const to = groups.value.findIndex((group) => group.id === targetId)
  if (from < 0 || to < 0) return
  const reordered = [...groups.value]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  groups.value = reordered
  status.value = '分组顺序已调整，点击保存后生效'
}
function finishGroupPress() {
  clearLongPressTimer()
  draggingGroupId.value = ''
  window.removeEventListener('pointermove', onGroupPointerMove)
  window.removeEventListener('pointerup', finishGroupPress)
  window.removeEventListener('pointercancel', finishGroupPress)
  setTimeout(() => { suppressGroupClick.value = false }, 0)
}
function startEditGroup(group) {
  groupMenuId.value = ''
  editingGroupId.value = group.id
  editingGroupName.value = group.name
}
function saveGroupName(group) {
  const name = editingGroupName.value.trim()
  if (!name) return
  if (groups.value.some((item) => item.id !== group.id && item.name === name)) {
    status.value = '已经有同名分组'
    return
  }
  group.name = name
  editingGroupId.value = ''
  editingGroupName.value = ''
  status.value = `已修改分组名称为「${name}」`
}
function cancelEditGroup() {
  editingGroupId.value = ''
  editingGroupName.value = ''
}
onUnmounted(() => {
  clearLongPressTimer()
  window.removeEventListener('pointermove', onGroupPointerMove)
  window.removeEventListener('pointerup', finishGroupPress)
  window.removeEventListener('pointercancel', finishGroupPress)
})
function requestDeleteGroup(group) {
  groupMenuId.value = ''
  editingGroupId.value = ''
  deleteGroupCandidate.value = group
}
function cancelDeleteGroup() {
  deleteGroupCandidate.value = null
}
function finishDeleteGroup(deleteCards) {
  const group = deleteGroupCandidate.value
  if (!group) return
  const id = group.id
  if (deleteCards) {
    cards.value = cards.value.filter((card) => card.groupId !== id)
  } else {
    cards.value = cards.value.map((card) => (card.groupId === id ? { ...card, groupId: '' } : card))
  }
  groups.value = groups.value.filter((item) => item.id !== id)
  if (selectedGroup.value === id) selectedGroup.value = 'ungrouped'
  status.value = deleteCards
    ? `已删除分组「${group.name}」及其字卡`
    : `已删除分组「${group.name}」，字卡已移入未分组`
  cancelDeleteGroup()
}
function removeCard(card) {
  cards.value = cards.value.filter((item) => item.id !== card.id)
}
function changeCardGroup(card, event) {
  card.groupId = event.target.value
}
function openImport() {
  importInput.value?.click()
}
async function importJson(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    const source = Array.isArray(parsed)
      ? parsed
      : parsed.cards || parsed.customReplies || parsed.replyCards || parsed.items || []
    const texts = []
    source.forEach((item) => {
      const value = typeof item === 'string' ? item : String(item?.text ?? item?.content ?? '')
      value.split(/\r?\n/).forEach((line) => texts.push(line))
    })
    addTexts(texts, '导入字卡')
  } catch {
    status.value = 'JSON 导入失败：文件格式无法识别'
  }
}
function selectSystemCategory(category) {
  systemCategoryKey.value = category.key
  systemGroupKey.value = 'all'
  systemSearch.value = ''
}
function loadMoreSystem() {
  systemVisibleLimit.value += SYSTEM_PAGE_SIZE
}
function closeWindow() {
  store.cardLibraryContactId = null
  go('profile')
}
function save() {
  if (!contact.value) return
  if (newCardsText.value.trim()) addCards()
  updateContact(contact.value.id, {
    cardGroups: groups.value,
    cards: cards.value,
  })
  closeWindow()
}
</script><template>
  <section v-if="contact" class="cardlib-window">
    <header class="cardlib-head">
      <div class="library-tabs" role="tablist" aria-label="字卡库分类">
        <button type="button" class="library-tab" :class="{ active: libraryTab === 'custom' }" role="tab" :aria-selected="libraryTab === 'custom'" @click="libraryTab = 'custom'">
          <span>我的字卡</span><small>{{ cards.length }}</small>
        </button>
        <button type="button" class="library-tab" :class="{ active: libraryTab === 'preset' }" role="tab" :aria-selected="libraryTab === 'preset'" @click="libraryTab = 'preset'">
          <span>系统预设</span><small>{{ effectiveSystemCardCount }}</small>
        </button>
      </div>
    </header>

    <template v-if="libraryTab === 'custom'">
      <div class="library-toolbar">
        <label class="card-search">
          <span class="search-glyph" aria-hidden="true">⌕</span>
          <input v-model="search" type="search" placeholder="搜索字卡、所在分组" />
        </label>
        <button class="toolbar-button" type="button" @click="composerOpen = !composerOpen">{{ composerOpen ? '收起' : '＋ 添加' }}</button>
      </div>
      <div class="group-strip" role="tablist" aria-label="我的字卡分组">
        <button v-for="group in fixedGroupTabs" :key="group.id" type="button" class="group-chip" :class="{ active: selectedGroup === group.id }" @click="handleGroupClick(group)">
          <span>{{ group.name }}</span><small>{{ groupCount(group.id) }}</small>
        </button>
        <div v-for="group in groups" :key="group.id" class="group-chip-wrap" :class="{ 'is-dragging': draggingGroupId === group.id }" :data-custom-group-id="group.id" @pointerdown="startGroupLongPress(group, $event)" @pointermove="onGroupPressMove" @pointerup="finishGroupPress" @pointercancel="finishGroupPress">
          <button type="button" class="group-chip custom" :class="{ active: selectedGroup === group.id, locked: group.locked }" :title="group.locked ? `${group.name}（已锁定，不参与抽卡）` : group.name" @click.stop="handleGroupClick(group)">
            <span>{{ group.name }}</span>
            <small v-if="group.locked" class="chip-lock">锁</small>
            <small v-else>{{ groupCount(group.id) }}</small>
          </button>
        </div>
        <button type="button" class="group-chip add" @click="newGroupOpen = !newGroupOpen">{{ newGroupOpen ? '收起' : '＋ 分组' }}</button>
      </div>

      <div v-if="selectedCustomGroup" class="group-actions">
        <span class="ga-name">{{ selectedCustomGroup.name }}</span>
        <button type="button" :class="{ on: selectedCustomGroup.locked }" @click="toggleCustomGroupLock(selectedCustomGroup)">
          {{ selectedCustomGroup.locked ? '解锁' : '锁定' }}
        </button>
        <button type="button" @click="startEditGroup(selectedCustomGroup)">重命名</button>
        <button class="danger" type="button" @click="requestDeleteGroup(selectedCustomGroup)">删除</button>
      </div>

      <div v-if="menuGroup && editingGroupId !== menuGroup.id" class="group-edit-panel">
        <strong>{{ menuGroup.name }}</strong>
        <button type="button" @click="startEditGroup(menuGroup)">编辑</button>
        <button type="button" @click="toggleCustomGroupLock(menuGroup)">{{ menuGroup.locked ? '解锁' : '锁定' }}</button>
        <button class="danger" type="button" @click="requestDeleteGroup(menuGroup)">删除</button>
      </div>
      <div v-if="editingGroup" class="group-edit-panel editing">
        <input v-model="editingGroupName" type="text" maxlength="20" @keydown.enter.prevent="saveGroupName(editingGroup)" />
        <button type="button" @click="saveGroupName(editingGroup)">确定</button>
        <button type="button" @click="cancelEditGroup">取消</button>
      </div>
      <div v-if="newGroupOpen" class="group-edit-panel creating">
        <input v-model="newGroupName" type="text" maxlength="20" placeholder="新分组名称" @keydown.enter.prevent="addGroup" />
        <button type="button" @click="addGroup">添加</button>
      </div>
      <p class="group-help group-strip-help">选中分组后可锁定或删除；锁定的分组不会参与 TA 的抽卡</p>

      <div class="library-summary">
        <span>{{ contactDisplayName(contact) }}</span>
        <strong>{{ activeGroupLabel }}</strong>
        <small>{{ filteredCards.length }} 张</small>
        <em v-if="search">搜索结果</em>
      </div>
      <div v-if="status" class="card-status">{{ status }}</div>

      <div class="cardlib-body">
        <main class="card-main">
          <div v-if="composerOpen" class="card-composer">
            <textarea v-model="newCardsText" spellcheck="false" placeholder="每行一张字卡。Enter 只会换行；长段落不换行也算一张。"></textarea>
            <div class="add-actions">
              <button type="button" @click="addCards">添加字卡</button>
              <button type="button" @click="openImport">导入 JSON</button>
              <input ref="importInput" type="file" accept=".json,application/json" @change="importJson" />
              <span>添加到：{{ targetGroup() ? groupName(targetGroup()) : '未分组' }}</span>
            </div>
          </div>
          <div class="cc-list">
            <section v-for="section in customSections" :key="section.key" class="cc-section">
              <header class="cc-group-header">
                <span class="ccg-name">{{ section.name }}</span>
                <span class="ccg-count">{{ section.cards.length }}</span>
                <span class="ccg-rule"></span>
              </header>
              <article v-for="card in section.cards" :key="card.id" class="cc-item">
                <span class="cc-ico" aria-hidden="true">“</span>
                <div class="cc-txt">
                  <p class="cc-copy">{{ card.text }}</p>
                  <div class="cc-meta">
                    <span class="cc-type">{{ groupName(card.groupId) }}</span>
                    <span>{{ Array.from(card.text).length }} 字</span>
                  </div>
                </div>
                <div class="cc-actions">
                  <select :value="card.groupId" aria-label="移动到分组" @change="changeCardGroup(card, $event)">
                    <option value="">未分组</option>
                    <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
                  </select>
                  <button type="button" class="cc-delete" aria-label="删除字卡" title="删除字卡" @click="removeCard(card)">×</button>
                </div>
              </article>
            </section>
            <div v-if="!filteredCards.length" class="card-empty">
              <strong>没有找到字卡</strong>
              <span>{{ search ? '换个关键词试试，或检查字卡是否在其他分组。' : '当前分组还没有字卡。' }}</span>
            </div>
          </div>
        </main>
      </div>
    </template>

    <template v-else>
      <div class="system-category-strip" role="tablist" aria-label="系统预设分类">
        <button v-for="category in systemCategoryOptions" :key="category.key" type="button" class="system-category" :class="{ active: systemCategory?.key === category.key }" @click="selectSystemCategory(category)">
          <span>{{ category.label }}</span><small>{{ category.visibleCount }}</small>
        </button>
      </div>
      <div class="library-toolbar system-toolbar">
        <label class="card-search">
          <span class="search-glyph" aria-hidden="true">⌕</span>
          <input v-model="systemSearch" type="search" placeholder="搜索全部系统预设字卡" />
        </label>
        <button class="toolbar-button" type="button" @click="openSystemLockDialog">
          {{ systemCategoryLocked ? '管理禁用分组' : '禁用本分类' }}
        </button>
        <button class="toolbar-button" type="button" @click="systemComposerOpen = !systemComposerOpen">
          {{ systemComposerOpen ? '收起' : '＋ 自定义' }}
        </button>
        <button v-if="hasDeletedSystemCards" class="toolbar-button" type="button" @click="restoreSystemCards">恢复删除</button>
      </div>
      <div v-if="systemComposerOpen" class="card-composer system-composer">
        <textarea v-model="systemCustomText" rows="2" maxlength="200" placeholder="输入要加入当前系统预设分组的自定义字卡"></textarea>
        <div class="add-actions"><button type="button" @click="addSystemCard">添加到当前分类</button></div>
      </div>
      <div class="group-strip system" role="tablist" aria-label="系统预设分组">
        <button v-for="group in systemGroupOptions" :key="group.key" type="button" class="group-chip" :class="{ active: systemGroupKey === group.key, locked: group.key !== 'all' && isSystemGroupLocked(Number(group.key)) }" :title="group.name" @click="systemGroupKey = group.key">
          <span>{{ group.name }}</span>
          <small v-if="group.key !== 'all' && isSystemGroupLocked(Number(group.key))" class="chip-lock">锁</small>
          <small v-else>{{ group.count }}</small>
        </button>
      </div>

      <div v-if="selectedSystemGroup" class="group-actions system">
        <span class="ga-name">{{ selectedSystemGroup.name }}</span>
        <button
          v-if="canLockSystemGroup"
          type="button"
          :class="{ on: isSystemGroupLocked(selectedSystemGroupIndex) }"
          @click="toggleSystemGroupLock(selectedSystemGroupIndex)"
        >
          {{ isSystemGroupLocked(selectedSystemGroupIndex) ? '解锁' : '锁定' }}
        </button>
        <span v-else class="ga-note">{{ systemCategory?.key === 'gift' ? '该分类用于礼物名称与礼物备注，不参与聊天字卡抽卡' : '该分类仅用于拼字 / 补充语料，不参与抽卡' }}</span>
      </div>
      <div class="library-summary system-summary">
        <span>{{ systemSearch ? '全部系统预设' : systemCategory?.label }}</span>
        <strong>{{ activeSystemGroupLabel }}</strong>
        <small>{{ systemFilteredRows.length }} 张</small>
        <em v-if="systemSearch">搜索定位</em>
      </div>

      <div class="cardlib-body system-body">
        <main class="card-main system-main">
          <div class="cc-list">
            <section v-for="section in systemSections" :key="section.key" class="cc-section">
              <header class="cc-group-header">
                <span class="ccg-name">{{ section.name }}</span>
                <span class="ccg-count">{{ section.cards.length }}</span>
                <span class="ccg-rule"></span>
              </header>
              <article v-for="card in section.cards" :key="card.id" class="cc-item system-card-item">
                <span class="cc-ico" aria-hidden="true">“</span>
                <div v-if="editingSystemCardId === card.id" class="cc-txt cc-edit-copy">
                  <input v-model="editingSystemCardText" type="text" maxlength="200" @keydown.enter.prevent="saveSystemCard(card)" />
                  <div class="cc-card-actions">
                    <button type="button" @click="saveSystemCard(card)">确定</button>
                    <button type="button" @click="cancelEditSystemCard">取消</button>
                  </div>
                </div>
                <div v-else class="cc-txt">
                  <p class="cc-copy">{{ card.text }}</p>
                  <div class="cc-meta"><span class="cc-type">{{ card.categoryLabel }}</span><span>{{ card.groupName }}</span></div>
                  <div class="cc-card-actions">
                    <button type="button" @click="startEditSystemCard(card)">编辑</button>
                    <button class="danger" type="button" @click="deleteSystemCard(card)">删除</button>
                  </div>
                </div>
              </article>
            </section>
            <div v-if="!systemFilteredRows.length" class="card-empty">
              <strong>没有找到系统字卡</strong><span>试试其他关键词或切换分类。</span>
            </div>
            <button v-if="systemDisplayRows.length < systemFilteredRows.length" class="load-more" type="button" @click="loadMoreSystem">加载更多 · 还有 {{ systemFilteredRows.length - systemDisplayRows.length }} 张</button>
          </div>
        </main>
      </div>
    </template>

    <footer class="cardlib-actions">
      <span class="footer-stat">我的 {{ cards.length }} 张 · 系统 {{ effectiveSystemCardCount }} 张</span>
      <button class="cancel" type="button" @click="closeWindow">关闭</button>
      <button class="save" type="button" @click="save">保存</button>
    </footer>

    <div v-if="systemLockDialogOpen" class="system-lock-layer" @click.self="closeSystemLockDialog">
      <div class="system-lock-card" @click.stop>
        <header class="system-lock-head">
          <div>
            <strong>管理「{{ systemCategory?.label }}」的小分组</strong>
            <span>禁用只限制 TA 抽取，字卡仍可保留自用；删除会从字卡库直接移除。取消勾选再应用即可重新启用。</span>
          </div>
          <button type="button" aria-label="关闭" @click="closeSystemLockDialog">×</button>
        </header>
        <div class="system-lock-list">
          <label v-for="group in systemLockPageGroups" :key="group.key" class="system-lock-item" :class="{ active: systemLockDraftKeys.includes(group.key) }">
            <input type="checkbox" :checked="systemLockDraftKeys.includes(group.key)" @change="toggleSystemLockDraft(group.key)" />
            <span><strong>{{ group.name }}</strong><small>{{ group.count }} 张字卡</small></span>
            <b>{{ systemLockDraftKeys.includes(group.key) ? '已选' : '可用' }}</b>
          </label>
          <div v-if="!systemLockGroups.length" class="card-empty"><strong>该分类没有小分组</strong></div>
        </div>
        <div v-if="systemLockPageCount > 1" class="system-lock-pager">
          <button type="button" :disabled="systemLockPage <= 0" @click="systemLockPage--">上一页</button>
          <span>{{ systemLockPage + 1 }} / {{ systemLockPageCount }}</span>
          <button type="button" :disabled="systemLockPage >= systemLockPageCount - 1" @click="systemLockPage++">下一页</button>
        </div>
        <div class="system-lock-bulk">
          <button type="button" @click="toggleSystemLockPage">全选本页</button>
          <button type="button" @click="selectAllSystemLockGroups">全选全部分组</button>
          <button type="button" @click="clearSystemLockSelection">清空选择</button>
        </div>
        <footer class="system-lock-actions">
          <span>已选 {{ systemLockSelectedCount }} 组</span>
          <button type="button" @click="closeSystemLockDialog">取消</button>
          <button type="button" class="danger" :disabled="!systemLockSelectedCount" @click="deleteSystemLockSelection">删除所选字卡</button>
          <button type="button" class="primary" @click="applySystemLockSelection">{{ systemLockSelectedCount ? '应用并禁用' : '应用并全部启用' }}</button>
        </footer>
      </div>
    </div>

    <div v-if="deleteGroupCandidate" class="delete-layer" @click.self="cancelDeleteGroup">
      <div class="delete-card">
        <strong>删除字卡组「{{ deleteGroupCandidate.name }}」</strong>
        <p>组内字卡是保留并移入未分组，还是与分组一起删除？</p>
        <div class="delete-actions three">
          <button type="button" @click="cancelDeleteGroup">取消</button>
          <button type="button" @click="finishDeleteGroup(false)">仅删除分组</button>
          <button type="button" class="danger" @click="finishDeleteGroup(true)">连同字卡删除</button>
        </div>
      </div>
    </div>
  </section>
</template><style scoped>
.cardlib-window { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--theme-surface); color: var(--theme-text); }
.cardlib-head { flex: none; padding: 10px 12px 0; background: var(--theme-surface); border-bottom: 1px solid var(--theme-border-soft); }
.library-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 2px 0 10px; }
.library-tab { min-width: 0; min-height: 42px; padding: 8px 10px; border: 1px solid var(--theme-border-soft); border-radius: 14px; background: var(--theme-soft); color: var(--theme-text); display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 800; cursor: pointer; transition: background .18s ease, color .18s ease, border-color .18s ease, transform .16s ease; }
.library-tab span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.library-tab small { flex: none; padding: 2px 7px; border-radius: 999px; background: rgba(var(--theme-overlay-rgb), .06); color: var(--theme-muted); font-size: 9.5px; }
.library-tab.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.library-tab.active small { background: rgba(255,255,255,.18); color: inherit; }
.library-tab:active { transform: scale(.985); }
.library-toolbar { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 12px 0; }
.card-search { flex: 1; min-width: 0; min-height: 42px; padding: 0 12px; border: 1px solid var(--theme-border-soft); border-radius: 15px; background: var(--theme-soft); display: flex; align-items: center; gap: 8px; }
.search-glyph { flex: none; color: var(--theme-muted); font-size: 21px; line-height: 1; transform: rotate(-18deg); }
.card-search input { flex: 1; min-width: 0; padding: 10px 0; border: 0; outline: 0; background: transparent; color: var(--theme-text-strong); font: inherit; font-size: 12px; }
.card-search input::placeholder { color: var(--theme-muted); }
.card-search:focus-within { border-color: var(--theme-primary); }
.toolbar-button { flex: none; min-height: 42px; padding: 0 12px; border: 1px solid var(--theme-border-soft); border-radius: 14px; background: var(--theme-soft); color: var(--theme-primary); font-size: 11px; font-weight: 800; cursor: pointer; }
.library-summary { flex: none; min-width: 0; display: flex; align-items: baseline; gap: 7px; padding: 9px 14px 0; color: var(--theme-muted); font-size: 9.5px; }
.library-summary strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--theme-text-strong); font-size: 12px; }
.library-summary small { flex: none; color: var(--theme-primary); font-weight: 800; }
.library-summary em { flex: none; margin-left: auto; color: var(--theme-accent-warm); font-style: normal; }
.card-status { flex: none; padding: 7px 14px 0; color: var(--theme-accent); font-size: 10px; font-weight: 700; }
.cardlib-body { flex: 1; min-width: 0; min-height: 0; padding: 5px 10px 8px; display: flex; flex-direction: column; overflow: hidden; }
.group-strip { flex: none; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 8px 12px 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.group-strip::-webkit-scrollbar { display: none; }
.group-strip.system { padding-top: 5px; }
.group-chip-wrap { flex: none; display: flex; min-width: 0; touch-action: pan-x; }
.group-chip-wrap.is-dragging { opacity: .62; transform: scale(.97); }
.group-chip { flex: none; min-height: 32px; padding: 5px 10px; border: 1px solid var(--theme-border-soft); border-radius: 999px; background: var(--theme-soft); color: var(--theme-text); display: inline-flex; align-items: center; gap: 7px; font-size: 9.5px; font-weight: 750; cursor: pointer; white-space: nowrap; }
.group-chip span { max-width: 118px; overflow: hidden; text-overflow: ellipsis; }
.group-chip small { color: var(--theme-muted); font-size: 8.5px; }
.group-chip.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.group-chip.active small { color: inherit; opacity: .8; }
.group-chip.locked:not(.active) { border-style: dashed; color: var(--theme-muted); }
.chip-lock { padding: 1px 4px; border-radius: 4px; background: rgba(var(--theme-overlay-rgb), .08); color: inherit; font-size: 7.5px; letter-spacing: .5px; }
.group-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 2px;
  padding: 7px 9px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: var(--theme-soft);
}
.group-actions.system { margin-top: 6px; }
.group-actions .ga-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 9.5px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-actions .ga-note { color: var(--theme-muted); font-size: 8px; }
.group-actions button {
  flex: none;
  padding: 4px 8px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 7px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font: inherit;
  font-size: 8.5px;
  cursor: pointer;
}
.group-actions button:hover { border-color: var(--theme-primary); color: var(--theme-primary); }
.group-actions button.on { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.group-actions button.danger { color: #c26a5e; }
.group-actions button.danger:hover { border-color: #c26a5e; color: #c26a5e; }
.group-chip.custom { border-color: var(--theme-border); }
.group-chip.add { border-style: dashed; background: transparent; color: var(--theme-primary); }
.group-edit-panel { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 6px 12px 0; padding: 7px 9px; border: 1px solid var(--theme-border-soft); border-radius: 11px; background: var(--theme-soft); }
.group-edit-panel strong { flex: 1; min-width: 90px; overflow: hidden; color: var(--theme-text-strong); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.group-edit-panel input { flex: 1; min-width: 100px; padding: 6px 8px; border: 1px solid var(--theme-border); border-radius: 8px; background: var(--theme-surface); color: var(--theme-text-strong); font-size: 10px; }
.group-edit-panel button { padding: 5px 9px; border: 1px solid var(--theme-border-soft); border-radius: 8px; background: var(--theme-surface); color: var(--theme-primary); font-size: 9px; font-weight: 700; cursor: pointer; }
.group-edit-panel button.danger { background: var(--theme-danger-surface); color: var(--theme-accent-warm); }
.group-help { margin: 4px 14px 0; color: var(--theme-muted); font-size: 8.5px; line-height: 1.45; }
.card-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.card-composer { flex: none; min-width: 0; padding: 9px; border: 1px solid var(--theme-border-soft); border-radius: 14px; background: var(--theme-soft); display: flex; flex-direction: column; gap: 7px; }
.card-composer textarea { width: 100%; min-height: 72px; padding: 9px 10px; border: 1px solid var(--theme-border-soft); border-radius: 11px; background: var(--theme-surface); color: var(--theme-text-strong); font: inherit; font-size: 11px; line-height: 1.55; resize: vertical; }
.add-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.add-actions button { padding: 6px 10px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-surface); color: var(--theme-primary); font-size: 9.5px; font-weight: 800; cursor: pointer; }
.add-actions input { display: none; }
.add-actions span { color: var(--theme-muted); font-size: 9px; }.cc-list { flex: 1; min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 2px 3px 8px; overscroll-behavior: contain; }
.cc-section { min-width: 0; }
.cc-group-header { min-width: 0; display: flex; align-items: center; gap: 7px; padding: 11px 3px 6px; margin-top: 1px; }
.ccg-name { min-width: 0; overflow: hidden; color: var(--theme-text-strong); font-size: 12px; font-weight: 800; letter-spacing: .04em; text-overflow: ellipsis; white-space: nowrap; }
.ccg-count { flex: none; padding: 1px 7px; border-radius: 999px; background: var(--theme-soft); color: var(--theme-muted); font-size: 9px; }
.ccg-rule { flex: 1; height: 1px; background: var(--theme-border-soft); }
.cc-item { min-width: 0; margin-bottom: 8px; padding: 11px 12px; border: 1px solid var(--theme-border-soft); border-radius: 16px; background: var(--theme-surface); display: flex; align-items: center; gap: 10px; transition: background .16s ease, transform .14s ease; }
.cc-item:active { transform: scale(.992); }
.cc-ico { flex: none; width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--theme-soft); color: var(--theme-primary); font-size: 24px; font-weight: 800; line-height: 1; }
.cc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.cc-copy { min-width: 0; margin: 0; color: var(--theme-text-strong); font-size: 12.5px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; word-break: break-word; }
.cc-meta { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--theme-muted); font-size: 8.5px; }
.cc-type { max-width: 100%; padding: 2px 7px; border: 1px solid var(--theme-border-soft); border-radius: 999px; overflow: hidden; color: var(--theme-muted); text-overflow: ellipsis; white-space: nowrap; }
.cc-actions { flex: none; display: flex; align-items: center; gap: 4px; }
.cc-actions select { width: 76px; min-width: 0; padding: 6px 4px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-soft); color: var(--theme-text); font-size: 9px; }
.cc-delete { flex: none; width: 28px; height: 28px; padding: 0; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-danger-surface); color: var(--theme-accent-warm); font-size: 16px; line-height: 1; cursor: pointer; }
.cc-item.readonly { padding-right: 13px; }
.system-composer { margin: 8px 12px 0; }
.system-composer textarea { min-height: 54px; }
.cc-item.system-card-item { align-items: flex-start; padding-right: 12px; }
.cc-edit-copy { display: flex; flex-direction: column; gap: 7px; }
.cc-edit-copy input { width: 100%; padding: 7px 9px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-surface); color: var(--theme-text); font: inherit; font-size: 10px; }
.cc-card-actions { display: flex; gap: 6px; margin-top: 6px; }
.cc-card-actions button { padding: 3px 7px; border: 0; border-radius: 7px; background: var(--theme-soft); color: var(--theme-primary); font-size: 8px; font-weight: 750; cursor: pointer; }
.cc-card-actions button.danger { color: var(--theme-danger, #b34d4d); }
.card-empty { min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 20px 12px; color: var(--theme-muted); text-align: center; }
.card-empty strong { color: var(--theme-text); font-size: 12px; }
.card-empty span { font-size: 10px; line-height: 1.55; }
.load-more { width: 100%; margin: 2px 0 8px; padding: 9px 12px; border: 1px solid var(--theme-border-soft); border-radius: 12px; background: var(--theme-soft); color: var(--theme-primary); font-size: 10px; font-weight: 800; cursor: pointer; }
.system-category-strip { flex: none; display: flex; gap: 7px; padding: 10px 12px 0; overflow-x: auto; scrollbar-width: none; }
.system-category-strip::-webkit-scrollbar { display: none; }
.system-category { flex: none; min-width: 92px; padding: 7px 10px; border: 1px solid var(--theme-border-soft); border-radius: 13px; background: var(--theme-soft); color: var(--theme-text); display: flex; align-items: center; justify-content: space-between; gap: 7px; font-size: 9.5px; font-weight: 750; cursor: pointer; }
.system-category span { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.system-category small { flex: none; color: var(--theme-muted); font-size: 8.5px; }
.system-category.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.system-category.active small { color: inherit; opacity: .8; }
.system-toolbar { padding-top: 8px; }
.system-summary { padding-top: 7px; }
.system-body { padding-top: 7px; }
.cardlib-actions { flex: none; position: relative; z-index: 7; padding: 8px 12px; border-top: 1px solid var(--theme-border-soft); background: var(--theme-surface); display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.footer-stat { min-width: 0; margin-right: auto; overflow: hidden; color: var(--theme-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.cardlib-actions button { padding: 8px 14px; border-radius: 11px; font-size: 10.5px; font-weight: 800; cursor: pointer; }
.cardlib-actions .cancel { border: 1px solid var(--theme-border-soft); background: var(--theme-soft); color: var(--theme-text); }
.cardlib-actions .save { border: 0; background: var(--theme-primary); color: var(--theme-inverse); }
.delete-layer { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; padding: 16px; background: rgba(var(--theme-overlay-rgb), .3); }
.delete-card { width: min(360px, 100%); padding: 16px; border: 1px solid var(--theme-border); border-radius: 17px; background: var(--theme-surface); box-shadow: 0 14px 36px rgba(var(--theme-overlay-rgb), .18); }
.delete-card strong { color: var(--theme-primary); font-size: 13px; }
.delete-card p { margin: 8px 0 14px; color: var(--theme-text); font-size: 11px; line-height: 1.6; }
.delete-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.delete-actions button { padding: 7px 10px; border: 1px solid var(--theme-border-soft); border-radius: 9px; background: var(--theme-soft); color: var(--theme-primary); font-size: 9.5px; font-weight: 700; cursor: pointer; }
.delete-actions button.danger { background: var(--theme-danger-surface); color: var(--theme-accent-warm); }
@media (max-width: 680px) {
  .cardlib-head { padding: 8px 8px 0; }
  .library-tabs { gap: 6px; padding-bottom: 8px; }
  .library-tab { min-height: 39px; padding: 7px 8px; font-size: 11px; border-radius: 12px; }
  .library-toolbar { padding: 8px 8px 0; gap: 6px; }
  .card-search { min-height: 39px; border-radius: 13px; padding: 0 10px; }
  .toolbar-button { min-height: 39px; padding: 0 9px; border-radius: 12px; font-size: 10px; }
  .library-summary { padding: 7px 9px 0; }
  .cardlib-body { padding: 4px 7px 6px; }

  .group-chip { min-height: 30px; padding: 5px 9px; font-size: 9px; }
  .group-strip { padding: 7px 8px 0; gap: 5px; }
  .group-edit-panel { margin: 6px 8px 0; }

  .cc-item { padding: 9px; gap: 8px; border-radius: 14px; }
  .cc-ico { width: 34px; height: 34px; border-radius: 11px; font-size: 20px; }
  .cc-copy { font-size: 11.5px; }
  .cc-actions { flex-direction: column; align-items: stretch; gap: 3px; }
  .cc-actions select { width: 66px; }
  .cc-delete { width: 66px; height: 24px; }
  .system-category-strip { padding: 8px 8px 0; gap: 5px; }
  .system-category { min-width: 84px; padding: 6px 8px; font-size: 8.8px; }
  .system-toolbar { padding-top: 7px; }
  .cardlib-actions { padding: 7px 9px; gap: 6px; }
  .footer-stat { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .library-tab, .cc-item { transition: none; }
}

/* 系统预设：按小分组多选禁用 */
.system-lock-layer { position:absolute; inset:0; z-index:34; display:grid; place-items:center; padding:14px; background:rgba(var(--theme-overlay-rgb),.32); }
.system-lock-card { width:min(560px,100%); max-height:min(86%,720px); display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--theme-border); border-radius:18px; background:var(--theme-surface); color:var(--theme-text); box-shadow:0 16px 42px rgba(var(--theme-overlay-rgb),.2); }
.system-lock-head { flex:none; padding:14px 15px 11px; display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--theme-border-soft); }
.system-lock-head strong { display:block; color:var(--theme-primary); font-size:13px; }
.system-lock-head span { display:block; margin-top:4px; color:var(--theme-muted); font-size:9px; line-height:1.5; }
.system-lock-head button { width:28px; height:28px; flex:none; padding:0; border:0; border-radius:50%; background:var(--theme-soft); color:var(--theme-text); font-size:17px; cursor:pointer; }
.system-lock-list { min-height:0; overflow-y:auto; padding:12px; display:grid; grid-template-columns:1fr 1fr; gap:7px; overscroll-behavior:contain; }
.system-lock-item { min-width:0; padding:9px; border:1px solid var(--theme-border-soft); border-radius:11px; background:var(--theme-soft); display:flex; align-items:center; gap:8px; cursor:pointer; }
.system-lock-item.active { border-color:var(--theme-primary); background:var(--theme-pale); }
.system-lock-item input { flex:none; accent-color:var(--theme-primary); }
.system-lock-item > span { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.system-lock-item strong { overflow:hidden; color:var(--theme-text); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.system-lock-item small { color:var(--theme-muted); font-size:8px; }
.system-lock-item b { flex:none; color:var(--theme-muted); font-size:8px; }
.system-lock-item.active b { color:var(--theme-primary); }
.system-lock-pager { flex:none; padding:0 12px 9px; display:flex; align-items:center; justify-content:center; gap:10px; }
.system-lock-pager button,.system-lock-bulk button { padding:6px 9px; border:1px solid var(--theme-border-soft); border-radius:8px; background:var(--theme-soft); color:var(--theme-text); font:inherit; font-size:9px; cursor:pointer; }
.system-lock-pager button:disabled { opacity:.4; cursor:default; }
.system-lock-pager span { color:var(--theme-muted); font-size:9px; }
.system-lock-bulk { flex:none; padding:0 12px 10px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
.system-lock-actions { flex:none; padding:10px 12px 13px; border-top:1px solid var(--theme-border-soft); display:flex; align-items:center; gap:7px; }
.system-lock-actions span { margin-right:auto; color:var(--theme-muted); font-size:9px; }
.system-lock-actions button { padding:8px 12px; border:1px solid var(--theme-border-soft); border-radius:9px; background:var(--theme-soft); color:var(--theme-text); font:inherit; font-size:9.5px; font-weight:800; cursor:pointer; }
.system-lock-actions button.primary { border-color:var(--theme-primary); background:var(--theme-primary); color:var(--theme-inverse); }
.system-lock-actions button.danger { border-color:#c85f5f; background:#fff3f2; color:#a33c3c; }
.system-lock-actions button:disabled { opacity:.42; cursor:not-allowed; }
@media (max-width:680px) {
  .system-lock-layer { padding:9px; }
  .system-lock-card { max-height:90%; border-radius:15px; }
  .system-lock-list { grid-template-columns:1fr; padding:9px; }
  .system-lock-head { padding:12px 12px 9px; }
  .system-lock-actions { padding:9px 10px 12px; flex-wrap:wrap; }
  .system-lock-actions span { width:100%; margin:0 0 2px; }
}</style>
