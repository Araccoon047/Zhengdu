<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  randomValue: { type: Boolean, default: false },
  label: { type: String, default: '概率（%）' },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'update:randomValue'])
const displayValue = computed(() => Number(props.modelValue) || 0)

function updateValue(event) {
  const value = Math.min(props.max, Math.max(props.min, Math.round(Number(event.target.value) || 0)))
  emit('update:modelValue', value)
}

function toggleRandom() {
  emit('update:randomValue', !props.randomValue)
}
</script>

<template>
  <label class="probability-field">
    <span>{{ label }}</span>
    <div class="probability-controls">
      <input
        type="number"
        :value="displayValue"
        :min="min"
        :max="max"
        :disabled="randomValue || disabled"
        @input="updateValue"
      />
      <button
        type="button"
        class="random-probability"
        :class="{ active: randomValue }"
        :aria-pressed="randomValue"
        :disabled="disabled"
        @click.prevent="toggleRandom"
      >完全随机</button>
    </div>
  </label>
</template>

<style scoped>
.probability-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.probability-field>span{color:var(--theme-text);font-size:10px;font-weight:700}
.probability-controls{display:flex;align-items:center;gap:5px;min-width:0}
.probability-controls input{flex:1;width:100%;min-width:0;padding:8px 9px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-surface);color:var(--theme-text-strong);font:inherit;font-size:11px}
.probability-controls input:disabled{opacity:.45}
.random-probability{flex:none;padding:7px 8px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-soft);color:var(--theme-muted);font:inherit;font-size:8.5px;font-weight:800;white-space:nowrap;cursor:pointer}
.random-probability.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}
.random-probability:disabled{opacity:.45;cursor:not-allowed}
</style>