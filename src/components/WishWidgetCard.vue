<script setup>
import { computed } from 'vue'
import { go } from '../store'
import { wishlistStats } from '../wishlist'

const props = defineProps({
  editing: { type: Boolean, default: false },
})

const message = computed(() => {
  if (wishlistStats.value.pending > 0) return `有 ${wishlistStats.value.pending} 个新订单`
  if (wishlistStats.value.accepted > 0) return `有 ${wishlistStats.value.accepted} 个未完成订单`
  return '暂无新订单'
})
const detail = computed(() => {
  if (wishlistStats.value.pending > 0) return 'TA 的小票已经打印出来了'
  if (wishlistStats.value.accepted > 0) return '礼物还在等你准备'
  return '安静等一封新的愿望'
})

function openWishlist() {
  if (!props.editing) go('wishlist')
}
</script>

<template>
  <section class="wish-widget-card" :class="{ editing }" role="button" tabindex="0" @click="openWishlist" @keydown.enter="openWishlist">
    <span class="wish-widget-mark" aria-hidden="true">✦</span>
    <div class="wish-widget-copy">
      <span>我想要这个！</span>
      <strong>{{ message }}</strong>
      <small>{{ detail }}</small>
    </div>
    <span class="wish-widget-arrow" aria-hidden="true">›</span>
  </section>
</template>

<style scoped>
.wish-widget-card{width:100%;height:100%;min-width:0;min-height:0;padding:clamp(8px,5cqw,16px);border:1px solid var(--theme-border-soft);border-radius:20px;background:var(--theme-surface);color:var(--theme-text);display:flex;align-items:center;gap:clamp(8px,5cqw,13px);overflow:hidden;cursor:pointer;box-shadow:none;filter:none;container-type:size}
.wish-widget-mark{flex:none;width:clamp(38px,30cqw,54px);aspect-ratio:1;border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);display:grid;place-items:center;font-size:clamp(18px,12cqw,28px)}
.wish-widget-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.wish-widget-copy>span{color:var(--theme-muted);font-size:clamp(7px,4cqw,10px);font-weight:800;letter-spacing:.08em}.wish-widget-copy strong{overflow:hidden;color:var(--theme-text-strong);font-size:clamp(11px,7cqw,17px);line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.wish-widget-copy small{overflow:hidden;color:var(--theme-muted);font-size:clamp(7px,4.2cqw,10px);line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
.wish-widget-arrow{flex:none;color:var(--theme-primary);font-size:clamp(16px,10cqw,24px)}.wish-widget-card.editing{cursor:grab}
@container (max-width: 90px){
  .wish-widget-mark,.wish-widget-arrow{display:none}
}
@container (max-height: 88px){
  .wish-widget-mark{width:32px;font-size:16px}
  .wish-widget-copy>span{display:none}
  .wish-widget-copy strong{font-size:11px}
  .wish-widget-copy small{font-size:7.5px}
  .wish-widget-arrow{font-size:17px}
}
</style>