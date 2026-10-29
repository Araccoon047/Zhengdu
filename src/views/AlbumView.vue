<script setup>
import { ref, computed, onMounted } from 'vue'
import { cropImage } from '../image-crop'
import { imageFileToOriginalDataUrl } from '../image-utils'
import { store } from '../store'
import {
  addAlbumCollection,
  addPhoto,
  deletePhoto,
  listAlbumCollections,
  listPhotos,
  removeAlbumCollection,
  renameAlbumCollection,
  setPhotoCollection,
} from '../album-store'

const photos = ref([])
const collections = ref([])
const selectedCollectionId = ref(store.albumCollectionId || 'default')
const idx = ref(-1)
const uploadInput = ref(null)
const uploading = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const newCollectionOpen = ref(false)
const newCollectionName = ref('')

const selectedCollection = computed(
  () => collections.value.find((item) => item.id === selectedCollectionId.value) || collections.value[0]
)
const collectionPhotos = computed(() => {
  if (selectedCollectionId.value === 'default') {
    return photos.value.filter((photo) => !photo.collectionId || photo.collectionId === 'default')
  }
  return photos.value.filter((photo) => photo.collectionId === selectedCollectionId.value)
})
const current = computed(() => (idx.value >= 0 ? collectionPhotos.value[idx.value] || null : null))
const canManageCollection = computed(() => selectedCollection.value?.kind === 'custom')

function showNotice(text) {
  notice.value = text
  setTimeout(() => {
    if (notice.value === text) notice.value = ''
  }, 2200)
}

function collectionCount(collection) {
  if (collection.id === 'default') {
    return photos.value.filter((photo) => !photo.collectionId || photo.collectionId === 'default').length
  }
  return photos.value.filter((photo) => photo.collectionId === collection.id).length
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    collections.value = listAlbumCollections()
    photos.value = await listPhotos()
    if (!collections.value.some((item) => item.id === selectedCollectionId.value)) {
      selectedCollectionId.value = 'default'
      store.albumCollectionId = 'default'
    }
  } catch (e) {
    error.value = e.message || '相册读取失败'
  } finally {
    loading.value = false
  }
}

function selectCollection(id) {
  selectedCollectionId.value = id
  store.albumCollectionId = id
  idx.value = -1
  newCollectionOpen.value = false
  newCollectionName.value = ''
}

function pickFiles() {
  uploadInput.value?.click()
}

async function onFiles(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  if (!files.length) return

  uploading.value = true
  error.value = ''
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const src = selectedCollectionId.value === 'carousel'
        ? await cropImage(file, {
            title: '裁剪轮播图（固定 1:1）',
            aspectRatio: 1,
            lockAspect: true,
            shape: 'rect',
            maxSide: 1600,
            quality: 0.88,
          })
        : await imageFileToOriginalDataUrl(file)
      if (!src) continue
      const title = file.name.replace(/\.[^.]+$/, '') || '照片'
      const collectionId = selectedCollectionId.value || 'default'
      const id = await addPhoto({ name: title, src, collectionId })
      photos.value.push({ id, name: title, src, collectionId, createdAt: Date.now() })
    }
    showNotice(`照片已加入「${selectedCollection.value?.name || '默认合集'}」`)
  } catch (e) {
    error.value = e.message || '照片上传失败'
  } finally {
    uploading.value = false
  }
}

function addCollection() {
  const collection = addAlbumCollection(newCollectionName.value)
  if (!collection) {
    error.value = '合集名称为空或已存在'
    return
  }
  collections.value = listAlbumCollections()
  selectedCollectionId.value = collection.id
  store.albumCollectionId = collection.id
  newCollectionOpen.value = false
  newCollectionName.value = ''
  error.value = ''
  showNotice(`已创建合集「${collection.name}」`)
}

function renameCollection() {
  if (!canManageCollection.value) return
  const name = window.prompt('修改合集名称', selectedCollection.value.name)
  if (name == null) return
  if (!renameAlbumCollection(selectedCollection.value.id, name)) {
    error.value = '合集名称为空、已存在或无法修改'
    return
  }
  collections.value = listAlbumCollections()
  error.value = ''
  showNotice('合集名称已修改')
}

async function deleteCollection() {
  if (!canManageCollection.value) return
  if (!window.confirm(`删除合集「${selectedCollection.value.name}」？合集内照片会移入默认合集。`)) return
  const id = selectedCollection.value.id
  try {
    await removeAlbumCollection(id)
    photos.value = photos.value.map((photo) =>
      photo.collectionId === id ? { ...photo, collectionId: 'default' } : photo
    )
    collections.value = listAlbumCollections()
    selectedCollectionId.value = 'default'
    store.albumCollectionId = 'default'
    idx.value = -1
    showNotice('合集已删除，照片已移入默认合集')
  } catch (e) {
    error.value = e.message || '合集删除失败'
  }
}

