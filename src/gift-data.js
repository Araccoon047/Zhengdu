export const SYSTEM_GIFT_NAMES = [
  { text: '一束小雏菊', emoji: '💐', price: 68 },
  { text: '一杯热可可', emoji: '☕', price: 26 },
  { text: '一枚月亮徽章', emoji: '🌙', price: 52 },
  { text: '一条软乎乎的围巾', emoji: '🧣', price: 128 },
  { text: '手写信和干花', emoji: '💌', price: 88 },
  { text: '草莓奶油蛋糕', emoji: '🍰', price: 158 },
  { text: '一只毛绒小熊', emoji: '🧸', price: 199 },
  { text: '星星玻璃罐', emoji: '✨', price: 66 },
  { text: '薄荷巧克力礼盒', emoji: '🍫', price: 99 },
  { text: '海边寄来的明信片', emoji: '🌊', price: 36 },
]

export const SYSTEM_GIFT_NOTES = [
  '路过的时候看见它，觉得你会喜欢。',
  '今天也辛苦了，想把一点甜送给你。',
  '不需要特别的日子，只是想送你。',
  '希望它替我陪你一会儿。',
  '看到它的第一眼就想到了你。',
  '把今天的小幸运分你一半。',
  '收下吧，下次见面再给你带一份。',
  '愿你的今天柔软又明亮。',
  '小小一份心意，请务必收下。',
  '想和你一起分享这一刻。',
]

export const SYSTEM_GIFT_GROUPS = [
  {
    name: '礼物名称',
    type: 'name',
    cards: SYSTEM_GIFT_NAMES.map((item) => item.text),
  },
  {
    name: '礼物备注',
    type: 'note',
    cards: [...SYSTEM_GIFT_NOTES],
  },
]

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function randomSystemGift() {
  const gift = randomItem(SYSTEM_GIFT_NAMES)
  return {
    name: gift.text,
    note: randomItem(SYSTEM_GIFT_NOTES),
    emoji: gift.emoji,
    price: gift.price,
  }
}

export function systemGiftEntryByText(text) {
  return SYSTEM_GIFT_NAMES.find((item) => item.text === text) || null
}