<script setup>
import { computed } from 'vue'
import { go } from '../store'
import {
  formatMusicTime, musicSettings, musicState, currentTrack,
  playNext, playPrev, setMusicMode, toggleFavorite, togglePlay, MUSIC_MODES,
} from '../music-player'

const props = defineProps({
  editing: { type: Boolean, default: false },
})

const progress = computed(() => musicState.duration > 0 ? Math.min(100, (musicState.currentTime / musicState.duration) * 100) : 0)
const currentMode = computed(() => MUSIC_MODES.find((mode) => mode.id === musicState.mode) || MUSIC_MODES[3])
const modeLabel = computed(() => currentMode.value.label)
const modeIcon = computed(() => currentMode.value.icon)
const isSquare = computed(() => musicSettings.widgetLayout === 'square')
const isFavorite = computed(() => currentTrack.value && musicState.favorites.includes(currentTrack.value.id))
const transitionName = computed(() => `mw-switch-${musicState.changeDirection}`)

function openMusicApp() {
  if (!props.editing) go('music')
}

function cycleMode() {
  const modes = MUSIC_MODES.map((item) => item.id)
  setMusicMode(modes[(modes.indexOf(musicState.mode) + 1) % modes.length])
}
</script>

<template>
  <section class="music-widget" :class="isSquare ? 'layout-square' : 'layout-wide'" @click="openMusicApp">
    <template v-if="!isSquare">
      <header class="mw-head">
        <span class="mw-tag">{{ currentTrack ? '正在播放' : '音乐' }}</span>
        <span class="mw-bars" :class="{ playing: musicState.playing }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      </header>
      <div class="mw-card-viewport">
        <transition :name="transitionName">
          <div :key="currentTrack?.id || 'empty'" class="mw-card-slide">
            <div class="mw-main">
              <div class="mw-cover" :class="{ spinning: musicState.playing }"><img v-if="musicSettings.widgetCoverMode === 'song' && currentTrack?.cover" :src="currentTrack.cover" alt="" /><span v-else>{{ musicSettings.widgetCoverMode === 'playlist' ? '歌单' : '♪' }}</span></div>
              <div class="mw-info">
                <strong class="mw-song">{{ currentTrack?.name || '暂无播放' }}</strong>
                <span class="mw-artist">{{ currentTrack?.artist || '点击播放开始听歌' }}</span>
                <div class="mw-progress">
                  <div class="mw-bar"><i :style="{ width: progress + '%' }"></i></div>
                  <div class="mw-times"><span>{{ formatMusicTime(musicState.currentTime) }}</span><span>{{ formatMusicTime(musicState.duration) }}</span></div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
      <div class="mw-controls">
        <button type="button" :title="modeLabel" @click.stop="cycleMode">{{ modeIcon }}</button>
        <button type="button" title="上一首" @click.stop="playPrev">‹</button>
        <button type="button" class="mw-play" title="播放或暂停" @click.stop="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
        <button type="button" title="下一首" @click.stop="playNext">›</button>
        <button type="button" :class="{ liked: isFavorite }" title="收藏" @click.stop="currentTrack && toggleFavorite(currentTrack.id)">♥</button>
      </div>
    </template>

    <div v-else class="mw-square-viewport">
      <transition :name="transitionName">
        <div :key="currentTrack?.id || 'empty'" class="mw-square-card">
          <div class="mw-square-main">
            <span class="mw-square-cover">
              <img v-if="musicSettings.widgetCoverMode === 'song' && currentTrack?.cover" :src="currentTrack.cover" alt="" />
              <template v-else>{{ musicSettings.widgetCoverMode === 'playlist' ? '歌单' : '♪' }}</template>
            </span>
            <div class="mw-square-copy">
              <span class="mw-square-notes" :class="{ playing: musicState.playing }" aria-hidden="true"><i>♪</i><i>♫</i><i>♩</i></span>
              <strong>{{ currentTrack?.name || '暂无播放' }}</strong>
              <span class="mw-square-artist">{{ currentTrack?.artist || '点击播放开始听歌' }}</span>
            </div>
          </div>
          <div class="mw-square-progress"><i :style="{ width: progress + '%' }"></i></div>
          <div class="mw-square-times"><span>{{ formatMusicTime(musicState.currentTime) }}</span><span>{{ formatMusicTime(musicState.duration) }}</span></div>
          <div class="mw-square-controls">
            <button type="button" class="mw-square-mode" :aria-label="modeLabel" :title="modeLabel" @click.stop="cycleMode">{{ modeIcon }}</button>
            <button type="button" aria-label="上一首" title="上一首" @click.stop="playPrev">‹</button>
            <button type="button" class="mw-square-play" aria-label="播放或暂停" @click.stop="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
            <button type="button" aria-label="下一首" title="下一首" @click.stop="playNext">›</button>
            <button type="button" class="mw-square-favorite" :class="{ liked: isFavorite }" aria-label="收藏" title="收藏" @click.stop="currentTrack && toggleFavorite(currentTrack.id)">♥</button>
          </div>
        </div>
      </transition>
    </div>
  </section>
