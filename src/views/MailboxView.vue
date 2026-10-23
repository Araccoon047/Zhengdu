<script setup>
import { computed, ref } from 'vue'
import { chatState, contactDisplayName, primaryContact } from '../chat'
import { addUserLetter, deleteLetter, lettersForTab, mailboxState, toggleLetterFavorite } from '../mailbox'

const tabs = [
  { id: 'incoming', label: '来信' },
  { id: 'replies', label: '回信' },
  { id: 'sent', label: '寄信' },
  { id: 'favorites', label: '收藏' },
]
const activeTab = ref('incoming')
const composerOpen = ref(false)
const composeKind = ref('sent')
const composeContactId = ref('')
const replyTarget = ref(null)
const draft = ref('')
const status = ref('')
const openedLetter = ref(null)
let statusTimer = null
const contacts = computed(() => chatState.contacts)
const letters = computed(() => lettersForTab(activeTab.value))

function contactName(contactId) {
  return contactDisplayName(chatState.contacts.find((item) => item.id === contactId)) || 'TA'
}
function tabCount(id) {
  return lettersForTab(id).length
}
function openComposer(kind, target = null) {
  composeKind.value = kind
  replyTarget.value = target
  composeContactId.value = target?.contactId || primaryContact()?.id || ''
  draft.value = ''
  composerOpen.value = true
}
function closeComposer() {
  composerOpen.value = false
  replyTarget.value = null
  composeContactId.value = ''
  draft.value = ''
}function sendLetter() {
  const body = draft.value.trim()
  if (!body || !composeContactId.value) return
  const isReply = composeKind.value === 'reply' && replyTarget.value
  const letter = addUserLetter(composeContactId.value, body, {
    kind: isReply ? 'reply' : 'sent',
    replyToId: replyTarget.value?.id || null,
  })
  if (!letter) return
  activeTab.value = isReply ? 'replies' : 'sent'
  closeComposer()
  showStatus(isReply ? '回信已寄出' : '信件已寄出')
}
function reply(letter) {
  openComposer('reply', letter)
}
function favorite(letter) {
  toggleLetterFavorite(letter.id)
}
function remove(letter) {
  if (!window.confirm('删除这封信件？')) return
  deleteLetter(letter.id)
}
function showStatus(text) {
  status.value = text
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { status.value = '' }, 1800)
}
function formatDate(timestamp) {
  const date = new Date(Number(timestamp) || Date.now())
  const now = new Date()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const dayStart = (value) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
  const diff = Math.floor((dayStart(now) - dayStart(date)) / 86400000)
  if (diff <= 0) return `今天 ${time}`
  if (diff === 1) return `昨天 ${time}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
function letterTitle(letter) {
  return letter.direction === 'incoming' ? `来自 ${letter.contactName}` : `寄给 ${letter.contactName}`
}
function excerpt(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > 64 ? `${clean.slice(0, 64)}…` : clean
}
</script><template>
  <section class="mail">
    <header class="mail-hero">
      <div><strong>信箱</strong><span>把想说的话慢慢写下来</span></div>
      <button type="button" @click="openComposer('sent')">写一封信</button>
    </header>
    <nav class="mail-tabs">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
        {{ tab.label }}<small>{{ tabCount(tab.id) }}</small>
      </button>
    </nav>
    <div v-if="status" class="mail-status">{{ status }}</div>

    <section v-if="composerOpen" class="mail-composer">
      <header><strong>{{ composeKind === 'reply' ? '回信' : '寄信' }}</strong><button type="button" aria-label="关闭写信" @click="closeComposer">×</button></header>
      <div v-if="composeKind === 'reply' && replyTarget" class="reply-reference">
        <span>回复 {{ replyTarget.contactName }}</span><p>{{ excerpt(replyTarget.body) }}</p>
      </div>
      <label v-else class="mail-contact-select">
        <span>收信人</span>
        <select v-model="composeContactId"><option v-for="contact in contacts" :key="contact.id" :value="contact.id">{{ contactName(contact.id) }}</option></select>
      </label>
      <textarea v-model="draft" rows="5" maxlength="2000" placeholder="写下这封信的内容…"></textarea>
      <div class="composer-actions">
        <button type="button" @click="closeComposer">取消</button>
        <button class="primary" type="button" :disabled="!draft.trim() || !composeContactId" @click="sendLetter">寄出</button>
      </div>
    </section>    <div class="mail-list">
      <article v-for="letter in letters" :key="letter.id" class="letter" @click="openedLetter = letter">
        <header class="letter-head">
          <span class="letter-avatar" :style="{ background: letter.contactColor || 'var(--theme-primary)' }">
            <img v-if="letter.contactAvatarImage" :src="letter.contactAvatarImage" alt="" />
            <template v-else>{{ letter.contactAvatar || '信' }}</template>
          </span>
          <div class="letter-who"><strong>{{ letterTitle(letter) }}</strong><time>{{ formatDate(letter.createdAt) }}</time></div>
          <span v-if="letter.favorite" class="favorite-mark">已收藏</span>
        </header>
        <p class="letter-preview">{{ excerpt(letter.body) }}</p>
      </article>
      <div v-if="!letters.length" class="mail-empty">
        <strong>{{ activeTab === 'favorites' ? '还没有收藏的信件' : '这里还没有信件' }}</strong>
        <span>{{ activeTab === 'sent' ? '点击右上角“写一封信”开始寄信。' : '新的信件会自动出现在这里。' }}</span>
      </div>
    </div>
    <teleport to="body">
      <div v-if="openedLetter" class="letter-modal-layer" @click.self="openedLetter = null">
        <article class="letter-modal">
          <header class="letter-modal-head">
            <span class="letter-avatar" :style="{ background: openedLetter.contactColor || 'var(--theme-primary)' }">
              <img v-if="openedLetter.contactAvatarImage" :src="openedLetter.contactAvatarImage" alt="" />
              <template v-else>{{ openedLetter.contactAvatar || '信' }}</template>
            </span>
            <div class="letter-who">
              <strong>{{ letterTitle(openedLetter) }}</strong>
              <time>{{ formatDate(openedLetter.createdAt) }}</time>
            </div>
          </header>
          <p class="letter-modal-body">{{ openedLetter.body }}</p>
          <footer class="letter-modal-actions">
            <button type="button" @click="reply(openedLetter)">回信</button>
            <button type="button" @click="favorite(openedLetter)">{{ openedLetter.favorite ? '取消收藏' : '收藏' }}</button>
            <button class="danger" type="button" @click="remove(openedLetter)">删除</button>
            <button type="button" @click="openedLetter = null">关闭</button>
          </footer>
        </article>
      </div>
    </teleport>
  </section>
</template><style scoped>
.mail { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.mail-hero { padding: 16px 18px; border: 1px solid var(--theme-border-soft); border-radius: 18px; background: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mail-hero > div { display: flex; flex-direction: column; gap: 3px; }
.mail-hero strong { color: var(--theme-primary); font-size: 20px; font-weight: 800; }
.mail-hero span { color: var(--theme-muted); font-size: 10.5px; }
.mail-hero button, .composer-actions button, .letter-actions button { border: 1px solid var(--theme-border); border-radius: 10px; background: #fff; color: var(--theme-primary); font-size: 10.5px; font-weight: 700; cursor: pointer; }
.mail-hero button { padding: 9px 13px; }.mail-tabs { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid var(--theme-border-soft); border-radius: 0; background: transparent; overflow: hidden; }
.mail-tabs button { padding: 11px 4px; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--theme-text); font-size: 11px; font-weight: 800; cursor: pointer; }
.mail-tabs button.active { background: transparent; color: var(--theme-primary); }
.mail-tabs small { margin-left: 4px; color: var(--theme-muted); font-size: 9px; }
.mail-status { padding: 8px 10px; border-radius: 10px; background: var(--theme-soft); color: var(--theme-primary); font-size: 10.5px; text-align: center; }
.mail-composer { padding: 13px; border: 1px solid var(--theme-border); border-radius: 16px; background: #fff; display: flex; flex-direction: column; gap: 9px; }
.mail-composer header { display: flex; justify-content: space-between; align-items: center; }
.mail-composer header strong { color: var(--theme-primary); font-size: 13px; }
.mail-composer header button { width: 28px; height: 28px; border: 1px solid var(--theme-border); border-radius: 50%; background: var(--theme-soft); color: var(--theme-primary); cursor: pointer; }.reply-reference { padding: 9px 10px; border-left: 3px solid var(--theme-accent); border-radius: 8px; background: var(--theme-surface); }
.reply-reference span { color: var(--theme-primary); font-size: 10px; font-weight: 800; }
.reply-reference p { margin: 3px 0 0; color: var(--theme-muted); font-size: 10px; line-height: 1.5; }
.mail-contact-select { display: flex; flex-direction: column; gap: 5px; color: var(--theme-text); font-size: 10px; font-weight: 700; }
.mail-contact-select select, .mail-composer textarea { width: 100%; padding: 9px 10px; border: 1px solid var(--theme-border); border-radius: 10px; background: #fff; color: var(--theme-text-strong); font-size: 11px; }
.mail-composer textarea { resize: vertical; line-height: 1.65; }
.composer-actions { display: flex; justify-content: flex-end; gap: 7px; }
.composer-actions button { padding: 8px 12px; }
.composer-actions button.primary { border-color: var(--theme-primary); background: var(--theme-primary); color: #fff; }
.composer-actions button:disabled { opacity: .45; cursor: default; }.mail-list { display: flex; flex-direction: column; gap: 10px; }
.letter { padding: 14px 15px; border: 1px solid var(--theme-border-soft); border-radius: 17px; background: #fff; box-shadow: 0 5px 18px rgba(var(--theme-primary-rgb), .05); }
.letter-head { display: flex; align-items: center; gap: 10px; }
.letter-avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; font-size: 13px; font-weight: 800; }
.letter-avatar img { width: 100%; height: 100%; object-fit: cover; }
.letter-who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.letter-who strong { color: var(--theme-text-strong); font-size: 12px; font-weight: 800; }
.letter-who time { color: var(--theme-muted); font-size: 9.5px; }.favorite-mark { flex: none; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--theme-primary); font-size: 9px; font-weight: 700; }
.letter-body { margin: 11px 0 12px; color: #333; font-size: 12px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.letter-actions { display: flex; gap: 14px; padding-top: 9px; border-top: 1px solid var(--theme-border-soft); }
.letter-actions button { padding: 0; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: var(--theme-primary); font-size: 10px; appearance: none; }
.letter-actions button.danger { color: var(--theme-accent-warm); }
.mail-empty { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--theme-muted); text-align: center; }
.mail-empty strong { color: var(--theme-primary); font-size: 12px; }
.mail-empty span { font-size: 10px; }
@media (max-width: 560px) { .mail-tabs button { font-size: 10px; } .mail-hero { padding: 13px 14px; } }

.letter{cursor:pointer}
.letter-preview{margin:10px 0 0;color:var(--theme-text);font-size:11.5px;line-height:1.65;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.letter-modal-layer{position:fixed;inset:0;z-index:180;display:grid;place-items:center;padding:14px;background:rgba(var(--theme-overlay-rgb),.42);backdrop-filter:blur(8px)}
.letter-modal{width:min(620px,100%);max-height:calc(100dvh - 28px);overflow:auto;padding:18px;border-radius:18px;background:var(--theme-surface);box-shadow:0 20px 52px rgba(var(--theme-overlay-rgb),.28)}
.letter-modal-head{display:flex;align-items:center;gap:10px}
.letter-modal-body{margin:16px 0;color:var(--theme-text);font-size:13px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere}
.letter-modal-actions{display:flex;gap:18px;padding-top:12px;border-top:1px solid var(--theme-border-soft)}
.letter-modal-actions button{padding:0;border:0;background:transparent;box-shadow:none;color:var(--theme-primary);font-size:10.5px;cursor:pointer}
.letter-modal-actions button.danger{color:var(--theme-accent-warm)}</style>