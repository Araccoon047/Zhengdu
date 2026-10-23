<script setup>
import { ref, computed } from 'vue'
import { settings } from '../settings'
import { store, go } from '../store'
import { cropImage } from '../image-crop'
import { backgroundLayerStyle } from '../background-style'
import {
  chatState,
  contactDisplayName,
  primaryContact,
  removeContact,
  updateContact,
  applyChatBackgroundToAll,
} from '../chat'
import ContactEditorDialog from '../components/ContactEditorDialog.vue'
import StickerManager from '../components/StickerManager.vue'

const contacts = computed(() => chatState.contacts)
const currentContact = computed(() => primaryContact())
const managerOpen = ref(false)
const editorOpen = ref(false)
const editingContact = ref(null)
const expandedRelated = ref('')
const userEditorOpen = ref(false)
const userAvatarInput = ref(null)
const userAvatarFrameInput = ref(null)
const userDraft = ref({ name: '', bio: '', avatar: '', avatarFrame: '' })
const imageError = ref('')
const backgroundContactId = ref('')
const backgroundDraft = ref({ url: '', opacity: 60 })
const backgroundNotice = ref('')
let backgroundNoticeTimer = null

const relatedItems = [
  { key: 'cards', label: '字卡库', hint: '管理抽卡回复内容' },
  { key: 'stickers', label: '表情包', hint: '管理可用表情' },
  { key: 'chatBackground', label: '聊天背景', hint: '设置单个或全部会话背景' },
  { key: 'frequency', label: '回复频率', hint: '调整自动回复速度' },
  { key: 'sound', label: '消息提示音', hint: '选择来消息时的声音' },
  { key: 'backstory', label: '身世', hint: '编辑角色背景设定' },
]

function openUserEditor() {
  userDraft.value = {
    name: settings.userName || '我',
    bio: settings.userBio || '',
    avatar: settings.anniversaryAvatarB || '',
    avatarFrame: settings.userAvatarFrame || '',
  }
  imageError.value = ''
  userEditorOpen.value = true
}

function pickUserAvatar() {
  userAvatarInput.value?.click()
}

async function onUserAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const result = await cropImage(file, {
      title: '裁剪我的头像',
      aspectRatio: 1,
      lockAspect: true,
      shape: 'circle',
      maxSide: 360,
      quality: 0.86,
    })
    if (result) userDraft.value.avatar = result
  } catch (e) {
    imageError.value = e.message || '头像处理失败'
  }
}

function pickUserAvatarFrame() {
  userAvatarFrameInput.value?.click()
}

async function onUserAvatarFrame(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const result = await cropImage(file, {
      title: '裁剪我的头像框',
      aspectRatio: 1,
      lockAspect: true,
      shape: 'circle',
      transparent: true,
      mimeType: 'image/png',
      maxSide: 480,
    })
    if (result) userDraft.value.avatarFrame = result
  } catch (e) {
    imageError.value = e.message || '头像框处理失败'
  }
}

function saveUser() {
  settings.userName = userDraft.value.name.trim() || '我'
  settings.userBio = userDraft.value.bio.trim()
  settings.anniversaryAvatarB = userDraft.value.avatar
  settings.userAvatarFrame = userDraft.value.avatarFrame
  userEditorOpen.value = false
}

function openManager() {
  managerOpen.value = true
}

function openContactEditor(contact) {
  editingContact.value = contact || null
  editorOpen.value = true
}

function openRelated(key) {
  if (!currentContact.value) {
    openContactEditor(null)
    return
  }
  if (key === 'cards') {
    store.cardLibraryContactId = currentContact.value.id
    go('cardLibrary')
    return
  }
  if (key === 'chatBackground') {
    if (expandedRelated.value !== key) {
      backgroundContactId.value = currentContact.value.id
      loadBackgroundDraft()
    }
    expandedRelated.value = expandedRelated.value === key ? '' : key
    return
  }
  expandedRelated.value = expandedRelated.value === key ? '' : key
}

