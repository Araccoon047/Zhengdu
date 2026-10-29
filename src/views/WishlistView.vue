<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { chatState, contactDisplayName } from '../chat'
import { settings } from '../settings'
import { imageFileToDataUrl } from '../image-utils'
import {
  WISHLIST_COMPLETION_MESSAGE,
  acceptWishOrder,
  addWishlistItem,
  clearWishOrderFocus,
  completeWishOrder,
  createContactOrder,
  formatWishDate,
  formatWishPrice,
  normalizeWishWidgetSize,
  rejectWishOrder,
  removeWishlistItem,
  sendWishOrderToChat,
  updateWishlistItem,
  wishlistState,
  wishlistStats,
} from '../wishlist'

const activeTab = ref('items')
const orderFilter = ref('all')
const itemEditorOpen = ref(false)
const editingItemId = ref('')
const imageInput = ref(null)
const itemImageBusy = ref(false)
const receiptOpen = ref(false)
const selectedOrderId = ref('')
const printSerial = ref(0)
const completionOpen = ref(false)
const notice = ref('')
let noticeTimer = null

const itemDraft = ref(emptyItemDraft())
const contacts = computed(() => Array.isArray(chatState.contacts) ? chatState.contacts : [])
const items = computed(() => wishlistState.items)
const orders = computed(() => wishlistState.orders)
const selectedOrder = computed(() => orders.value.find((order) => order.id === selectedOrderId.value) || null)
const filteredOrders = computed(() => {
  if (orderFilter.value === 'all') return orders.value
  return orders.value.filter((order) => order.status === orderFilter.value)
})
const tabs = [
  { id: 'items', label: '物品' },
  { id: 'orders', label: '订单' },
  { id: 'tickets', label: '票夹' },
]
const filters = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待处理' },
  { id: 'accepted', label: '待完成' },
  { id: 'completed', label: '已完成' },
  { id: 'rejected', label: '已拒绝' },
]

