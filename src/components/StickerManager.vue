<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { chatState } from '../chat'
import { putSticker, removeSticker } from '../sticker-store'
import {
  addStickerGroup,
  ensureMirrorStickerGroup,
  loadStickerLibrary,
  removeStickerGroup,
  stickerState,
  updateStickerGroup,
} from '../stickers'

const category = ref('mine')
const selectedGroupId = ref('')
const newGroupName = ref('')
const uploadInput = ref(null)

const contacts = computed(() => chatState.contacts)
const categoryGroups = computed(() =>
  stickerState.groups.filter((group) => group.category === category.value)
)
const selectedGroup = computed(() =>
  categoryGroups.value.find((group) => group.id === selectedGroupId.value) || null
)
const selectedStickers = computed(() =>
  selectedGroup.value
    ? stickerState.stickers.filter((sticker) => sticker.groupId === selectedGroup.value.id)
    : []
)

watch(
  categoryGroups,
  (groups) => {
    if (!groups.some((group) => group.id === selectedGroupId.value)) {
      selectedGroupId.value = groups[0]?.id || ''
    }
  },
  { immediate: true }
)

function addGroup() {
  const group = addStickerGroup({
    name: newGroupName.value || '新分组',
    category: category.value,
    contactIds: [],
  })
  selectedGroupId.value = group.id
  newGroupName.value = ''
}

function removeGroup(group) {
  if (!window.confirm('删除该表情包分组？')) return
  const ids = stickerState.stickers
    .filter((sticker) => sticker.groupId === group.id)
    .map((sticker) => sticker.id)
  ids.forEach((id) => removeSticker(id))
  stickerState.stickers = stickerState.stickers.filter((sticker) => sticker.groupId !== group.id)
  removeStickerGroup(group.id)
}

function toggleContact(group, contactId) {
  const ids = group.contactIds.includes(contactId)
    ? group.contactIds.filter((id) => id !== contactId)
    : [...group.contactIds, contactId]
  updateStickerGroup(group.id, { contactIds: ids })
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function upload(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  if (!selectedGroup.value || !files.length) return
  const sourceGroup = selectedGroup.value
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const src = await readDataUrl(file)
    if (!src) continue
    const createdAt = Date.now()
    const sticker = {
      id: 'sticker' + createdAt + Math.random().toString(36).slice(2, 6),
      groupId: sourceGroup.id,
      name: file.name,
      src,
      createdAt,
    }
    await putSticker(sticker)
    stickerState.stickers.push(sticker)

    const mirrorGroup = ensureMirrorStickerGroup(sourceGroup)
    if (mirrorGroup) {
      const mirrorSticker = {
        ...sticker,
        id: 'sticker-mirror' + createdAt + Math.random().toString(36).slice(2, 6),
        groupId: mirrorGroup.id,
        mirroredFromId: sticker.id,
      }
      await putSticker(mirrorSticker)
      stickerState.stickers.push(mirrorSticker)
    }
  }
}

async function deleteSticker(sticker) {
  await removeSticker(sticker.id)
  stickerState.stickers = stickerState.stickers.filter((item) => item.id !== sticker.id)
}

onMounted(() => {
  if (!stickerState.loaded) loadStickerLibrary().catch(() => {})
})
</script>

<template>
  <div class="sticker-manager">
    <div class="category-tabs">
      <button type="button" :class="{ active: category === 'mine' }" @click="category = 'mine'">我的表情包</button>
      <button type="button" :class="{ active: category === 'ta' }" @click="category = 'ta'">TA 的表情包</button>
    </div>

    <div class="group-strip">
      <button
        v-for="group in categoryGroups"
        :key="group.id"
        type="button"
        class="group-chip"
        :class="{ active: selectedGroupId === group.id }"
        @click="selectedGroupId = group.id"
      >{{ group.name }}</button>
      <button v-if="selectedGroup" type="button" class="group-delete" @click="removeGroup(selectedGroup)">删除分组</button>
    </div>

    <div class="new-group-row">
      <input v-model="newGroupName" type="text" maxlength="20" placeholder="新分组名称" />
      <button type="button" @click="addGroup">新建分组</button>
      <button type="button" :disabled="!selectedGroup" @click="uploadInput?.click()">批量上传</button>
      <input ref="uploadInput" type="file" accept="image/*" multiple @change="upload" />
    </div>

    <p class="sticker-sync-hint">上传时会同步分组和内容到另一侧；之后删除单张表情只影响当前一侧。</p>

    <div v-if="category === 'ta' && selectedGroup" class="assign-row">
      <span>给谁使用：</span>
      <label v-for="contact in contacts" :key="contact.id">
        <input
          type="checkbox"
          :checked="selectedGroup.contactIds.includes(contact.id)"
          @change="toggleContact(selectedGroup, contact.id)"
        />
        {{ contact.note || contact.name }}
      </label>
    </div>

    <div v-if="selectedStickers.length" class="sticker-grid">
      <div v-for="sticker in selectedStickers" :key="sticker.id" class="sticker-item">
        <img :src="sticker.src" alt="" />
        <button type="button" @click="deleteSticker(sticker)">×</button>
      </div>
    </div>
    <div v-else class="sticker-empty">该分组还没有表情包。</div>
  </div>
</template>

<style scoped>
.sticker-manager { display: flex; flex-direction: column; gap: 9px; }
.category-tabs { display: flex; gap: 7px; }
.category-tabs button, .group-chip, .group-delete, .new-group-row button {
  padding: 7px 10px; border: 1px solid var(--theme-border); border-radius: 999px; background: #fff; color: var(--theme-text); font-size: 10.5px; font-weight: 700; cursor: pointer;
}
.category-tabs button.active, .group-chip.active { background: var(--theme-pale); color: var(--theme-primary); }
.group-strip { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.group-delete { color: var(--theme-accent-warm); border-color: var(--theme-danger-border); background: var(--theme-danger-surface); }
.new-group-row { display: flex; flex-wrap: wrap; gap: 6px; }
.new-group-row input { flex: 1; min-width: 120px; padding: 8px 9px; border: 1px solid var(--theme-border); border-radius: 10px; background: #fff; color: var(--theme-text-strong); font-size: 11px; }
.new-group-row input[type=file] { display: none; }
.new-group-row button:disabled { opacity: .55; cursor: default; }
.assign-row { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; color: var(--theme-text); font-size: 10.5px; font-weight: 700; }
.assign-row label { display: flex; align-items: center; gap: 4px; }
.sticker-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }
.sticker-item { position: relative; aspect-ratio: 1; border: 1px solid var(--theme-border-soft); border-radius: 12px; background: #fff; overflow: hidden; }
.sticker-item img { width: 100%; height: 100%; object-fit: contain; display: block; }
.sticker-item button { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border: 0; border-radius: 50%; background: rgba(var(--theme-accent-warm-rgb), .9); color: #fff; font-size: 11px; cursor: pointer; }
.sticker-sync-hint { margin: 0; color: var(--theme-muted); font-size: 9.5px; line-height: 1.5; }
.sticker-empty { padding: 18px 8px; text-align: center; color: var(--theme-muted); font-size: 10.5px; }
</style>
