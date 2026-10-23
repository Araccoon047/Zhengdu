<script setup>
defineProps({ type: String })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="type === 'copy'">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </template>
    <template v-else-if="type === 'translate'">
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7Z" />
      <path d="M14 20l3-8 3 8M15 17h4" />
    </template>
    <template v-else-if="type === 'quote'">
      <path d="M5 9h5v5H6a5 5 0 0 0 4 4" />
      <path d="M14 9h5v5h-4a5 5 0 0 0 4 4" />
    </template>
    <template v-else-if="type === 'forward'">
      <path d="M14 5l6 6-6 6" />
      <path d="M20 11H8a5 5 0 0 0-5 5v2" />
    </template>
    <template v-else-if="type === 'multiselect'">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </template>
    <template v-else-if="type === 'interpret'">
      <path d="M9 18h6M10 21h4" />
      <path d="M8.5 15.5a6 6 0 1 1 7 0c-.8.7-1.5 1.5-1.5 2.5h-4c0-1-.7-1.8-1.5-2.5Z" />
    </template>
    <template v-else-if="type === 'recall'">
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h8a7 7 0 1 1 0 14" />
    </template>
    <template v-else-if="type === 'delete'">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </template>
  </svg>
</template>

<style scoped>
svg { width: 22px; height: 22px; display: block; }
</style>
