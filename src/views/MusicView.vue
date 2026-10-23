<script setup>
import { computed, ref } from 'vue'
import ProbabilityField from '../components/ProbabilityField.vue'
import { resolveInput, fetchPlaylist, fetchSongInfo, resolveShortLink } from '../netease-music'
import {
  MUSIC_MODES,
  MUSIC_SETTINGS_DEFAULTS,
  addMusicFiles,
  addMusicUrl,
  addPlaylist,
  clearMusicHistory,
  clearMusicQueue,
  currentTrack,
  enqueueTrack,
  formatMusicTime,
  musicSettings,
  musicState,
  pauseMusic,
  playMusic,
  playNext,
  playPrev,
  playTrack,
  removeMusicTracks,
  removePlaylist,
  resetMusicSettings,
  scanUnplayableNetease,
  seekMusic,
  setMusicMode,
  setTrackPlaylist,
  toggleFavorite,
  togglePlay,
  trackById,
} from '../music-player'

const activeTab = ref('library')
const historyTab = ref('invite')
const search = ref('')
const settingsOpen = ref(false)
const addUrlOpen = ref(false)
const playlistOpen = ref(false)
const queueOpen = ref(false)
const batchMode = ref(false)
const selectedIds = ref([])
const fileInput = ref(null)
const urlDraft = ref({ text: '' })
const loadingImport = ref(false)
const playlistDraft = ref('')
const notice = ref('')
const cleanOpen = ref(false)
const cleanBusy = ref(false)
const cleanProgress = ref({ done: 0, total: 0 })
const cleanResult = ref(null)
const cleanRows = ref([])

const tabs = [
  { id: 'library', label: '我的音乐库' },
  { id: 'playlists', label: '歌单' },
  { id: 'favorites', label: '我的收藏' },
  { id: 'taFavorites', label: 'TA的收藏' },
  { id: 'history', label: '听歌记录' },
]

const filteredLibrary = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return musicState.library
  return musicState.library.filter((track) => `${track.name} ${track.artist}`.toLowerCase().includes(query))
})
const favoriteTracks = computed(() => idsToTracks(musicState.favorites))
const taFavoriteTracks = computed(() => idsToTracks(musicState.taFavorites))
const queueTracks = computed(() => idsToTracks(musicState.queue))
const modeLabel = computed(() => MUSIC_MODES.find((mode) => mode.id === musicState.mode)?.label || '列表播放')
const progressPercent = computed(() =>
  musicState.duration > 0 ? Math.min(100, (musicState.currentTime / musicState.duration) * 100) : 0
)
const playlistGroups = computed(() =>
  musicState.playlists.map((playlist) => ({
    ...playlist,
    tracks: musicState.library.filter((track) => track.playlistId === playlist.id),
  }))
)

function idsToTracks(ids) {
  return ids.map((id) => trackById(id)).filter(Boolean)
}
function setTab(id) {
  activeTab.value = id
  search.value = ''
}
function chooseFiles() {
  fileInput.value?.click()
}
async function onFiles(event) {
  const files = event.target.files
  event.target.value = ''
  const added = await addMusicFiles(files)
  notice.value = added.length ? `已导入 ${added.length} 首音乐` : '没有找到可导入的音频文件'
}
async function submitUrl() {
  const raw = urlDraft.value.text.trim()
  if (!raw || loadingImport.value) return
  loadingImport.value = true
  let added = 0
  let failed = 0
  try {
    const parsed = resolveInput(raw)
    for (const playlistId of parsed.playlistIds) {
      const tracks = await fetchPlaylist(playlistId)
      if (!tracks.length) {
        failed += 1
        continue
      }
      const playlist = musicState.playlists.find((item) => item.name === `网易云歌单 ${playlistId}`) || addPlaylist(`网易云歌单 ${playlistId}`)
      for (const item of tracks) {
        const track = addMusicUrl({
          url: item.playUrl,
          name: item.name,
          artist: item.artist,
          cover: item.cover,
          source: 'netease',
          sourceId: item.id,
          playlistId: playlist?.id || '',
        })
        if (track) added += 1
      }
    }
    for (const item of parsed.tracks) {
      let songId = typeof item === 'string' ? item : ''
      if (item && typeof item === 'object' && item.short) songId = await resolveShortLink(item.short)
      if (songId) {
        const info = await fetchSongInfo(songId)
        if (info) {
          const track = addMusicUrl({
            url: info.playUrl,
            name: info.name,
            artist: info.artist,
            cover: info.cover,
            lyric: info.lyric,
            source: 'netease',
            sourceId: info.id,
          })
          if (track) added += 1
        } else failed += 1
      } else if (item && typeof item === 'object' && item.direct) {
        const track = addMusicUrl({ url: item.direct, name: '在线音频', artist: '未知歌手', source: 'url' })
        if (track) added += 1
        else failed += 1
      }
    }
    if (added) {
      urlDraft.value = { text: '' }
      addUrlOpen.value = false
      notice.value = `已导入 ${added} 首音乐${failed ? `，${failed} 项失败` : ''}`
    } else {
      notice.value = '没有导入成功，请检查链接是否为完整网易云单曲/歌单地址，或 API 是否可用。'
    }
  } catch {
    notice.value = '链接解析失败，请检查网络与链接格式。'
  } finally {
    loadingImport.value = false
  }
}
function submitPlaylist() {
  const playlist = addPlaylist(playlistDraft.value)
  if (!playlist) return
  playlistDraft.value = ''
  playlistOpen.value = false
  notice.value = `已创建歌单「${playlist.name}」`
}