function open(i) {
  idx.value = i
}

function close() {
  idx.value = -1
}

function prev() {
  if (!collectionPhotos.value.length) return
  idx.value = (idx.value - 1 + collectionPhotos.value.length) % collectionPhotos.value.length
}

function next() {
  if (!collectionPhotos.value.length) return
  idx.value = (idx.value + 1) % collectionPhotos.value.length
}

async function moveCurrent(event) {
  const photo = current.value
  const targetId = event.target.value
  if (!photo || !targetId) return
  try {
    await setPhotoCollection(photo.id, targetId)
    photos.value = photos.value.map((item) =>
      item.id === photo.id ? { ...item, collectionId: targetId } : item
    )
    close()
    showNotice(`已移动到「${collections.value.find((item) => item.id === targetId)?.name || '合集'}」`)
  } catch (e) {
    error.value = e.message || '照片移动失败'
  }
}

async function removeCurrent() {
  const photo = current.value
  if (!photo) return
  if (!window.confirm('删除这张照片？')) return
  try {
    await deletePhoto(photo.id)
    photos.value = photos.value.filter((item) => item.id !== photo.id)
    if (!collectionPhotos.value.length) close()
    else idx.value = Math.min(idx.value, collectionPhotos.value.length - 1)
  } catch (e) {
    error.value = e.message || '照片删除失败'
  }
}

onMounted(load)
</script>

<template>
  <section class="album">
    <input
      ref="uploadInput"
      class="album-file"
      type="file"
      accept="image/*"
      multiple
      @change="onFiles"
    />

    <div class="album-collection-strip" role="tablist" aria-label="相册合集">
      <button
        v-for="collection in collections"
        :key="collection.id"
        class="album-collection-chip"
        :class="{ active: selectedCollectionId === collection.id }"
        type="button"
        role="tab"
        :aria-selected="selectedCollectionId === collection.id"
        @click="selectCollection(collection.id)"
      >
        <span>{{ collection.name }}</span>
        <small>{{ collectionCount(collection) }}</small>
      </button>
      <button class="album-collection-chip add" type="button" @click="newCollectionOpen = !newCollectionOpen">
        ＋ 新合集
      </button>
    </div>

    <div v-if="newCollectionOpen" class="album-create-row">
      <input v-model="newCollectionName" type="text" maxlength="30" placeholder="输入合集名称" @keydown.enter.prevent="addCollection" />
      <button type="button" @click="addCollection">创建</button>
    </div>

    <div v-if="canManageCollection" class="album-collection-actions">
      <span>{{ selectedCollection.name }}</span>
      <button type="button" @click="renameCollection">重命名</button>
      <button class="danger" type="button" @click="deleteCollection">删除合集</button>
    </div>

    <div class="album-summary-row">
      <div>
        <strong>{{ selectedCollection?.name || '默认合集' }}</strong>
        <small>
          {{ selectedCollectionId === 'carousel' ? '桌面轮播使用此合集 · 上传时固定 1:1 裁剪' : `${collectionPhotos.length} 张照片 · 直接上传，不裁剪` }}
        </small>
      </div>
      <button class="album-upload-button" type="button" :disabled="uploading" @click="pickFiles">
        {{ uploading ? '正在上传' : '上传照片' }}
      </button>
    </div>

    <div class="album-grid">
      <button
        v-for="(photo, index) in collectionPhotos"
        :key="photo.id"
        type="button"
        class="echoes-photo-card photo-btn"
        @click="open(index)"
      >
        <img :src="photo.src" :alt="photo.name" loading="lazy" />
      </button>
      <button class="album-add-tile" type="button" :disabled="uploading" @click="pickFiles">
        <span>{{ uploading ? '…' : '+' }}</span>
        <small>{{ selectedCollectionId === 'carousel' ? '上传 1:1 轮播图' : '直接上传原图' }}</small>
      </button>
    </div>

    <div v-if="!loading && !collectionPhotos.length" class="album-empty">
      {{ selectedCollectionId === 'carousel' ? '轮播合集还没有照片，上传后桌面照片组件会自动轮播。' : '这个合集还没有照片，点击「上传照片」添加。' }}
    </div>
    <div v-if="notice" class="album-notice">{{ notice }}</div>
    <div v-if="error" class="album-error">{{ error }}</div>

    <transition name="fade">
      <div v-if="current" class="lightbox" @click.self="close">
        <div class="echoes-photo-dialog lb-card">
          <button class="lb-close" type="button" aria-label="关闭" @click="close">×</button>
          <img :src="current.src" :alt="current.name" />

          <div class="lb-bar">
            <button class="lb-btn" type="button" aria-label="上一张" @click="prev">‹</button>
            <span class="lb-title">{{ current.name }}</span>
            <button class="lb-btn" type="button" aria-label="下一张" @click="next">›</button>
          </div>

          <label class="lb-collection-field">
            <span>所在合集</span>
            <select :value="current.collectionId || 'default'" @change="moveCurrent">
              <option v-for="collection in collections" :key="collection.id" :value="collection.id">
                {{ collection.name }}
              </option>
            </select>
          </label>

          <button class="lb-delete" type="button" @click="removeCurrent">删除这张照片</button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.album { position: relative; min-width: 0; }