</template>

<style scoped>
.music-widget{width:100%;height:100%;min-height:0;overflow:hidden;container-type:size}
.music-widget.layout-wide{padding:9px 11px;border:1px solid var(--theme-border-soft);border-radius:20px;background:var(--theme-surface);display:flex;flex-direction:column;gap:4px}
.music-widget.layout-square{display:flex;flex-direction:column;box-sizing:border-box;padding:1px;border:0;border-radius:20px;background:transparent;overflow:hidden}
.mw-head{display:flex;align-items:center;justify-content:space-between;color:var(--theme-muted);font-size:8px;letter-spacing:.08em}
.mw-bars{height:14px;display:flex;align-items:center;gap:2px}.mw-bars i{display:block;width:2px;height:7px;border-radius:2px;background:var(--theme-primary);opacity:.35}.mw-bars.playing i{animation:mw-bar .9s ease-in-out infinite alternate}.mw-bars.playing i:nth-child(2){animation-duration:1.1s}.mw-bars.playing i:nth-child(3){animation-duration:.75s}.mw-bars.playing i:nth-child(4){animation-duration:1.3s}
@keyframes mw-bar{from{transform:scaleY(.45);opacity:.38}to{transform:scaleY(1.2);opacity:1}}
.mw-card-viewport,.mw-square-viewport{position:relative;flex:1 1 auto;width:100%;min-width:0;min-height:0;overflow:hidden;perspective:520px}.layout-square .mw-square-viewport{height:100%}
.mw-card-slide{position:absolute;inset:0;display:flex;align-items:center;min-height:0;transform-origin:center center}
.mw-main{width:100%;height:100%;display:flex;align-items:center;gap:9px;min-width:0}
.mw-cover{--mw-cover-size:min(40cqw,40cqh,60px);flex:none;width:var(--mw-cover-size);height:var(--mw-cover-size);max-width:none;max-height:none;box-sizing:border-box;aspect-ratio:auto;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 40% 35%,#3b3b3b,#151515 62%,#292929);color:#fff;font-size:15px;box-shadow:inset 0 0 0 5px rgba(255,255,255,.08);transform-origin:center}.mw-cover img{width:100%;height:100%;object-fit:cover;object-position:center;border-radius:50%;display:block}.mw-cover.spinning{animation:mw-spin 8s linear infinite}
@keyframes mw-spin{to{transform:rotate(360deg)}}
.mw-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.mw-song{overflow:hidden;color:var(--theme-text-strong);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.mw-artist{overflow:hidden;color:var(--theme-muted);font-size:9.5px;text-overflow:ellipsis;white-space:nowrap}
.mw-progress{display:flex;flex-direction:column;gap:2px;margin-top:2px}.mw-bar{height:3px;border-radius:99px;background:var(--theme-border-soft);overflow:hidden}.mw-bar i{display:block;height:100%;border-radius:inherit;background:var(--theme-primary)}.mw-times{display:flex;justify-content:space-between;color:var(--theme-muted);font-size:6.5px}
.mw-controls{display:flex;align-items:center;justify-content:space-between;gap:2px}.mw-controls button{width:27px;height:27px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--theme-muted);font-size:12px;font-weight:700;cursor:pointer}.mw-controls button:hover{color:var(--theme-primary)}.mw-controls button.liked{color:#e05555}.mw-controls .mw-play{width:36px;height:36px;background:var(--theme-primary);color:var(--theme-inverse);font-size:9px}

.mw-square-card{position:absolute;inset:0;box-sizing:border-box;padding:clamp(8px,5.5cqw,13px);border:1px solid var(--theme-border-soft);border-radius:20px;background:var(--theme-surface);background-image:none;color:var(--theme-text-strong);display:flex;flex-direction:column;gap:clamp(2px,1.5cqh,5px);overflow:hidden;transform-origin:center center;box-shadow:none!important;filter:none}
.mw-square-main{display:grid;grid-template-columns:minmax(0,42%) minmax(0,1fr);align-items:center;gap:clamp(5px,4cqw,9px);min-height:0}
.mw-square-cover{width:100%;min-width:0;aspect-ratio:1;border-radius:clamp(11px,5cqw,17px);display:grid;place-items:center;overflow:hidden;background:var(--theme-soft);background-image:none;color:var(--theme-primary);font-size:clamp(14px,6cqw,21px);box-shadow:none!important}
.mw-square-cover img{width:100%;height:100%;object-fit:cover;display:block}
.mw-square-copy{display:flex;flex-direction:column;gap:2px;min-width:0;overflow:hidden}
.mw-square-copy strong{overflow:hidden;color:var(--theme-text-strong);font-size:clamp(10px,6.2cqw,15px);font-weight:800;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}
.mw-square-copy .mw-square-artist{overflow:hidden;color:var(--theme-muted);font-size:clamp(8px,4.4cqw,11px);line-height:1.15;text-overflow:ellipsis;white-space:nowrap}
.mw-square-notes{display:flex;align-items:flex-start;justify-content:flex-end;gap:1px;min-width:0;min-height:clamp(9px,5cqw,14px);color:var(--theme-primary);font-weight:800}
.mw-square-notes i{display:block;font-style:normal;line-height:1;opacity:.38;transform-origin:center}.mw-square-notes i:nth-child(1){font-size:clamp(8px,3.8cqw,12px)}.mw-square-notes i:nth-child(2){font-size:clamp(9px,4.4cqw,14px)}.mw-square-notes i:nth-child(3){font-size:clamp(7px,3.4cqw,11px)}
.mw-square-notes.playing i{animation:mw-note 1s ease-in-out infinite alternate}.mw-square-notes.playing i:nth-child(2){animation-delay:-.35s}.mw-square-notes.playing i:nth-child(3){animation-delay:-.65s}
@keyframes mw-note{from{opacity:.25;transform:translateY(2px) scale(.82)}to{opacity:.9;transform:translateY(-4px) scale(1.12)}}
.mw-square-progress{flex:none;height:3px;margin-top:auto;border-radius:99px;background:var(--theme-border-soft);background-image:none;overflow:hidden}.mw-square-progress i{display:block;height:100%;border-radius:inherit;background:var(--theme-primary)}
.mw-square-times{display:flex;justify-content:space-between;margin-top:1px;color:var(--theme-muted);font-size:clamp(5px,2.8cqw,7px);line-height:1}
.mw-square-controls{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:1px;width:100%;margin-top:1px}
.mw-square-controls button{width:100%;min-width:0;height:clamp(22px,18cqw,30px);padding:0;border:0;border-radius:50%;background:transparent;color:var(--theme-text-strong);font-size:clamp(12px,7cqw,18px);font-weight:700;line-height:1;display:grid;place-items:center;cursor:pointer}
.mw-square-controls button.liked{color:#e05555}
.mw-square-controls .mw-square-mode{color:var(--theme-primary);font-size:clamp(11px,6cqw,15px)}
.mw-square-controls .mw-square-play{background:var(--theme-primary);color:var(--theme-inverse);font-size:clamp(7px,4cqw,10px)}

.mw-switch-next-enter-active,.mw-switch-next-leave-active,.mw-switch-prev-enter-active,.mw-switch-prev-leave-active{transition:transform .36s cubic-bezier(.2,.78,.24,1),opacity .3s ease,filter .3s ease}
.mw-switch-next-enter-active,.mw-switch-prev-enter-active{z-index:2}
.mw-switch-next-leave-active,.mw-switch-prev-leave-active{z-index:1}
.mw-switch-next-enter-from{opacity:0;transform:translate3d(14%,42%,0) rotateX(-14deg) scale(.9);filter:blur(2px)}
.mw-switch-next-leave-to{opacity:0;transform:translate3d(-9%,-34%,0) rotateX(11deg) scale(.94);filter:blur(1px)}
.mw-switch-prev-enter-from{opacity:0;transform:translate3d(-14%,-42%,0) rotateX(14deg) scale(.9);filter:blur(2px)}
.mw-switch-prev-leave-to{opacity:0;transform:translate3d(9%,34%,0) rotateX(-11deg) scale(.94);filter:blur(1px)}
@media(prefers-reduced-motion:reduce){.mw-cover.spinning,.mw-bars.playing i,.mw-square-notes.playing i{animation:none!important}.mw-switch-next-enter-active,.mw-switch-next-leave-active,.mw-switch-prev-enter-active,.mw-switch-prev-leave-active{transition:none!important}}
</style>