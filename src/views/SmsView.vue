<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { settings } from '../settings'
import { go, store } from '../store'
import { formatWishDate, formatWishPrice, requestWishOrderFocus } from '../wishlist'
import { chatBackgroundStyle as makeChatBackgroundStyle } from '../background-style'
import { cropImage } from '../image-crop'
import { imageFileToDataUrl } from '../image-utils'
import { avatarFrameStyle } from '../avatar-frame-style'
import StickerPickerDialog from '../components/StickerPickerDialog.vue'
import ActionGlyph from '../components/ActionGlyph.vue'
import LineGlyph from '../components/LineGlyph.vue'
import SafeImage from '../components/SafeImage.vue'
import { CHAT_TOOL_CATALOG, isChatToolEnabled } from '../chat-tools'
import { isAiScopeEnabled, requestAiInterpretation } from '../ai'
import { languageLabel, translateText } from '../translation'
import {
  DEFAULT_NUDGE_TEXTS,
  allNudgeSymbols,
  allNudgeTexts,
  outgoingNudgeText,
} from '../nudge'
import {
  chatState,
  closeChat,
  contactById,
  contactDisplayName,
  createGroup,
  deleteMessage,
  forwardMessages,
  groupById,
  groupMembers,
  giftNameOptionsForContact,
  markRead,
  openGroup,
  recallMessage,
  openChat as openChatById,
  refreshUnread,
  sendOutgoing,
  sendIncomingText,
  startOutgoingCall,
  sendText,
  setConversationMuted,
  setConversationPinned,
  triggerProactiveForActiveChat,
  unreadOf,
  updateGroup,
  sendGroupMemberMessage,
  startGroupCall,
  joinGroupCall,
  leaveGroupCall,
  endGroupCall,
  deleteGroup,
} from '../chat'

const GIFT_CAT_COLOR = {
  default: '#f2f2f5',
  custom: '#e7f1ff',
  flower: '#f5d9df',
  food: '#f3e2c9',
  daily: '#d9ece8',
  virtual: '#e5dcf2',
}
const contacts = computed(() => chatState.contacts)
const groups = computed(() => chatState.groups)
const activeId = computed({
  get: () => chatState.activeId,
  set: (value) => {
    if (value) openChatById(value)
    else closeChat()
  },
})
const activeGroup = computed(() => groupById(chatState.activeGroupId))
const active = computed(() => activeGroup.value || contactById(activeId.value))
const activeIsGroup = computed(() => Boolean(activeGroup.value))
const chatMessageGap = computed(() => {
  const skin = settings.chatBubbleSkin
  if (skin === 'xiemao' || skin === 'xiemao-reverse') return '20px'
  if (skin === 'shuise') return '25px'
  if (skin === 'baitu') return '23px'
  return '15px'
})
const selectingCards = computed(() => {
  if (!active.value) return false
  return activeIsGroup.value
    ? chatState.selectingGroupId === active.value.id
    : chatState.selectingContactId === active.value.id
})
const MESSAGE_PAGE_SIZE = 80
const draft = ref('')
const chatRef = ref(null)
const chatField = ref(null)
const visibleMessageLimit = ref(MESSAGE_PAGE_SIZE)
const visibleMessages = computed(() => {
  const messages = active.value?.messages || []
  const limit = visibleMessageLimit.value
  return messages.length > limit ? messages.slice(-limit) : messages
})
const hiddenMessageCount = computed(() => Math.max(0, (active.value?.messages?.length || 0) - visibleMessageLimit.value))
const visibleMessageTimeIds = computed(() => {
  const visibleIds = new Set()
  let anchorDate = null
  for (const message of visibleMessages.value) {
    const date = messageDate(message)
    const crossedDay = anchorDate && calendarDayNumber(date) !== calendarDayNumber(anchorDate)
    const elapsed = anchorDate ? date.getTime() - anchorDate.getTime() : 0
    if (!anchorDate || crossedDay || elapsed < 0 || elapsed >= 5 * 60 * 1000) {
      visibleIds.add(message.id)
      anchorDate = date
    }
  }
  return visibleIds
})

const menuOpen = ref(false)
const stickerOpen = ref(false)
const messageMenuOpen = ref(false)
const messageTarget = ref(null)
const quoteTarget = ref(null)
const multiSelectMode = ref(false)
const selectedMessageIds = ref([])
const inlineActionMode = ref('actions')
const forwardMessagesList = ref([])
const infoTitle = ref('')
const infoText = ref('')
const infoLoading = ref(false)
const chatNotice = ref('')
const sheet = ref(null) // 'transfer' | 'location' | 'gift'
const amount = ref('')
const note = ref('')
const placeName = ref('')
const giftName = ref('')
const groupGiftRecipientId = ref('')
const groupTransferRecipientId = ref('')
const giftPrice = ref('')
const groupMembersForTools = computed(() => activeIsGroup.value ? groupMembers(active.value) : [])
const groupGiftRecipient = computed(() => groupMembersForTools.value.find((member) => member.id === groupGiftRecipientId.value) || groupMembersForTools.value[0] || null)
const groupTransferRecipient = computed(() => groupMembersForTools.value.find((member) => member.id === groupTransferRecipientId.value) || groupMembersForTools.value[0] || null)
const giftNameOptions = computed(() => giftNameOptionsForContact(activeIsGroup.value ? groupGiftRecipient.value : active.value))
const photoInput = ref(null)
const nudgeOpen = ref(false)
const nudgeText = ref(DEFAULT_NUDGE_TEXTS[0])
const nudgeSymbol = ref('✦')
const nudgeGroupContactId = ref('')
const customNudgeSymbolInput = ref('')
const customNudgeTextInput = ref('')
const photoPreviewSrc = ref('')
const batchSendMode = ref(false)
const stagedOutgoingMessages = ref([])
const batchSending = ref(false)
const activeChatTool = ref('')
const decisionQuestion = ref('')
const decisionOptions = ref('')
const decisionCount = ref(settings.chatTools?.decisionDefaultCount || 1)
const decisionDelay = ref(settings.chatTools?.decisionDefaultSeconds || 2)
const decisionThinking = ref(false)
const decisionResult = ref('')
const decisionGroupContactIds = ref([])
const searchKeyword = ref('')
const searchFrom = ref('')
const searchTo = ref('')
const toolHistory = ref(loadToolHistory())
let decisionTimer = null

const WORKBENCH_TOOL_IDS = new Set([
  'decision',
  'search',
])

const toolDefinitions = computed(() => Object.fromEntries(
  CHAT_TOOL_CATALOG
    .filter((tool) => WORKBENCH_TOOL_IDS.has(tool.id) && isChatToolEnabled(settings.chatTools, tool.id))
    .map((tool) => [tool.id, {
      ...tool,
      hint: tool.hint || tool.description,
    }])
))

function runChatToolAction(id) {
  if (id === 'batchSend') toggleBatchSendMode()
  else if (id === 'photo') pickPhotos()
  else if (id === 'location') openSheet('location')
  else if (id === 'gift') openSheet('gift')
  else if (id === 'nudge') openNudgeCard()
  else if (id === 'voiceCall') startCall('voice')
  else if (id === 'videoCall') startCall('video')
  else if (id === 'transfer') openSheet('transfer')
  else openChatTool(id)
}

const chatToolItems = computed(() => CHAT_TOOL_CATALOG
  .filter((tool) => isChatToolEnabled(settings.chatTools, tool.id))
  .map((tool) => ({
    id: tool.id,
    label: tool.label,
    icon: tool.icon,
    active: tool.id === 'batchSend' ? batchSendMode.value : false,
    action: () => runChatToolAction(tool.id),
  })))
const chatToolPages = computed(() => {
  const items = chatToolItems.value
  return Array.from({ length: Math.ceil(items.length / 8) }, (_, index) => items.slice(index * 8, index * 8 + 8))
})
const activeTool = computed(() => toolDefinitions.value[activeChatTool.value] || null)
const chatSearchResults = computed(() => {
  const messages = active.value?.messages || []
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword && !searchFrom.value && !searchTo.value) return []
  return messages.filter((message) => {
    const date = localMessageDate(message)
    if (searchFrom.value && date < searchFrom.value) return false
    if (searchTo.value && date > searchTo.value) return false
    return !keyword || messageText(message).toLowerCase().includes(keyword)
  }).slice(-(settings.chatTools?.searchResultLimit || 80)).reverse()
})

let quoteJumpTimer = null
let stagedSequence = 0
let composerComposing = false

const quickAmounts = [520, 1314, 5200, 52000]

const messageActionItems = computed(() => {
  const items = [
    { key: 'copy', label: '复制', icon: 'copy' },
    { key: 'translate', label: '翻译', icon: 'translate' },
    { key: 'quote', label: '引用', icon: 'quote' },
    { key: 'forward', label: '转发', icon: 'forward' },
    { key: 'multi', label: '多选', icon: 'multiselect' },
    { key: 'interpret', label: '解读', icon: 'interpret' },
  ]
  if (messageTarget.value?.from === 'me') {
    items.push({ key: 'recall', label: '撤回', icon: 'recall' })
  }
  items.push({ key: 'delete', label: '删除', icon: 'delete' })
  return items
})

const groupCreateOpen = ref(false)
const groupName = ref('')
const selectedMemberIds = ref([])
const optionsOpen = ref(false)
const optionsTarget = ref(null)
const groupDraft = ref(null)
const groupCallPickerOpen = ref(false)
const groupCallPanelOpen = ref(false)
const groupCallKind = ref('voice')
const groupCallSelectedIds = ref([])
const activeGroupCall = computed(() => (
  chatState.call?.groupId && activeGroup.value?.id === chatState.call.groupId ? chatState.call : null
))
const groupCallParticipantCount = computed(() => (
  (activeGroupCall.value?.joinedMemberIds?.length || 0) + (activeGroupCall.value?.userJoined ? 1 : 0)
))
const groupCallTitle = computed(() => `${(activeGroupCall.value?.kind || groupCallKind.value) === 'video' ? '视频' : '语音'}群通话`)

const selectedMessages = computed(() => {
  if (!active.value) return []
  const ids = new Set(selectedMessageIds.value)
  return active.value.messages.filter((message) => ids.has(message.id))
})

const forwardCandidates = computed(() => {
  const currentKind = activeIsGroup.value ? 'group' : 'contact'
  const currentId = active.value?.id
  return conversations.value.filter(
    (conversation) => !(conversation.kind === currentKind && conversation.id === currentId)
  )
})

const conversations = computed(() => {
  const direct = contacts.value.map((contact) => ({
    kind: 'contact',
    id: contact.id,
    item: contact,
    last: contact.messages[contact.messages.length - 1] || null,
    pinned: Boolean(contact.pinned),
    muted: Boolean(contact.muted),
  }))
  const groupList = groups.value.map((group) => ({
    kind: 'group',
    id: group.id,
    item: group,
    last: group.messages[group.messages.length - 1] || null,
    pinned: Boolean(group.pinned),
    muted: Boolean(group.muted),
  }))
  return [...direct, ...groupList].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  )
})


function lastMsg(c) {
  return c.messages[c.messages.length - 1] || { text: '', time: '', type: 'text' }
}
function messageDate(message) {
  const stamp = Number(message?.createdAt)
  if (Number.isFinite(stamp) && stamp > 0) return new Date(stamp)
  const now = new Date()
  const [hour, minute] = String(message?.time || '').split(':').map(Number)
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number.isFinite(hour) ? hour : now.getHours(),
    Number.isFinite(minute) ? minute : now.getMinutes()
  )
}

function calendarDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function formatConversationTime(message) {
  const date = messageDate(message)
  const now = new Date()
  const time = message?.time ||
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const dayDiff = calendarDayNumber(now) - calendarDayNumber(date)
  if (dayDiff <= 0) return time
  if (dayDiff === 1) return `昨天 ${time}`
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

function previewOf(c) {
  const m = lastMsg(c)
  if (m.type === 'transfer') return `[转账] ¥${m.amount}`
  if (m.type === 'redpacket') return `[红包] ¥${m.amount}`
  if (m.type === 'photo') return '[图片]'
  if (m.type === 'location') return '[位置]'
  if (m.type === 'file') return '[文件]'
  if (m.type === 'gift') return '[礼物]'
  if (m.type === 'wishOrder') return `[许愿订单] ${m.wishOrder?.no || ''}`.trim()
  if (m.type === 'call') return m.text
  if (m.type === 'sticker') return '[表情包]'
  if (m.type === 'voice') return m.text || '[语音]'
  return m.text
}

function avatarImageOf(contact) {
  return contact?.avatarImage || ''
}

function avatarFrameSkinOf(contact) {
  return String(contact?.avatarFrameSkin || settings.contactAvatarFrameSkin || 'none')
}

function messageAvatarFrameSkin(message) {
  if (!message) return 'none'
  if (message.from === 'me') return settings.userAvatarFrameSkin || 'none'
  if (activeIsGroup.value) return avatarFrameSkinOf(contactById(message.senderId))
  return avatarFrameSkinOf(active.value)
}

function meAvatarImage() {
  return settings.anniversaryAvatarB || ''
}

function nameOf(contact) {
  return contactDisplayName(contact)
}

const chatBackgroundStyle = computed(() =>
  makeChatBackgroundStyle(
    active.value?.chatBackground,
    active.value?.chatBackgroundOpacity
  )
)

function scrollBottom() {
  nextTick(() => {
    const el = chatRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function loadOlderMessages() {
  const el = chatRef.value
  const previousHeight = el?.scrollHeight || 0
  const previousTop = el?.scrollTop || 0
  const total = active.value?.messages?.length || 0
  visibleMessageLimit.value = Math.min(total, visibleMessageLimit.value + MESSAGE_PAGE_SIZE)
  nextTick(() => {
    if (!chatRef.value) return
    chatRef.value.scrollTop = chatRef.value.scrollHeight - previousHeight + previousTop
  })
}
const NUDGE_TEXTS_PER_PAGE = 6
const nudgeTextPage = ref(0)
const nudgeTextPageCount = computed(() => Math.max(1, Math.ceil(nudgeTexts.value.length / NUDGE_TEXTS_PER_PAGE)))
const visibleNudgeTexts = computed(() => {
  const start = nudgeTextPage.value * NUDGE_TEXTS_PER_PAGE
  return nudgeTexts.value.slice(start, start + NUDGE_TEXTS_PER_PAGE)
})
function changeNudgeTextPage(offset) {
  nudgeTextPage.value = (nudgeTextPage.value + offset + nudgeTextPageCount.value) % nudgeTextPageCount.value
}

const nudgeTexts = computed(() => allNudgeTexts())
const nudgeSymbols = computed(() => allNudgeSymbols())
const nudgeTargetContact = computed(() => groupMembersForTools.value.find((member) => member.id === nudgeGroupContactId.value) || groupMembersForTools.value[0] || null)
const nudgeTargetName = computed(() => activeIsGroup.value ? (nudgeTargetContact.value ? nameOf(nudgeTargetContact.value) : '大家') : nameOf(active.value))
const nudgePreview = computed(() =>
  outgoingNudgeText(nudgeText.value, nudgeSymbol.value, nudgeTargetName.value)
)
function wishMessageStatusLabel(status) {
  return {
    pending: '待接受',
    accepted: '待完成',
    completed: '已完成',
    rejected: '已拒绝',
  }[status] || status
}
function wishMessageSummary(message) {
  return (message.wishOrder?.items || []).map((item) => `${item.name} × ${item.qty}`).join('；')
}
function openWishOrderMessage(message) {
  const id = String(message?.wishOrder?.id || '')
  if (!id) return
  requestWishOrderFocus(id)
  go('wishlist')
}

const chatPlaceholder = computed(() => {
  if (batchSendMode.value) {
    return settings.enterForNewline
      ? '输入要预存的消息…（Ctrl + Enter 预存）'
      : '输入要预存的消息…（Enter 预存）'
  }
  return settings.enterForNewline
    ? '说点什么…（Enter 换行，Ctrl + Enter 发送）'
    : '说点什么…（Enter 发送）'
})

function resizeComposer() {
  const field = chatField.value
  if (!field) return
  field.style.height = 'auto'
  field.style.height = `${Math.min(104, Math.max(40, field.scrollHeight))}px`
}

function handleComposerEnter(event) {
  if (event.isComposing || composerComposing) return
  if (settings.enterForNewline) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      send()
    }
    return
  }
  event.preventDefault()
  send()
}

function handleComposerCompositionStart() {
  composerComposing = true
}

function handleComposerCompositionEnd() {
  composerComposing = false
}
function outgoingPreview(payload) {
  if (!payload) return ''
  if (payload.type === 'photo') return payload.text ? `[照片] ${payload.text}` : '[照片]'
  if (payload.type === 'sticker') return '[表情包]'
  if (payload.type === 'transfer') return `[转账] ¥${payload.amount} ${payload.text || ''}`.trim()
  if (payload.type === 'redpacket') return `[红包] ¥${payload.amount} ${payload.text || ''}`.trim()
  if (payload.type === 'location') return `[位置] ${payload.text || ''}`.trim()
  if (payload.type === 'gift') return `[礼物] ${payload.text || ''}`.trim()
  if (payload.type === 'nudge') return payload.text || '[拍一拍]'
  if (payload.type === 'voice') return payload.text || '[语音]'
  return payload.text || '[消息]'
}

function stageOutgoing(payload) {
  stagedOutgoingMessages.value.push({
    id: `staged-${Date.now()}-${++stagedSequence}`,
    payload: { ...payload },
  })
}

function dispatchOutgoing(payload) {
  if (batchSendMode.value) {
    if (!batchSending.value) stageOutgoing(payload)
    return true
  }
  sendOutgoing(payload)
  scrollBottom()
  return false
}

function toggleBatchSendMode() {
  if (batchSending.value) return
  menuOpen.value = false
  if (batchSendMode.value) {
    batchSendMode.value = false
    stagedOutgoingMessages.value = []
    return
  }
  batchSendMode.value = true
}

function removeStagedMessage(id) {
  if (batchSending.value) return
  stagedOutgoingMessages.value = stagedOutgoingMessages.value.filter((item) => item.id !== id)
}

function clearStagedMessages() {
  if (batchSending.value) return
  stagedOutgoingMessages.value = []
}

function sendStagedMessages() {
  if (
    batchSending.value ||
    !stagedOutgoingMessages.value.length ||
    !active.value
  ) {
    return
  }

  const targetKind = activeIsGroup.value ? 'group' : 'contact'
  const targetId = active.value.id
  const items = stagedOutgoingMessages.value.map((item) => ({
    ...item,
    payload: { ...item.payload },
  }))

  batchSending.value = true
  items.forEach((item, index) => {
    setTimeout(() => {
      sendOutgoing(item.payload, {
        targetKind,
        targetId,
        scheduleReply: index === items.length - 1,
      })
      scrollBottom()
      if (index === items.length - 1) {
        stagedOutgoingMessages.value = []
        batchSending.value = false
        batchSendMode.value = false
      }
    }, index * 420)
  })
}

function openPhotoPreview(message) {
  if (!message?.src) return
  if (multiSelectMode.value) {
    toggleSelected(message.id)
    return
  }
  photoPreviewSrc.value = message.src
}

function openChat(c) {
  openChatById(c.id)
  menuOpen.value = false
  sheet.value = null
  scrollBottom()
}

function openGroupChat(group) {
  openGroup(group.id)
  menuOpen.value = false
  sheet.value = null
  scrollBottom()
}

function openConversation(conversation) {
  if (conversation.kind === 'group') openGroupChat(conversation.item)
  else openChat(conversation.item)
}

function backToConversationList() {
  closeChat()
  menuOpen.value = false
  sheet.value = null
  quoteTarget.value = null
  cancelMultiSelect()
}

function openActiveOptions() {
  if (!active.value) return
  openOptions({
    kind: activeIsGroup.value ? 'group' : 'contact',
    id: active.value.id,
    item: active.value,
    pinned: Boolean(active.value.pinned),
    muted: Boolean(active.value.muted),
  })
}

function toggleMember(id) {
  selectedMemberIds.value = selectedMemberIds.value.includes(id)
    ? selectedMemberIds.value.filter((item) => item !== id)
    : [...selectedMemberIds.value, id]
}

function createGroupChat() {
  if (selectedMemberIds.value.length < 2) {
    window.alert('至少选择两个联系人')
    return
  }
  const group = createGroup(groupName.value, selectedMemberIds.value)
  if (!group) return
  groupCreateOpen.value = false
  groupName.value = ''
  selectedMemberIds.value = []
  openGroupChat(group)
}

function flashChatNotice(message) {
  chatNotice.value = message
  window.setTimeout(() => {
    if (chatNotice.value === message) chatNotice.value = ''
  }, 1600)
}

function openGroupCallPicker(kind) {
  menuOpen.value = false
  if (!activeIsGroup.value || !active.value) return
  if (chatState.call) {
    flashChatNotice('当前已有正在进行的通话')
    return
  }
  groupCallKind.value = kind === 'video' ? 'video' : 'voice'
  groupCallSelectedIds.value = groupMembersForTools.value.map((member) => member.id)
  groupCallPickerOpen.value = true
}

function toggleGroupCallMember(id) {
  groupCallSelectedIds.value = groupCallSelectedIds.value.includes(id)
    ? groupCallSelectedIds.value.filter((item) => item !== id)
    : [...groupCallSelectedIds.value, id]
}

function confirmGroupCall() {
  if (!activeIsGroup.value || !active.value) return
  if (!groupCallSelectedIds.value.length) {
    flashChatNotice('至少选择一位群成员')
    return
  }
  const started = startGroupCall(active.value.id, groupCallSelectedIds.value, groupCallKind.value)
  if (!started) {
    flashChatNotice('通话发起失败，请稍后重试')
    return
  }
  groupCallPickerOpen.value = false
}

function openGroupCallPanel() {
  if (!activeGroupCall.value) return
  groupCallPanelOpen.value = true
}

function joinActiveGroupCall() {
  if (joinGroupCall()) groupCallPanelOpen.value = true
}

function leaveActiveGroupCall() {
  leaveGroupCall()
  if (!chatState.call) groupCallPanelOpen.value = false
}

function endActiveGroupCall() {
  endGroupCall()
  groupCallPanelOpen.value = false
}


function openOptions(conversation) {
  optionsTarget.value = conversation
  if (conversation.kind === 'group') {
    const group = conversation.item
    groupDraft.value = {
      name: group.name,
      chatBackground: group.chatBackground || '',
      chatBackgroundOpacity: group.chatBackgroundOpacity ?? 60,
      avatarImage: group.avatarImage || '',
      memberIds: [...(group.memberIds || [])],
    }
  } else {
    groupDraft.value = null
  }
  optionsOpen.value = true
}

function togglePinned() {
  const target = optionsTarget.value
  if (!target) return
  const ok = setConversationPinned(target.kind, target.id, !target.pinned)
  if (!ok) {
    window.alert('最多只能置顶 10 个聊天会话')
    return
  }
  target.pinned = !target.pinned
}

function toggleMuted() {
  const target = optionsTarget.value
  if (!target) return
  setConversationMuted(target.kind, target.id, !target.muted)
  target.muted = !target.muted
}

async function pickGroupBackground(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !groupDraft.value) return
  const result = await cropImage(file, {
    title: '裁剪群聊背景',
    aspectRatio: 9 / 16,
    lockAspect: true,
    shape: 'rect',
    maxSide: 1600,
    quality: 0.84,
  })
  if (result) groupDraft.value.chatBackground = result
}

async function pickGroupAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !groupDraft.value) return
  const result = await cropImage(file, {
    title: '裁剪群头像',
    aspectRatio: 1,
    lockAspect: true,
    shape: 'circle',
    maxSide: 512,
    quality: 0.88,
  })
  if (result) groupDraft.value.avatarImage = result
}

function groupBgStyle() {
  const value = groupDraft.value?.chatBackground
  if (!value) return null
  return {
    backgroundImage: `url("${value.replace(/"/g, '%22')}")`,
    opacity: (groupDraft.value.chatBackgroundOpacity ?? 60) / 100,
  }
}

function toggleGroupDraftMember(contactId) {
  if (!groupDraft.value) return
  const ids = new Set(groupDraft.value.memberIds || [])
  if (ids.has(contactId)) ids.delete(contactId)
  else ids.add(contactId)
  groupDraft.value.memberIds = [...ids]
}

function removeSelectedGroup() {
  const target = optionsTarget.value
  if (!target || target.kind !== 'group') return
  if (!window.confirm(`确定解散并删除群聊“${target.item?.name || '群聊'}”吗？聊天记录也会一并删除。`)) return
  deleteGroup(target.id)
  optionsOpen.value = false
  if (activeIsGroup.value && active.value?.id === target.id) closeChat()
}

function saveGroupOptions() {
  const target = optionsTarget.value
  if (!target || target.kind !== 'group' || !groupDraft.value) return
  const memberIds = [...new Set(groupDraft.value.memberIds || [])].filter((id) => contactById(id))
  if (memberIds.length < 2) {
    window.alert('群聊至少需要两位联系人')
    return
  }
  updateGroup(target.id, {
    name: groupDraft.value.name.trim() || '群聊',
    chatBackground: groupDraft.value.chatBackground,
    chatBackgroundOpacity: groupDraft.value.chatBackgroundOpacity,
    avatarImage: groupDraft.value.avatarImage || '',
    memberIds,
  })
  target.item.name = groupDraft.value.name.trim() || '群聊'
  optionsOpen.value = false
}

