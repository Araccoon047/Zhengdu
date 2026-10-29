export const EXPORT_CATEGORIES = [
  { key: 'characters', label: '角色与群聊', hint: '联系人、群聊、头像、背景和角色资料' },
  { key: 'cards', label: '字卡', hint: '每个联系人的字卡和字卡分组' },
  { key: 'stickers', label: '表情包', hint: '表情包文件、分组和使用分配' },
  { key: 'chats', label: '聊天与朋友圈', hint: '聊天记录、群聊消息和朋友圈动态' },
  { key: 'settings', label: '网站设置', hint: '主题、纪念日、背景、TA 的回复、AI 等设置' },
  { key: 'album', label: '相册照片', hint: '相册中的全部照片和自定义合集' },
  { key: 'wishlist', label: '许愿订单与票夹', hint: '订单、票夹、愿望物品、限购和商店设置' },
  { key: 'music', label: '音乐', hint: '音乐库、歌单、收藏、播放记录、设置和本地音频文件' },
  { key: 'mailbox', label: '信箱', hint: '来信、回信、收藏和信件队列' },
  { key: 'calendar', label: '日历与纪念日', hint: '日历记录、纪念日、提醒和日历设置' },
  { key: 'period', label: '经期记录', hint: '经期配置、每日状态和历史记录' },
  { key: 'questionnaire', label: '问卷记录', hint: '问卷、答案和答题历史' },
  { key: 'accounting', label: '记账', hint: '账单、分类和预算设置' },
  { key: 'tarot', label: '塔罗与决策', hint: '塔罗记录、自定义牌面和决策历史' },
  { key: 'pomodoro', label: '番茄钟', hint: '番茄钟设置和运行记录' },
  { key: 'avatarLib', label: '头像库', hint: '用户与联系人头像库、轮换状态' },
  { key: 'runtime', label: '其他应用数据', hint: '首页会话、通话状态、时间偏移等尚未归类的数据' },
]

export const CORE_STORAGE_KEYS = new Set([
  'zhengdu_sms_v1',
  'zhengdu_groups_v1',
  'zhengdu_custom_settings_v1',
  'zhengdu_sticker_groups_v1',
  'zhengdu_stickers_v1',
  'zhengdu_moments_v1',
  'zhengdu_album_collections_v1',
  'zhengdu_album_v1',
])

export const APP_STORAGE_GROUPS = {
  wishlist: ['zhengdu_wishlist_'],
  music: ['zhengdu_music_'],
  mailbox: ['zhengdu_mailbox_'],
  calendar: ['zhengdu_calendar_', 'zhengdu_memorials_', 'zhengdu_anniversary_reminder_'],
  period: ['zhengdu_period_'],
  questionnaire: ['zhengdu_questionnaire_'],
  accounting: ['zhengdu_accounting_'],
  tarot: ['zhengdu_divination_', 'zhengdu_decision_history_'],
  pomodoro: ['zhengdu_pomodoro_'],
  avatarLib: ['zhengdu_avatar_'],
  runtime: [],
}

export function isAppDataCategory(key) {
  return Object.prototype.hasOwnProperty.call(APP_STORAGE_GROUPS, key)
}

function appKeys() {
  const keys = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith('zhengdu_')) keys.push(key)
    }
  } catch {}
  return keys
}

function matchesPrefix(key, prefixes) {
  return prefixes.some((prefix) => key.startsWith(prefix))
}

export function storageKeysForCategory(category) {
  if (!isAppDataCategory(category)) return []
  if (category === 'runtime') {
    return appKeys().filter((key) => {
      if (CORE_STORAGE_KEYS.has(key)) return false
      return !Object.entries(APP_STORAGE_GROUPS).some(([group, prefixes]) =>
        group !== 'runtime' && matchesPrefix(key, prefixes)
      )
    })
  }
  return appKeys().filter((key) => matchesPrefix(key, APP_STORAGE_GROUPS[category]))
}

export function readStorageCategory(category) {
  const result = {}
  for (const key of storageKeysForCategory(category)) {
    try {
      result[key] = localStorage.getItem(key) || ''
    } catch {}
  }
  return result
}