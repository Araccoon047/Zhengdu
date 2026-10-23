export const CHAT_TOOL_CATALOG = [
  {
    id: 'batchSend',
    label: '发多条',
    icon: 'multi',
    category: '消息与媒体',
    description: '把文字、图片、表情等先放进预存栏，确认后按顺序逐条发送；最后一条发送完成后才触发联系人回复。',
  },
  {
    id: 'photo',
    label: '照片',
    icon: 'photo',
    category: '消息与媒体',
    description: '从设备选择并发送照片；点击聊天中的照片可放大查看。',
  },
  {
    id: 'location',
    label: '位置',
    icon: 'location',
    category: '消息与媒体',
    description: '发送位置卡片，并自行填写当前地点名称。',
  },
  {
    id: 'gift',
    label: '礼物',
    icon: 'gift',
    category: '消息与媒体',
    description: '自定义礼物名称与留言，以礼物卡片发送给对方。',
  },
  {
    id: 'nudge',
    label: '拍一拍',
    icon: 'nudge',
    category: '消息与媒体',
    description: '选择动作和前置符号发送拍一拍；联系人也可能主动拍你。',
  },
  {
    id: 'voiceCall',
    label: '语音电话',
    icon: 'phone',
    category: '消息与媒体',
    description: '发起语音通话；刷新页面不会挂断，手动结束后双方聊天中都会留下通话时长气泡。',
  },
  {
    id: 'videoCall',
    label: '视频电话',
    icon: 'video',
    category: '消息与媒体',
    description: '发起视频通话；刷新页面不会挂断，手动结束后双方聊天中都会留下通话时长气泡。',
  },
  {
    id: 'transfer',
    label: '转账',
    icon: 'transfer',
    category: '消息与媒体',
    description: '自定义转账金额和留言，也可以点选 520、1314 等快捷金额。',
  },
  {
    id: 'decision',
    label: '帮我决定',
    icon: 'scale',
    category: '辅助工具',
    description: '输入问题和候选项，让 TA 随机选择一个或多个结果；结果可以先预览，再发送到聊天。',
    hint: '随机抽取问题结果',
  },
  {
    id: 'search',
    label: '搜索记录',
    icon: 'search',
    category: '辅助工具',
    description: '按关键词和日期搜索当前会话，点击结果即可定位到原消息。',
    hint: '按关键词和日期搜索',
  },
]

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function createDefaultChatToolSettings() {
  return {
    enabled: Object.fromEntries(CHAT_TOOL_CATALOG.map((tool) => [tool.id, true])),
    decisionDefaultCount: 1,
    decisionDefaultSeconds: 2,
    decisionHistoryLimit: 30,
    searchResultLimit: 80,
  }
}

export function normalizeChatToolSettings(source = {}) {
  const defaults = createDefaultChatToolSettings()
  const value = source && typeof source === 'object' ? source : {}
  const enabledSource = value.enabled && typeof value.enabled === 'object' ? value.enabled : {}
  return {
    enabled: Object.fromEntries(
      CHAT_TOOL_CATALOG.map((tool) => [tool.id, enabledSource[tool.id] !== false])
    ),
    decisionDefaultCount: clampInteger(value.decisionDefaultCount, 1, 10, defaults.decisionDefaultCount),
    decisionDefaultSeconds: clampInteger(value.decisionDefaultSeconds, 1, 10, defaults.decisionDefaultSeconds),
    decisionHistoryLimit: clampInteger(value.decisionHistoryLimit, 10, 200, defaults.decisionHistoryLimit),
    searchResultLimit: clampInteger(value.searchResultLimit, 10, 200, defaults.searchResultLimit),
  }
}

export function isChatToolEnabled(toolSettings, id) {
  return toolSettings?.enabled?.[id] !== false
}