function loadToolHistory() {
  try { const value = JSON.parse(localStorage.getItem('zhengdu_decision_history_v1') || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}
function saveToolHistory() {
  try { localStorage.setItem('zhengdu_decision_history_v1', JSON.stringify(toolHistory.value.slice(0, settings.chatTools?.decisionHistoryLimit || 30))) } catch {}
}
function localMessageDate(message) {
  const date = new Date(Number(message?.createdAt) || Date.now())
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function openChatTool(id) {
  activeChatTool.value = id
  menuOpen.value = false
  stickerOpen.value = false
  decisionResult.value = ''
  decisionThinking.value = false
  if (id === 'search') {
    searchKeyword.value = ''
    searchFrom.value = ''
    searchTo.value = ''
  }
  if (id === 'decision') {
    decisionCount.value = settings.chatTools?.decisionDefaultCount || 1
    decisionDelay.value = settings.chatTools?.decisionDefaultSeconds || 2
  }
}
function closeChatTool() {
  activeChatTool.value = ''
  clearTimeout(decisionTimer)
  decisionThinking.value = false
}
function startDecision() {
  const question = decisionQuestion.value.trim()
  const options = decisionOptions.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  if (!question) return
  decisionThinking.value = true
  decisionResult.value = ''
  clearTimeout(decisionTimer)
  const wait = Math.max(1, Math.min(10, Number(decisionDelay.value) || 2)) * 1000
  decisionTimer = setTimeout(() => {
    let result = ''
    if (options.length) {
      const max = Math.max(1, Math.min(options.length, Number(decisionCount.value) || 1))
      const picked = new Set()
      while (picked.size < max) picked.add(Math.floor(Math.random() * options.length))
      result = [...picked].map((index) => options[index]).join('、')
    } else {
      result = ['可以', '不可以', '再想想', '也许可以'][Math.floor(Math.random() * 4)]
    }
    decisionResult.value = result
    decisionThinking.value = false
    toolHistory.value = [{ id: `decision-${Date.now()}`, question, result, ts: Date.now() }, ...toolHistory.value].slice(0, settings.chatTools?.decisionHistoryLimit || 30)
    saveToolHistory()
    if (activeIsGroup.value && active.value) {
      const selected = groupMembersForTools.value.filter((member) => decisionGroupContactIds.value.includes(member.id))
      const results = selected.map((member) => `${nameOf(member)}：${result}`)
      for (const member of selected) sendGroupMemberMessage(active.value.id, member.id, `关于「${question}」，我选：${result}`)
      decisionResult.value = results.join('；')
    } else {
      sendIncomingText(`关于「${question}」，我选：${result}`)
    }
  }, wait)
}
function sendDecisionToChat() {
  if (!decisionResult.value) return
  if (activeIsGroup.value && active.value) {
    const [memberId] = decisionGroupContactIds.value
    if (memberId) sendGroupMemberMessage(active.value.id, memberId, `帮我决定的结果：${decisionResult.value}`)
    scrollBottom()
    return
  }
  sendIncomingText(`帮我决定的结果：${decisionResult.value}`)
}
function jumpToSearchResult(message) {
  jumpToQuotedMessage({ messageId: message.id })
}
function toggleStickerPanel() {
  stickerOpen.value = !stickerOpen.value
  if (stickerOpen.value) menuOpen.value = false
}
function sendSticker(src) {
  dispatchOutgoing({ type: 'sticker', src, text: '[表情包]' })
  stickerOpen.value = false
  scrollBottom()
}

function makeProactive() {
  triggerProactiveForActiveChat()
  scrollBottom()
}

function messageSourceLabels(message) {
  if (!message || message.from !== 'other') return []
  if (Array.isArray(message.sourceLabels) && message.sourceLabels.length) {
    return [...new Set(message.sourceLabels.filter(Boolean))]
  }
  const labels = []
  if (message.dictionary === true) labels.push('拼词')
  if (message.sourceCategory) labels.push(message.sourceCategory)
  if (message.sourceGroup) labels.push(message.sourceGroup)
  return [...new Set(labels)]
}

function messageText(message) {
  if (!message) return ''
  if (message.type === 'sticker') return '[表情包]'
  if (message.type === 'photo') return '[图片] ' + (message.text || '')
  if (message.type === 'voice') return message.text || '[语音]'
  if (message.type === 'transfer') return `[转账] ¥${message.amount} ${message.text || ''}`
  if (message.type === 'redpacket') return `[红包] ¥${message.amount} ${message.text || ''}`
  return message.text || ''
}

function translatableMessageText(message) {
  if (!message || message.type === 'sticker') return ''
  if (['photo', 'voice', 'transfer', 'redpacket'].includes(message.type)) {
    return String(message.text || '').trim()
  }
  return String(message.text || '').trim()
}

function onComposerFocus() {
  stickerOpen.value = false
  menuOpen.value = false
  scrollBottom()
}

function senderNameFor(message) {
  if (message.from === 'me') return settings.userName || '我'
  if (activeIsGroup.value) return message.senderName || nameOf(active.value)
  return nameOf(active.value)
}

function toggleInlineActions(message) {
  if (message.recalled || multiSelectMode.value) return
  if (messageMenuOpen.value && messageTarget.value?.id === message.id) {
    messageMenuOpen.value = false
    return
  }
  messageTarget.value = message
  messageMenuOpen.value = true
  inlineActionMode.value = 'actions'
  infoTitle.value = ''
  infoText.value = ''
  infoLoading.value = false
  forwardMessagesList.value = []
}

function handleMessageContentClick(message) {
  if (multiSelectMode.value) {
    toggleSelected(message.id)
    return
  }
  toggleInlineActions(message)
}

function closeChatPopovers() {
  menuOpen.value = false
  stickerOpen.value = false
  messageMenuOpen.value = false
}

function jumpToQuotedMessage(quote) {
  if (!active.value || !chatRef.value || !quote) return
  const messages = active.value.messages
  let targetMessage = messages.find((message) => message.id === quote.messageId)
  if (!targetMessage && quote.text) {
    targetMessage = messages.find((message) => messageText(message) === quote.text)
  }
  if (!targetMessage) {
    chatNotice.value = '被引用的消息已不存在'
    setTimeout(() => (chatNotice.value = ''), 1400)
    return
  }
  const targetIndex = messages.findIndex((message) => message.id === targetMessage.id)
  if (targetIndex >= 0 && messages.length - targetIndex > visibleMessageLimit.value) {
    visibleMessageLimit.value = Math.min(messages.length, Math.ceil((messages.length - targetIndex) / MESSAGE_PAGE_SIZE) * MESSAGE_PAGE_SIZE)
    nextTick(() => jumpToQuotedMessage(quote))
    return
  }

  const target = [...chatRef.value.querySelectorAll('[data-message-id]')].find(
    (node) => node.dataset.messageId === targetMessage.id
  )
  if (!target) return

  messageMenuOpen.value = false
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('quote-jump-target')
  clearTimeout(quoteJumpTimer)
  quoteJumpTimer = setTimeout(() => target.classList.remove('quote-jump-target'), 1400)
}

function runMessageAction(key) {
  if (key === 'copy') copyMessage()
  else if (key === 'translate') translateMessage()
  else if (key === 'quote') quoteMessage()
  else if (key === 'forward') openForward([messageTarget.value])
  else if (key === 'multi') startMultiSelect()
  else if (key === 'interpret') interpretMessage()
  else if (key === 'recall') recallCurrentMessage()
  else if (key === 'delete') deleteCurrentMessage()
}

async function copyMessage() {
  const text = messageText(messageTarget.value)
  messageMenuOpen.value = false
  try {
    await navigator.clipboard.writeText(text)
    chatNotice.value = '已复制'
  } catch (e) {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    chatNotice.value = '已复制'
  }
  setTimeout(() => (chatNotice.value = ''), 1400)
}

async function translateMessage() {
  const message = messageTarget.value
  const text = translatableMessageText(message)
  inlineActionMode.value = 'result'
  infoTitle.value = '翻译'
  infoText.value = ''

  if (!text) {
    infoLoading.value = false
    infoText.value = '这条消息没有可翻译的文字内容。'
    return
  }

  infoLoading.value = true
  try {
    const result = await translateText(text, { aiConfig: settings.ai })
    infoTitle.value = `翻译 · ${languageLabel(result.sourceLanguage)} → ${languageLabel(result.targetLanguage)}`
    infoText.value = result.text
  } catch (error) {
    infoText.value = error.message || '翻译失败，请检查网络后重试。'
  } finally {
    infoLoading.value = false
  }
}

async function interpretMessage() {
  const message = messageTarget.value
  const text = messageText(message)
  inlineActionMode.value = 'result'
  infoTitle.value = '消息解读'
  infoText.value = ''

  if (isAiScopeEnabled(settings.ai, 'chat')) {
    const roleContact = activeIsGroup.value
      ? chatState.contacts.find((item) => (active.value?.memberIds || []).includes(item.id))
      : active.value
    infoTitle.value = 'AI 消息解读'
    infoLoading.value = true
    try {
      infoText.value = await requestAiInterpretation(settings.ai, {
        characterName: roleContact ? contactDisplayName(roleContact) : 'TA',
        backstory: roleContact?.backstory || '',
        contentType: '聊天消息',
        content: text,
      })
    } catch (error) {
      infoText.value = error.message || 'AI 解读失败，请检查设置 → AI接入'
    } finally {
      infoLoading.value = false
    }
    return
  }

  infoLoading.value = false
  if (/想你|喜欢|爱|抱|亲/.test(text)) {
    infoText.value = '这句话带有明显的亲近和在意，像是在表达想念或撒娇。'
  } else if (/[？?]/.test(text)) {
    infoText.value = '这是一句询问，对方可能在等你的回应或确认。'
  } else if (/[！!]/.test(text)) {
    infoText.value = '语气比较直接，情绪表达偏强烈。'
  } else if (text.length <= 6) {
    infoText.value = '句子很短，更像随口回应，语气轻松。'
  } else {
    infoText.value = '这是一句日常分享或陈述，整体语气比较平稳。'
  }
}

function quoteMessage() {
  const message = messageTarget.value
  quoteTarget.value = {
    messageId: message?.id || '',
    sender: senderNameFor(message),
    text: messageText(message),
  }
  messageMenuOpen.value = false
}

function startMultiSelect() {
  messageMenuOpen.value = false
  multiSelectMode.value = true
  selectedMessageIds.value = messageTarget.value ? [messageTarget.value.id] : []
}

function toggleSelected(id) {
  selectedMessageIds.value = selectedMessageIds.value.includes(id)
    ? selectedMessageIds.value.filter((item) => item !== id)
    : [...selectedMessageIds.value, id]
}

function cancelMultiSelect() {
  multiSelectMode.value = false
  selectedMessageIds.value = []
}

function openForward(messages) {
  if (!forwardCandidates.value.length) {
    window.alert('当前只有一个联系人，无法转发。')
    return
  }
  forwardMessagesList.value = messages
  inlineActionMode.value = 'forward'
}

function doForward(target) {
  forwardMessages(target.kind, target.id, forwardMessagesList.value)
  messageMenuOpen.value = false
  cancelMultiSelect()
  chatNotice.value = '已逐条转发'
  setTimeout(() => (chatNotice.value = ''), 1400)
}

function deleteCurrentMessage() {
  const message = messageTarget.value
  messageMenuOpen.value = false
  if (!message) return
  if (!window.confirm('删除这条消息？')) return
  deleteMessage(message.id)
}

function recallCurrentMessage() {
  const message = messageTarget.value
  messageMenuOpen.value = false
  if (!message || message.from !== 'me') return
  if (!window.confirm('撤回这条消息？')) return
  recallMessage(message.id)
}

function send() {
  const text = draft.value.trim()
  if (!text) return
  dispatchOutgoing({
    type: 'text',
    text,
    quote: quoteTarget.value ? { ...quoteTarget.value } : null,
  })
  draft.value = ''
  quoteTarget.value = null
  menuOpen.value = false
  nextTick(resizeComposer)
  scrollBottom()
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) stickerOpen.value = false
  sheet.value = null
  if (menuOpen.value) scrollBottom()
}

function openSheet(kind) {
  menuOpen.value = false
  sheet.value = kind
  amount.value = ''
  note.value = ''
  placeName.value = ''
  giftName.value = ''
  giftPrice.value = ''
  groupGiftRecipientId.value = activeIsGroup.value ? (groupMembersForTools.value[0]?.id || '') : ''
  groupTransferRecipientId.value = activeIsGroup.value ? (groupMembersForTools.value[0]?.id || '') : ''
}

function confirmSheet() {
  if (!active.value || !sheet.value) return
  const kind = sheet.value

  if (kind === 'transfer') {
    const value = parseFloat(amount.value)
    if (!Number.isFinite(value) || value <= 0) return
    dispatchOutgoing({
      type: 'transfer',
      amount: value.toFixed(2),
      text: note.value.trim() || '一点心意',
      transferRecipientId: activeIsGroup.value ? groupTransferRecipient.value?.id || '' : 'me',
      transferRecipientName: activeIsGroup.value ? nameOf(groupTransferRecipient.value) : '我',
      transferRecipientKind: activeIsGroup.value ? 'contact' : 'user',
    })
  } else if (kind === 'location') {
    const place = placeName.value.trim()
    if (!place) return
    dispatchOutgoing({ type: 'location', text: place })
  } else if (kind === 'gift') {
    const name = giftName.value.trim()
    if (!name) return
    const option = giftNameOptions.value.find((item) => item.text === name)
    const price = Math.max(0, Number(giftPrice.value) || 0)
    dispatchOutgoing({
      type: 'gift',
      text: name,
      giftName: name,
      note: note.value.trim(),
      giftWish: note.value.trim() || '一份小小的心意',
      giftEmoji: option?.emoji || '🎁',
      giftPrice: price,
      giftCat: 'custom',
      giftSelf: false,
      giftRecipientId: activeIsGroup.value ? groupGiftRecipient.value?.id || '' : '',
      giftRecipientName: activeIsGroup.value ? nameOf(groupGiftRecipient.value) : '',
      giftSourceGroup: option ? `${option.source} · 礼物` : '我的字卡 · 礼物',
    })
  }

  sheet.value = null
  menuOpen.value = false
  scrollBottom()
}

function pickPhotos() {
  photoInput.value?.click()
}

async function onPhotoFiles(event) {
  const files = [...(event.target.files || [])].filter((file) =>
    file.type.startsWith('image/')
  )
  event.target.value = ''
  if (!files.length || !active.value) return
  menuOpen.value = false
  for (const file of files) {
    try {
      const src = await imageFileToDataUrl(file, 1600, 0.84)
      if (!src) continue
      dispatchOutgoing({
        type: 'photo',
        src,
        text: file.name.replace(/\.[^.]+$/, '') || '照片',
      })
    } catch (e) {
      console.warn('照片发送失败：', e)
    }
  }
  scrollBottom()
}

function openNudgeCard() {
  if (!active.value) return
  menuOpen.value = false
  nudgeText.value = DEFAULT_NUDGE_TEXTS[0]
  nudgeTextPage.value = 0
  nudgeSymbol.value = '✦'
  nudgeGroupContactId.value = activeIsGroup.value ? (groupMembersForTools.value[0]?.id || '') : ''
  customNudgeSymbolInput.value = ''
  customNudgeTextInput.value = ''
  nudgeOpen.value = true
}

function addCustomNudgeText() {
  const value = customNudgeTextInput.value.trim().slice(0, 80)
  if (!value) return
  if (!Array.isArray(settings.customNudgeTexts)) settings.customNudgeTexts = []
  if (!nudgeTexts.value.includes(value)) settings.customNudgeTexts.push(value)
  nudgeText.value = value
  nudgeTextPage.value = Math.floor(Math.max(0, nudgeTexts.value.length - 1) / NUDGE_TEXTS_PER_PAGE)
  customNudgeTextInput.value = ''
}
function addCustomNudgeSymbol() {
  const symbol = customNudgeSymbolInput.value.trim().slice(0, 8)
  if (!symbol) return
  if (!Array.isArray(settings.customNudgeSymbols)) settings.customNudgeSymbols = []
  if (!nudgeSymbols.value.includes(symbol)) settings.customNudgeSymbols.push(symbol)
  nudgeSymbol.value = symbol
  customNudgeSymbolInput.value = ''
}

function confirmNudge() {
  if (!active.value) return
  dispatchOutgoing({ type: 'nudge', text: nudgePreview.value, nudgeTargetId: activeIsGroup.value ? nudgeTargetContact.value?.id || '' : '', nudgeTargetName: nudgeTargetName.value })
  nudgeOpen.value = false
  menuOpen.value = false
  scrollBottom()
}

function startCall(kind) {
  if (!active.value) return
  menuOpen.value = false
  if (activeIsGroup.value) {
    openGroupCallPicker(kind)
    return
  }
  const started = startOutgoingCall(kind)
  if (!started) flashChatNotice('当前已有正在进行的通话')
}
watch(
  () => store.groupCreateRequest,
  () => {
    if (store.page === 'sms' && !active.value) groupCreateOpen.value = true
  }
)

// 功能大全 → 直接打开某个聊天工具（工具 id 见 chat-tools.js）
watch(
  () => store.chatToolRequest,
  (req) => {
    if (!req) return
    store.chatToolRequest = null
    nextTick(() => {
      if (!active.value && chatState.contacts?.length) openChat(chatState.contacts[0])
      runChatToolAction(req.id)
    })
  }
)

watch(
  draft,
  () => nextTick(resizeComposer)
)
watch(
  () => active.value?.id || '',
  () => {
    visibleMessageLimit.value = MESSAGE_PAGE_SIZE
    if (batchSending.value) return
    batchSendMode.value = false
    stagedOutgoingMessages.value = []
    stickerOpen.value = false
    photoPreviewSrc.value = ''
  }
)
watch(
  () => active.value?.messages.length || 0,
  () => {
    if (active.value) scrollBottom()
  }
)

onMounted(() => {
  refreshUnread()
  if (activeId.value) markRead(activeId.value)
  if (chatState.activeGroupId) {
    const group = groupById(chatState.activeGroupId)
    if (group) {
      group.messages.forEach((message) => {
        if (message.from === 'other') message.read = true
      })
    }
  }
  if (active.value) scrollBottom()
  // 从功能大全跳进来时，SmsView 刚挂载，watch 收不到请求，这里补一次
  const pendingTool = store.chatToolRequest
  if (pendingTool) {
    store.chatToolRequest = null
    nextTick(() => {
      if (!active.value && chatState.contacts?.length) {
        openChat(chatState.contacts[0])
      }
      runChatToolAction(pendingTool.id)
    })
  }
})
</script>

<template>
  <section>
    <div class="sms-layout" :class="{ chatting: !!active }">
      <!-- 会话列表 -->
      <div class="echoes-character-card conv-panel">
        <div
          v-for="conversation in conversations"
          :key="conversation.kind + '-' + conversation.id"
          class="conv-item"
          :class="{
            active:
              conversation.kind === 'group'
                ? chatState.activeGroupId === conversation.id
                : chatState.activeId === conversation.id,
          }"
          @click="openConversation(conversation)"
        >
          <span class="avatar" :class="{ 'echoes-avatar-other': conversation.kind === 'contact' }" :data-avatar-frame-skin-id="conversation.kind === 'contact' ? avatarFrameSkinOf(conversation.item) : 'none'" :style="{ background: conversation.item.color }">
            <img v-if="avatarImageOf(conversation.item)" :src="avatarImageOf(conversation.item)" alt="" />
            <template v-else>{{ conversation.item.avatar }}</template>
            <img v-if="conversation.item.avatarFrame" class="avatar-frame" :src="conversation.item.avatarFrame" :style="avatarFrameStyle(conversation.item)" alt="" />
          </span>
          <span class="conv-main">
            <span class="conv-top">
              <span class="conv-name">{{ nameOf(conversation.item) }}</span>
              <span class="conv-time">{{ conversation.last?.time || '' }}</span>
            </span>
            <span class="conv-preview">{{ previewOf(conversation.item) }}</span>
          </span>
          <span v-if="unreadOf(conversation.item)" class="conv-unread">{{ unreadOf(conversation.item) }}</span>
        </div>
      </div>

      <!-- 对话 -->
      <div class="echoes-character-card chat-panel">
        <template v-if="active">
          <div class="echoes-chat-header chat-head">
            <button class="chat-back" type="button" aria-label="返回联系人列表" @click="backToConversationList"><LineGlyph type="back" /></button>
            <span class="avatar chat-contact-avatar" :class="{ 'echoes-avatar-other': !activeIsGroup }" :data-avatar-frame-skin-id="activeIsGroup ? 'none' : avatarFrameSkinOf(active)" :style="{ background: active.color }">
              <img v-if="avatarImageOf(active)" :src="avatarImageOf(active)" alt="" />
              <template v-else>{{ active.avatar }}</template>
              <img v-if="active.avatarFrame" class="avatar-frame" :src="active.avatarFrame" :style="avatarFrameStyle(active)" alt="" />
            </span>
            <div class="chat-head-main">
              <h2>{{ nameOf(active) }}</h2>
              <span v-if="selectingCards">{{ settings.typingIndicatorText || '正在挑选字卡' }}</span>
              <span v-else-if="activeIsGroup">{{ groupMembers(active).length + 1 }} 位成员</span>
            </div>
            <button class="chat-head-options" type="button" aria-label="聊天设置" @click="openActiveOptions">···</button>
          </div>

          <button
            v-if="activeGroupCall"
            type="button"
            class="group-call-banner"
            @click="openGroupCallPanel"
          >
            <span class="group-call-live" aria-hidden="true"></span>
            <span class="group-call-banner-copy">
              <strong>{{ groupCallTitle }}</strong>
              <small>{{ groupCallParticipantCount }} 人 · {{ activeGroupCall.status }}</small>
            </span>
            <b>{{ activeGroupCall.userJoined ? '管理' : '进入' }}</b>
          </button>
          <div v-if="multiSelectMode" class="multi-toolbar">
            <span>已选择 {{ selectedMessageIds.length }} 条</span>
            <button type="button" :disabled="!selectedMessageIds.length" @click="openForward(selectedMessages)">逐条转发</button>
            <button type="button" @click="cancelMultiSelect">取消</button>
          </div>

          <div v-if="chatNotice" class="chat-action-notice">{{ chatNotice }}</div>

          <div
            ref="chatRef"
            class="chat-scroll"
            :class="{ 'group-chat-scroll': activeIsGroup }"
            :style="[chatBackgroundStyle, { '--chat-message-gap': chatMessageGap }]"
            @click="closeChatPopovers"
          >
            <button
              v-if="hiddenMessageCount > 0"
              class="chat-load-older"
              type="button"
              @click.stop="loadOlderMessages"
            >
               加载更早记录（{{ hiddenMessageCount }} 条）
            </button>
            <template v-for="m in visibleMessages" :key="m.id">
              <div class="chat-message-item" :data-message-id="m.id">
              <div
                v-if="visibleMessageTimeIds.has(m.id)"
                class="echoes-timestamp"
              >
                {{ formatConversationTime(m) }}
              </div>

              <div
                v-if="messageMenuOpen && messageTarget?.id === m.id"
                class="inline-message-actions"
                @click.stop
              >
                <template v-if="inlineActionMode === 'actions'">
                  <button
                    v-for="item in messageActionItems"
                    :key="item.key"
                    type="button"
                    @click="runMessageAction(item.key)"
                  >
                    <ActionGlyph :type="item.icon" />
                    <small>{{ item.label }}</small>
                  </button>
                </template>

                <template v-else-if="inlineActionMode === 'forward'">
                  <div class="inline-forward-title">选择转发对象</div>
                  <div class="inline-forward-list">
                    <button
                      v-for="target in forwardCandidates"
                      :key="target.kind + '-' + target.id"
                      type="button"
                      @click="doForward(target)"
                    >
                      <span class="forward-avatar" :style="{ background: target.item.color }">{{ target.item.avatar }}</span>
                      <span>{{ nameOf(target.item) }}</span>
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="inline-result">
                    <strong>{{ infoTitle }}</strong>
                    <span v-if="infoLoading">正在处理…</span>
                    <span v-else>{{ infoText }}</span>
                  </div>
                  <button class="inline-result-close" type="button" @click="messageMenuOpen = false">关闭</button>
                </template>
              </div>

              <div v-if="m.recalled" class="call-row" :data-message-id="m.id">
                <div class="echoes-narrator">
                  {{ m.from === 'me' ? '你' : senderNameFor(m) }}撤回了一条消息
                </div>
              </div>

              <div v-else-if="m.type === 'nudge'" class="nudge-row" :class="`status-skin-${settings.statusBubbleSkin}`" :data-message-id="m.id">
                <span>{{ m.text }}</span>
              </div>

              <div v-else-if="m.type === 'readReceipt'" class="nudge-row read-receipt-row" :class="`status-skin-${settings.statusBubbleSkin}`" :data-message-id="m.id">
                <span>{{ m.text }}</span>
              </div>

              <div
                v-else
                class="msg"
                :class="[
                  m.from === 'me' ? 'echoes-msg-user' : 'echoes-msg-other',
                  m.from === 'me' ? 'me' : 'other',
                  {
                    selecting: multiSelectMode,
                    selected: selectedMessageIds.includes(m.id),
                    'media-message': m.type === 'sticker' || m.type === 'photo',
                    'transfer-message': m.type === 'transfer' || m.type === 'redpacket',
                    'gift-message': m.type === 'gift',
                    'has-msg-meta': messageSourceLabels(m).length > 0,
                  },
                ]"
                :data-message-id="m.id"
              >
                <span
                  class="avatar"
                  :class="m.from === 'me' ? 'echoes-avatar-user' : 'echoes-avatar-other'"
                  :data-avatar-frame-skin-id="messageAvatarFrameSkin(m)"
                  :style="m.from === 'other' ? { background: activeIsGroup ? (m.senderColor || active.color) : active.color } : {}"
                >
                  <img
                    v-if="m.from === 'other' && (activeIsGroup ? m.senderAvatarImage : avatarImageOf(active))"
                    :src="activeIsGroup ? m.senderAvatarImage : avatarImageOf(active)"
                    alt=""
                  />
                  <img
                    v-else-if="m.from === 'me' && meAvatarImage()"
                    :src="meAvatarImage()"
                    alt=""
                  />
                  <template v-else>{{ m.from === 'me' ? '我' : (activeIsGroup ? (m.senderAvatar || '群') : active.avatar) }}</template>
                  <img
                    v-if="m.from === 'other' && (activeIsGroup ? m.senderAvatarFrame : active.avatarFrame)"
                    class="avatar-frame"
                    :src="activeIsGroup ? m.senderAvatarFrame : active.avatarFrame"
                    :style="avatarFrameStyle(activeIsGroup ? { avatarFrameOffsetX: m.senderAvatarFrameOffsetX, avatarFrameOffsetY: m.senderAvatarFrameOffsetY, avatarFrameScale: m.senderAvatarFrameScale } : active)"
                    alt=""
                  />
                  <img
                    v-else-if="m.from === 'me' && settings.userAvatarFrame"
                    class="avatar-frame"
                    :src="settings.userAvatarFrame"
                    :style="avatarFrameStyle({ avatarFrameOffsetX: settings.userAvatarFrameOffsetX, avatarFrameOffsetY: settings.userAvatarFrameOffsetY, avatarFrameScale: settings.userAvatarFrameScale })"
                    alt=""
                  />
                </span>
                <span v-if="activeIsGroup && m.from === 'other'" class="msg-sender">{{ m.senderName }}</span>
                <span v-if="m.forwarded" class="forwarded-tag">转发</span>

                <div
                  class="message-content"
                  @click.stop="handleMessageContentClick(m)"
                  @contextmenu.prevent.stop="handleMessageContentClick(m)"
                >
                  <!-- 文本气泡 -->
                  <div
                    v-if="!m.type || m.type === 'text' || m.type === 'call' || m.type === 'voice'"
                    class="bubble"
                    :class="[
                      m.from === 'me' ? 'echoes-bubble-user' : 'echoes-bubble-other',
                      { 'call-message-bubble': m.type === 'call' },
                    ]"
                  >
                    <button
                      v-if="m.quote"
                      class="quoted-message"
                      type="button"
                      @click.stop="jumpToQuotedMessage(m.quote)"
                    >
                      <strong>{{ m.quote.sender }}</strong>
                      <span>{{ m.quote.text }}</span>
                    </button>
                    {{ m.text }}
                  </div>

                <button
                  v-else-if="m.type === 'wishOrder'"
                  class="wish-order-message-card"
                  type="button"
                  @click.stop="openWishOrderMessage(m)"
                >
                  <span class="wish-order-message-head"><b>许愿订单</b><small>{{ wishMessageStatusLabel(m.wishOrder?.status) }}</small></span>
                  <strong>我想要这个！</strong>
                  <span class="wish-order-message-items">{{ wishMessageSummary(m) }}</span>
                  <span class="wish-order-message-foot"><time>{{ formatWishDate(m.wishOrder?.createdAt) }}</time><em>{{ formatWishPrice(m.wishOrder?.total) }}</em></span>
                </button>
                <div v-else-if="m.type === 'sticker'" class="sticker-message">
                  <SafeImage :src="m.src" alt="表情包" class="message-url-image" />
                </div>

                <!-- 转账 / 红包：套用发起方气泡角饰 -->
                <div
                  v-else-if="m.type === 'transfer' || m.type === 'redpacket'"
                  class="decorated-card"
                  :class="[m.from === 'me' ? 'from-me' : 'from-other', `transfer-decoration-${settings.transferCardSkin}`]"
                >
                  <div
                    class="echoes-transfer-card transfer-card"
                    :class="[`transfer-skin-${settings.transferCardSkin}`, { 'redpacket-card': m.type === 'redpacket' }]"
                  >
                    <div class="transfer-top">
                      {{ m.type === 'redpacket' ? '红包' : '转账' }}
                    </div>
                    <div v-if="m.type === 'transfer' && m.transferRecipientName" class="transfer-recipient">
                      {{ m.from === 'me' ? '转给 ' + m.transferRecipientName : '转给你' }}
                    </div>
                    <div class="transfer-amount">¥ {{ m.amount }}</div>
                    <div class="transfer-note">{{ m.text }}</div>
                  </div>
                </div>

                <!-- 图片：套用发起方气泡角饰 -->
                <div
                  v-else-if="m.type === 'photo'"
                  class="decorated-card"
                  :class="m.from === 'me' ? 'from-me' : 'from-other'"
                >
                  <div class="echoes-photo-card photo-card">
                    <SafeImage :src="m.src" :alt="m.text" class="message-url-image" @click.stop="openPhotoPreview(m)" />
                    <div class="photo-caption">{{ m.text }}</div>
                  </div>
                </div>

                <!-- 位置：套用发起方气泡角饰 -->
                <div
                  v-else-if="m.type === 'location'"
                  class="decorated-card"
                  :class="m.from === 'me' ? 'from-me' : 'from-other'"
                >
                  <div class="echoes-location-card mini-card">
                    <div class="mini-kicker">位置</div>
                    <div class="mini-title">{{ m.text }}</div>
                  </div>
                </div>

                <!-- 文件：文档里的 .echoes-file-card -->
                <div v-else-if="m.type === 'file'" class="echoes-file-card mini-card">
                  <div class="mini-kicker">文件</div>
                  <div class="mini-title">{{ m.text }}</div>
                  <div class="mini-sub">12 KB</div>
                </div>

                <div v-else-if="m.type === 'gift'" class="msg-gift">
                  <div class="msg-gift-card">
                    <div class="msg-gift-emoji" :style="{ background: GIFT_CAT_COLOR[m.giftCat] || GIFT_CAT_COLOR.default }">
                      <SafeImage v-if="m.giftImg" class="msg-gift-img message-url-image" :src="m.giftImg" alt="礼物图片" />
                      <template v-else>{{ m.giftEmoji || '🎁' }}</template>
                    </div>
                    <div class="msg-gift-name">{{ m.giftName || m.text || '礼物' }}</div>
                    <div class="msg-gift-divider"></div>
                    <div class="msg-gift-wish">“{{ m.giftWish || m.note || '一点心意' }}”</div>
                    <div class="msg-gift-foot"><span class="mg-side">{{ m.from === 'me' ? (m.giftRecipientName ? `我 送给 ${m.giftRecipientName}` : '我 送出') : (m.giftSelf ? 'TA 自己买的' : 'TA 送来') }}</span><span class="msg-gift-price">¥{{ Number(m.giftPrice || 0).toFixed(2) }}</span></div>
                  </div>
                </div>

                  <span v-if="multiSelectMode" class="msg-select-mark" :class="{ active: selectedMessageIds.includes(m.id) }">
                    {{ selectedMessageIds.includes(m.id) ? '✓' : '○' }}
                  </span>
                  <span
                    v-if="messageSourceLabels(m).length"
                    class="msg-meta for-other"
                  >
                    <span v-for="label in messageSourceLabels(m)" :key="label" class="msg-source">{{ label }}</span>
                  </span>
                </div>
              </div>
              </div>
            </template>
          </div>

          <div v-if="quoteTarget" class="quote-compose">
            <div>
              <strong>{{ quoteTarget.sender }}</strong>
              <span>{{ quoteTarget.text }}</span>
            </div>
            <button type="button" aria-label="取消引用" @click="quoteTarget = null">×</button>
          </div>

          <div v-if="batchSendMode" class="batch-send-queue">
            <div class="batch-queue-head">
              <div>
                <strong>发多条</strong>
                <span>{{ stagedOutgoingMessages.length }} 条已预存</span>
              </div>
              <button type="button" aria-label="退出发多条" @click="toggleBatchSendMode">×</button>
            </div>

            <div v-if="stagedOutgoingMessages.length" class="batch-queue-list">
              <div v-for="(item, index) in stagedOutgoingMessages" :key="item.id" class="batch-queue-item">
                <span class="batch-queue-index">{{ index + 1 }}</span>
                <img
                  v-if="item.payload.type === 'photo' || item.payload.type === 'sticker'"
                  :src="item.payload.src"
                  alt=""
                />
                <span class="batch-queue-text">{{ outgoingPreview(item.payload) }}</span>
                <button type="button" aria-label="移除预存消息" @click="removeStagedMessage(item.id)">×</button>
              </div>
            </div>
            <div v-else class="batch-queue-empty">输入消息后会先预存在这里，不会立即发出。</div>

            <div class="batch-queue-actions">
              <button type="button" :disabled="batchSending || !stagedOutgoingMessages.length" @click="clearStagedMessages">清空</button>
              <button class="primary" type="button" :disabled="batchSending || !stagedOutgoingMessages.length" @click="sendStagedMessages">
                {{ batchSending ? '发送中…' : '发送预存消息' }}
              </button>
            </div>
          </div>

          <form class="echoes-input-area chat-input-area" @submit.prevent="send">
            <button class="sticker-btn" type="button" aria-label="表情包" @click.stop="toggleStickerPanel">
              <span>☺</span>
            </button>
            <textarea
              ref="chatField"
              v-model="draft"
              class="echoes-chat-input chat-field"
              rows="1"
              maxlength="200"
              :placeholder="chatPlaceholder"
              @focus="onComposerFocus"
              @keydown.enter="handleComposerEnter"
              @compositionstart="handleComposerCompositionStart"
              @compositionend="handleComposerCompositionEnd"
            ></textarea>
            <button class="chat-send-btn" type="submit" aria-label="发送" title="发送" :disabled="!draft.trim()">
              ✈
            </button>
            <button
              class="chat-more-btn"
              type="button"
              aria-label="让对方主动发消息"
              title="让对方主动发消息"
              @click.stop="makeProactive"
            ><span class="proactive-dots" aria-hidden="true"><i></i><i></i><i></i></span></button>
            <button
              class="plus-btn"
              type="button"
              aria-label="更多功能"
              :class="{ open: menuOpen }"
              @click.stop="toggleMenu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </form>

          <!-- 微信式：输入框下方整块向下展开 -->
          <transition name="tool-slide">
            <div v-if="menuOpen" class="tool-panel">
              <div v-if="chatToolItems.length" class="tool-grid">
                <div v-for="(page, pageIndex) in chatToolPages" :key="pageIndex" class="tool-page">
                  <button
                    v-for="tool in page"
                    :key="tool.id"
                    class="tool-item"
                    type="button"
                    :class="{ active: tool.active }"
                    :aria-label="tool.label"
                    @click="tool.action()"
                  >
                    <span class="tool-tile"><LineGlyph :type="tool.icon" /></span>
                    <span class="tool-label">{{ tool.label }}</span>
                  </button>
                </div>
              </div>
              <div v-else class="tool-empty">聊天工具已全部关闭，可在「设置 → 聊天工具」中重新开启。</div>
              <input ref="photoInput" class="hidden-file" type="file" accept="image/*" multiple style="display: none" @change="onPhotoFiles" />
            </div>
          </transition>

          <transition name="tool-slide">
            <section v-if="activeTool" class="chat-tool-workbench">
              <header class="chat-tool-head"><div><strong>{{ activeTool.label }}</strong><span>{{ activeTool.hint }}</span></div><button type="button" aria-label="关闭工具" @click="closeChatTool">×</button></header>

              <div v-if="activeChatTool === 'decision'" class="chat-tool-body">
                <label><span>要决定的问题</span><textarea v-model="decisionQuestion" rows="2" placeholder="例如：今晚吃什么？"></textarea></label>
                <label><span>可选项（每行一个，可不填）</span><textarea v-model="decisionOptions" rows="3" placeholder="火锅&#10;烧烤&#10;寿司"></textarea></label>
                <div class="chat-tool-grid"><label><span>最多选几个</span><input v-model.number="decisionCount" type="number" min="1" max="10" /></label><label><span>思考秒数</span><input v-model.number="decisionDelay" type="number" min="1" max="10" /></label></div>
                <button class="tool-primary" type="button" :disabled="decisionThinking || !decisionQuestion.trim()" @click="startDecision">{{ decisionThinking ? 'TA 正在思考…' : '帮我决定' }}</button>
                <div v-if="decisionResult" class="decision-result"><span>TA 的选择</span><strong>{{ decisionResult }}</strong><button type="button" @click="sendDecisionToChat">再发送到聊天</button></div>
                <details v-if="toolHistory.length" class="tool-history"><summary>历史记录</summary><p v-for="item in toolHistory.slice(0, 5)" :key="item.id"><b>{{ item.question }}</b><span>{{ item.result }}</span></p></details>
              </div>

              <div v-else-if="activeChatTool === 'search'" class="chat-tool-body">
                <div class="chat-tool-grid search-grid"><label><span>关键词</span><input v-model="searchKeyword" type="search" placeholder="搜索聊天内容" /></label><label><span>开始日期</span><input v-model="searchFrom" type="date" /></label><label><span>结束日期</span><input v-model="searchTo" type="date" /></label></div>
                <div class="search-result-list"><button v-for="message in chatSearchResults" :key="message.id" type="button" @click="jumpToSearchResult(message)"><span>{{ message.from === 'me' ? '我' : senderNameFor(message) }}</span><strong>{{ messageText(message) }}</strong><small>{{ new Date(Number(message.createdAt) || Date.now()).toLocaleString('zh-CN') }}</small></button><div v-if="(searchKeyword || searchFrom || searchTo) && !chatSearchResults.length" class="tool-empty">没有找到匹配记录</div></div>
              </div>
            </section>
          </transition>
          <StickerPickerDialog
            :open="stickerOpen"
            @close="stickerOpen = false"
            @select="sendSticker"
          />

          <teleport to="body">
            <transition name="fade">
              <div v-if="photoPreviewSrc" class="photo-preview-layer" @click.self="photoPreviewSrc = ''">
                <button class="photo-preview-close" type="button" aria-label="关闭照片预览" @click="photoPreviewSrc = ''">×</button>
                <SafeImage :src="photoPreviewSrc" alt="照片预览" class="photo-preview-image" />
              </div>
            </transition>
          </teleport>

          <teleport to="body">
            <transition name="fade">
              <div v-if="nudgeOpen" class="nudge-layer" @click.self="nudgeOpen = false">
                <section class="nudge-card" role="dialog" aria-modal="true" aria-label="拍一拍">
                  <header class="nudge-head">
                    <div>
                      <strong>拍一拍</strong>
                      <span>选择文案和符号</span>
                    </div>
                    <button type="button" aria-label="关闭拍一拍" @click="nudgeOpen = false">×</button>
                  </header>
                  <label v-if="activeIsGroup" class="nudge-group-target">
                    <span>拍一拍对象</span>
                    <select v-model="nudgeGroupContactId">
                      <option v-for="member in groupMembersForTools" :key="member.id" :value="member.id">{{ nameOf(member) }}</option>
                    </select>
                  </label>
                <div v-if="activeIsGroup" class="decision-group-members">
                  <span>选择参与抉择的群成员</span>
                  <label v-for="member in groupMembersForTools" :key="member.id">
                    <input v-model="decisionGroupContactIds" type="checkbox" :value="member.id" />
                    <b>{{ nameOf(member) }}</b>
                  </label>
                </div>

                  <div class="nudge-section">
                    <span class="nudge-label">选择文案</span>
                    <div class="nudge-options nudge-text-options">
                      <button
                        v-for="item in visibleNudgeTexts"
                        :key="item"
                        type="button"
                        :class="{ active: nudgeText === item }"
                        @click="nudgeText = item"
                      >
                        {{ item }}
                      </button>
                    </div>
                    <div v-if="nudgeTextPageCount > 1" class="nudge-pager">
                      <button type="button" @click="changeNudgeTextPage(-1)">上一页</button>
                      <span>{{ nudgeTextPage + 1 }} / {{ nudgeTextPageCount }}</span>
                      <button type="button" @click="changeNudgeTextPage(1)">下一页</button>
                    </div>
                    <div class="nudge-custom-text">
                      <input
                        v-model="customNudgeTextInput"
                        type="text"
                        maxlength="80"
                        placeholder="例：轻轻咬了一口你的脸。"
                        @keydown.enter.prevent="addCustomNudgeText"
                      />
                      <button type="button" @click="addCustomNudgeText">添加</button>
                    </div>
                  </div>

                  <div class="nudge-section">
                    <span class="nudge-label">选择符号</span>
                    <div class="nudge-options nudge-symbol-options">
                      <button
                        v-for="symbol in nudgeSymbols"
                        :key="symbol"
                        type="button"
                        :class="{ active: nudgeSymbol === symbol }"
                        @click="nudgeSymbol = symbol"
                      >
                        {{ symbol }}
                      </button>
                    </div>
                    <div class="nudge-custom-symbol">
                      <input
                        v-model="customNudgeSymbolInput"
                        type="text"
                        maxlength="8"
                        placeholder="添加自定义符号"
                        @keydown.enter.prevent="addCustomNudgeSymbol"
                      />
                      <button type="button" @click="addCustomNudgeSymbol">添加</button>
                    </div>
                  </div>

                  <div class="nudge-preview">{{ nudgePreview }}</div>

                  <div class="nudge-actions">
                    <button type="button" @click="nudgeOpen = false">取消</button>
                    <button class="primary" type="button" :disabled="!nudgeText.trim()" @click="confirmNudge">发送</button>
                  </div>
                </section>
              </div>
            </transition>
          </teleport>

          <!-- 自定义发送填写层 -->
          <teleport to="body">
            <transition name="fade">
              <div v-if="sheet" class="sheet-backdrop" @click.self="sheet = null">
              <div class="echoes-character-card sheet-card">
                <div class="sheet-title">
                  {{ sheet === 'transfer' ? '转账' : sheet === 'location' ? '发送位置' : '送礼物' }}
                </div>

                <template v-if="sheet === 'transfer'">
                  <label v-if="activeIsGroup" class="sheet-field">
                    <span>转账给</span>
                    <select v-model="groupTransferRecipientId" class="echoes-chat-input sheet-note">
                      <option v-for="member in groupMembersForTools" :key="member.id" :value="member.id">{{ nameOf(member) }}</option>
                    </select>
                  </label>
                  <div class="amount-row">
                    <span>¥</span>
                    <input
                      v-model="amount"
                      inputmode="decimal"
                      placeholder="0.00"
                      aria-label="金额"
                    />
                  </div>
                  <div class="quick-amounts">
                    <button
                      v-for="v in quickAmounts"
                      :key="v"
                      type="button"
                      @click="amount = String(v)"
                    >
                      ¥{{ v }}
                    </button>
                  </div>
                </template>

                <template v-else-if="sheet === 'location'">
                  <label class="sheet-field">
                    <span>地点名称</span>
                    <input
                      v-model="placeName"
                      class="echoes-chat-input sheet-note"
                      type="text"
                      maxlength="40"
                      placeholder="例如：海边旧灯塔"
                    />
                  </label>
                </template>

                <template v-else>
                  <label v-if="activeIsGroup" class="sheet-field">
                    <span>赠送给</span>
                    <select v-model="groupGiftRecipientId" class="echoes-chat-input sheet-note">
                      <option v-for="member in groupMembersForTools" :key="member.id" :value="member.id">{{ nameOf(member) }}</option>
                    </select>
                  </label>
                  <label class="sheet-field">
                    <span>礼物名称</span>
                    <input
                      v-model="giftName"
                      class="echoes-chat-input sheet-note"
                      type="text"
                      maxlength="40"
                      list="gift-name-options"
                      placeholder="选择或输入礼物名称"
                      @change="giftPrice = String(giftNameOptions.find((item) => item.text === giftName)?.price || giftPrice)"
                    />
                    <datalist id="gift-name-options">
                      <option v-for="item in giftNameOptions" :key="item.source + item.text" :value="item.text">{{ item.emoji }} {{ item.source }}</option>
                    </datalist>
                  </label>
                  <label class="sheet-field">
                    <span>礼物价格</span>
                    <input
                      v-model="giftPrice"
                      class="echoes-chat-input sheet-note"
                      type="number"
                      min="0"
                      step="0.01"
                      inputmode="decimal"
                      placeholder="0.00"
                    />
                  </label>
                </template>

                <label v-if="sheet !== 'location'" class="sheet-field">
                  <span>留言</span>
                  <input
                    v-model="note"
                    class="echoes-chat-input sheet-note"
                    type="text"
                    maxlength="60"
                    placeholder="写一句想说的话（可选）"
                  />
                </label>

                <div class="sheet-actions">
                  <button class="sheet-cancel" type="button" @click="sheet = null">
                    取消
                  </button>
                  <button class="sheet-ok" type="button" @click="confirmSheet">
                    发送
                  </button>
                </div>
              </div>
            </div>
            </transition>
          </teleport>
        </template>

        <div v-else class="chat-empty">
          <div class="seal">🦭</div>
          <div>从左边选一个会话开始</div>
        </div>
      </div>
    </div>


    <teleport to="body">
      <div v-if="groupCreateOpen" class="sms-modal-layer" @click.self="groupCreateOpen = false">
        <div class="sms-modal-card">
          <h3>发起群聊</h3>
          <input v-model="groupName" type="text" maxlength="30" placeholder="群组名称" />
          <div class="member-select">
            <label v-for="contact in contacts" :key="contact.id">
              <input
                type="checkbox"
                :checked="selectedMemberIds.includes(contact.id)"
                @change="toggleMember(contact.id)"
              />
              <span>{{ contact.note || contact.name }}</span>
            </label>
          </div>
          <div class="sms-modal-actions">
            <button type="button" @click="groupCreateOpen = false">取消</button>
            <button type="button" :disabled="selectedMemberIds.length < 2" @click="createGroupChat">创建群聊</button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="optionsOpen && optionsTarget" class="sms-modal-layer" @click.self="optionsOpen = false">
        <div class="sms-modal-card">
          <h3>聊天设置</h3>
          <template v-if="optionsTarget.kind === 'group' && groupDraft">
            <div class="group-avatar-editor">
              <span class="group-avatar-preview"><img v-if="groupDraft.avatarImage" :src="groupDraft.avatarImage" alt="" /><template v-else>群</template></span>
              <label class="modal-file-button">上传群头像<input type="file" accept="image/*" @change="pickGroupAvatar" /></label>
            </div>
          </template>
          <div class="option-row">
            <span>置顶会话</span>
            <button type="button" :class="{ active: optionsTarget.pinned }" @click="togglePinned">{{ optionsTarget.pinned ? '已置顶' : '置顶' }}</button>
          </div>
          <div class="option-row">
            <span>消息免打扰</span>
            <button type="button" :class="{ active: optionsTarget.muted }" @click="toggleMuted">{{ optionsTarget.muted ? '已开启' : '关闭' }}</button>
          </div>

          <template v-if="optionsTarget.kind === 'group' && groupDraft">

            <div class="group-member-manager">
              <div class="group-member-manager-head">
                <strong>群成员</strong>
                <span>含我共 {{ (groupDraft.memberIds?.length || 0) + 1 }} 人</span>
              </div>
              <div class="member-select group-member-choices">
                <label v-for="contact in contacts" :key="contact.id">
                  <input
                    type="checkbox"
                    :checked="groupDraft.memberIds?.includes(contact.id)"
                    @change="toggleGroupDraftMember(contact.id)"
                  />
                  <span>{{ nameOf(contact) }}</span>
                  <small>{{ groupDraft.memberIds?.includes(contact.id) ? '已在群内' : '点击邀请' }}</small>
                </label>
              </div>
              <p class="group-member-hint">勾选联系人即可邀请入群；取消勾选会将该联系人移出群聊。</p>
            </div>
            <input v-model="groupDraft.name" type="text" maxlength="30" placeholder="修改群名" />
            <input v-model="groupDraft.chatBackground" type="text" placeholder="群聊背景图片链接" />
            <div class="sms-modal-actions left">
              <label class="modal-file-button">
                上传群聊背景
                <input type="file" accept="image/*" @change="pickGroupBackground" />
              </label>
            </div>
            <div
              v-if="groupDraft.chatBackground"
              class="group-bg-preview"
              :style="groupBgStyle()"
            ></div>
            <label v-if="groupDraft.chatBackground" class="group-opacity">
              <span>背景不透明度</span>
              <input v-model.number="groupDraft.chatBackgroundOpacity" type="range" min="0" max="100" />
              <strong>{{ groupDraft.chatBackgroundOpacity }}%</strong>
            </label>
            <div class="group-settings-danger">
              <button type="button" @click="removeSelectedGroup">解散并删除群聊</button>
            </div>
            <div class="sms-modal-actions">
              <button type="button" @click="optionsOpen = false">取消</button>
              <button type="button" @click="saveGroupOptions">保存群设置</button>
            </div>
          </template>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="groupCallPickerOpen" class="sms-modal-layer" @click.self="groupCallPickerOpen = false">
        <div class="sms-modal-card group-call-picker">
          <h3>发起{{ groupCallTitle }}</h3>
          <p class="group-call-hint">选择要在群聊里呼叫的成员</p>
          <div class="member-select group-call-member-select">
            <label v-for="member in groupMembersForTools" :key="member.id">
              <input
                type="checkbox"
                :checked="groupCallSelectedIds.includes(member.id)"
                @change="toggleGroupCallMember(member.id)"
              />
              <span>{{ nameOf(member) }}</span>
            </label>
          </div>
          <div class="sms-modal-actions">
            <button type="button" @click="groupCallPickerOpen = false">取消</button>
            <button type="button" :disabled="!groupCallSelectedIds.length" @click="confirmGroupCall">
              呼叫 {{ groupCallSelectedIds.length }} 人
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="groupCallPanelOpen && activeGroupCall" class="sms-modal-layer" @click.self="groupCallPanelOpen = false">
        <div class="sms-modal-card group-call-manager">
          <div class="group-call-manager-head">
            <div>
              <h3>{{ activeGroup.name }}</h3>
              <p>{{ groupCallTitle }} · {{ activeGroupCall.status }}</p>
            </div>
            <strong>{{ groupCallParticipantCount }} 人</strong>
          </div>
          <div class="group-call-member-list">
            <div v-for="member in groupMembersForTools" :key="member.id" class="group-call-member-row">
              <span class="group-call-member-avatar" :style="{ background: member.color }">
                <img v-if="member.avatarImage" :src="member.avatarImage" alt="" />
                <template v-else>{{ member.avatar }}</template>
              </span>
              <span>{{ nameOf(member) }}</span>
              <b :class="{ online: activeGroupCall.joinedMemberIds.includes(member.id) }">
                {{ activeGroupCall.joinedMemberIds.includes(member.id) ? '通话中' : '未加入' }}
              </b>
            </div>
          </div>
          <div class="group-call-manager-actions">
            <button v-if="!activeGroupCall.userJoined" type="button" class="join" @click="joinActiveGroupCall">加入通话</button>
            <button v-else type="button" class="leave" @click="leaveActiveGroupCall">退出通话</button>
            <button type="button" class="end" @click="endActiveGroupCall">结束群通话</button>
          </div>
        </div>
      </div>
    </teleport>


  </section>