/** 一键检测并清理网易云会员/付费歌曲 */
async function startCleanUnplayable() {
  if (cleanBusy.value) return
  cleanBusy.value = true
  cleanResult.value = null
  cleanRows.value = []
  cleanProgress.value = { done: 0, total: 0 }
  notice.value = '正在探测网易云歌曲的可播放性与时长…'
  try {
    const result = await scanUnplayableNetease((progress) => {
      cleanProgress.value = progress
    })
    if (!result.total) {
      notice.value = '音乐库里还没有网易云链接歌曲'
      return
    }
    if (!result.ok) {
      notice.value = '检测失败：播放探测服务暂时不可用，请稍后重试'
      return
    }
    if (!result.removable.length) {
      const extra = result.unknown ? `，${result.unknown} 首探测超时未计入` : ''
      notice.value = `已检测 ${result.probed} 首，未发现会员/付费歌曲${extra}`
      return
    }
    cleanResult.value = result
    cleanRows.value = [
      ...result.unplayable.map((track) => ({ track, reason: 'blocked' })),
      ...result.preview.map((track) => ({ track, reason: 'preview' })),
    ]
    cleanOpen.value = true
    notice.value = ''
  } catch {
    notice.value = '检测失败：网络异常，请稍后重试'
  } finally {
    cleanBusy.value = false
  }
}

async function confirmCleanUnplayable() {
  const ids = (cleanResult.value?.removable || []).map((track) => track.id)
  if (!ids.length) return
  await removeMusicTracks(ids)
  cleanOpen.value = false
  cleanResult.value = null
  cleanRows.value = []
  notice.value = `已移除 ${ids.length} 首会员/付费歌曲`
}

