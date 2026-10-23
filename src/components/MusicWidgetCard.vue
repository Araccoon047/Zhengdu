<script setup>
import { computed } from 'vue'
import {
  formatMusicTime, musicSettings, musicState, currentTrack,
  playNext, playPrev, setMusicMode, toggleFavorite, togglePlay, MUSIC_MODES,
} from '../music-player'

const progress = computed(() => musicState.duration > 0 ? Math.min(100, (musicState.currentTime / musicState.duration) * 100) : 0)
const modeLabel = computed(() => MUSIC_MODES.find((mode) => mode.id === musicState.mode)?.label || '列表播放')
const isFavorite = computed(() => currentTrack.value && musicState.favorites.includes(currentTrack.value.id))
function cycleMode() {
  const modes = MUSIC_MODES.map((item) => item.id)
  setMusicMode(modes[(modes.indexOf(musicState.mode) + 1) % modes.length])
}
</script>

<template>
  <section class="music-widget">
    <header class="mw-head">
      <span class="mw-tag">{{ currentTrack ? '正在播放' : '音乐' }}</span>
      <span class="mw-bars" :class="{ playing: musicState.playing }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </header>
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
    <div class="mw-controls">
      <button type="button" :title="modeLabel" @click="cycleMode">↻</button>
      <button type="button" title="上一首" @click="playPrev">‹</button>
      <button type="button" class="mw-play" title="播放或暂停" @click="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
      <button type="button" title="下一首" @click="playNext">›</button>
      <button type="button" :class="{ liked: isFavorite }" title="收藏" @click="currentTrack && toggleFavorite(currentTrack.id)">♥</button>
    </div>
  </section>
</template>

<style scoped>
.music-widget{width:100%;height:100%;min-height:0;padding:11px 12px;border:1px solid var(--theme-border-soft);border-radius:20px;background:var(--theme-surface);display:flex;flex-direction:column;gap:6px;overflow:hidden;container-type:size}
.mw-head{display:flex;align-items:center;justify-content:space-between;color:var(--theme-muted);font-size:8px;letter-spacing:.08em}
.mw-bars{height:14px;display:flex;align-items:center;gap:2px}.mw-bars i{display:block;width:2px;height:7px;border-radius:2px;background:var(--theme-primary);opacity:.35}.mw-bars.playing i{animation:mw-bar .9s ease-in-out infinite alternate}.mw-bars.playing i:nth-child(2){animation-duration:1.1s}.mw-bars.playing i:nth-child(3){animation-duration:.75s}.mw-bars.playing i:nth-child(4){animation-duration:1.3s}
@keyframes mw-bar{from{transform:scaleY(.45);opacity:.38}to{transform:scaleY(1.2);opacity:1}}
.mw-main{flex:1;min-height:0;display:flex;align-items:center;gap:9px;min-width:0}
.mw-cover{flex:none;width:min(58cqw,58cqh);aspect-ratio:1;max-width:66px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 35%,#3b3b3b,#151515 62%,#292929);color:#fff;font-size:15px;box-shadow:inset 0 0 0 5px rgba(255,255,255,.08)}.mw-cover img{width:100%;height:100%;object-fit:cover;border-radius:50%}.mw-cover.spinning{animation:mw-spin 8s linear infinite}
@keyframes mw-spin{to{transform:rotate(360deg)}}
.mw-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.mw-song{overflow:hidden;color:var(--theme-text-strong);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.mw-artist{overflow:hidden;color:var(--theme-muted);font-size:9.5px;text-overflow:ellipsis;white-space:nowrap}
.mw-progress{display:flex;flex-direction:column;gap:2px;margin-top:2px}.mw-bar{height:3px;border-radius:99px;background:var(--theme-border-soft);overflow:hidden}.mw-bar i{display:block;height:100%;border-radius:inherit;background:var(--theme-primary)}.mw-times{display:flex;justify-content:space-between;color:var(--theme-muted);font-size:6.5px}
.mw-controls{display:flex;align-items:center;justify-content:space-between;gap:2px}.mw-controls button{width:27px;height:27px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--theme-muted);font-size:12px;cursor:pointer}.mw-controls button:hover{color:var(--theme-primary)}.mw-controls button.liked{color:#e05555}.mw-controls .mw-play{width:36px;height:36px;background:var(--theme-primary);color:var(--theme-inverse);font-size:9px}
@media(prefers-reduced-motion:reduce){.mw-cover.spinning,.mw-bars.playing i{animation:none!important}}
</style>