</template>

<style scoped>

.avatar,
.call-avatar {
  position: relative;
  overflow: visible;
}

.avatar > .avatar-frame,
.call-avatar > .avatar-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  width: 120%;
  height: 120%;
  max-width: none;
  object-fit: contain;
  border-radius: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: none;
}

.conv-panel {
  border: 0 !important;
  box-shadow: none !important;
}

.chat-panel {
  position: relative;
}

.chat-load-older{display:block;margin:10px auto 8px;padding:6px 11px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-soft);color:var(--theme-muted);font-size:9px;font-weight:700;cursor:pointer}.chat-scroll {
  position: relative;
  background-color: var(--theme-surface);
}

.chat-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 27px;
  border-radius: 18px 18px 0 0;
}

.chat-contact-avatar {
  width: 36px;
  height: 36px;
  font-size: 13px;
}

.avatar img,
.call-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}

.chat-head-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.chat-head-main h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--theme-primary);
}

.chat-head-main span {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-accent);
}

.chat-back {
  display: none;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: rgba(255, 255, 255, 0.7);
  color: var(--theme-primary);
  font-size: 16px;
  line-height: 1;
  place-items: center;
  cursor: pointer;
}

.chat-empty {
  flex: 1;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--theme-accent);
  font-size: 13px;
  font-weight: 600;
}