function cancelCleanUnplayable() {
  cleanOpen.value = false
  cleanResult.value = null
  cleanRows.value = []
}
function toggleMode() {
  const modes = MUSIC_MODES.map((item) => item.id)
  setMusicMode(modes[(modes.indexOf(musicState.mode) + 1) % modes.length])
}
function toggleBatchMode() {
  batchMode.value = !batchMode.value
  selectedIds.value = []
}
function toggleSelected(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}
async function deleteSelected() {
  if (!selectedIds.value.length) return
  await removeMusicTracks(selectedIds.value)
  selectedIds.value = []
  batchMode.value = false
  notice.value = '已删除所选音乐'
}
async function deleteSingle(id) {
  if (!window.confirm('删除这首音乐？')) return
  await removeMusicTracks(id)
}
function seekFromEvent(event) {
  seekMusic(Number(event.target.value))
}
function currentFavorite() {
  return currentTrack.value ? musicState.favorites.includes(currentTrack.value.id) : false
}
function notify(text) {
  notice.value = text
  setTimeout(() => { if (notice.value === text) notice.value = '' }, 2200)
}
function saveSettings() {
  settingsOpen.value = false
  notify('音乐设置已保存')
}
function clearHistory() {
  clearMusicHistory()
  notify('听歌记录已清空')
}
function playFromHistory(item) {
  playTrack(item.trackId)
}
</script>
<template>
  <section class="music-app">
    <div class="music-head-row">
      <label class="float-switch">
        <span>悬浮播放小框</span>
        <input v-model="musicSettings.floatEnabled" type="checkbox" />
      </label>
      <button class="music-icon-button" type="button" aria-label="音乐设置" title="音乐设置" @click="settingsOpen = true">⚙</button>
    </div>

    <nav class="music-tabs" aria-label="音乐分类">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="setTab(tab.id)">{{ tab.label }}</button>
    </nav>

    <div v-if="notice" class="music-notice">{{ notice }}</div>

    <div class="music-content">
      <section v-show="activeTab === 'library'" class="music-panel">
        <div class="music-tools">
          <button type="button" @click="chooseFiles">上传音乐</button>
          <button type="button" @click="addUrlOpen = true">链接添加</button>
          <button type="button" @click="chooseFiles">批量导入</button>
          <button type="button" :class="{ active: batchMode }" @click="toggleBatchMode">{{ batchMode ? '结束管理' : '批量管理' }}</button>
          <button type="button" :disabled="cleanBusy" @click="startCleanUnplayable">
            {{ cleanBusy ? `检测中 ${cleanProgress.done}/${cleanProgress.total}` : '清理会员歌曲' }}
          </button>
        </div>
        <input ref="fileInput" class="hidden-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" multiple @change="onFiles" />
        <div class="music-subbar">
          <label class="music-search"><input v-model="search" type="search" placeholder="搜索歌曲或歌手" /></label>
          <span>{{ filteredLibrary.length }} 首</span>
        </div>
        <div class="track-list">
          <article v-for="track in filteredLibrary" :key="track.id" class="track-row" :class="{ selected: selectedIds.includes(track.id), playing: musicState.currentId === track.id }">
            <button v-if="batchMode" type="button" class="track-check" :class="{ active: selectedIds.includes(track.id) }" @click="toggleSelected(track.id)">{{ selectedIds.includes(track.id) ? '✓' : '' }}</button>
            <button type="button" class="track-main" @click="batchMode ? toggleSelected(track.id) : playTrack(track.id)">
              <span class="track-art"><img v-if="track.cover" :src="track.cover" alt="" /><template v-else>{{ musicState.currentId === track.id && musicState.playing ? '❚❚' : '▶' }}</template></span>
              <span class="track-copy"><strong>{{ track.name }}</strong><small>{{ track.artist }}<template v-if="track.playlistId"> · {{ musicState.playlists.find((item) => item.id === track.playlistId)?.name }}</template></small></span>
              <time>{{ formatMusicTime(track.duration) }}</time>
            </button>
            <div class="track-actions">
              <button type="button" :class="{ liked: musicState.favorites.includes(track.id) }" title="收藏" @click="toggleFavorite(track.id)">♥</button>
              <select v-if="track.source !== 'builtin' && musicState.playlists.length" class="track-playlist" :value="track.playlistId" title="加入歌单" @change="setTrackPlaylist(track.id, $event.target.value)"><option value="">未加入歌单</option><option v-for="playlist in musicState.playlists" :key="playlist.id" :value="playlist.id">{{ playlist.name }}</option></select>
              <button type="button" title="加入队列" @click="enqueueTrack(track.id)">＋</button>
              <button v-if="track.source !== 'builtin'" type="button" class="danger" title="删除" @click="deleteSingle(track.id)">×</button>
            </div>
          </article>
          <div v-if="!filteredLibrary.length" class="music-empty">音乐库还是空的，上传本地音乐或添加音频链接吧。</div>
        </div>
        <div v-if="batchMode" class="batch-bar"><span>已选择 {{ selectedIds.length }} 首</span><button type="button" :disabled="!selectedIds.length" @click="deleteSelected">删除所选</button></div>
      </section>

      <section v-show="activeTab === 'playlists'" class="music-panel">
        <button class="playlist-create" type="button" @click="playlistOpen = true">＋ 新建歌单</button>
        <article v-for="playlist in playlistGroups" :key="playlist.id" class="playlist-card">
          <header><div><strong>{{ playlist.name }}</strong><small>{{ playlist.tracks.length }} 首歌曲</small></div><button type="button" class="danger-text" @click="removePlaylist(playlist.id)">删除</button></header>
          <div v-if="playlist.tracks.length" class="playlist-tracks">
            <button v-for="track in playlist.tracks" :key="track.id" type="button" @click="playTrack(track.id)"><span>▶</span><span>{{ track.name }}</span><small>{{ track.artist }}</small></button>
          </div>
          <div v-else class="playlist-empty">暂无歌曲。可在音乐库中把歌曲加入该歌单。</div>
        </article>
        <div v-if="!playlistGroups.length" class="music-empty">还没有歌单。</div>
      </section>

      <section v-show="activeTab === 'favorites'" class="music-panel">
        <div class="track-list">
          <article v-for="track in favoriteTracks" :key="track.id" class="track-row">
            <button type="button" class="track-main" @click="playTrack(track.id)"><span class="track-art"><img v-if="track.cover" :src="track.cover" alt="" /><template v-else>▶</template></span><span class="track-copy"><strong>{{ track.name }}</strong><small>{{ track.artist }}</small></span><time>{{ formatMusicTime(track.duration) }}</time></button>
            <div class="track-actions"><button type="button" class="liked" @click="toggleFavorite(track.id)">♥</button></div>
          </article>
          <div v-if="!favoriteTracks.length" class="music-empty">还没有收藏歌曲。</div>
        </div>
      </section>

      <section v-show="activeTab === 'taFavorites'" class="music-panel">
        <div class="track-list">
          <article v-for="track in taFavoriteTracks" :key="track.id" class="track-row">
            <button type="button" class="track-main" @click="playTrack(track.id)"><span class="track-art"><img v-if="track.cover" :src="track.cover" alt="" /><template v-else>▶</template></span><span class="track-copy"><strong>{{ track.name }}</strong><small>{{ track.artist }}</small></span><time>{{ formatMusicTime(track.duration) }}</time></button>
          </article>
          <div v-if="!taFavoriteTracks.length" class="music-empty">TA 还没有收藏歌曲。</div>
        </div>
      </section>

      <section v-show="activeTab === 'history'" class="music-panel">
        <div class="history-tabs"><button type="button" :class="{ active: historyTab === 'invite' }" @click="historyTab = 'invite'">TA 邀请</button><button type="button" :class="{ active: historyTab === 'mine' }" @click="historyTab = 'mine'">我的收听</button><button type="button" class="danger-text" @click="clearHistory">清空</button></div>
        <div class="track-list">
          <button v-for="item in (historyTab === 'invite' ? musicState.history : musicState.myHistory)" :key="item.id" type="button" class="history-row" @click="playFromHistory(item)">
            <span class="track-art">▶</span><span class="track-copy"><strong>{{ item.trackName }}</strong><small>{{ item.artist || '未知歌手' }} · {{ item.triggerType || '播放' }}</small></span><time>{{ new Date(item.ts).toLocaleString('zh-CN') }}</time>
          </button>
          <div v-if="!(historyTab === 'invite' ? musicState.history : musicState.myHistory).length" class="music-empty">暂无记录。</div>
        </div>
      </section>
    </div>

    <div v-if="currentTrack" class="player-bar">
      <button type="button" class="player-main" @click="queueOpen = true"><span class="player-art"><img v-if="currentTrack.cover" :src="currentTrack.cover" alt="" /><template v-else>{{ musicState.playing ? '❚❚' : '▶' }}</template></span><span class="track-copy"><strong>{{ currentTrack.name }}</strong><small>{{ currentTrack.artist }}</small></span></button>
      <div class="player-progress"><span>{{ formatMusicTime(musicState.currentTime) }}</span><input type="range" min="0" :max="musicState.duration || 1" step="0.01" :value="musicState.currentTime" :style="{ '--p': progressPercent + '%' }" @input="seekFromEvent" /><span>{{ formatMusicTime(musicState.duration) }}</span></div>
      <div class="player-controls">
        <button type="button" @click="toggleMode" :title="modeLabel">↻</button>
        <button type="button" @click="playPrev">‹</button>
        <button type="button" class="play-button" @click="togglePlay">{{ musicState.playing ? '❚❚' : '▶' }}</button>
        <button type="button" @click="playNext">›</button>
        <button type="button" :class="{ liked: currentFavorite() }" @click="toggleFavorite(currentTrack.id)">♥</button>
      </div>
      <div v-if="musicState.lastAction" class="ta-action">{{ musicState.lastAction }}</div>
    </div>

    <transition name="music-pop">
      <div v-if="addUrlOpen" class="music-modal-layer" @click.self="addUrlOpen = false">
        <div class="music-modal import-modal"><header><strong>导入音乐链接</strong><button type="button" @click="addUrlOpen = false">×</button></header><label class="field"><span>网易云单曲 / 歌单 / 普通音频直链，可多行</span><textarea v-model="urlDraft.text" rows="6" placeholder="https://music.163.com/#/song?id=...&#10;https://music.163.com/playlist?id=...&#10;https://example.com/audio.mp3"></textarea></label><div class="auto-chat-hint">支持网易云完整链接、纯歌曲 ID、短链接（可能受代理稳定性影响）和普通 MP3/WAV 等音频直链；VIP 或付费歌曲可能无法播放。</div><div class="modal-actions"><button type="button" @click="addUrlOpen = false">取消</button><button type="button" class="primary" :disabled="loadingImport" @click="submitUrl">{{ loadingImport ? '解析中…' : '开始导入' }}</button></div></div>
      </div>
    </transition>

    <transition name="music-pop">
      <div v-if="cleanOpen && cleanResult" class="music-modal-layer" @click.self="cancelCleanUnplayable">
        <div class="music-modal clean-modal">
          <header>
            <strong>清理会员歌曲</strong>
            <button type="button" aria-label="关闭" @click="cancelCleanUnplayable">×</button>
          </header>
          <p class="clean-hint">
            共 {{ cleanResult.removable.length }} 首会被移除：
            <template v-if="cleanResult.unplayable.length">{{ cleanResult.unplayable.length }} 首无法播放（会员 / 付费 / 链接失效）</template>
            <template v-if="cleanResult.unplayable.length && cleanResult.preview.length">，</template>
            <template v-if="cleanResult.preview.length">{{ cleanResult.preview.length }} 首只有 30 秒试听（会员歌曲）</template>。
            移除只影响这些网易云歌曲，本地音乐与其他直链不受影响。
          </p>
          <div class="clean-list">
            <article v-for="row in cleanRows.slice(0, 30)" :key="row.track.id">
              <span class="clean-art">
                <img v-if="row.track.cover" :src="row.track.cover" alt="" />
                <template v-else>♪</template>
              </span>
              <span class="clean-copy">
                <strong>{{ row.track.name }}</strong>
                <small>{{ row.track.artist }}</small>
              </span>
              <span class="clean-tag" :class="row.reason">
                {{ row.reason === 'preview' ? '30 秒试听' : '无法播放' }}
              </span>
            </article>
            <p v-if="cleanRows.length > 30" class="clean-more">
              …还有 {{ cleanRows.length - 30 }} 首，一并移除
            </p>
          </div>
          <p v-if="cleanResult.unknown" class="clean-hint">
            {{ cleanResult.unknown }} 首探测超时，已保持原样、不会被删除。
          </p>
          <div class="modal-actions">
            <button type="button" @click="cancelCleanUnplayable">取消</button>
            <button type="button" class="primary" @click="confirmCleanUnplayable">
              移除 {{ cleanResult.removable.length }} 首
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="music-pop">
      <div v-if="playlistOpen" class="music-modal-layer" @click.self="playlistOpen = false">
        <div class="music-modal"><header><strong>新建歌单</strong><button type="button" @click="playlistOpen = false">×</button></header><label class="field"><span>歌单名称</span><input v-model="playlistDraft" class="input" type="text" maxlength="30" /></label><div class="modal-actions"><button type="button" @click="playlistOpen = false">取消</button><button type="button" class="primary" @click="submitPlaylist">创建</button></div></div>
      </div>
    </transition>

    <transition name="music-pop">
      <div v-if="queueOpen" class="music-modal-layer" @click.self="queueOpen = false">
        <div class="music-modal queue-modal"><header><strong>播放队列</strong><button type="button" @click="queueOpen = false">×</button></header><p class="queue-mode">当前模式：{{ modeLabel }}</p><button v-for="track in queueTracks" :key="track.id" type="button" class="queue-row" @click="playTrack(track.id)"><span>▶</span><span>{{ track.name }}</span><small>{{ track.artist }}</small></button><div v-if="!queueTracks.length" class="music-empty">队列里还没有歌曲。</div><div class="modal-actions"><button type="button" @click="clearMusicQueue">清空队列</button><button type="button" class="primary" @click="queueOpen = false">关闭</button></div></div>
      </div>
    </transition>

    <transition name="music-pop">
      <div v-if="settingsOpen" class="music-modal-layer" @click.self="settingsOpen = false">
        <div class="music-modal settings-modal">
          <header><strong>音乐设置</strong><button type="button" @click="settingsOpen = false">×</button></header>
          <div class="setting-tabs">
            <label class="setting-line"><span>悬浮播放小框</span><input v-model="musicSettings.floatEnabled" type="checkbox" /></label>
            <ProbabilityField v-model="musicSettings.requestChance" v-model:random-value="musicSettings.requestChanceRandom" label="音乐请求触发概率（%）" :max="30" />
            <label class="setting-line"><span>请求冷却</span><select v-model.number="musicSettings.cooldownMinutes"><option :value="0">无冷却</option><option :value="5">5分钟</option><option :value="10">10分钟</option></select></label>
            <label class="setting-line"><span>桌面组件封面</span><select v-model="musicSettings.widgetCoverMode"><option value="song">歌曲封面</option><option value="playlist">歌单封面</option></select></label>
            <ProbabilityField v-model="musicSettings.taReserveChance" v-model:random-value="musicSettings.taReserveChanceRandom" label="TA 预存下一首概率（%）" />
            <ProbabilityField v-model="musicSettings.taNextChance" v-model:random-value="musicSettings.taNextChanceRandom" label="TA 主动切下一首概率（%）" />
            <ProbabilityField v-model="musicSettings.taRandomChance" v-model:random-value="musicSettings.taRandomChanceRandom" label="TA 随机挑歌概率（%）" />
            <ProbabilityField v-model="musicSettings.taModeChance" v-model:random-value="musicSettings.taModeChanceRandom" label="TA 切换播放模式概率（%）" />
            <label class="setting-line"><span>联系人可暂停播放</span><input v-model="musicSettings.taPauseEnabled" type="checkbox" /></label>
            <ProbabilityField v-model="musicSettings.taPauseChance" v-model:random-value="musicSettings.taPauseChanceRandom" label="TA 暂停再播放概率（%）" :disabled="!musicSettings.taPauseEnabled" />
            <ProbabilityField v-model="musicSettings.taFavoriteChance" v-model:random-value="musicSettings.taFavoriteChanceRandom" label="TA 收藏歌曲概率（%）" />
          </div>
          <div class="modal-actions"><button type="button" @click="resetMusicSettings">恢复默认</button><button type="button" class="primary" @click="saveSettings">保存</button></div>
        </div>
      </div>
    </transition>
  </section>
