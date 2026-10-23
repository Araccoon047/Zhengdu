<script setup>
defineProps({
  type: { type: String, required: true },
})
</script>

<template>
  <svg
    v-if="type === 'sms'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6.6h16v8.8a2.2 2.2 0 0 1-2.2 2.2H9.4L5.2 20.6v-3H4a2 2 0 0 1-2-2V8.6a2 2 0 0 1 2-2Z" transform="translate(1 0)" />
    <circle cx="9" cy="11" r="1" fill="#fff" stroke="none" />
    <circle cx="12.6" cy="11" r="1" fill="#fff" stroke="none" />
    <circle cx="16.2" cy="11" r="1" fill="#fff" stroke="none" />
  </svg>

  <svg
    v-else-if="type === 'album'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3.6" y="5.2" width="16.8" height="13.6" rx="3" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="M5.4 17.2l4.3-4.3 3.2 3.2 2.6-2.6 3.1 3.1" />
  </svg>

  <svg
    v-else-if="type === 'music'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M10 17.2V6.6l8.4-2.1v9.8" />
    <circle cx="7.6" cy="17.6" r="2.4" />
    <circle cx="16" cy="14.7" r="2.4" />
  </svg>

  <svg
    v-else
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 11.2 12 4l8 7.2" />
    <path d="M6.4 9.6V19a1.4 1.4 0 0 0 1.4 1.4h8.4A1.4 1.4 0 0 0 17.6 19V9.6" />
    <path d="M10.2 20.4v-4.6h3.6v4.6" />
  </svg>
</template>