.chat-empty .seal {
  font-size: 46px;
  filter: drop-shadow(0 6px 12px rgba(var(--theme-accent-rgb), 0.28));
}

/* 输入框只占可用空间，避免右侧文字被按钮区域遮住 */
.chat-input-area {
  align-items: flex-end;
}

.chat-field {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  min-height: 40px;
  max-height: 104px;
  padding: 10px 14px;
  line-height: 1.45;
  resize: none;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chat-field::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.chat-send-btn {
  flex: none;
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--theme-primary);
  border-radius: 50%;
  background: var(--theme-primary);
  color: #ffffff;
  display: grid;
  place-items: center;
  place-content: center;
  aspect-ratio: 1;
  font-size: 15px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
}

.chat-send-btn:disabled {
  opacity: 0.42;
  cursor: default;
}

@media (max-width: 380px) {
  .chat-input-area {
    gap: 6px;
    padding-right: 10px;
    padding-left: 10px;
  }

  .sticker-btn,
  .chat-more-btn {
    width: 34px;
    height: 34px;
  }

  .plus-btn {
    width: 36px;
    height: 36px;
  }

  .chat-send-btn {
    width: 36px;
    min-width: 36px;
    height: 36px;
    padding: 0;
  }

  .chat-field {
    min-height: 36px;
  }
}