function emptyItemDraft() {
  return {
    name: '',
    price: '',
    limit: 1,
    image: '',
    noImage: true,
    exclusiveContactId: '',
  }
}
function showNotice(text) {
  notice.value = String(text || '')
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    if (notice.value === text) notice.value = ''
  }, 2400)
}
function contactLabel(contact) {
  return contactDisplayName(contact)
}
function statusLabel(status) {
  return {
    pending: '待接受',
    accepted: '待完成',
    completed: '已完成',
    rejected: '已拒绝',
  }[status] || status
}
function itemsSummary(order) {
  return order.items.map((item) => `${item.name} × ${item.qty}`).join('；')
}
function openItemEditor(item = null) {
  editingItemId.value = item?.id || ''
  itemDraft.value = item
    ? {
        name: item.name,
        price: String(item.price || ''),
        limit: item.limit,
        image: item.image || '',
        noImage: item.noImage !== false,
        exclusiveContactId: item.exclusiveContactId || '',
      }
    : emptyItemDraft()
  itemEditorOpen.value = true
}
function closeItemEditor() {
  if (itemImageBusy.value) return
  itemEditorOpen.value = false
  editingItemId.value = ''
}
function chooseItemImage() {
  imageInput.value?.click()
}
async function onItemImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  itemImageBusy.value = true
  try {
    itemDraft.value.image = await imageFileToDataUrl(file, 720, 0.84)
    itemDraft.value.noImage = false
  } catch {
    showNotice('图片读取失败，请换一张图片重试')
  } finally {
    itemImageBusy.value = false
    event.target.value = ''
  }
}
function saveItem() {
  const name = itemDraft.value.name.trim()
  if (!name) {
    showNotice('先给愿望起一个名字')
    return
  }
  const payload = {
    name,
    price: Math.max(0, Number(itemDraft.value.price) || 0),
    limit: Math.max(1, Math.min(99, Math.round(Number(itemDraft.value.limit) || 1))),
    image: itemDraft.value.image,
    noImage: Boolean(itemDraft.value.noImage),
    exclusiveContactId: itemDraft.value.exclusiveContactId || '',
  }
  if (editingItemId.value) updateWishlistItem(editingItemId.value, payload)
  else addWishlistItem(payload)
  itemEditorOpen.value = false
  editingItemId.value = ''
  showNotice('愿望已保存')
}
function deleteItem() {
  if (!editingItemId.value) return
  if (!window.confirm(`删除“${itemDraft.value.name}”？`)) return
  removeWishlistItem(editingItemId.value)
  itemEditorOpen.value = false
  editingItemId.value = ''
  showNotice('愿望已删除')
}
function openReceipt(order) {
  if (!order) return
  selectedOrderId.value = order.id
  printSerial.value += 1
  receiptOpen.value = true
}
function closeReceipt() {
  receiptOpen.value = false
  selectedOrderId.value = ''
}
function acceptOrder(order) {
  if (!acceptWishOrder(order.id)) return
  showNotice('已接受订单，完成后记得标记完成')
}
function rejectOrder(order) {
  if (!rejectWishOrder(order.id)) return
  showNotice('已拒绝订单，TA 会主动来找你')
}
function finishOrder(order) {
  if (!completeWishOrder(order.id)) return
  completionOpen.value = true
}
function sendToChat(order) {
  if (sendWishOrderToChat(order.id)) showNotice('订单已发送到聊天')
  else showNotice('发送失败，请检查联系人是否还在')
}
function handleFocusedOrder() {
  const id = wishlistState.focusOrderId
  if (!id) return
  const order = orders.value.find((item) => item.id === id)
  if (order) {
    activeTab.value = 'orders'
    openReceipt(order)
  }
  clearWishOrderFocus()
}
function normalizeWidgetSizeInput() {
  wishlistState.widgetSize = normalizeWishWidgetSize(wishlistState.widgetSize)
}
function syncWidgetLayout(enabled) {
  if (!Array.isArray(settings.homeLayout)) settings.homeLayout = []
  const existing = settings.homeLayout.find((item) => item.id === 'wish-widget')
  if (enabled && !existing) {
    settings.homeLayout.push({ id: 'wish-widget', page: 2, x: 1, y: 2 })
  } else if (enabled && existing && existing.page === 1 && existing.x === 2 && existing.y === 2) {
    existing.page = 2
    existing.x = 1
    existing.y = 2
  } else if (!enabled && existing) {
    settings.homeLayout = settings.homeLayout.filter((item) => item.id !== 'wish-widget')
  }
}
function makeTestOrder() {
  const order = createContactOrder({ source: 'manual' })
  if (!order) {
    showNotice('请先添加至少一个愿望')
    return
  }
  openReceipt(order)
  clearWishOrderFocus()
}
function handleWishOrderEvent(event) {
  const id = String(event?.detail?.id || '')
  if (!id) return
  const order = orders.value.find((item) => item.id === id)
  if (order) openReceipt(order)
  clearWishOrderFocus()
}

watch(() => wishlistState.widgetEnabled, syncWidgetLayout, { immediate: true })
onMounted(() => { handleFocusedOrder(); window.addEventListener('zhengdu:wish-order', handleWishOrderEvent) })
onUnmounted(() => { window.clearTimeout(noticeTimer); window.removeEventListener('zhengdu:wish-order', handleWishOrderEvent) })
</script>