function showBackgroundNotice(text) {
  backgroundNotice.value = text
  clearTimeout(backgroundNoticeTimer)
  backgroundNoticeTimer = setTimeout(() => (backgroundNotice.value = ''), 1800)
}

function loadBackgroundDraft() {
  const contact = contacts.value.find((item) => item.id === backgroundContactId.value)
  backgroundDraft.value = {
    url: contact?.chatBackground || '',
    opacity: contact?.chatBackgroundOpacity ?? 60,
  }
}

function selectBackgroundContact() {
  loadBackgroundDraft()
}

function clearBackgroundDraft() {
  backgroundDraft.value.url = ''
}

async function pickRelatedBackground(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const result = await cropImage(file, {
      title: '裁剪聊天背景',
      aspectRatio: 16 / 9,
      shape: 'rect',
      maxSide: 1600,
      quality: 0.84,
    })
    if (result) backgroundDraft.value.url = result
  } catch (e) {
    backgroundNotice.value = e.message || '聊天背景处理失败'
  }
}

function saveContactBackground() {
  if (!backgroundContactId.value) return
  updateContact(backgroundContactId.value, {
    chatBackground: backgroundDraft.value.url,
    chatBackgroundOpacity: backgroundDraft.value.opacity,
  })
  showBackgroundNotice('已保存到该联系人')
}

function applyBackgroundToAllChats() {
  if (!backgroundDraft.value.url) return
  applyChatBackgroundToAll(backgroundDraft.value.url, backgroundDraft.value.opacity)
  showBackgroundNotice('已应用到全部聊天背景')
}

function saveStickers(event) {
  if (!currentContact.value) return
  const stickers = event.target.value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
  updateContact(currentContact.value.id, { stickers })
}

function setReplyFrequency(event) {
  if (currentContact.value) {
    updateContact(currentContact.value.id, { replyFrequency: event.target.value })
  }
}

function setNotificationSound(event) {
  if (currentContact.value) {
    updateContact(currentContact.value.id, { notificationSound: event.target.value })
  }
}

function saveBackstory(event) {
  if (currentContact.value) {
    updateContact(currentContact.value.id, { backstory: event.target.value.trim() })
  }
}

function deleteContact(contact) {
  if (!window.confirm(`删除联系人「${contactDisplayName(contact)}」？`)) return
  removeContact(contact.id)
}