.chat-input-area::before {
  display: none !important;
}

.plus-btn {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--theme-border);
  background: var(--theme-pale);
  color: var(--theme-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}
.plus-btn:hover {
  background: #ffffff;
}
.plus-btn.open {
  transform: rotate(45deg);
}
.plus-btn svg {
  width: 19px;
  height: 19px;
  display: block;
}

/* 微信式向下展开的工具面板 */
.tool-panel {
  flex: none;
  max-height: 260px;
  overflow: hidden;
  padding: 14px 14px 16px;
  background: var(--theme-surface);
  border-top: 2px solid var(--theme-border);
}

.tool-grid {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 1px 1px 5px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}

.tool-grid::-webkit-scrollbar {
  display: none;
}

.tool-page {
  flex: 0 0 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(2, auto);
  align-content: start;
  gap: 10px 8px;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.tool-item {
  width: 100%;
  max-width: 82px;
  min-width: 0;
  justify-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.tool-tile {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  border: 1px solid var(--theme-border-soft);
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(var(--theme-accent-rgb), 0.1);
  display: grid;
  place-items: center;
  color: var(--theme-primary);
  transition: transform 0.16s ease, background 0.16s ease;
}
.tool-item:hover .tool-tile {
  background: var(--theme-soft);
  transform: translateY(-2px);
}
.tool-item:active .tool-tile {
  transform: scale(0.94);
}
.tool-tile svg {
  width: 26px;
  height: 26px;
  display: block;
}

.tool-label {
  width: 100%;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-slide-enter-active,
.tool-slide-leave-active {
  transition: max-height 0.26s ease, opacity 0.2s ease,
    padding-top 0.26s ease, padding-bottom 0.26s ease;
}
.tool-slide-enter-from,
.tool-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* 转账卡片 */
.wish-order-message-card{width:min(250px,calc(100vw - 128px));padding:10px 11px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-surface);color:var(--theme-text);display:flex;flex-direction:column;gap:5px;text-align:left;cursor:pointer}
.wish-order-message-head,.wish-order-message-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}.wish-order-message-head b{color:var(--theme-primary);font-size:9px;letter-spacing:.08em}.wish-order-message-head small{padding:2px 5px;border-radius:5px;background:var(--theme-soft);color:var(--theme-muted);font-size:7.5px}.wish-order-message-card>strong{font-size:12px;color:var(--theme-text-strong)}.wish-order-message-items{color:var(--theme-text);font-size:9px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.wish-order-message-foot{color:var(--theme-muted);font-size:7.5px}.wish-order-message-foot em{color:var(--theme-text-strong);font-size:10px;font-style:normal;font-weight:800}
.transfer-card {
  position: relative;
  align-self: flex-start;
  width: min(240px, calc(100vw - 118px)) !important;
  min-height: 112px;
  padding: 12px 74px 12px 52px !important;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden !important;
}
.transfer-recipient { margin:-2px 0 3px; color:inherit; font-size:10.5px; opacity:.72; }
.transfer-top {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text);
}
.transfer-amount {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
  color: var(--theme-primary);
  position: relative;
  z-index: 4;
}
.transfer-note {
  margin-top: 4px;
  max-width: none;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--theme-text);
  position: relative;
  z-index: 4;
  white-space: normal;
  overflow-wrap: anywhere;
}
.redpacket-card {
  background: var(--theme-danger-surface) !important;
  border-color: var(--theme-danger-border) !important;
}
.redpacket-card .transfer-amount {
  color: var(--theme-accent-warm);
}

/* 图片 / 位置 / 文件 / 礼物卡片 */
.photo-card {
  width: 190px;
  padding: 8px;
}
.photo-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  border-radius: 14px;
}
.photo-card .safe-image-fallback {
  width: 100%;
  min-height: 0;
  aspect-ratio: 1;
  border-radius: 14px;
}
.photo-caption {
  margin-top: 6px;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text);
}

.mini-card {
  width: min(220px, calc(100vw - 128px));
  max-width: 100%;
  padding: 12px 14px;
  overflow: hidden;
}
.mini-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--theme-muted);
}
.mini-title {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 800;
  color: var(--theme-primary);
}
.mini-sub {
  margin-top: 4px;
  font-size: 10px;
  color: var(--theme-text);
}
.mini-note {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--theme-border-soft);
  color: var(--theme-text);
  font-size: 10.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* 通话记录 */
.call-row {
  display: flex;
  justify-content: center;
  margin: 14px 0;
}
.call-row .echoes-narrator {
  font-size: 11px;
}

/* 填写层：固定覆盖整个手机视口，内容过高时内部滚动 */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 260;
  display: grid;
  place-items: center;
  padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--theme-pale);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.sheet-card {
  width: min(360px, calc(100vw - 28px));
  max-height: calc(100dvh - 28px);
  box-sizing: border-box;
  overflow-y: auto;
  padding: 16px;
}