<template>
  <section class="wish-app">
    <header class="wish-app-head">
      <div>
        <span class="wish-kicker">WISH LIST</span>
        <h1>我想要这个！</h1>
        <p>{{ items.length }} 个愿望 · {{ wishlistStats.pending }} 张新订单</p>
      </div>
      <button class="wish-settings-button" type="button" aria-label="许愿设置" title="许愿设置" @click="activeTab = 'settings'">⚙</button>
    </header>

    <div v-if="notice" class="wish-notice">{{ notice }}</div>

    <template v-if="activeTab === 'items'">
      <div class="wish-summary">
        <div><span>新订单</span><strong>{{ wishlistStats.pending }}</strong></div>
        <div><span>待完成</span><strong>{{ wishlistStats.accepted }}</strong></div>
        <div><span>票夹</span><strong>{{ wishlistStats.total }}</strong></div>
      </div>
      <div class="wish-item-grid">
        <button
          v-for="item in items"
          :key="item.id"
          class="wish-item-card"
          type="button"
          @click="openItemEditor(item)"
        >
          <span class="wish-item-image">
            <img v-if="!item.noImage && item.image" :src="item.image" alt="" />
            <span v-else class="wish-item-placeholder">✦</span>
          </span>
          <span class="wish-item-copy">
            <strong>{{ item.name }}</strong>
            <small>{{ formatWishPrice(item.price) }} · 限购 {{ item.limit }}</small>
            <em v-if="item.exclusiveContactId">限定联系人</em>
          </span>
          <span class="wish-edit-mark">编辑</span>
        </button>
        <button class="wish-add-card" type="button" @click="openItemEditor()">
          <span>＋</span>
          <strong>添加愿望</strong>
          <small>自定义图片、价格和限购</small>
        </button>
      </div>
    </template>

    <template v-else-if="activeTab === 'orders'">
      <div class="wish-filter-row">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          :class="{ active: orderFilter === filter.id }"
          @click="orderFilter = filter.id"
        >{{ filter.label }}</button>
      </div>
      <div v-if="filteredOrders.length" class="wish-order-list">
        <article v-for="order in filteredOrders" :key="order.id" class="wish-order-card">
          <header>
            <div>
              <span>{{ order.no }}</span>
              <strong>{{ order.contactName }} 的愿望小票</strong>
            </div>
            <b :class="['wish-status', order.status]">{{ statusLabel(order.status) }}</b>
          </header>
          <p>{{ itemsSummary(order) }}</p>
          <div class="wish-order-meta">
            <span>{{ formatWishDate(order.createdAt) }}</span>
            <strong>{{ formatWishPrice(order.total) }}</strong>
          </div>
          <div class="wish-order-actions">
            <button type="button" class="wish-secondary" @click="openReceipt(order)">查看小票</button>
            <template v-if="order.status === 'pending'">
              <button type="button" class="wish-primary" @click="acceptOrder(order)">接受</button>
              <button type="button" class="wish-danger" @click="rejectOrder(order)">拒绝</button>
            </template>
            <template v-else-if="order.status === 'accepted'">
              <button type="button" class="wish-secondary" @click="sendToChat(order)">发到聊天</button>
              <button type="button" class="wish-primary" @click="finishOrder(order)">完成</button>
            </template>
            <button v-else-if="order.status === 'completed'" type="button" class="wish-secondary" @click="sendToChat(order)">发到聊天</button>
          </div>
        </article>
      </div>
      <div v-else class="wish-empty">这里还没有对应的订单。</div>
    </template>

    <template v-else-if="activeTab === 'tickets'">
      <div class="wish-ticket-intro">
        <span>RECEIPT ARCHIVE</span>
        <strong>所有打印过的小票都收在这里</strong>
      </div>
      <div v-if="orders.length" class="wish-ticket-list">
        <button v-for="order in orders" :key="order.id" type="button" class="wish-ticket-card" @click="openReceipt(order)">
          <span class="wish-ticket-head"><b>我想要这个！</b><small>{{ order.no }}</small></span>
          <strong>{{ order.contactName }}</strong>
          <span>{{ itemsSummary(order) }}</span>
          <span class="wish-ticket-foot"><time>{{ formatWishDate(order.createdAt) }}</time><em>{{ statusLabel(order.status) }}</em></span>
        </button>
      </div>
      <div v-else class="wish-empty">票夹还是空的，等 TA 来下单吧。</div>
    </template>

    <template v-else>
      <section class="wish-settings-page">
        <header>
          <div><span>WISH SETTINGS</span><strong>许愿设置</strong></div>
          <button type="button" @click="activeTab = 'items'">返回物品</button>
        </header>
        <label class="wish-setting-row">
          <span><strong>一次最多购买几种物品</strong><small>联系人下单时最多选择的愿望种类</small></span>
          <input v-model.number="wishlistState.maxKinds" type="number" min="1" max="20" />
        </label>
        <label class="wish-setting-row">
          <span><strong>桌面组件比例</strong><small>例如 2x1、3x2，宽度和高度均为 1–4 个 APP</small></span>
          <input v-model="wishlistState.widgetSize" class="wish-size-input" type="text" maxlength="3" placeholder="2x1" @change="normalizeWidgetSizeInput" />
        </label>
        <label class="wish-setting-row">
          <span><strong>允许联系人自动下单</strong><small>关闭后只能使用下方测试按钮生成订单</small></span>
          <input v-model="wishlistState.autoOrderEnabled" type="checkbox" />
        </label>
        <label class="wish-setting-row">
          <span><strong>指定下单联系人</strong><small>不选则随机；专属物品的联系人设定优先</small></span>
          <select v-model="wishlistState.preferredContactId" class="wish-setting-select"><option value="">随机联系人</option><option v-for="contact in contacts" :key="contact.id" :value="contact.id">{{ contactLabel(contact) }}</option></select>
        </label>
        <label class="wish-setting-row" :class="{ disabled: !wishlistState.autoOrderEnabled }">
          <span><strong>下单概率</strong><small>每次到达下单间隔时，触发订单的概率</small></span>
          <span class="wish-percent-input"><input v-model.number="wishlistState.orderChance" type="number" min="0" max="100" :disabled="!wishlistState.autoOrderEnabled" /><b>%</b></span>
        </label>
        <div class="wish-setting-row" :class="{ disabled: !wishlistState.autoOrderEnabled }">
          <span><strong>下单时间间隔</strong><small>单位：天，实际时间会在区间内随机浮动</small></span>
          <div class="wish-range-inputs">
            <input v-model.number="wishlistState.orderMinDays" type="number" min="1" max="365" :disabled="!wishlistState.autoOrderEnabled" />
            <span>至</span>
            <input v-model.number="wishlistState.orderMaxDays" type="number" min="1" max="365" :disabled="!wishlistState.autoOrderEnabled" />
            <span>天</span>
          </div>
        </div>
        <label class="wish-setting-row">
          <span><strong>开启桌面组件</strong><small>显示新订单和未完成订单数量</small></span>
          <input v-model="wishlistState.widgetEnabled" type="checkbox" />
        </label>
        <div class="wish-rule-note">
          每个物品有自己的限购数量；联系人有固定的小概率不遵守限购，这个概率不会被展示或修改。设置专属联系人后，该物品通常会优先由指定联系人来购买。
        </div>
        <button class="wish-test-button" type="button" @click="makeTestOrder">让 TA 现在下一单</button>
      </section>
    </template>

    <nav class="wish-bottom-tabs" aria-label="许愿 APP 导航">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
    </nav>

    <teleport to="body">
      <div v-if="itemEditorOpen" class="wish-layer" @click.self="closeItemEditor">
        <section class="wish-editor" role="dialog" aria-modal="true" aria-label="编辑愿望">
          <header><div><span>{{ editingItemId ? 'EDIT WISH' : 'NEW WISH' }}</span><strong>{{ editingItemId ? '编辑愿望' : '添加愿望' }}</strong></div><button type="button" aria-label="关闭" @click="closeItemEditor">×</button></header>
          <div class="wish-image-editor">
            <button type="button" class="wish-image-preview" :disabled="itemImageBusy" @click="chooseItemImage">
              <img v-if="!itemDraft.noImage && itemDraft.image" :src="itemDraft.image" alt="" />
              <span v-else>✦</span>
              <small>{{ itemImageBusy ? '处理中…' : '上传图片' }}</small>
            </button>
            <label class="wish-no-image"><input v-model="itemDraft.noImage" type="checkbox" />无图片</label>
            <input ref="imageInput" class="wish-hidden-file" type="file" accept="image/*" @change="onItemImage" />
          </div>
          <label class="wish-field"><span>物品名称</span><input v-model="itemDraft.name" type="text" maxlength="30" placeholder="例如：一枚戒指" /></label>
          <div class="wish-field-pair">
            <label class="wish-field"><span>价格</span><input v-model="itemDraft.price" type="number" min="0" step="0.01" placeholder="0 表示无价" /></label>
            <label class="wish-field"><span>每种限购</span><input v-model.number="itemDraft.limit" type="number" min="1" max="99" /></label>
          </div>
          <label class="wish-field"><span>专属联系人</span><select v-model="itemDraft.exclusiveContactId"><option value="">所有联系人都可以买</option><option v-for="contact in contacts" :key="contact.id" :value="contact.id">{{ contactLabel(contact) }}</option></select></label>
          <div class="wish-editor-actions">
            <button v-if="editingItemId" type="button" class="wish-danger" @click="deleteItem">删除</button>
            <span></span>
            <button type="button" class="wish-secondary" @click="closeItemEditor">取消</button>
            <button type="button" class="wish-primary" :disabled="itemImageBusy" @click="saveItem">保存</button>
          </div>
        </section>
      </div>

      <div v-if="receiptOpen && selectedOrder" class="wish-layer receipt-layer" @click.self="closeReceipt">
        <div class="wish-printer">
          <div class="wish-printer-slot"><span></span></div>
          <article :key="printSerial" class="wish-receipt">
            <header><strong>我想要这个！</strong><span>WISH RECEIPT</span></header>
            <div class="wish-receipt-meta"><span>单号 {{ selectedOrder.no }}</span><span>{{ formatWishDate(selectedOrder.createdAt) }}</span></div>
            <div class="wish-receipt-contact">来自：{{ selectedOrder.contactName }}</div>
            <div class="wish-receipt-lines">
              <div v-for="item in selectedOrder.items" :key="item.itemId + item.name">
                <span>{{ item.name }} × {{ item.qty }}<small v-if="item.price">{{ formatWishPrice(item.price * item.qty) }}</small></span>
                <b>{{ formatWishPrice(item.price * item.qty) }}</b>
              </div>
            </div>
            <div class="wish-receipt-total"><span>合计</span><strong>{{ formatWishPrice(selectedOrder.total) }}</strong></div>
            <div class="wish-receipt-status">{{ statusLabel(selectedOrder.status) }}</div>
            <div class="wish-receipt-actions">
              <template v-if="selectedOrder.status === 'pending'">
                <button type="button" class="wish-danger" @click="rejectOrder(selectedOrder)">拒绝</button>
                <button type="button" class="wish-primary" @click="acceptOrder(selectedOrder)">接受</button>
              </template>
              <template v-else-if="selectedOrder.status === 'accepted'">
                <button type="button" class="wish-secondary" @click="sendToChat(selectedOrder)">发到聊天</button>
                <button type="button" class="wish-primary" @click="finishOrder(selectedOrder)">完成</button>
              </template>
              <template v-else>
                <button v-if="selectedOrder.status === 'completed'" type="button" class="wish-secondary" @click="sendToChat(selectedOrder)">发到聊天</button>
                <button type="button" class="wish-primary" @click="closeReceipt">收好小票</button>
              </template>
            </div>
          </article>
        </div>
      </div>

      <div v-if="completionOpen" class="wish-layer" @click.self="completionOpen = false">
        <section class="wish-complete-dialog" role="dialog" aria-modal="true" aria-label="订单完成提示">
          <span class="wish-package-icon">✦</span>
          <strong>礼物正在打包中</strong>
          <p>{{ WISHLIST_COMPLETION_MESSAGE }}</p>
          <button type="button" class="wish-primary" @click="completionOpen = false">知道了</button>
        </section>
      </div>
    </teleport>
  </section>
