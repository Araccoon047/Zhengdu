<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, required: true },
})

// The default "white line" icon set supplied in APP图标/默认图标-白.
// Markup is static and local; currentColor keeps every icon theme-aware.
const iconMarkup = {
  home: `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  stats: `<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h8"/><path d="M7 11h12"/><path d="M7 6h3"/>`,
  mail: `<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>`,
  tarot: `<path d="M14.832 8.445a1 1 0 00-1.589-.098l-2.075 3.098a1 1 0 000 1.11l2 3a1 1 0 001.664 0l2-3a1 1 0 000-1.11z"/><path d="m7.18 20.827-5-11a2 2 0 01.993-2.647L7 5.44"/><rect x="7" y="2" width="14" height="20" rx="2"/>`,
  profile: `<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>`,
  user: `<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>`,
  journey: `<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>`,
  moments: `<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>`,
  pomodoro: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l-4 2"/>`,
  album: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
  sms: `<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>`,
  settings: `<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>`,
  music: `<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>`,
  questionnaire: `<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>`,
  period: `<path d="M12 2s6 5.2 6 11a6 6 0 0 1-12 0c0-5.8 6-11 6-11Z"/><path d="M9 14c1 1.4 2 2 3 2"/>`,
  accounting: `<path d="M4 5h16v14H4z"/><path d="M4 9h16"/><path d="M15 13h3"/><path d="M8 13h4"/>`,
  multi: `<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h4M12 17h4"/>`,
  photo: `<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/>`,
  location: `<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>`,
  gift: `<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3.5 12.5h17M12 9v11"/><path d="M12 9c-1-3-4-3.5-4-1.5S11 9 12 9Zm0 0c1-3 4-3.5 4-1.5S13 9 12 9Z"/>`,
  nudge: `<path d="M9 11.5V6.3a1.6 1.6 0 0 1 3.2 0v4.2"/><path d="M12.2 10V5.1a1.6 1.6 0 0 1 3.2 0v5"/><path d="M15.4 10V6.4a1.6 1.6 0 0 1 3.2 0v6.1c0 4.1-2.4 7-6.3 7-2.4 0-4.1-1.1-5.4-3.2L4.4 12a1.7 1.7 0 0 1 2.8-1.9L9 12.2"/>`,
  phone: `<path d="M6.3 4h3.1l1.5 4-2.1 1.5a12.5 12.5 0 0 0 5.7 5.7L16 13.1l4 1.5v3.1a2 2 0 0 1-2 2A16.3 16.3 0 0 1 4.3 6a2 2 0 0 1 2-2Z"/>`,
  video: `<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10.5 6-3v9l-6-3z"/>`,
  transfer: `<path d="M4 8h12M12 4l4 4-4 4"/><path d="M20 16H8M12 12l-4 4 4 4"/>`,
  scale: `<path d="M12 3v18M5 21h14M4 7h16M6 7l-3 6h6L6 7Zm12 0-3 6h6l-3-6Z"/><path d="M3 13a3 3 0 0 0 6 0M15 13a3 3 0 0 0 6 0"/>`,
  search: `<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>`,
  circleHelp: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.9 1.4c-.7 1-1.7 1.3-2.4 2.3"/><path d="M12 17h.01"/>`,
  star4: `<path d="m12 2.5 2.3 7.2 7.2 2.3-7.2 2.3-2.3 7.2-2.3-7.2L2.5 12l7.2-2.3z"/>`,
  star5: `<path d="m12 2.7 2.8 5.68 6.27.91-4.54 4.43 1.07 6.24L12 17.02l-5.6 2.94 1.07-6.24L2.93 9.29l6.27-.91z"/>`,
  heart: `<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>`,
  eye: `<path d="M2.1 12a10.7 10.7 0 0 1 19.8 0 10.7 10.7 0 0 1-19.8 0Z"/><circle cx="12" cy="12" r="3"/>`,
  bubbleQuestion: `<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/><path d="M9.7 9.2a2.4 2.4 0 1 1 4.3 1.3c-.6.8-1.5 1.1-2 1.9"/><path d="M12 15h.01"/>`,
  chatQuestion: `<path d="M19.5 5.5A8.5 8.5 0 1 1 7.2 19.2L3 21l1.8-4.2A8.5 8.5 0 0 1 19.5 5.5Z"/><path d="M9.6 9.2a2.4 2.4 0 1 1 4.3 1.3c-.6.8-1.5 1.1-2 1.9"/><path d="M12 15h.01"/>`,
  bubbleSpark: `<path d="M20 14a3 3 0 0 1-3 3h-5l-5 4v-4H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/><path d="m12 7-1.2 3H14l-2 4"/>`,
  send: `<path d="m3 11 18-8-8 18-2.5-7.5z"/><path d="M10.5 13.5 21 3"/>`,
  monitorQuestion: `<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M9.8 9a2.3 2.3 0 1 1 4.2 1.2c-.6.8-1.5 1-2 1.8"/><path d="M12 14h.01"/>`,
  back: `<path d="m15 18-6-6 6-6"/>`,}

const fallbackMarkup = '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>'
const markup = computed(() => iconMarkup[props.type] || fallbackMarkup)
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-html="markup" />
  </svg>
</template>