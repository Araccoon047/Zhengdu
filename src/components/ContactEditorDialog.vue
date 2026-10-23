<script setup>
import { ref, watch } from 'vue'
import { cropImage } from '../image-crop'
import { createContact, updateContact } from '../chat'
import { backgroundLayerStyle } from '../background-style'

const props = defineProps({
  open: Boolean,
  contact: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const draft = ref(null)
const error = ref('')

watch(
  () => [props.open, props.contact?.id],
  () => {
    if (!props.open) return
    const source = props.contact || {
      name: 'TA',
      note: 'TA',
      gender: 'unspecified',
      avatar: 'T',
      color: 'var(--theme-primary)',
      avatarImage: '',
      avatarFrame: '',
      chatBackground: '',
      chatBackgroundOpacity: 60,
      momentsCover: '',
      momentsCoverOpacity: 100,
      cards: [],
      stickers: [],
      replyFrequency: 'normal',
      notificationSound: 'default',
      backstory: '',
    }
    draft.value = JSON.parse(JSON.stringify(source))
    error.value = ''
  },
  { immediate: true }
)

async function pickImage(event, key, options) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !draft.value) return
  error.value = ''
  try {
    const result = await cropImage(file, options)
    if (result) draft.value[key] = result
  } catch (e) {
    error.value = e.message || '图片处理失败'
  }
}

function save() {
  if (!draft.value) return
  const patch = {
    ...draft.value,
    note: draft.value.note?.trim() || draft.value.name?.trim() || 'TA',
  }
  if (props.contact?.id) updateContact(props.contact.id, patch)
  else createContact(patch)
  emit('saved')
  emit('close')
}

function close() {
  emit('close')
}
</script>
<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="open && draft" class="dialog-layer" @click.self="close">
        <div class="dialog-card">
          <header class="dialog-head">
            <div>
              <strong>{{ contact ? '编辑联系人' : '新增联系人' }}</strong>
              <span>备注会作为聊天界面的显示名字</span>
            </div>
            <button class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
          </header>

          <div class="avatar-preview-row">
            <span class="editor-avatar" :style="{ background: draft.color }">
              <img v-if="draft.avatarImage" :src="draft.avatarImage" alt="" />
              <template v-else>{{ draft.avatar || 'T' }}</template>
              <img v-if="draft.avatarFrame" class="editor-frame" :src="draft.avatarFrame" alt="" />
            </span>
            <div class="avatar-preview-main">
              <strong>{{ draft.note || draft.name || 'TA' }}</strong>
              <span>{{ draft.name || 'TA' }}</span>
            </div>
          </div>

          <label class="dialog-field">
            <span>名字</span>
            <input v-model="draft.name" type="text" maxlength="30" />
          </label>

          <label class="dialog-field">
            <span>备注（聊天显示名）</span>
            <input v-model="draft.note" type="text" maxlength="20" />
          </label>

          <label class="dialog-field">
            <span>性别</span>
            <select v-model="draft.gender">
              <option value="unspecified">未设定</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>

          <label class="dialog-field">
            <span>头像图片</span>
            <input v-model="draft.avatarImage" type="text" placeholder="图片链接" />
          </label>
          <div class="upload-row">
            <label class="upload-button">
              上传头像
              <input type="file" accept="image/*" @change="pickImage($event, 'avatarImage', { title: '裁剪联系人头像', aspectRatio: 1, lockAspect: true, shape: 'circle', maxSide: 360, quality: 0.86 })" />
            </label>
            <button v-if="draft.avatarImage" class="soft-button" type="button" @click="draft.avatarImage = ''">清除头像</button>
          </div>

          <label class="dialog-field">
            <span>聊天背景</span>
            <input v-model="draft.chatBackground" type="text" placeholder="图片链接" />
          </label>
          <div class="upload-row">
            <label class="upload-button">
              上传聊天背景
              <input type="file" accept="image/*" @change="pickImage($event, 'chatBackground', { title: '裁剪聊天背景', aspectRatio: 4 / 3, shape: 'rect', maxSide: 1600, quality: 0.84 })" />
            </label>
            <button v-if="draft.chatBackground" class="soft-button" type="button" @click="draft.chatBackground = ''">清除</button>
          </div>
          <div v-if="draft.chatBackground" class="bg-preview" :style="backgroundLayerStyle(draft.chatBackground, draft.chatBackgroundOpacity)"></div>
          <label v-if="draft.chatBackground" class="opacity-row">
            <span>不透明度</span>
            <input v-model.number="draft.chatBackgroundOpacity" type="range" min="0" max="100" />
            <strong>{{ draft.chatBackgroundOpacity }}%</strong>
          </label>

          <label class="dialog-field">
            <span>朋友圈封面背景</span>
            <input v-model="draft.momentsCover" type="text" placeholder="图片链接" />
          </label>
          <div class="upload-row">
            <label class="upload-button">
              上传朋友圈封面
              <input type="file" accept="image/*" @change="pickImage($event, 'momentsCover', { title: '裁剪朋友圈封面', aspectRatio: 16 / 9, lockAspect: true, shape: 'rect', maxSide: 1600, quality: 0.84 })" />
            </label>
            <button v-if="draft.momentsCover" class="soft-button" type="button" @click="draft.momentsCover = ''">清除</button>
          </div>
          <div v-if="draft.momentsCover" class="bg-preview" :style="backgroundLayerStyle(draft.momentsCover, 100)"></div>

          <label class="dialog-field">
            <span>头像框</span>
            <input v-model="draft.avatarFrame" type="text" placeholder="图片链接" />
          </label>
          <div class="upload-row">
            <label class="upload-button">
              上传头像框
              <input type="file" accept="image/*" @change="pickImage($event, 'avatarFrame', { title: '裁剪头像框', aspectRatio: 1, lockAspect: true, shape: 'circle', transparent: true, mimeType: 'image/png', maxSide: 480 })" />
            </label>
            <button v-if="draft.avatarFrame" class="soft-button" type="button" @click="draft.avatarFrame = ''">清除头像框</button>
          </div>

          <div v-if="error" class="dialog-error">{{ error }}</div>

          <div class="dialog-actions">
            <button class="dialog-cancel" type="button" @click="close">取消</button>
            <button class="dialog-save" type="button" @click="save">保存</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
