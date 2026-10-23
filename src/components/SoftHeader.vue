<script setup>
defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
})
defineEmits(['back'])
</script>

<template>
  <header class="soft-header">
    <button class="header-back" type="button" aria-label="返回桌面" @click="$emit('back')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>

    <div class="header-title">
      <h1>{{ title }}</h1>
      <span v-if="sub" class="sub">{{ sub }}</span>
    </div>

    <span class="header-side" />
  </header>
</template>