.hidden-file {
  display: none !important;
}
.sheet-title {
  text-align: center;
  font-size: 15px;
  font-weight: 800;
  color: var(--theme-primary);
  letter-spacing: 0.06em;
}
.amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--theme-border);
}
.amount-row span {
  font-size: 20px;
  font-weight: 800;
  color: var(--theme-primary);
}
.amount-row input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: 26px;
  font-weight: 800;
  color: #333333;
  outline: none;
}
.quick-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.quick-amounts button {
  flex: 1;
  min-width: 58px;
  padding: 7px 4px;
  border-radius: 10px;
  border: 1px solid var(--theme-border);
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.quick-amounts button:hover {
  background: var(--theme-pale);
}
.sheet-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.sheet-field > span {
  color: var(--theme-text);
  font-size: 10.5px;
  font-weight: 700;
}

.sheet-note {
  width: 100%;
  margin-top: 0;
  padding: 10px 12px;
  font-size: 12px;
}
.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.sheet-cancel,
.sheet-ok {
  flex: 1;
  padding: 11px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
}
.sheet-cancel {
  border: 1px solid var(--theme-border);
  background: #ffffff;
  color: var(--theme-text);
}
.sheet-ok {
  border: 0;
  background: var(--theme-primary);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(var(--theme-primary-rgb), 0.3);
}

.call-message-bubble {
  min-width: 170px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.nudge-row {
  display: flex;
  justify-content: center;
  margin: 14px 0;
  animation: nudge-shake 0.55s ease;
}

.nudge-row { margin: 22px 0 !important; }
.nudge-row + .msg { margin-top: 42px !important; }
.msg + .nudge-row { margin-top: 38px !important; }
.nudge-row + .call-row,
.call-row + .nudge-row { margin-top: 28px !important; }
.nudge-row span {
  padding: 7px 15px;
  border: 1px dashed var(--theme-border);
  border-radius: 12px;
  background: var(--theme-soft);
  color: var(--theme-accent);
  font-size: 10.5px;
  font-weight: 700;
}
.read-receipt-row { animation: none; margin: 10px 0 16px !important; }
.read-receipt-row span {
  border-style: solid;
  border-color: var(--theme-border-soft);
  border-radius: 12px;
  color: var(--theme-muted);
  font-weight: 600;
}

@keyframes nudge-shake {
  0%, 100% { transform: translateX(0); }
  22% { transform: translateX(-4px); }
  44% { transform: translateX(4px); }
  66% { transform: translateX(-2px); }
  82% { transform: translateX(2px); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 980px) {
  .sms-layout.chatting .conv-panel {
    display: none;
  }
  .sms-layout:not(.chatting) .chat-panel {
    display: none;
  }
  .chat-back {
    display: grid;
  }
  .chat-empty {
    min-height: 320px;
  }
}
/* 会话列表与聊天选项 */
.conv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 7px;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.conv-add {
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 18px;
  cursor: pointer;
}

.conv-item {
  cursor: pointer;
}

.conv-options {
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 50%;
  background: var(--theme-surface);
  color: var(--theme-accent);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.conv-pin {
  margin-right: 5px;
  padding: 1px 4px;
  border-radius: 5px;
  background: var(--theme-pale);
  color: var(--theme-primary);
  font-size: 8px;
  font-weight: 800;
}

.chat-back {
  display: grid !important;
}

.chat-head-options {
  flex: none;
  width: 34px;
  height: 34px;
  margin-left: auto;
  padding: 0;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  color: var(--theme-primary);
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  font-size: 15px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
}

.sticker-btn,
.chat-more-btn {
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-soft);
  color: var(--theme-primary);
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
}

.chat-more-btn {
  padding: 0;
  place-items: center;
  font-size: 12px;
  line-height: 1;
}
.proactive-dots {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transform: translateY(-1px);
}
.proactive-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  display: block;
}

.sticker-message img {
  width: 128px;
  height: 128px;
  object-fit: contain;
  display: block;
}
.sticker-message .safe-image-fallback {
  width: 128px;
  height: 128px;
  min-height: 0;
}
.msg-gift-img.safe-image-fallback {
  width: 84px;
  height: 84px;
  min-height: 0;
  border-radius: 50%;
}

.msg {
  position: relative;
}

.chat-scroll .msg.has-msg-meta {
  margin-bottom: 50px !important;
}

.msg-meta {
  position: absolute;
  left: 52px;
  right: 10px;
  bottom: -38px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--theme-muted);
  font-size: 8px;
  line-height: 1.2;
  pointer-events: none;
  box-shadow: none;
  filter: none;
  text-shadow: none;
}

.msg-meta.for-other { left: 52px; }
.msg-source {
  max-width: min(180px, 100%);
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--theme-soft);
  overflow: hidden;
  color: var(--theme-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: none;
  filter: none;
  text-shadow: none;
}

.msg.media-message {
  margin-top: 32px !important;
  margin-bottom: 18px !important;
}

.msg.transfer-message {
  margin-top: 32px !important;
  margin-bottom: 24px !important;
}

.msg-sender {
  position: absolute;
  top: -13px;
  left: 52px;
  color: var(--theme-muted);
  font-size: 9.5px;
  font-weight: 700;
}

/* 群聊使用更宽松的自适应行距，名称与上一条来源标签不重叠。 */
.chat-scroll.group-chat-scroll .msg {
  margin-top: clamp(20px, 4.8vw, 28px) !important;
  margin-bottom: clamp(20px, 4.8vw, 28px) !important;
  align-items: center;
}
.chat-scroll.group-chat-scroll .msg.other {
  box-sizing: border-box;
  padding-top: clamp(17px, 3.8vw, 21px);
}
.chat-scroll.group-chat-scroll .msg + .msg {
  margin-top: clamp(24px, 5.4vw, 30px) !important;
}
.chat-scroll.group-chat-scroll .nudge-row + .msg {
  margin-top: 42px !important;
}
.chat-scroll.group-chat-scroll .msg.has-msg-meta {
  margin-bottom: clamp(58px, 11vw, 68px) !important;
}
.chat-scroll.group-chat-scroll .msg-sender {
  top: 1px;
  right: 10px;
  max-width: calc(100% - 62px);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(9px, 1.3vw, 10.5px);
}

.sms-modal-layer {
  position: fixed;
  inset: 0;
  z-index: 170;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(var(--theme-overlay-rgb), 0.44);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.sms-modal-card {
  width: min(430px, 100%);
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

.sms-modal-card h3 {
  margin: 0 0 4px;
  color: var(--theme-primary);
  font-size: 15px;
  font-weight: 800;
}

.sms-modal-card > input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--theme-text-strong);
  font-size: 12px;
}

.member-select {
  max-height: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.member-select label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--theme-text);
  font-size: 11.5px;
  font-weight: 700;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--theme-text-strong);
  font-size: 12px;
  font-weight: 700;
}

