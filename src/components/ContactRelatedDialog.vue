<script setup>
import { ref, watch } from 'vue'
import { settings } from '../settings'
import { contactDisplayName, updateContact } from '../chat'

const props = defineProps({
  open: Boolean,
  contact: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const cardsText = ref('')
const stickersText = ref('')
const draft = ref(null)

watch(
  () => [props.open, props.contact?.id],
  () => {
    if (!props.open || !props.contact) return
    const source = props.contact
    draft.value = {
      replyFrequency: source.replyFrequency || 'normal',
      notificationSound: source.notificationSound || 'default',
      backstory: source.backstory || '',
    }
    cardsText.value = (source.cards?.length ? source.cards : settings.replyCards).join('\n')
    stickersText.value = (source.stickers || []).join('\n')
  },
  { immediate: true }
)

function lines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function save() {
  if (!props.contact || !draft.value) return
  updateContact(props.contact.id, {
    cards: lines(cardsText.value),
    stickers: lines(stickersText.value),
    replyFrequency: draft.value.replyFrequency,
    notificationSound: draft.value.notificationSound,
    backstory: draft.value.backstory,
  })
  settings.maxReplyCards = Number(settings.maxReplyCards) || 1
  emit('close')
}
</script>
<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="open && draft && contact" class="related-layer" @click.self="$emit('close')">
        <div class="related-dialog">
          <header class="related-head">
            <div>
              <strong>TA 的相关</strong>
              <span>{{ contactDisplayName(contact) }}</span>
            </div>
            <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
          </header>

          <details class="related-details">
            <summary>字卡库</summary>
            <textarea v-model="cardsText" spellcheck="false"></textarea>
          </details>

          <details class="related-details">
            <summary>表情包</summary>
            <textarea v-model="stickersText" class="short" spellcheck="false" placeholder="每行一个表情或图片链接"></textarea>
          </details>

          <label class="related-field">
            <span>回复频率</span>
            <select v-model="draft.replyFrequency">
              <option value="fast">很快</option>
              <option value="normal">正常</option>
              <option value="slow">慢一些</option>
            </select>
          </label>

          <label class="related-field">
            <span>一次最多回复</span>
            <select v-model.number="settings.maxReplyCards">
              <option :value="1">1 条</option>
              <option :value="2">最多 2 条</option>
              <option :value="3">最多 3 条</option>
            </select>
          </label>

          <label class="related-field">
            <span>消息提示音</span>
            <select v-model="draft.notificationSound">
              <option value="default">默认</option>
              <option value="soft">轻柔</option>
              <option value="clear">清脆</option>
              <option value="none">静音</option>
            </select>
          </label>

          <label class="related-field backstory">
            <span>身世</span>
            <textarea v-model="draft.backstory" rows="5" placeholder="写下 TA 的身世设定"></textarea>
          </label>

          <div class="related-actions">
            <button class="cancel" type="button" @click="$emit('close')">取消</button>
            <button class="save" type="button" @click="save">保存</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
<style scoped>
.related-layer {
  position: fixed;
  inset: 0;
  z-index: 190;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(var(--theme-overlay-rgb), 0.45);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.related-dialog {
  width: min(640px, 100%);
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 16px;
  border: 2px solid var(--theme-border);
  border-radius: 20px;
  background: var(--theme-surface);
  box-shadow: 0 24px 60px rgba(var(--theme-overlay-rgb), 0.3);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.related-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.related-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.related-head strong {
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.related-head span {
  color: var(--theme-muted);
  font-size: 10.5px;
  font-weight: 600;
}

.related-head button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 18px;
  cursor: pointer;
}

.related-field {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.related-field.backstory {
  align-items: flex-start;
}

.related-field > span {
  color: var(--theme-text);
  font-size: 11px;
  font-weight: 700;
}

.related-field select,
.related-field textarea,
.related-details textarea {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.related-details {
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: var(--theme-soft);
  padding: 8px 10px;
}

.related-details summary {
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.related-details textarea {
  min-height: 170px;
  max-height: 320px;
  margin-top: 8px;
  resize: vertical;
}

.related-details textarea.short {
  min-height: 100px;
}

.related-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.related-actions button {
  padding: 9px 18px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.related-actions .cancel {
  border: 1px solid var(--theme-border);
  background: #ffffff;
  color: var(--theme-text);
}

.related-actions .save {
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
  .related-layer { padding: 8px; }
  .related-dialog { padding: 12px; }
  .related-field { grid-template-columns: 92px minmax(0, 1fr); }
}
</style>