function initials(contact) {
  return contact?.avatar || contact?.name?.slice(0, 1) || 'T'
}
</script>
<template>
  <section class="profile">
    <button class="echoes-character-card profile-block" type="button" @click="openUserEditor">
      <span class="profile-avatar user-avatar">
        <img v-if="settings.anniversaryAvatarB" :src="settings.anniversaryAvatarB" alt="" />
        <template v-else>我</template>
        <img v-if="settings.userAvatarFrame" class="avatar-frame" :src="settings.userAvatarFrame" alt="" />
      </span>
      <span class="profile-copy">
        <strong>我</strong>
        <span>点击编辑个人信息</span>
        <small>{{ settings.userName || '我' }}</small>
      </span>
      <span class="chevron">›</span>
    </button>

    <button class="echoes-character-card profile-block" type="button" @click="openManager">
      <span class="profile-avatar" :style="{ background: currentContact?.color || 'var(--theme-primary)' }">
        <img v-if="currentContact?.avatarImage" :src="currentContact.avatarImage" alt="" />
        <template v-else>{{ initials(currentContact) }}</template>
        <img v-if="currentContact?.avatarFrame" class="avatar-frame" :src="currentContact.avatarFrame" alt="" />
      </span>
      <span class="profile-copy">
        <strong>TA</strong>
        <span>点击管理列表</span>
        <small>{{ currentContact ? contactDisplayName(currentContact) : '还没有联系人' }}</small>
      </span>
      <span class="chevron">›</span>
    </button>

    <div class="echoes-character-card related-card">
      <div class="related-head">TA 的相关</div>
      <template v-for="item in relatedItems" :key="item.key">
        <button
          class="related-row"
          type="button"
          @click="openRelated(item.key)"
        >
          <span class="related-main">
            <strong>{{ item.label }}</strong>
            <small>{{ item.hint }}</small>
          </span>
          <span class="chevron" :class="{ open: expandedRelated === item.key }">›</span>
        </button>

        <div v-if="expandedRelated === item.key" class="related-expand">
          <StickerManager v-if="item.key === 'stickers'" />
          <div v-if="item.key === 'chatBackground'" class="chat-bg-editor">
            <label class="related-bg-field">
              <span>联系人</span>
              <select v-model="backgroundContactId" @change="selectBackgroundContact">
                <option v-for="contact in contacts" :key="contact.id" :value="contact.id">
                  {{ contactDisplayName(contact) }}
                </option>
              </select>
            </label>
            <label class="related-bg-field">
              <span>背景图片</span>
              <input v-model="backgroundDraft.url" type="text" placeholder="图片链接" />
            </label>
            <div class="related-bg-actions">
              <label class="related-bg-upload">
                上传背景图片
                <input type="file" accept="image/*" @change="pickRelatedBackground" />
              </label>
              <button v-if="backgroundDraft.url" class="clear" type="button" @click="clearBackgroundDraft">
                清除
              </button>
            </div>
            <div
              v-if="backgroundDraft.url"
              class="related-bg-preview"
              :style="backgroundLayerStyle(backgroundDraft.url, backgroundDraft.opacity)"
            ></div>
            <label v-if="backgroundDraft.url" class="related-bg-opacity">
              <span>不透明度</span>
              <input v-model.number="backgroundDraft.opacity" type="range" min="0" max="100" />
              <strong>{{ backgroundDraft.opacity }}%</strong>
            </label>
            <div class="related-bg-actions">
              <button class="save" type="button" @click="saveContactBackground">
                保存到该联系人
              </button>
              <button
                class="apply-all"
                type="button"
                :disabled="!backgroundDraft.url"
                @click="applyBackgroundToAllChats"
              >
                应用到全部聊天背景
              </button>
            </div>
            <div v-if="backgroundNotice" class="related-bg-notice">{{ backgroundNotice }}</div>
          </div>
          <select
            v-if="item.key === 'frequency'"
            :value="currentContact?.replyFrequency || 'normal'"
            @change="setReplyFrequency"
          >
            <option value="fast">很快</option>
            <option value="normal">正常</option>
            <option value="slow">慢一些</option>
          </select>
          <select
            v-if="item.key === 'sound'"
            :value="currentContact?.notificationSound || 'default'"
            @change="setNotificationSound"
          >
            <option value="default">默认</option>
            <option value="soft">轻柔</option>
            <option value="clear">清脆</option>
            <option value="none">静音</option>
          </select>
          <textarea
            v-if="item.key === 'backstory'"
            :value="currentContact?.backstory || ''"
            rows="4"
            placeholder="写下 TA 的身世设定"
            @change="saveBackstory"
          ></textarea>
        </div>
      </template>
    </div>

    <teleport to="body">
      <transition name="dialog-fade">
        <div v-if="managerOpen" class="modal-layer" @click.self="managerOpen = false">
          <div class="manager-card">
            <header class="manager-head">
              <div>
                <strong>联系人</strong>
                <span>默认联系人为 TA</span>
              </div>
              <button class="modal-close" type="button" aria-label="关闭" @click="managerOpen = false">×</button>
            </header>

            <div v-if="!contacts.length" class="manager-empty">还没有联系人</div>

            <div v-for="contact in contacts" :key="contact.id" class="manager-row">
              <span class="manager-avatar" :style="{ background: contact.color }">
                <img v-if="contact.avatarImage" :src="contact.avatarImage" alt="" />
                <template v-else>{{ initials(contact) }}</template>
                <img v-if="contact.avatarFrame" class="avatar-frame" :src="contact.avatarFrame" alt="" />
              </span>
              <span class="manager-copy">
                <strong>{{ contactDisplayName(contact) }}</strong>
                <small>{{ contact.name }}</small>
              </span>
              <span class="manager-actions">
                <button type="button" @click="openContactEditor(contact)">编辑</button>
                <button class="danger" type="button" @click="deleteContact(contact)">删除</button>
              </span>
            </div>

            <button class="add-contact" type="button" @click="openContactEditor(null)">
              + 新增联系人
            </button>
          </div>
        </div>
      </transition>
    </teleport>

    <teleport to="body">
      <transition name="dialog-fade">
        <div v-if="userEditorOpen" class="modal-layer user-layer" @click.self="userEditorOpen = false">
          <div class="user-card">
            <header class="manager-head">
              <div>
                <strong>编辑个人信息</strong>
                <span>头像与纪念日头像二完全同步</span>
              </div>
              <button class="modal-close" type="button" aria-label="关闭" @click="userEditorOpen = false">×</button>
            </header>

            <div class="user-avatar-row">
              <button class="profile-avatar user-edit-avatar" type="button" @click="pickUserAvatar">
                <img v-if="userDraft.avatar" :src="userDraft.avatar" alt="" />
                <template v-else>+</template>
                <img v-if="userDraft.avatarFrame" class="avatar-frame" :src="userDraft.avatarFrame" alt="" />
              </button>
              <input ref="userAvatarInput" class="hidden-file" type="file" accept="image/*" @change="onUserAvatar" />
              <div class="user-avatar-tip">点击头像上传图片，使用圆形裁剪框</div>
            </div>

            <label class="user-field">
              <span>名字</span>
              <input v-model="userDraft.name" type="text" maxlength="20" />
            </label>
            <label class="user-field">
              <span>简介</span>
              <textarea v-model="userDraft.bio" rows="3" maxlength="80"></textarea>
            </label>
            <label class="user-field">
              <span>头像框</span>
              <input v-model="userDraft.avatarFrame" type="text" placeholder="图片链接" />
            </label>
            <div class="user-frame-actions">
              <button type="button" @click="pickUserAvatarFrame">上传头像框</button>
              <button v-if="userDraft.avatarFrame" class="clear" type="button" @click="userDraft.avatarFrame = ''">清除头像框</button>
              <input ref="userAvatarFrameInput" class="hidden-file" type="file" accept="image/*" @change="onUserAvatarFrame" />
            </div>

            <div v-if="imageError" class="user-error">{{ imageError }}</div>

            <div class="user-actions">
              <button class="cancel" type="button" @click="userEditorOpen = false">取消</button>
              <button class="save" type="button" @click="saveUser">保存</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <ContactEditorDialog
      :open="editorOpen"
      :contact="editingContact"
      @close="editorOpen = false"
    />
  </section>