.option-row button,
.sms-modal-actions button {
  padding: 8px 13px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.option-row button.active {
  border-color: var(--theme-accent);
  background: var(--theme-pale);
}

.sms-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.sms-modal-actions.left {
  justify-content: flex-start;
}

.sms-modal-actions button:last-child {
  border: 0;
  background: var(--theme-primary);
  color: #ffffff;
}

.modal-file-button {
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.modal-file-button input {
  display: none;
}

.group-bg-preview {
  height: 80px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background-size: cover;
  background-position: center;
}

.group-opacity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
  color: var(--theme-text);
  font-size: 10.5px;
  font-weight: 700;
}

.group-opacity input {
  accent-color: var(--theme-primary);
}

.group-opacity strong {
  color: var(--theme-primary);
  text-align: right;
}

/* 只有消息内容区域响应点击，头像、间距和空白区域不触发操作栏 */
.message-content {
  display: contents;
}
.msg { cursor: default; }
.msg.selected { background: rgba(var(--theme-border-rgb), 0.18); border-radius: 14px; }
.msg.selecting .bubble,
.msg.selecting .sticker-message,
.msg.selecting .transfer-card,
.msg.selecting .photo-card,
.msg.selecting .mini-card {
  cursor: pointer;
}
.msg-select-mark {
  flex: none;
  align-self: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #fff;
  color: var(--theme-muted);
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 800;
}
.msg-select-mark.active { background: var(--theme-primary); border-color: var(--theme-primary); color: #fff; }
.forwarded-tag {
  margin-left: auto;
  align-self: flex-start;
  color: var(--theme-muted);
  font-size: 9px;
  font-weight: 700;
}
.quoted-message {
  width: 100%;
  margin: 0 0 6px;
  padding: 6px 8px;
  border: 0;
  border-left: 3px solid var(--theme-accent);
  border-radius: 8px;
  background: var(--theme-pale);
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s ease;
}
.quoted-message:hover {
  background: rgba(var(--theme-border-rgb), 0.78);
}
.quoted-message strong { color: var(--theme-primary); font-size: 10px; }
.quoted-message span { color: var(--theme-text); font-size: 10.5px; line-height: 1.45; }

.quote-jump-target {
  border-radius: 16px;
  animation: quote-jump-flash 1.4s ease;
}

@keyframes quote-jump-flash {
  0%,
  100% {
    background: transparent;
    box-shadow: none;
  }
  22%,
  58% {
    background: var(--theme-pale);
    box-shadow: 0 0 0 4px rgba(var(--theme-muted-rgb), 0.25);
  }
}
.quote-compose {
  flex: none;
  margin: 0 12px 7px;
  padding: 8px 10px;
  border-left: 3px solid var(--theme-accent);
  border-radius: 10px;
  background: var(--theme-soft);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.quote-compose > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.quote-compose strong { color: var(--theme-primary); font-size: 10px; }
.quote-compose span { color: var(--theme-text); font-size: 10.5px; line-height: 1.4; }
.quote-compose button { border: 0; background: none; color: var(--theme-muted); font-size: 16px; cursor: pointer; }
.multi-toolbar {
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--theme-border-soft);
  background: var(--theme-soft);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--theme-text-strong);
  font-size: 10.5px;
  font-weight: 700;
}
.multi-toolbar span { flex: 1; }
.multi-toolbar button {
  padding: 6px 9px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: #fff;
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.multi-toolbar button:disabled { opacity: .5; cursor: default; }
.chat-action-notice {
  position: absolute;
  top: 64px;
  left: 50%;
  z-index: 15;
  transform: translateX(-50%);
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(var(--theme-primary-rgb), 0.16);
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.action-grid button {
  padding: 12px 6px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: #fff;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.action-grid button.danger { color: var(--theme-accent-warm); border-color: var(--theme-danger-border); background: var(--theme-danger-surface); }
.forward-list { max-height: 320px; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.forward-list button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: #fff;
  color: var(--theme-text-strong);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}
.forward-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 12px;
}
.info-card p { margin: 4px 0 8px; color: var(--theme-text); font-size: 12px; line-height: 1.7; white-space: pre-wrap; }

/* 消息顶部内联建议栏 */
.inline-message-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
  margin: 8px 8px 4px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--theme-soft);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.inline-message-actions > button:not(.inline-result-close) {
  min-width: 38px;
  padding: 3px 2px;
  border: 0;
  background: transparent;
  color: var(--theme-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}
.inline-message-actions > button:not(.inline-result-close):hover {
  color: var(--theme-primary);
}
.inline-message-actions small {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}
.inline-forward-title {
  width: 100%;
  color: var(--theme-primary);
  font-size: 10.5px;
  font-weight: 800;
}
.inline-forward-list {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.inline-forward-list button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 0;
  background: transparent;
  color: var(--theme-text-strong);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}
.inline-forward-list .forward-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 10px;
}
.inline-result {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.inline-result strong {
  color: var(--theme-primary);
  font-size: 10.5px;
}
.inline-result span {
  color: var(--theme-text);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.inline-result-close {
  align-self: flex-start;
  padding: 3px 5px;
  border: 0;
  background: transparent;
  color: var(--theme-muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}


.tool-item.active .tool-tile {
  border-color: var(--theme-primary);
  background: var(--theme-pale);
}

.photo-card img {
  cursor: zoom-in;
}

.batch-send-queue {
  flex: none;
  margin: 0 12px 8px;
  padding: 10px;
  border: 1px solid var(--theme-border);
  border-radius: 14px;
  background: var(--theme-surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-queue-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.batch-queue-head > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.batch-queue-head strong {
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 800;
}

.batch-queue-head span {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.batch-queue-head > button {
  flex: none;
  width: 24px;
  height: 24px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.batch-queue-list {
  max-height: 128px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.batch-queue-item {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 9px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 7px;
}

.batch-queue-index {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--theme-pale);
  color: var(--theme-primary);
  font-size: 9px;
  font-weight: 800;
}

.batch-queue-item img {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  object-fit: cover;
}

.batch-queue-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 10.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-queue-item > button {
  flex: none;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--theme-muted);
  cursor: pointer;
}

.batch-queue-empty {
  padding: 9px 10px;
  border-radius: 9px;
  background: #ffffff;
  color: var(--theme-muted);
  font-size: 10px;
  line-height: 1.5;
}

.batch-queue-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.batch-queue-actions button {
  padding: 7px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: #ffffff;
  color: var(--theme-text);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.batch-queue-actions button.primary {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: #ffffff;
}

.batch-queue-actions button:disabled {
  opacity: 0.45;
  cursor: default;
}

.photo-preview-layer {
  position: fixed;
  inset: 0;
  z-index: 320;
  display: grid;
  place-items: center;
  padding: 34px 18px;
  background: rgba(var(--theme-overlay-rgb), 0.88);
  cursor: zoom-out;
}

.photo-preview-layer img {
  display: block;
  max-width: min(94vw, 1100px);
  max-height: 88dvh;
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
}
.photo-preview-layer .safe-image-fallback {
  min-width: min(320px, 82vw);
  min-height: 180px;
  border-radius: 12px;
}

.photo-preview-close {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  right: 16px;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.nudge-layer {
  position: fixed;
  inset: 0;
  z-index: 310;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(var(--theme-overlay-rgb), 0.42);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.nudge-card {
  width: min(360px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(var(--theme-overlay-rgb), 0.28);
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.nudge-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 11px;
  border-bottom: 1px solid var(--theme-border-soft);
}

.nudge-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nudge-head strong {
  color: var(--theme-primary);
  font-size: 14px;
  font-weight: 800;
}

.nudge-head span {
  color: var(--theme-muted);
  font-size: 9.5px;
}

.nudge-head > button {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
  color: var(--theme-primary);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}

.nudge-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nudge-label {
  color: var(--theme-text);
  font-size: 10px;
  font-weight: 800;
}

.nudge-options {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.nudge-options button {
  min-width: 48px;
  padding: 7px 11px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.nudge-options button.active {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: #ffffff;
}

.nudge-text-options {
  flex-direction: column;
  align-items: stretch;
}

.nudge-text-options button {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}

.nudge-symbol-options button {
  min-width: 38px;
  height: 34px;
  padding: 0 9px;
  font-size: 16px;
}

.nudge-custom-text input,
.nudge-custom-symbol input {
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-soft);
  color: var(--theme-text-strong);
  font-size: 11px;
}

.nudge-custom-text,
.nudge-custom-symbol {
  display: flex;
  gap: 7px;
}

.nudge-custom-text button,
.nudge-custom-symbol button {
  flex: none;
  padding: 0 12px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.nudge-preview {
  min-height: 48px;
  padding: 12px;
  border: 1px dashed var(--theme-border);
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--theme-soft);
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
  text-align: center;
  word-break: break-word;
}

.nudge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.nudge-actions button {
  padding: 8px 15px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--theme-text);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.nudge-actions button.primary {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: #ffffff;
}

.nudge-actions button:disabled {
  opacity: 0.45;
  cursor: default;
}

.decorated-card {
  position: relative;
  display: block;
  width: fit-content;
  max-width: 100%;
}

.decorated-card::before,
.decorated-card::after {
  content: none;
  display: none;
  position: absolute;
  pointer-events: none;
  z-index: 5;
  background: none !important;
  border: 0;
  box-shadow: none !important;
  filter: none !important;
  text-shadow: none !important;
}

.decorated-card.from-other::before {
  top: -28px;
  left: -20px;
  width: clamp(52px, 15vw, 66px);
  height: clamp(52px, 15vw, 66px);
  background: url("../assets/theme/bubble-other.png") no-repeat center/contain;
  transform: rotate(-5deg);
  filter: drop-shadow(0 3px 5px rgba(var(--theme-accent-rgb), 0.1));
}

.decorated-card.from-me::before {
  top: -22px;
  right: -16px;
  width: clamp(42px, 12vw, 52px);
  height: clamp(42px, 12vw, 52px);
  background: url("../assets/theme/bubble-user.png") no-repeat center/contain;
  transform: rotate(4deg);
  filter: drop-shadow(0 3px 5px rgba(var(--theme-accent-rgb), 0.1));
}
/* 聊天礼物卡：分类色图标 + 黑白信息卡 */
.msg.gift-message{justify-content:center!important;width:100%!important;margin-top:34px!important;margin-bottom:22px!important}
.msg.gift-message>.avatar,.msg.gift-message>.msg-sender{display:none!important}
.msg-gift{width:100%;display:flex;justify-content:center}
.msg-gift-card{width:min(260px,80vw);padding:22px 18px 14px;box-sizing:border-box;border:1px solid rgba(0,0,0,.07);border-radius:20px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.06);text-align:center}
.msg-gift-emoji{width:84px;height:84px;margin:0 auto;border-radius:50%;display:grid;place-items:center;overflow:hidden;font-size:42px;line-height:1}
.msg-gift-img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.msg-gift-name{margin-top:14px;color:#111;font-size:16px;font-weight:600;letter-spacing:2px}
.msg-gift-divider{width:46px;height:1px;margin:12px auto 0;background:#e5e5e5}
.msg-gift-wish{margin-top:12px;color:#8a8a8a;font-size:13px;line-height:1.75;word-break:break-word}
.msg-gift-foot{display:flex;align-items:center;justify-content:space-between;margin-top:14px}.mg-side{color:#b5b5b5;font-size:11px;letter-spacing:.5px}.msg-gift-price{color:#c8c8c8;font-size:11px;letter-spacing:.3px}
/* 聊天工具与互动卡 */
.chat-tool-workbench{flex:none;margin:0 12px 10px;padding:11px;border:1px solid var(--theme-border-soft);border-radius:14px;background:var(--theme-surface);box-shadow:0 8px 22px rgba(var(--theme-overlay-rgb),.08)}
.chat-tool-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}.chat-tool-head>div{display:flex;flex-direction:column;gap:2px}.chat-tool-head strong{color:var(--theme-primary);font-size:12px}.chat-tool-head span{color:var(--theme-muted);font-size:8.5px}.chat-tool-head button{width:24px;height:24px;border:0;border-radius:50%;background:var(--theme-soft);color:var(--theme-muted);font-size:15px;cursor:pointer}
.chat-tool-body{display:flex;flex-direction:column;gap:8px}.chat-tool-body label{display:flex;flex-direction:column;gap:4px;color:var(--theme-text);font-size:9px}.chat-tool-body textarea,.chat-tool-body input{width:100%;padding:8px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px;resize:vertical}.chat-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.search-grid{grid-template-columns:1fr 1fr}.search-grid label:first-child{grid-column:1/-1}.tool-primary{padding:8px 10px;border:0;border-radius:9px;background:var(--theme-primary);color:var(--theme-inverse);font-size:10px;font-weight:800;cursor:pointer}.tool-primary:disabled{opacity:.45}.decision-result{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:8px;border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font-size:9px}.decision-result strong{color:var(--theme-primary);font-size:12px}.decision-result button{margin-left:auto;padding:4px 7px;border:1px solid var(--theme-border-soft);border-radius:7px;background:var(--theme-surface);color:var(--theme-primary);font-size:8px;cursor:pointer}.tool-history summary{color:var(--theme-muted);font-size:8.5px;cursor:pointer}.tool-history p{display:flex;justify-content:space-between;gap:8px;margin:5px 0;color:var(--theme-muted);font-size:8px}.tool-history p b{color:var(--theme-text);font-weight:600}.search-result-list{max-height:190px;overflow:auto;display:flex;flex-direction:column;gap:5px}.search-result-list button{display:grid;grid-template-columns:45px 1fr auto;align-items:center;gap:6px;padding:6px 7px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);text-align:left;cursor:pointer}.search-result-list button span{color:var(--theme-primary);font-size:8px}.search-result-list button strong{overflow:hidden;color:var(--theme-text);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.search-result-list button small{color:var(--theme-muted);font-size:7px}.tool-empty{min-height:60px;display:grid;place-items:center;color:var(--theme-muted);font-size:9px}
/* 聊天工具 */
@media(max-width:560px){.chat-tool-workbench{margin:0 7px 8px;padding:9px}.chat-tool-grid{grid-template-columns:1fr}.search-grid{grid-template-columns:1fr}.search-grid label:first-child{grid-column:auto}.search-result-list button{grid-template-columns:38px 1fr}.search-result-list button small{display:none}}

.chat-scroll:not(.group-chat-scroll) .msg{margin:6px 0!important}
.chat-scroll:not(.group-chat-scroll) .msg + .msg{margin-top:4px!important}
.chat-scroll:not(.group-chat-scroll) .msg.media-message{margin-top:10px!important;margin-bottom:8px!important}
.chat-scroll:not(.group-chat-scroll) .msg.transfer-message{margin-top:10px!important;margin-bottom:10px!important}
.chat-scroll:not(.group-chat-scroll) .msg.has-msg-meta{margin-bottom:42px!important}
.chat-scroll .echoes-timestamp{margin:12px 0 5px!important}
.group-avatar-editor{display:flex;align-items:center;gap:10px;margin:8px 0}.group-avatar-preview{width:54px;height:54px;flex:none;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--theme-soft);color:var(--theme-primary);font-size:18px}.group-avatar-preview img{width:100%;height:100%;object-fit:cover}.nudge-group-target{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0;color:var(--theme-text);font-size:10px}.nudge-group-target select{padding:7px 9px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.decision-group-members{display:flex;flex-wrap:wrap;gap:6px}.decision-group-members>span{width:100%;color:var(--theme-muted);font-size:8.5px}.decision-group-members label{display:flex;align-items:center;gap:4px;padding:5px 7px;border-radius:7px;background:var(--theme-soft);font-size:9px}.decision-group-members input{accent-color:var(--theme-primary)}
.group-call-banner{width:calc(100% - 24px);margin:0 12px 8px;padding:8px 10px;display:flex;align-items:center;gap:9px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-soft);color:var(--theme-text);text-align:left;cursor:pointer}
.group-call-banner-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.group-call-banner-copy strong{font-size:11px}.group-call-banner-copy small{overflow:hidden;color:var(--theme-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.group-call-banner>b{flex:none;color:var(--theme-primary);font-size:9px}
.group-call-live{width:8px;height:8px;flex:none;border-radius:50%;background:var(--theme-positive,#43b581);box-shadow:0 0 0 3px color-mix(in srgb,var(--theme-positive,#43b581) 18%,transparent);animation:group-call-pulse 1.5s ease-in-out infinite}
@keyframes group-call-pulse{50%{opacity:.45;transform:scale(.8)}}
.group-call-hint{margin:-2px 0 9px;color:var(--theme-muted);font-size:9px;line-height:1.5}.group-call-member-select{max-height:min(42vh,300px);overflow:auto}
.group-call-manager{width:min(360px,calc(100vw - 30px));max-height:min(76vh,560px);overflow:auto}.group-call-manager-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}.group-call-manager-head h3{margin:0}.group-call-manager-head p{margin:3px 0 0;color:var(--theme-muted);font-size:9px}.group-call-manager-head>strong{padding:4px 7px;border-radius:999px;background:var(--theme-soft);color:var(--theme-primary);font-size:9px}
.group-call-member-list{display:flex;flex-direction:column;gap:6px;margin:8px 0 13px}.group-call-member-row{display:flex;align-items:center;gap:8px;padding:6px;border-radius:10px;background:var(--theme-soft);font-size:10px}.group-call-member-row>span:nth-child(2){flex:1;min-width:0}.group-call-member-row>b{color:var(--theme-muted);font-size:8.5px}.group-call-member-row>b.online{color:var(--theme-positive,#43b581)}.group-call-member-avatar{width:30px;height:30px;flex:none;border-radius:50%;overflow:hidden;display:grid;place-items:center;color:#fff;font-size:10px}.group-call-member-avatar img{width:100%;height:100%;object-fit:cover}
.group-call-manager-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.group-call-manager-actions button{min-height:38px;border:0;border-radius:10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.group-call-manager-actions .join{background:var(--theme-primary);color:var(--theme-inverse)}.group-call-manager-actions .leave{background:var(--theme-soft);color:var(--theme-text)}.group-call-manager-actions .end{grid-column:1/-1;background:var(--theme-danger-surface,var(--theme-soft));color:var(--theme-accent-warm)}
@media(max-width:560px){.group-call-banner{width:calc(100% - 18px);margin:0 9px 7px}.group-call-manager{width:calc(100vw - 24px)}}

/* 每条消息作为一个完整条目排版：时间、气泡/图片、标签共同决定内容高度，条目之间保持统一空隙。 */
.chat-scroll{--chat-message-gap:15px;display:flex!important;flex-direction:column!important;gap:var(--chat-message-gap)!important;padding-bottom:32px!important;}
.chat-message-item{flex:none;width:100%;display:flex;flex-direction:column;gap:var(--chat-message-gap)!important;margin:0!important;padding:0!important;overflow:visible;}
.chat-message-item .echoes-timestamp{margin:0!important;line-height:1.35;}
.chat-message-item .msg,.chat-message-item .msg.media-message,.chat-message-item .msg.transfer-message,.chat-message-item .msg.gift-message,.chat-message-item .msg.has-msg-meta{margin:0!important;padding:0!important;align-items:center!important;flex-wrap:wrap!important;row-gap:0!important;overflow:visible!important;}
.chat-scroll:not(.group-chat-scroll) .chat-message-item .msg,.chat-scroll:not(.group-chat-scroll) .chat-message-item .msg.media-message,.chat-scroll:not(.group-chat-scroll) .chat-message-item .msg.transfer-message,.chat-scroll:not(.group-chat-scroll) .chat-message-item .msg.gift-message,.chat-scroll:not(.group-chat-scroll) .chat-message-item .msg.has-msg-meta,.chat-scroll.group-chat-scroll .chat-message-item .msg,.chat-scroll.group-chat-scroll .chat-message-item .msg.media-message,.chat-scroll.group-chat-scroll .chat-message-item .msg.transfer-message,.chat-scroll.group-chat-scroll .chat-message-item .msg.gift-message,.chat-scroll.group-chat-scroll .chat-message-item .msg.has-msg-meta{margin:0!important;}
.chat-message-item .msg + .msg{margin-top:0!important;}
.chat-message-item .echoes-bubble-user,.chat-message-item .echoes-bubble-other{transform:none!important;}
.chat-message-item .msg-meta{position:static!important;left:auto!important;right:auto!important;bottom:auto!important;order:99;flex:0 0 calc(100% - 52px)!important;width:calc(100% - 52px)!important;margin:var(--chat-message-gap) 8px 0 52px!important;padding:0;}
.chat-message-item .msg .bubble{min-height:42px;box-sizing:border-box;}
.chat-message-item .msg-sender{top:0;right:auto;left:52px;}
.chat-message-item .msg.other:has(.msg-sender){padding-top:14px!important;}
.chat-message-item .nudge-row,.chat-message-item .call-row,.chat-message-item .read-receipt-row{margin:0!important;}
.nudge-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;}
.nudge-pager button{padding:6px 10px;border:1px solid var(--theme-border);border-radius:9px;background:var(--theme-surface);color:var(--theme-text);font-size:9px;font-weight:700;cursor:pointer;}
.nudge-pager span{color:var(--theme-muted);font-size:9px;}
.group-member-manager{margin:10px 0 12px;padding:10px;border-radius:12px;background:var(--theme-soft)}
.group-member-manager-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;color:var(--theme-text)}.group-member-manager-head strong{font-size:10.5px}.group-member-manager-head span{color:var(--theme-muted);font-size:9px}
.group-member-choices{max-height:180px;overflow:auto}.group-member-choices label{position:relative}.group-member-choices small{margin-left:auto;color:var(--theme-muted);font-size:7.5px}
.group-member-hint{margin:7px 0 0;color:var(--theme-muted);font-size:8.5px;line-height:1.55}
.group-settings-danger{margin-top:12px;padding-top:10px;border-top:1px solid var(--theme-border-soft)}.group-settings-danger button{width:100%;padding:9px;border:0;border-radius:10px;background:var(--theme-danger-surface,var(--theme-soft));color:var(--theme-accent-warm);font:inherit;font-size:9.5px;font-weight:800;cursor:pointer}
@media(max-width:560px){.group-member-choices{max-height:150px}}
</style>



