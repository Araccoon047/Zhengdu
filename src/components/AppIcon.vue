<script setup>
import { computed } from 'vue'
import SoftGlyph from './SoftGlyph.vue'

const props = defineProps({
  type: { type: String, required: true },
  label: { type: String, default: '' },
  badge: { type: [Number, String], default: 0 },
  compact: { type: Boolean, default: false },
})

defineEmits(['click'])

const gradients = {
  sms: 'var(--theme-primary)',
  album: 'var(--theme-primary)',
  music: 'var(--theme-primary)',
  home: 'var(--theme-primary)',
}

const tileStyle = computed(() => ({
  background: gradients[props.type] || gradients.home,
}))
</script>

<template>
  <button class="app-icon" type="button" @click="$emit('click')">
    <span class="icon-tile" :style="tileStyle">
      <SoftGlyph :type="type" />
      <span v-if="badge" class="badge">{{ badge > 99 ? '99+' : badge }}</span>
    </span>
    <span v-if="!compact && label" class="icon-label">{{ label }}</span>
  </button>
</template>