<style scoped>
.dialog-layer {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(var(--theme-overlay-rgb), 0.48);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.dialog-card {
  width: min(680px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 16px;
  border: 2px solid var(--theme-border);
  border-radius: 22px;
  background: var(--theme-surface);
  box-shadow: 0 24px 60px rgba(var(--theme-overlay-rgb), 0.3);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.dialog-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialog-head strong {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.dialog-head span,
.avatar-preview-main span {
  color: var(--theme-muted);
  font-size: 10.5px;
  font-weight: 600;
}

.dialog-close {
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 18px;
  cursor: pointer;
}

.avatar-preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-avatar {
  position: relative;
  width: 68px;
  height: 68px;
  flex: none;
  border-radius: 50%;
  overflow: visible;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-size: 22px;
  font-weight: 800;
}

.editor-avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.editor-avatar > .editor-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  width: 112%;
  height: 112%;
  max-width: none;
  object-fit: contain;
  border-radius: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.avatar-preview-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.avatar-preview-main strong {
  color: var(--theme-text-strong);
  font-size: 14px;
}

.dialog-field {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.dialog-field > span {
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
}

.dialog-field input,
.dialog-field select,
.dialog-field textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.dialog-field.backstory {
  align-items: flex-start;
}

.dialog-field textarea {
  resize: vertical;
}

.upload-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.upload-button,
.soft-button {
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.upload-button input {
  display: none;
}

.bg-preview {
  height: 74px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background-color: var(--theme-soft);
  background-size: cover;
  background-position: center;
}
.opacity-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 38px;
  align-items: center;
  gap: 10px;
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
}

.opacity-row input {
  width: 100%;
  accent-color: var(--theme-primary);
}

.opacity-row strong {
  color: var(--theme-primary);
  font-size: 10.5px;
  text-align: right;
}

.related-title {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed var(--theme-border);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.editor-details {
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: var(--theme-soft);
  padding: 8px 10px;
}

.editor-details summary {
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.editor-textarea {
  width: 100%;
  min-height: 160px;
  max-height: 300px;
  margin-top: 8px;
  padding: 9px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 11.5px;
  line-height: 1.55;
  resize: vertical;
}

.editor-textarea.short {
  min-height: 100px;
}

.dialog-error {
  color: var(--theme-accent-warm);
  font-size: 11px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 4px;
}

.dialog-cancel,
.dialog-save {
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.dialog-cancel {
  border: 1px solid var(--theme-border);
  background: #ffffff;
  color: var(--theme-text);
}

.dialog-save {
  border: 0;
  background: var(--theme-primary);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(var(--theme-primary-rgb), 0.28);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .dialog-layer { padding: 8px; }
  .dialog-card { padding: 12px; border-radius: 18px; }
  .dialog-field { grid-template-columns: 100px minmax(0, 1fr); }
}
</style>