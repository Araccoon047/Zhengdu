export const BASE_TRANSFER_CARD_SKIN_OPTIONS = [
  { id: 'follow', name: '跟随气泡装饰', description: '转账卡使用当前聊天气泡的角落装饰' },
  { id: 'seal', name: '小海豹', description: '淡海蓝章主题的小海豹转账卡' },
  { id: 'mono', name: '默认黑白', description: '干净的黑白描边转账卡' },
  { id: 'maotaotao', name: '猫桃桃', description: '粉白猫桃桃主题转账卡' },
]

export function transferCardSkinOptions(themes = []) {
  return [
    ...BASE_TRANSFER_CARD_SKIN_OPTIONS,
    ...themes.map((theme) => ({
      id: `theme-${theme.id}`,
      name: `主题 · ${theme.name}`,
      description: `使用「${theme.name}」的转账卡外观，与当前网站主题独立`,
    })),
  ]
}

export const STATUS_BUBBLE_SKIN_OPTIONS = [
  { id: 'follow', name: '跟随气泡', description: '拍一拍和已读不回跟随当前气泡风格' },
  { id: 'seal', name: '小海豹', description: '淡海蓝章小海豹状态提示' },
  { id: 'mono', name: '默认黑白', description: '黑白线框状态提示' },
  { id: 'maotaotao', name: '猫桃桃', description: '粉白猫桃桃状态提示' },
]

export const CARD_SKIN_IDS = BASE_TRANSFER_CARD_SKIN_OPTIONS.map((skin) => skin.id)