</template><style scoped>
.music-app{max-width:760px;margin:0 auto;padding:0 12px 96px;color:var(--theme-text);position:relative}
.music-head-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0 8px}
.float-switch{min-height:34px;display:flex;align-items:center;gap:9px;padding:0 11px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-soft);color:var(--theme-text);font-size:10px;font-weight:700}
.float-switch input{accent-color:var(--theme-primary)}
.music-icon-button{width:34px;height:34px;border:1px solid var(--theme-border-soft);border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);font-size:15px;cursor:pointer}
.music-tabs{display:flex;gap:5px;overflow-x:auto;padding:2px 0 9px;scrollbar-width:none}
.music-tabs::-webkit-scrollbar{display:none}
.music-tabs button{flex:none;padding:8px 11px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--theme-muted);font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}
.music-tabs button.active{border-bottom-color:var(--theme-primary);color:var(--theme-primary)}
.music-notice{margin-bottom:8px;padding:7px 10px;border-radius:9px;background:var(--theme-soft);color:var(--theme-accent);font-size:10px}
.music-panel{min-width:0;display:flex;flex-direction:column;gap:9px}
.music-tools{display:flex;flex-wrap:wrap;gap:6px}
.music-tools button,.playlist-create,.batch-bar button,.settings-modal button,.music-modal button{padding:8px 11px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-soft);color:var(--theme-primary);font-size:10px;font-weight:800;cursor:pointer}
.music-tools button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}
.hidden-file{display:none}
.music-subbar{display:flex;align-items:center;gap:8px;min-width:0}
.music-search{flex:1;min-width:0}
.music-search input{width:100%;padding:9px 10px;border:1px solid var(--theme-border-soft);border-radius:11px;background:var(--theme-surface);color:var(--theme-text);font-size:10.5px}
.music-subbar>span{flex:none;color:var(--theme-muted);font-size:9px}
.track-list{display:flex;flex-direction:column;gap:6px;min-width:0}
.track-row{min-width:0;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid var(--theme-border-soft);border-radius:13px;background:var(--theme-surface)}
.track-row.playing{border-color:var(--theme-primary);background:var(--theme-soft)}
.track-row.selected{background:var(--theme-soft)}
.track-main{flex:1;min-width:0;display:flex;align-items:center;gap:9px;padding:0;border:0;background:transparent;color:var(--theme-text);text-align:left;cursor:pointer}
.track-art{flex:none;width:38px;height:38px;border-radius:50%;background:var(--theme-soft);color:var(--theme-primary);font-size:10px;display:grid;place-items:center;overflow:hidden;aspect-ratio:1}.track-art img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.track-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.track-copy strong{overflow:hidden;color:var(--theme-text-strong);font-size:12.5px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
.track-copy small{overflow:hidden;color:var(--theme-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.track-main time{flex:none;color:var(--theme-muted);font-size:9px}
.track-actions{flex:none;display:flex;gap:2px}
.track-actions button{width:26px;height:26px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--theme-muted);font-size:14px;cursor:pointer}
.track-actions button:hover{background:var(--theme-soft);color:var(--theme-primary)}
.track-actions button.liked{color:#e05555}
.track-actions button.danger{color:var(--theme-accent-warm)}
.track-playlist{width:64px;height:24px;padding:0 3px;border:1px solid var(--theme-border-soft);border-radius:7px;background:var(--theme-soft);color:var(--theme-muted);font-size:8px}
.track-check{flex:none;width:23px;height:23px;padding:0;border:1px solid var(--theme-border);border-radius:7px;background:var(--theme-surface);color:var(--theme-inverse);font-size:10px;cursor:pointer}
.track-check.active{border-color:var(--theme-primary);background:var(--theme-primary)}
.music-empty,.playlist-empty{min-height:96px;display:grid;place-items:center;padding:18px;color:var(--theme-muted);font-size:10px;text-align:center}
.batch-bar{position:sticky;bottom:0;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--theme-border);border-radius:11px;background:var(--theme-surface);color:var(--theme-text);font-size:10px}
.batch-bar button:disabled{opacity:.4}
.playlist-card{border:1px solid var(--theme-border-soft);border-radius:14px;background:var(--theme-surface);overflow:hidden}
.playlist-card header{display:flex;align-items:center;justify-content:space-between;padding:10px 11px;border-bottom:1px solid var(--theme-border-soft)}
.playlist-card header>div{display:flex;flex-direction:column;gap:2px}
.playlist-card strong{color:var(--theme-text-strong);font-size:12px}
.playlist-card small{color:var(--theme-muted);font-size:9px}
.danger-text{border:0!important;background:transparent!important;color:var(--theme-accent-warm)!important}
.playlist-tracks{display:flex;flex-direction:column}
.playlist-tracks button{display:flex;align-items:center;gap:7px;padding:8px 10px;border:0;border-bottom:1px solid var(--theme-border-soft);background:transparent;color:var(--theme-text);text-align:left;font-size:10px;cursor:pointer}
.playlist-tracks button:last-child{border-bottom:0}
.playlist-tracks button span:first-child{color:var(--theme-primary);font-size:8px}
.playlist-tracks button span:nth-child(2){flex:1;min-width:0;overflow:hidden;color:var(--theme-text-strong);font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.playlist-tracks button small{flex:none;color:var(--theme-muted);font-size:8.5px}
.history-tabs{display:flex;gap:6px;align-items:center}
.history-tabs button{padding:6px 9px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-muted);font-size:9px;cursor:pointer}
.history-tabs button.active{border-color:var(--theme-primary);background:var(--theme-primary);color:var(--theme-inverse)}
.history-tabs .danger-text{margin-left:auto}
.history-row{display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid var(--theme-border-soft);border-radius:11px;background:var(--theme-surface);color:var(--theme-text);text-align:left;cursor:pointer}
.history-row time{flex:none;color:var(--theme-muted);font-size:8px}
.player-bar{position:sticky;bottom:0;z-index:20;margin-top:10px;padding:8px 9px;border:1px solid var(--theme-border);border-radius:16px;background:var(--theme-surface);display:flex;flex-direction:column;gap:6px}
.player-main{display:flex;align-items:center;gap:10px;min-width:0;border:0;background:transparent;color:var(--theme-text);text-align:left;cursor:pointer}
.player-art{width:48px;height:48px;flex:none;display:grid;place-items:center;border-radius:50%;aspect-ratio:1;overflow:hidden;background:var(--theme-primary);color:var(--theme-inverse);font-size:11px}.player-art img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.player-progress{display:grid;grid-template-columns:29px minmax(0,1fr) 29px;align-items:center;gap:4px;color:var(--theme-muted);font-size:8px}
.player-progress input{width:100%;height:4px;appearance:none;border-radius:99px;background:linear-gradient(to right,var(--theme-primary) var(--p),var(--theme-border-soft) var(--p));cursor:pointer}
.player-progress input::-webkit-slider-thumb{width:9px;height:9px;appearance:none;border-radius:50%;background:var(--theme-primary)}
.player-controls{display:flex;align-items:center;justify-content:center;gap:9px}
.player-controls button{width:28px;height:28px;padding:0;border:0;background:transparent;color:var(--theme-text);font-size:15px;cursor:pointer}
.player-controls button.liked{color:#e05555}
.player-main .track-copy strong{font-size:14px}.player-main .track-copy small{font-size:10px}
.player-progress{font-size:9px}
.import-modal .auto-chat-hint{color:var(--theme-muted);font-size:9px;line-height:1.55}
.import-modal .primary:disabled{opacity:.45;cursor:wait}
.player-controls .play-button{width:38px;height:38px;border-radius:50%;background:var(--theme-primary);color:var(--theme-inverse);font-size:12px;box-shadow:0 5px 14px rgba(var(--theme-primary-rgb),.24)}
.ta-action{color:var(--theme-muted);font-size:8.5px;text-align:center}
.music-modal-layer{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:14px;background:rgba(var(--theme-overlay-rgb),.34);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
.music-modal{width:min(430px,100%);max-height:min(82dvh,680px);overflow:auto;padding:13px;border:1px solid var(--theme-border);border-radius:17px;background:var(--theme-surface);display:flex;flex-direction:column;gap:10px}
.music-modal header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.music-modal header strong{color:var(--theme-primary);font-size:13px}
.music-modal header button{border:0;background:transparent;font-size:17px}
.setting-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--theme-border-soft);color:var(--theme-text);font-size:10px}
.setting-line input[type="number"],.setting-line select{width:82px;padding:6px 7px;border:1px solid var(--theme-border-soft);border-radius:8px;background:var(--theme-soft);color:var(--theme-text)}
.setting-line input[type="checkbox"]{accent-color:var(--theme-primary)}
.import-modal textarea{width:100%;min-height:120px;padding:9px 10px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-soft);color:var(--theme-text);font:inherit;font-size:10.5px;resize:vertical}
.modal-actions{display:flex;justify-content:flex-end;gap:7px}
.modal-actions .primary,.music-modal .primary{border:0;background:var(--theme-primary);color:var(--theme-inverse)}
.queue-modal .queue-row{display:flex;align-items:center;gap:7px;padding:7px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-soft);color:var(--theme-text);font-size:10px;text-align:left;cursor:pointer}
.queue-row span:first-child,.queue-row small{color:var(--theme-muted);font-size:8.5px}
.queue-row span:nth-child(2){flex:1;min-width:0}
.clean-modal header{display:flex;align-items:center;justify-content:space-between}
.clean-hint{margin:0;color:var(--theme-muted);font-size:9.5px;line-height:1.65}
.clean-list{display:flex;flex-direction:column;gap:5px;max-height:320px;overflow:auto}
.clean-list article{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-soft)}
.clean-art{width:32px;height:32px;flex:none;display:grid;place-items:center;overflow:hidden;border-radius:8px;background:var(--theme-surface);color:var(--theme-muted);font-size:12px}
.clean-art img{width:100%;height:100%;object-fit:cover}
.clean-copy{min-width:0;display:flex;flex-direction:column;gap:2px}
.clean-copy strong{overflow:hidden;color:var(--theme-text);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
.clean-copy small{color:var(--theme-muted);font-size:8.5px}
.clean-more{margin:2px 0 0;color:var(--theme-muted);font-size:9px}
.clean-tag{flex:none;margin-left:auto;padding:2px 6px;border:1px solid var(--theme-border-soft);border-radius:999px;color:var(--theme-muted);font-size:8px;white-space:nowrap}
.clean-tag.blocked{color:#c26a5e;border-color:rgba(194,106,94,.42)}
.clean-tag.preview{color:var(--theme-primary);border-color:var(--theme-primary);opacity:.85}
.music-pop-enter-active,.music-pop-leave-active{transition:opacity .18s ease,transform .18s ease}.music-pop-enter-from,.music-pop-leave-to{opacity:0;transform:translateY(7px) scale(.98)}
@media(max-width:560px){.music-app{padding:0 8px 92px}.music-tabs button{padding:7px 9px;font-size:9.5px}.music-tools button{flex:1;min-width:76px}.player-bar{border-radius:14px}.track-actions button{width:23px}.track-copy strong{font-size:10.5px}.history-row time{display:none}}
</style>