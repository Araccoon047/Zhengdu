<script setup>
import { ref, computed, onMounted } from 'vue'
import { cropImage } from '../image-crop'
import { addPhoto, deletePhoto, listPhotos } from '../album-store'

const photos = ref([])
const idx = ref(-1)
const uploadInput = ref(null)
const uploading = ref(false)
const loading = ref(true)
const error = ref('')

const current = computed(() => (idx.value >= 0 ? photos.value[idx.value] || null : null))

async function load() {
  loading.value = true
  error.value = ''
  try {
    photos.value = await listPhotos()
  } catch (e) {
    error.value = e.message || '相册读取失败'
  } finally {
    loading.value = false
  }
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
      const src = await cropImage(file, {
        title: '裁剪照片',
        aspectRatio: 1,
        shape: 'rect',
        maxSide: 1600,
        quality: 0.84,
      })
      if (!src) continue
      const title = file.name.replace(/\.[^.]+$/, '') || '照片'
      const id = await addPhoto({ name: title, src })
      photos.value.push({ id, name: title, src, createdAt: Date.now() })
    }
  } catch (e) {
    error.value = e.message || '照片上传失败'
  } finally {
    uploading.value = false
  }
}

function open(i) {
  idx.value = i
}

function close() {
  idx.value = -1
}

function prev() {
  if (!photos.value.length) return
  idx.value = (idx.value - 1 + photos.value.length) % photos.value.length
}

function next() {
  if (!photos.value.length) return
  idx.value = (idx.value + 1) % photos.value.length
}

async function removeCurrent() {
  const photo = current.value
  if (!photo) return
  if (!window.confirm('删除这张照片？')) return
  try {
    await deletePhoto(photo.id)
    photos.value = photos.value.filter((item) => item.id !== photo.id)
    if (!photos.value.length) close()
    else idx.value = Math.min(idx.value, photos.value.length - 1)
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

    <div class="album-grid">
      <button
        class="echoes-photo-card photo-btn upload-tile"
        type="button"
        :disabled="uploading"
        @click="pickFiles"
      >
        <span class="upload-plus">{{ uploading ? '…' : '+' }}</span>
        <span class="upload-label">{{ uploading ? '正在上传' : '上传照片' }}</span>
      </button>

      <button
        v-for="(p, i) in photos"
        :key="p.id"
        type="button"
        class="echoes-photo-card photo-btn"
        @click="open(i)"
      >
        <img :src="p.src" :alt="p.name" loading="lazy" />
      </button>
    </div>

    <div v-if="!loading && !photos.length" class="album-empty">
      还没有照片，点击「上传照片」添加。
    </div>
    <div v-if="error" class="album-error">{{ error }}</div>

    <transition name="fade">
      <div v-if="current" class="lightbox" @click.self="close">
        <div class="echoes-photo-dialog lb-card">
          <button class="lb-close" type="button" aria-label="关闭" @click="close">
            ×
          </button>

          <img :src="current.src" :alt="current.name" />

          <div class="lb-bar">
            <button class="lb-btn" type="button" aria-label="上一张" @click="prev">
              ‹
            </button>
            <span class="lb-title">{{ current.name }}</span>
            <button class="lb-btn" type="button" aria-label="下一张" @click="next">
              ›
            </button>
          </div>

          <button class="lb-delete" type="button" @click="removeCurrent">
            删除这张照片
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.album {
  position: relative;
}

.album-file {
  display: none;
}

.upload-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 2px dashed var(--theme-border) !important;
  background: var(--theme-surface) !important;
  color: var(--theme-accent);
}

.upload-tile:disabled {
  cursor: default;
  opacity: 0.72;
}

.upload-plus {
  font-size: 32px;
  font-weight: 300;
  line-height: 1;
}

.upload-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.album-empty {
  margin-top: 14px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-muted);
}

.album-error {
  margin-top: 10px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-accent-warm);
}

.lb-card {
  position: relative;
}

.lb-delete {
  width: 100%;
  margin-top: 10px;
  padding: 9px 12px;
  border: 1px solid var(--theme-danger-border);
  border-radius: 12px;
  background: var(--theme-danger-surface);
  color: var(--theme-accent-warm);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