</template>
<style scoped>
.profile {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-block {
  width: 100%;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  cursor: pointer;
}

.profile-avatar,
.manager-avatar {
  position: relative;
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: visible;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  box-shadow: 0 8px 22px rgba(var(--theme-primary-rgb), 0.24);
}

.user-avatar {
  background: var(--theme-pale);
  color: var(--theme-primary);
}

.profile-avatar > img,
.manager-avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.profile-avatar > .avatar-frame,
.manager-avatar > .avatar-frame {
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
  filter: drop-shadow(0 2px 5px rgba(var(--theme-primary-rgb), 0.14));
}

.profile-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-copy strong {
  color: var(--theme-primary);
  font-size: 16px;
  font-weight: 800;
}

.profile-copy span {
  color: var(--theme-accent);
  font-size: 11px;
  font-weight: 700;
}

.profile-copy small {
  overflow: hidden;
  color: var(--theme-muted);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  flex: none;
  color: var(--theme-muted);
  font-size: 22px;
  font-weight: 300;
}

.related-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.related-head {
  padding-bottom: 8px;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.related-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 2px;
  border: 0;
  border-top: 1px solid var(--theme-border-soft);
  background: none;
  text-align: left;
  cursor: pointer;
}

.related-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.related-main strong {
  color: var(--theme-text-strong);
  font-size: 12px;
  font-weight: 800;
}

.related-main small {
  color: var(--theme-muted);
  font-size: 10px;
  font-weight: 600;
}

.chevron.open {
  transform: rotate(90deg);
}

.related-expand {
  padding: 10px 2px 12px;
  border-top: 1px dashed var(--theme-border-soft);
}

.related-expand textarea,
.related-expand select {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
  resize: vertical;
}

.chat-bg-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.related-bg-field {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.related-bg-field > span,
.related-bg-opacity > span {
  color: var(--theme-text);
  font-size: 10.5px;
  font-weight: 700;
}

.related-bg-field input {
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.related-bg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.related-bg-upload,
.related-bg-actions button {
  padding: 7px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.related-bg-upload input {
  display: none;
}

.related-bg-actions button.clear {
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
  color: var(--theme-accent-warm);
}

.related-bg-actions button.save {
  border: 0;
  background: var(--theme-primary);
  color: #fff;
}

.related-bg-actions button.apply-all {
  background: #ffffff;
}

.related-bg-actions button:disabled {
  opacity: 0.45;
  cursor: default;
}

.related-bg-preview {
  height: 92px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background-color: var(--theme-soft);
  background-size: cover;
  background-position: center;
}

.related-bg-opacity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
}

.related-bg-opacity input {
  width: 100%;
  accent-color: var(--theme-primary);
}

.related-bg-opacity strong {
  color: var(--theme-primary);
  font-size: 10px;
  text-align: right;
}

.related-bg-notice {
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 700;
}

.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 160;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(var(--theme-overlay-rgb), 0.42);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.user-layer {
  z-index: 190;
}

.manager-card,
.user-card {
  width: min(430px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 16px;
  border: 2px solid var(--theme-border);
  border-radius: 20px;
  background: var(--theme-surface);
  box-shadow: 0 24px 60px rgba(var(--theme-overlay-rgb), 0.3);
}

.manager-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.manager-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.manager-head strong {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.manager-head span {
  color: var(--theme-muted);
  font-size: 10.5px;
  font-weight: 600;
}

.modal-close {
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 18px;
  cursor: pointer;
}

.manager-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--theme-border-soft);
}

.manager-avatar {
  width: 48px;
  height: 48px;
  font-size: 16px;
}

.manager-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.manager-copy strong {
  color: var(--theme-text-strong);
  font-size: 13px;
}

.manager-copy small {
  color: var(--theme-muted);
  font-size: 10px;
}

.manager-actions {
  display: flex;
  gap: 5px;
}

.manager-actions button,
.add-contact {
  padding: 6px 9px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.manager-actions button.danger {
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
  color: var(--theme-accent-warm);
}

.add-contact {
  width: 100%;
  margin-top: 10px;
  padding: 9px;
}

.manager-empty {
  padding: 20px 0;
  text-align: center;
  color: var(--theme-muted);
  font-size: 11px;
}
.user-card {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.user-avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-edit-avatar {
  border: 0;
  background: var(--theme-pale);
  color: var(--theme-primary);
  cursor: pointer;
}

.user-avatar-tip {
  flex: 1;
  color: var(--theme-muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.hidden-file {
  display: none;
}

.user-field {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.user-field > span {
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
}

.user-field input,
.user-field textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
  resize: vertical;
}

.user-frame-actions {
  display: flex;
  gap: 8px;
  padding-left: 64px;
}

.user-frame-actions button {
  padding: 7px 11px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.user-frame-actions button.clear {
  border-color: var(--theme-danger-border);
  background: var(--theme-danger-surface);
  color: var(--theme-accent-warm);
}

.user-error {
  color: var(--theme-accent-warm);
  font-size: 11px;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.user-actions button {
  padding: 9px 18px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.user-actions .cancel {
  border: 1px solid var(--theme-border);
  background: #ffffff;
  color: var(--theme-text);
}

.user-actions .save {
  border: 0;
  background: var(--theme-primary);
  color: #ffffff;
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
  .profile-block { padding: 14px; }
  .profile-avatar { width: 56px; height: 56px; }
  .modal-layer { padding: 8px; }
  .manager-card, .user-card { padding: 13px; }
}
</style>