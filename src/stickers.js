import { reactive } from 'vue'
import { listStickers } from './sticker-store'

const GROUPS_KEY = 'zhengdu_sticker_groups_v1'

function makeSyncKey() {
  return 'sync-' + Date.now() + Math.random().toString(36).slice(2, 7)
}

function defaultGroups() {
  return [
    { id: 'mine-default', name: '默认', category: 'mine', contactIds: [], syncKey: 'default-shared' },
    { id: 'ta-default', name: '默认', category: 'ta', contactIds: [], syncKey: 'default-shared' },
  ]
}

function assignMissingSyncKeys(groups) {
  for (const group of groups) {
    if (group.id === 'mine-default' || group.id === 'ta-default') {
      group.syncKey = group.syncKey || 'default-shared'
    }
  }

  for (const group of groups) {
    if (group.syncKey) continue
    const opposite = groups.find(
      (candidate) =>
        !candidate.syncKey &&
        candidate.category !== group.category &&
        candidate.name === group.name
    )
    const syncKey = makeSyncKey()
    group.syncKey = syncKey
    if (opposite) opposite.syncKey = syncKey
  }
  return groups
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.groups) && parsed.groups.length) {
        return assignMissingSyncKeys(
          parsed.groups.map((group) => ({
            ...group,
            contactIds: Array.isArray(group.contactIds) ? group.contactIds : [],
          }))
        )
      }
    }
  } catch (e) {
    /* 忽略损坏数据 */
  }
  return defaultGroups()
}

export const stickerState = reactive({
  groups: loadGroups(),
  stickers: [],
  loaded: false,
})

function saveGroups() {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ groups: stickerState.groups }))
  } catch (e) {
    /* 忽略不可写场景 */
  }
}

export async function loadStickerLibrary() {
  stickerState.stickers = await listStickers()
  stickerState.loaded = true
}

export function addStickerGroup({ name, category, contactIds = [], syncKey = '' }) {
  const group = {
    id: 'sg' + Date.now() + Math.random().toString(36).slice(2, 6),
    name: String(name || '新分组').trim() || '新分组',
    category: category === 'ta' ? 'ta' : 'mine',
    contactIds: [...new Set(contactIds)],
    syncKey: syncKey || makeSyncKey(),
  }
  stickerState.groups.push(group)
  saveGroups()
  return group
}

export function ensureMirrorStickerGroup(sourceGroup) {
  const group = stickerState.groups.find((item) => item.id === sourceGroup?.id)
  if (!group) return null
  if (!group.syncKey) {
    group.syncKey = makeSyncKey()
    saveGroups()
  }
  const mirrorCategory = group.category === 'mine' ? 'ta' : 'mine'
  const existing = stickerState.groups.find(
    (item) => item.category === mirrorCategory && item.syncKey === group.syncKey
  )
  if (existing) return existing
  return addStickerGroup({
    name: group.name,
    category: mirrorCategory,
    contactIds: [],
    syncKey: group.syncKey,
  })
}

export function updateStickerGroup(id, patch) {
  const group = stickerState.groups.find((item) => item.id === id)
  if (!group) return null
  Object.assign(group, patch)
  saveGroups()
  return group
}

export function removeStickerGroup(id) {
  stickerState.groups = stickerState.groups.filter((group) => group.id !== id)
  saveGroups()
}

export function mineStickerGroups() {
  return stickerState.groups.filter((group) => group.category === 'mine')
}

export function taStickerGroupsFor(contactId) {
  return stickerState.groups.filter(
    (group) => group.category === 'ta' && group.contactIds.includes(contactId)
  )
}

export function saveStickerGroupsNow() {
  saveGroups()
}

export function importStickerGroups(groups = []) {
  let count = 0
  for (const source of Array.isArray(groups) ? groups : []) {
    if (!source || !source.id) continue
    const existing = stickerState.groups.find((group) => group.id === source.id)
    const normalized = {
      id: source.id,
      name: String(source.name || '未命名分组').trim() || '未命名分组',
      category: source.category === 'ta' ? 'ta' : 'mine',
      contactIds: [...new Set(Array.isArray(source.contactIds) ? source.contactIds : [])],
      syncKey: String(source.syncKey || '').trim() || makeSyncKey(),
    }
    if (existing) Object.assign(existing, normalized)
    else stickerState.groups.push(normalized)
    count += 1
  }
  assignMissingSyncKeys(stickerState.groups)
  saveGroups()
  return count
}

export function setLoadedStickers(stickers = []) {
  stickerState.stickers = stickers
  stickerState.loaded = true
}

export function stickersInGroups(groups) {
  const ids = new Set(groups.map((group) => group.id))
  return stickerState.stickers.filter((sticker) => ids.has(sticker.groupId))
}

export function randomStickerForContact(contactId) {
  const stickers = stickersInGroups(taStickerGroupsFor(contactId))
  if (!stickers.length) return null
  return stickers[Math.floor(Math.random() * stickers.length)]
}
