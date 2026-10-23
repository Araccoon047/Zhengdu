<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { loadStickerLibrary, mineStickerGroups, stickerState } from '../stickers'

defineProps({ open: Boolean })
const emit = defineEmits(['close', 'select'])

const activeGroupId = ref('')

const groups = computed(() => mineStickerGroups())
const groupedStickers = computed(() =>
  groups.value.map((group) => ({
    ...group,
    items: stickerState.stickers.filter((sticker) => sticker.groupId === group.id),
  }))
)
const activeGroup = computed(
  () => groupedStickers.value.find((group) => group.id === activeGroupId.value) || null
)
const activeStickers = computed(() => activeGroup.value?.items || [])

watch(
  groupedStickers,
  (list) => {
    if (!list.some((group) => group.id === activeGroupId.value)) {
      activeGroupId.value = list[0]?.id || ''
    }
  },
  { immediate: true, deep: true }
)

function choose(sticker) {
  emit('select', sticker.src)
  emit('close')
}

onMounted(() => {
  if (!stickerState.loaded) loadStickerLibrary().catch(() => {})
})
</script>

<template>
  <transition name="sticker-slide">
    <section v-if="open" class="sticker-inline-panel">
      <div v-if="groupedStickers.length" class="sticker-group-tabs" aria-label="表情包分组">
        <button
          v-for="group in groupedStickers"
          :key="group.id"
          type="button"
          class="sticker-group-tab"
          :class="{ active: activeGroupId === group.id }"
          :aria-label="group.name"
          :title="group.name"
          @click="activeGroupId = group.id"
        >
          <img v-if="group.items[0]?.src" :src="group.items[0].src" alt="" />
          <span v-else>☺</span>
        </button>
      </div>

      <div class="sticker-panel-scroll">
        <div v-if="activeStickers.length" class="sticker-panel-grid">
          <button v-for="sticker in activeStickers" :key="sticker.id" type="button" @click="choose(sticker)">
            <img :src="sticker.src" alt="" />
          </button>
        </div>
        <div v-else class="sticker-empty">
          该分组还没有表情包，请先到「我的 → TA 的相关 → 表情包」上传。
        </div>
      </div>
    </section>
  </transition>
</template>

<style scoped>
.sticker-inline-panel {
  flex: none;
  height: min(250px, 34dvh);
  min-height: 190px;
  padding: 8px 12px 12px;
  border-top: 3px dashed var(--theme-border);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sticker-group-tabs {
  flex: none;
  display: flex;
  gap: 7px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.sticker-group-tabs::-webkit-scrollbar {
  display: none;
}

.sticker-group-tab {
  flex: none;
  width: 38px;
  height: 38px;
  padding: 3px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 10px;
  background: var(--theme-surface);
  color: var(--theme-muted);
  display: grid;
  place-items: center;
  font-size: 17px;
  cursor: pointer;
}

.sticker-group-tab.active {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--theme-primary-rgb), 0.13);
}

.sticker-group-tab img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.sticker-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.sticker-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.sticker-panel-grid button {
  aspect-ratio: 1;
  padding: 4px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 11px;
  background: var(--theme-surface);
  cursor: pointer;
}

.sticker-panel-grid img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.sticker-empty {
  min-height: 110px;
  padding: 20px 10px;
  display: grid;
  place-items: center;
  color: var(--theme-muted);
  font-size: 10.5px;
  line-height: 1.6;
  text-align: center;
}

.sticker-slide-enter-active,
.sticker-slide-leave-active {
  transition: max-height 0.24s ease, opacity 0.18s ease,
    padding-top 0.24s ease, padding-bottom 0.24s ease;
}

.sticker-slide-enter-from,
.sticker-slide-leave-to {
  max-height: 0;
  min-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
}
</style>