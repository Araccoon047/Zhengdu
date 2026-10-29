import { reactive } from 'vue'

/**
 * 站点状态
 * page: 当前页面 home | sms | album | music | journey | moments | more | settings | profile
 * unreadSms: 短信未读数（导航与首页卡片用）
 */
export const store = reactive({
  page: 'home',
  homePage: 0,
  albumCollectionId: 'default',
  view: 'phone', // phone：手机端结构视图；site：电脑网站视图
  unreadSms: 0,
  groupCreateRequest: 0,
  cardLibraryContactId: null,
  // 功能大全 → 聊天工具：外部请求打开某个工具，SmsView 消费后清空
  chatToolRequest: null,
  // 功能大全 → 设置页：外部请求直接进入某个设置分区
  pendingSettingsSection: null,
})

export function requestGroupCreate() {
  store.groupCreateRequest += 1
}

export function toggleView() {
  store.view = store.view === 'phone' ? 'site' : 'phone'
}

export function go(page) {
  store.page = page
  if (typeof document !== 'undefined') {
    const main = document.querySelector('.site-main')
    if (main) main.scrollTop = 0
  }
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

/** 功能大全：请求在聊天页打开某个工具（对应 chat-tools.js 的 id） */
export function requestChatTool(id) {
  store.chatToolRequest = { id, at: Date.now() }
}

/** 功能大全：跳到设置页并直接进入某个分区 */
export function requestSettingsSection(id) {
  store.pendingSettingsSection = id
  go('settings')
}