</template>

<style scoped>
.wish-app{max-width:760px;margin:0 auto;padding:0 12px 88px;color:var(--theme-text);position:relative}
.wish-app-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:4px 0 12px}
.wish-kicker{color:var(--theme-muted);font-size:8px;font-weight:800;letter-spacing:.18em}
.wish-app-head h1{margin:2px 0 3px;color:var(--theme-text-strong);font-size:20px;line-height:1.1}
.wish-app-head p{margin:0;color:var(--theme-muted);font-size:9.5px}
.wish-settings-button{width:36px;height:36px;flex:none;padding:0;border:1px solid var(--theme-border-soft);border-radius:50%;background:var(--theme-surface);color:var(--theme-primary);font-size:16px;cursor:pointer}
.wish-notice{padding:8px 11px;margin-bottom:10px;border-radius:11px;background:var(--theme-soft);color:var(--theme-primary);font-size:10px;font-weight:700}
.wish-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:11px}
.wish-summary div{padding:9px 10px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-surface);display:flex;flex-direction:column;gap:2px}
.wish-summary span{color:var(--theme-muted);font-size:8.5px}.wish-summary strong{color:var(--theme-text-strong);font-size:17px}
.wish-item-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.wish-item-card{position:relative;min-width:0;padding:0;border:1px solid var(--theme-border-soft);border-radius:15px;background:var(--theme-surface);color:var(--theme-text);text-align:left;overflow:hidden;cursor:pointer}
.wish-item-image{display:grid;place-items:center;width:100%;aspect-ratio:1.55;background:var(--theme-soft);overflow:hidden}
.wish-item-image img{width:100%;height:100%;object-fit:cover;display:block}
.wish-item-placeholder{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--theme-surface);color:var(--theme-primary);font-size:20px}
.wish-item-copy{display:flex;flex-direction:column;gap:3px;padding:8px 9px 9px;min-width:0}
.wish-item-copy strong{overflow:hidden;color:var(--theme-text-strong);font-size:11px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.wish-item-copy small{overflow:hidden;color:var(--theme-muted);font-size:8.5px;text-overflow:ellipsis;white-space:nowrap}
.wish-item-copy em{align-self:flex-start;padding:2px 5px;border-radius:5px;background:var(--theme-soft);color:var(--theme-primary);font-size:7.5px;font-style:normal;font-weight:800}
.wish-edit-mark{position:absolute;top:6px;right:6px;padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.82);color:var(--theme-primary);font-size:7.5px;font-weight:800;pointer-events:none}
.wish-add-card{min-height:150px;padding:14px;border:1px dashed var(--theme-border);border-radius:15px;background:transparent;color:var(--theme-text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}
.wish-add-card span{color:var(--theme-primary);font-size:26px;line-height:1}.wish-add-card strong{font-size:11px}.wish-add-card small{color:var(--theme-muted);font-size:8px;text-align:center}
.wish-filter-row{display:flex;gap:5px;overflow-x:auto;padding-bottom:8px}
.wish-filter-row button{flex:none;padding:7px 10px;border:1px solid var(--theme-border-soft);border-radius:999px;background:var(--theme-surface);color:var(--theme-muted);font-size:9px;font-weight:700;cursor:pointer}
.wish-filter-row button.active{background:var(--theme-primary);color:var(--theme-inverse);border-color:var(--theme-primary)}
.wish-order-list{display:flex;flex-direction:column;gap:9px}
.wish-order-card{padding:11px;border:1px solid var(--theme-border-soft);border-radius:15px;background:var(--theme-surface)}
.wish-order-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.wish-order-card>header div{display:flex;flex-direction:column;gap:2px;min-width:0}.wish-order-card>header span{color:var(--theme-muted);font-size:8px}.wish-order-card>header strong{color:var(--theme-text-strong);font-size:11px}
.wish-order-card>p{margin:9px 0 7px;color:var(--theme-text);font-size:10px;line-height:1.55}
.wish-status{flex:none;padding:3px 6px;border-radius:6px;background:var(--theme-soft);color:var(--theme-primary);font-size:7.5px}.wish-status.accepted{color:#8d6a20}.wish-status.completed{color:#3f7a52}.wish-status.rejected{color:#a85555}
.wish-order-meta{display:flex;align-items:center;justify-content:space-between;color:var(--theme-muted);font-size:8.5px}.wish-order-meta strong{color:var(--theme-text-strong);font-size:12px}
.wish-order-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;padding-top:8px;border-top:1px solid var(--theme-border-soft)}
.wish-order-actions button,.wish-editor-actions button,.wish-receipt-actions button,.wish-complete-dialog button{min-height:29px;padding:6px 10px;border:0;border-radius:8px;font-size:9px;font-weight:800;cursor:pointer}
.wish-primary{background:var(--theme-primary);color:var(--theme-inverse)}.wish-secondary{background:var(--theme-soft);color:var(--theme-text)}.wish-danger{background:var(--theme-danger-surface,var(--theme-soft));color:var(--theme-accent-warm,#a85555)}
.wish-ticket-intro{padding:11px;margin-bottom:9px;border:1px solid var(--theme-border-soft);border-radius:14px;background:var(--theme-surface);display:flex;flex-direction:column;gap:3px}.wish-ticket-intro span{color:var(--theme-muted);font-size:7px;letter-spacing:.16em}.wish-ticket-intro strong{font-size:11px}
.wish-ticket-list{display:flex;flex-direction:column;gap:9px}
.wish-ticket-card{width:100%;padding:11px;border:1px solid var(--theme-border-soft);border-radius:15px;background:var(--theme-surface);color:var(--theme-text);text-align:left;display:flex;flex-direction:column;gap:6px;cursor:pointer}
.wish-ticket-head,.wish-ticket-foot{display:flex;justify-content:space-between;gap:6px;color:var(--theme-muted);font-size:7.5px}.wish-ticket-head b{color:var(--theme-primary);font-size:8.5px}.wish-ticket-card>strong{font-size:10px}.wish-ticket-card>span:not(.wish-ticket-head):not(.wish-ticket-foot){color:var(--theme-text);font-size:8.5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.wish-ticket-foot em{font-style:normal}.wish-ticket-foot time{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wish-settings-page{display:flex;flex-direction:column;gap:8px}
.wish-settings-page>header{display:flex;align-items:center;justify-content:space-between;padding:4px 0 2px}.wish-settings-page>header div{display:flex;flex-direction:column;gap:2px}.wish-settings-page>header span{color:var(--theme-muted);font-size:7px;letter-spacing:.16em}.wish-settings-page>header strong{color:var(--theme-text-strong);font-size:14px}.wish-settings-page>header button{padding:6px 9px;border:0;border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font-size:8.5px;cursor:pointer}
.wish-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-surface)}
.wish-setting-row.disabled{opacity:.55}.wish-setting-row>span{display:flex;flex-direction:column;gap:2px;min-width:0}.wish-setting-row strong{font-size:10px}.wish-setting-row small{color:var(--theme-muted);font-size:8px;line-height:1.4}.wish-setting-row>input[type="number"]{width:70px;padding:6px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.wish-setting-row>input[type="checkbox"]{accent-color:var(--theme-primary)}
.wish-setting-select{width:120px;max-width:48%;padding:6px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:9px}.wish-percent-input{display:flex;align-items:center;gap:4px;flex:none}.wish-percent-input input,.wish-size-input{width:58px;padding:6px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:9px}.wish-percent-input b{color:var(--theme-muted);font-size:9px}.wish-size-input{width:54px;text-align:center;text-transform:lowercase}
.wish-range-inputs{display:flex;align-items:center;gap:4px;flex:none;color:var(--theme-muted);font-size:8px}.wish-range-inputs input{width:62px;padding:6px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:9px;min-width:0}
.wish-rule-note{padding:10px;border-radius:11px;background:var(--theme-soft);color:var(--theme-muted);font-size:8.5px;line-height:1.65}
.wish-test-button{padding:10px;border:0;border-radius:10px;background:var(--theme-primary);color:var(--theme-inverse);font-size:10px;font-weight:800;cursor:pointer}
.wish-empty{padding:34px 12px;color:var(--theme-muted);font-size:10px;text-align:center;border:1px dashed var(--theme-border-soft);border-radius:14px}
.wish-bottom-tabs{position:sticky;bottom:8px;z-index:15;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;margin-top:14px;padding:4px;border:1px solid var(--theme-border-soft);border-radius:14px;background:color-mix(in srgb,var(--theme-surface) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.wish-bottom-tabs button{padding:9px 6px;border:0;border-radius:10px;background:transparent;color:var(--theme-muted);font-size:10px;font-weight:800;cursor:pointer}.wish-bottom-tabs button.active{background:var(--theme-primary);color:var(--theme-inverse)}
.wish-layer{position:fixed;inset:0;z-index:280;display:grid;place-items:center;padding:14px max(10px,env(safe-area-inset-right)) 14px max(10px,env(safe-area-inset-left));background:rgba(var(--theme-overlay-rgb),.38);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);overflow:auto;overscroll-behavior:contain}
.wish-editor{width:min(400px,100%);max-height:calc(100dvh - 28px);overflow-y:auto;padding:12px;border:1px solid var(--theme-border);border-radius:17px;background:var(--theme-surface);display:flex;flex-direction:column;gap:9px;box-sizing:border-box}
.wish-editor>header{display:flex;justify-content:space-between;align-items:flex-start}.wish-editor>header div{display:flex;flex-direction:column;gap:2px}.wish-editor>header span{color:var(--theme-muted);font-size:7px;letter-spacing:.15em}.wish-editor>header strong{color:var(--theme-text-strong);font-size:13px}.wish-editor>header button{border:0;background:transparent;color:var(--theme-muted);font-size:18px;cursor:pointer}
.wish-image-editor{display:flex;align-items:center;gap:10px}.wish-image-preview{position:relative;width:84px;height:84px;padding:0;border:1px solid var(--theme-border-soft);border-radius:13px;background:var(--theme-soft);color:var(--theme-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;overflow:hidden;cursor:pointer}.wish-image-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.wish-image-preview span{font-size:24px}.wish-image-preview small{position:relative;z-index:1;padding:2px 4px;border-radius:5px;background:rgba(255,255,255,.8);color:#555;font-size:7px}.wish-no-image{display:flex;align-items:center;gap:6px;color:var(--theme-text);font-size:9px}.wish-no-image input{accent-color:var(--theme-primary)}.wish-hidden-file{display:none}
.wish-field{display:flex;flex-direction:column;gap:4px}.wish-field span{color:var(--theme-muted);font-size:8px;font-weight:700}.wish-field input,.wish-field select{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10px}.wish-field-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wish-editor-actions{display:grid;grid-template-columns:auto 1fr auto auto;gap:5px;padding-top:4px}
.receipt-layer{align-items:start;padding-top:max(18px,env(safe-area-inset-top))}
.wish-printer{position:relative;width:min(360px,100%);margin:auto;padding-top:22px}
.wish-printer-slot{position:relative;z-index:2;height:22px;border-radius:8px 8px 3px 3px;background:color-mix(in srgb,var(--theme-text-strong) 82%,#111);box-shadow:inset 0 -5px 0 rgba(0,0,0,.28)}
.wish-printer-slot span{position:absolute;left:18px;right:18px;bottom:5px;height:3px;border-radius:2px;background:rgba(255,255,255,.45)}
.wish-receipt{position:relative;z-index:1;margin:-3px 7px 0;padding:16px 15px 19px;background:#fffef9;color:#292d31;font-family:'Courier New','Microsoft YaHei',monospace;box-shadow:0 12px 30px rgba(0,0,0,.18);animation:receiptPrint .85s steps(14,end) both,receiptTear .5s .88s cubic-bezier(.2,.7,.2,1) both}
.wish-receipt::after{content:'';position:absolute;right:0;bottom:-7px;left:0;height:8px;background:#fffef9;clip-path:polygon(0 0,100% 0,100% 25%,96% 82%,92% 23%,88% 76%,84% 20%,80% 78%,76% 26%,72% 86%,68% 28%,64% 74%,60% 22%,56% 84%,52% 25%,48% 76%,44% 20%,40% 82%,36% 26%,32% 78%,28% 24%,24% 86%,20% 28%,16% 74%,12% 22%,8% 84%,4% 27%,0 75%);filter:drop-shadow(0 3px 2px rgba(0,0,0,.08));pointer-events:none}
@keyframes receiptPrint{0%{clip-path:inset(0 0 100% 0);transform:translateY(-16px)}70%{clip-path:inset(0 0 8% 0);transform:translateY(2px)}100%{clip-path:inset(0);transform:translateY(0)}}
@keyframes receiptTear{0%{transform:translateY(0) rotate(0)}42%{transform:translateY(-2px) rotate(-.18deg)}100%{transform:translateY(8px) rotate(.5deg)}}
.wish-receipt>header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:8px;border-bottom:2px dashed #b8b1a7}.wish-receipt>header strong{font-size:16px;letter-spacing:.06em}.wish-receipt>header span{font-size:7px;letter-spacing:.18em;color:#756f67}.wish-receipt-meta,.wish-receipt-contact{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:#68625b;font-size:8.5px}.wish-receipt-contact{justify-content:flex-start;padding-bottom:8px;border-bottom:1px dashed #c8c1b8}
.wish-receipt-lines{display:flex;flex-direction:column;gap:7px;padding:10px 0;border-bottom:1px dashed #c8c1b8}.wish-receipt-lines>div{display:flex;justify-content:space-between;gap:10px;font-size:10px;line-height:1.35}.wish-receipt-lines>div>span{display:flex;flex-direction:column;gap:1px}.wish-receipt-lines small{font-size:7.5px;color:#8c857c}.wish-receipt-lines b{white-space:nowrap}
.wish-receipt-total{display:flex;justify-content:space-between;padding:10px 0 5px;font-size:12px}.wish-receipt-total strong{font-size:16px}.wish-receipt-status{text-align:center;margin:7px auto 10px;padding:5px 12px;border:2px solid #8c7668;color:#765f51;font-size:10px;font-weight:800;letter-spacing:.16em}
.wish-receipt-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
.wish-complete-dialog{width:min(390px,100%);padding:18px;border:1px solid var(--theme-border);border-radius:18px;background:var(--theme-surface);display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px}.wish-package-icon{width:54px;height:54px;border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);display:grid;place-items:center;font-size:26px}.wish-complete-dialog strong{color:var(--theme-text-strong);font-size:15px}.wish-complete-dialog p{margin:0;color:var(--theme-text);font-size:10px;line-height:1.75;text-align:left}
@media(max-width:560px){.wish-app{padding:0 9px 84px}.wish-app-head h1{font-size:18px}.wish-item-grid{gap:7px}.wish-ticket-list{gap:6px}.wish-setting-row{align-items:flex-start}.wish-range-inputs{flex-wrap:wrap;justify-content:flex-end}.wish-range-inputs input{width:54px}.wish-editor{max-height:calc(100dvh - 20px)}.wish-receipt{padding:14px 12px}}
@media(prefers-reduced-motion:reduce){.wish-receipt{animation:none}.wish-layer{backdrop-filter:none}}
</style>