.album-file { display: none; }
.album-collection-strip { display: flex; gap: 7px; overflow-x: auto; padding: 2px 1px 10px; scrollbar-width: none; }
.album-collection-strip::-webkit-scrollbar { display: none; }
.album-collection-chip { flex: none; min-height: 30px; padding: 6px 11px; border: 1px solid var(--theme-border-soft); border-radius: 999px; background: var(--theme-soft); color: var(--theme-text); display: flex; align-items: center; gap: 6px; font-size: 9.5px; font-weight: 750; cursor: pointer; }
.album-collection-chip small { color: var(--theme-muted); font-size: 8px; }
.album-collection-chip.active { border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); }
.album-collection-chip.active small { color: inherit; opacity: .78; }
.album-collection-chip.add { border-style: dashed; color: var(--theme-primary); }
.album-create-row { display: flex; gap: 7px; margin-bottom: 10px; }
.album-create-row input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--theme-border-soft); border-radius: 10px; background: var(--theme-surface); color: var(--theme-text); font: inherit; font-size: 10px; }
.album-collection-actions { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; padding: 8px 10px; border-radius: 11px; background: var(--theme-soft); }
.album-collection-actions span { flex: 1; min-width: 0; color: var(--theme-text-strong); font-size: 10px; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.album-collection-actions button { padding: 5px 8px; border: 0; background: transparent; color: var(--theme-primary); font-size: 9px; font-weight: 750; }
.album-collection-actions button.danger { color: var(--theme-accent-warm); }
.album-summary-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.album-summary-row > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.album-summary-row strong { color: var(--theme-text-strong); font-size: 13px; }
.album-summary-row small { color: var(--theme-muted); font-size: 8.5px; }
.album-upload-button { flex: none; border-color: var(--theme-primary); background: var(--theme-primary); color: var(--theme-inverse); font-size: 9.5px; }
.album-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 5px !important; }
.album-grid .photo-btn { border-radius: 4px; }
.album-grid .photo-btn img { border-radius: 4px; }
.album-add-tile { aspect-ratio: 1; border: 1px dashed var(--theme-border); border-radius: 4px; background: var(--theme-soft); color: var(--theme-primary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.album-add-tile > span { font-size: 27px; line-height: 1; font-weight: 300; }
.album-add-tile small { color: var(--theme-muted); font-size: 8px; }
.album-empty { margin-top: 14px; text-align: center; font-size: 11px; font-weight: 600; color: var(--theme-muted); }
.album-notice { margin-top: 10px; text-align: center; color: var(--theme-primary); font-size: 10px; }
.album-error { margin-top: 10px; text-align: center; font-size: 11px; font-weight: 600; color: var(--theme-accent-warm); }
.lb-card { position: relative; }
.lb-collection-field { display: flex; align-items: center; gap: 9px; margin-top: 9px; padding: 8px 10px; border-radius: 10px; background: var(--theme-soft); }
.lb-collection-field span { flex: none; color: var(--theme-text); font-size: 9.5px; font-weight: 700; }
.lb-collection-field select { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--theme-border-soft); border-radius: 8px; background: var(--theme-surface); color: var(--theme-text); font: inherit; font-size: 9.5px; }
.lb-delete { width: 100%; margin-top: 10px; padding: 9px 12px; border: 1px solid var(--theme-danger-border); border-radius: 12px; background: var(--theme-danger-surface); color: var(--theme-accent-warm); font-size: 11.5px; font-weight: 700; cursor: pointer; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>