import { computed, reactive, watch } from 'vue'
import musicData from './data/music.json'
import { sendIncomingText } from './chat'
import { toPlayUrl } from './netease-music'

const LIBRARY_KEY = 'zhengdu_music_library_v1'
const PLAYLISTS_KEY = 'zhengdu_music_playlists_v1'
const FAVORITES_KEY = 'zhengdu_music_favorites_v1'
const TA_FAVORITES_KEY = 'zhengdu_music_ta_favorites_v1'
const HISTORY_KEY = 'zhengdu_music_history_v1'
const MY_HISTORY_KEY = 'zhengdu_music_my_history_v1'
const SETTINGS_KEY = 'zhengdu_music_settings_v1'
const CURRENT_KEY = 'zhengdu_music_current_v1'
const DB_NAME = 'zhengdu_music_files_v1'
const DB_STORE = 'files'
const REQUEST_TIME_KEY = 'zhengdu_music_request_at_v1'

const audioFiles = import.meta.glob('./assets/songs/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
})
const builtinTracks = (musicData.tracks || []).map((track) => {
  const path = Object.keys(audioFiles).find((key) => key.endsWith('/' + track.file))
  return {
    id: `builtin-${track.id}`,
    name: track.title,
    artist: track.artist,
    url: path ? audioFiles[path] : '',
    source: 'builtin',
    duration: 0,
    playlistId: '',
    addedAt: 0,
    mood: track.mood || '',
  }
})

export const MUSIC_MODES = [
  { id: 'list', label: '列表播放' },
  { id: 'shuffle', label: '随机播放' },
  { id: 'single', label: '单曲循环' },
]
export const MUSIC_SETTINGS_DEFAULTS = Object.freeze({
  floatEnabled: true,
  requestChance: 5,
  requestChanceRandom: false,
  cooldownMinutes: 10,
  widgetCoverMode: 'song',
  taReserveChance: 6,
  taReserveChanceRandom: false,
  taNextChance: 15,
  taNextChanceRandom: false,
  taRandomChance: 10,
  taRandomChanceRandom: false,
  taModeChance: 5,
  taModeChanceRandom: false,
  taPauseEnabled: true,
  taPauseChance: 3,
  taPauseChanceRandom: false,
  taFavoriteChance: 20,
  taFavoriteChanceRandom: false,
})

function loadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadObject(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function loadSettings() {
  const saved = loadObject(SETTINGS_KEY)
  return {
    floatEnabled: saved.floatEnabled === undefined ? true : Boolean(saved.floatEnabled),
    requestChance: Math.min(30, Math.max(0, Number(saved.requestChance) || 5)),
    requestChanceRandom: Boolean(saved.requestChanceRandom),
    cooldownMinutes: [0, 5, 10].includes(Number(saved.cooldownMinutes)) ? Number(saved.cooldownMinutes) : 10,
    widgetCoverMode: saved.widgetCoverMode === 'playlist' ? 'playlist' : 'song',
    taReserveChance: Math.min(100, Math.max(0, Number(saved.taReserveChance) || 6)),
    taReserveChanceRandom: Boolean(saved.taReserveChanceRandom),
    taNextChance: Math.min(100, Math.max(0, Number(saved.taNextChance) || 15)),
    taNextChanceRandom: Boolean(saved.taNextChanceRandom),
    taRandomChance: Math.min(100, Math.max(0, Number(saved.taRandomChance) || 10)),
    taRandomChanceRandom: Boolean(saved.taRandomChanceRandom),
    taModeChance: Math.min(100, Math.max(0, Number(saved.taModeChance) || 5)),
    taModeChanceRandom: Boolean(saved.taModeChanceRandom),
    taPauseEnabled: saved.taPauseEnabled === undefined ? true : Boolean(saved.taPauseEnabled),
    taPauseChance: Math.min(100, Math.max(0, Number(saved.taPauseChance) || 3)),
    taPauseChanceRandom: Boolean(saved.taPauseChanceRandom),
    taFavoriteChance: Math.min(100, Math.max(0, Number(saved.taFavoriteChance) || 20)),
    taFavoriteChanceRandom: Boolean(saved.taFavoriteChanceRandom),
  }
}

const savedLibrary = loadArray(LIBRARY_KEY).filter((track) => track && track.id && track.source !== 'builtin')
const currentSaved = loadObject(CURRENT_KEY)

export const musicState = reactive({
  library: [...builtinTracks, ...savedLibrary],
  playlists: loadArray(PLAYLISTS_KEY),
  favorites: loadArray(FAVORITES_KEY),
  taFavorites: loadArray(TA_FAVORITES_KEY),
  history: loadArray(HISTORY_KEY),
  myHistory: loadArray(MY_HISTORY_KEY),
  currentId: typeof currentSaved.id === 'string' ? currentSaved.id : '',
  playing: false,
  currentTime: 0,
  duration: 0,
  mode: ['list', 'shuffle', 'single'].includes(currentSaved.mode) ? currentSaved.mode : 'list',
  queue: Array.isArray(currentSaved.queue) ? currentSaved.queue : [],
  floatClosed: false,
  floatMin: false,
  lastAction: '',
  loadingTrackId: '',
})
export const musicSettings = reactive(loadSettings())

// 内置示例曲目（淡海 / 海豹午睡 / 争渡）已下线：清掉旧存档里指向 builtin-* 的残留引用，
// 否则收藏、队列、听歌记录里会留下点不开的空条目。
const isBuiltinRef = (id) => typeof id === 'string' && id.startsWith('builtin-')
musicState.favorites = musicState.favorites.filter((id) => !isBuiltinRef(id))
musicState.taFavorites = musicState.taFavorites.filter((id) => !isBuiltinRef(id))
musicState.queue = musicState.queue.filter((id) => !isBuiltinRef(id))
musicState.history = musicState.history.filter((item) => !isBuiltinRef(item?.trackId))
musicState.myHistory = musicState.myHistory.filter((item) => !isBuiltinRef(item?.trackId))
if (isBuiltinRef(musicState.currentId)) {
  musicState.currentId = ''
  musicState.currentTime = 0
  musicState.duration = 0
}

let audio = null
let inviteTimer = null
let favoriteTimer = null
let pauseTimer = null
let nextTimer = null
const objectUrls = new Map()

function chance(percent, random = false) {
  if (random === true) return Math.random() < 0.5
  return Math.random() * 100 < Math.min(100, Math.max(0, Number(percent) || 0))
}
function saveArray(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
export function trackById(id) {
  return musicState.library.find((track) => track.id === id) || null
}
export const currentTrack = computed(() => trackById(musicState.currentId))
export function formatMusicTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
export function cleanTrackName(filename) {
  return String(filename || '未命名音频').replace(/\.[^.]+$/, '').trim() || '未命名音频'
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('当前浏览器不支持本地音乐缓存'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function putFile(id, file) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(file, id)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}
async function getFile(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const request = tx.objectStore(DB_STORE).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}
async function deleteFile(id) {
  try {
    const db = await openDb()
    db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id)
  } catch {}
}

function persistLibrary() {
  saveArray(LIBRARY_KEY, musicState.library.filter((track) => track.source !== 'builtin'))
}
function persistAll() {
  persistLibrary()
  saveArray(PLAYLISTS_KEY, musicState.playlists)
  saveArray(FAVORITES_KEY, musicState.favorites)
  saveArray(TA_FAVORITES_KEY, musicState.taFavorites)
  saveArray(HISTORY_KEY, musicState.history.slice(0, 300))
  saveArray(MY_HISTORY_KEY, musicState.myHistory.slice(0, 300))
  saveArray(SETTINGS_KEY, musicSettings)
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ id: musicState.currentId, mode: musicState.mode, queue: musicState.queue }))
  } catch {}
}

function initAudio() {
  if (audio || typeof Audio === 'undefined') return audio
  audio = new Audio()
  audio.preload = 'metadata'
  audio.addEventListener('loadedmetadata', () => {
    musicState.duration = Number.isFinite(audio.duration) ? audio.duration : 0
    const current = trackById(musicState.currentId)
    if (current && musicState.duration) current.duration = musicState.duration
    persistLibrary()
  })
  audio.addEventListener('timeupdate', () => {
    musicState.currentTime = Number(audio.currentTime) || 0
    if (!musicState.duration && Number.isFinite(audio.duration)) musicState.duration = audio.duration
  })
  audio.addEventListener('play', () => {
    musicState.playing = true
    armTaActions()
  })
  audio.addEventListener('pause', () => { musicState.playing = false })
  audio.addEventListener('ended', () => handleTrackEnded())
  audio.addEventListener('error', () => {
    musicState.playing = false
    musicState.lastAction = '当前音频无法播放，请检查链接或文件。'
  })
  return audio
}

function addMyHistory(track) {
  if (!track) return
  musicState.myHistory = [
    { id: `mh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, trackId: track.id, trackName: track.name, artist: track.artist, ts: Date.now() },
    ...musicState.myHistory.filter((item) => item.trackId !== track.id),
  ].slice(0, 300)
  persistAll()
}
function addInviteHistory(track, triggerType = 'invite') {
  if (!track) return
  musicState.history = [
    { id: `mhi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, trackId: track.id, trackName: track.name, artist: track.artist, triggerType, ts: Date.now() },
    ...musicState.history,
  ].slice(0, 300)
  persistAll()
}
function requestCooldownReady() {
  try {
    const last = Number(localStorage.getItem(REQUEST_TIME_KEY)) || 0
    return Date.now() - last >= Math.max(0, Number(musicSettings.cooldownMinutes) || 0) * 60000
  } catch {
    return true
  }
}
function markRequestTime() {
  try { localStorage.setItem(REQUEST_TIME_KEY, String(Date.now())) } catch {}
}
function scheduleInvite(track) {
  clearTimeout(inviteTimer)
  if (!track || !requestCooldownReady() || !chance(musicSettings.requestChance, musicSettings.requestChanceRandom)) return
  inviteTimer = setTimeout(() => {
    addInviteHistory(track, '概率邀请')
    markRequestTime()
    musicState.lastAction = `TA 邀请你一起听《${track.name}》`
    sendIncomingText(`想和你一起听《${track.name}》`)
  }, 5000)
}
function scheduleTaFavorite(track) {
  clearTimeout(favoriteTimer)
  if (!track || !chance(musicSettings.taFavoriteChance, musicSettings.taFavoriteChanceRandom)) return
  favoriteTimer = setTimeout(() => {
    if (!musicState.taFavorites.includes(track.id)) musicState.taFavorites = [track.id, ...musicState.taFavorites]
    musicState.lastAction = `TA 收藏了《${track.name}》`
    persistAll()
  }, 6500)
}
function scheduleTaPause(track) {
  clearTimeout(pauseTimer)
  if (!track || !musicSettings.taPauseEnabled || !chance(musicSettings.taPauseChance, musicSettings.taPauseChanceRandom)) return
  pauseTimer = setTimeout(() => {
    if (musicState.currentId !== track.id || !musicState.playing) return
    pauseMusic()
    musicState.lastAction = `TA 暂停了《${track.name}》`
    setTimeout(() => { if (musicState.currentId === track.id) playMusic() }, 2600)
  }, 15000)
}
function scheduleTaNext(track) {
  clearTimeout(nextTimer)
  if (!track || !chance(musicSettings.taNextChance, musicSettings.taNextChanceRandom)) return
  nextTimer = setTimeout(() => {
    if (musicState.currentId !== track.id || !musicState.playing) return
    playNext()
    musicState.lastAction = 'TA 主动切了下一首'
  }, 8000 + Math.random() * 120000)
}
function armTaActions() {
  const track = currentTrack.value
  clearTimeout(favoriteTimer)
  clearTimeout(pauseTimer)
  clearTimeout(nextTimer)
  if (!track) return
  scheduleInvite(track)
  scheduleTaFavorite(track)
  scheduleTaPause(track)
  scheduleTaNext(track)
}
function reserveRandomTrack() {
  const pool = musicState.library.filter((track) => track.id !== musicState.currentId)
  if (!pool.length || !chance(musicSettings.taReserveChance, musicSettings.taReserveChanceRandom)) return
  const track = pool[Math.floor(Math.random() * pool.length)]
  musicState.queue = [...musicState.queue, track.id]
  musicState.lastAction = `TA 把《${track.name}》加入了播放队列`
}
async function resolvePlayableUrl(track) {
  if (!track) return ''
  if (track.url) return track.url
  if (track.source !== 'upload') return ''
  if (objectUrls.has(track.id)) return objectUrls.get(track.id)
  const file = await getFile(track.id)
  if (!file) return ''
  const url = URL.createObjectURL(file)
  objectUrls.set(track.id, url)
  return url
}
export async function playTrack(id, options = {}) {
  const track = trackById(id)
  if (!track) return false
  const player = initAudio()
  if (!player) return false
  musicState.loadingTrackId = id
  try {
    const url = await resolvePlayableUrl(track)
    if (!url) {
      musicState.lastAction = '这个音频没有可用的播放地址。'
      return false
    }
    if (musicState.currentId !== id) {
      musicState.currentId = id
      musicState.currentTime = 0
      musicState.duration = Number(track.duration) || 0
    }
    player.src = url
    player.load()
    if (options.autoplay !== false) {
      await player.play()
      addMyHistory(track)
      reserveRandomTrack()
    }
    persistAll()
    return true
  } catch {
    musicState.playing = false
    musicState.lastAction = '播放失败，请检查音频链接或文件格式。'
    return false
  } finally {
    musicState.loadingTrackId = ''
  }
}

export function playMusic() {
  if (!musicState.currentId) {
    const first = musicState.library[0]
    return first ? playTrack(first.id) : Promise.resolve(false)
  }
  const player = initAudio()
  if (!player) return Promise.resolve(false)
  return player.play().then(() => true).catch(() => false)
}
export function pauseMusic() {
  if (audio) audio.pause()
}
export function togglePlay() {
  return musicState.playing ? (pauseMusic(), Promise.resolve(false)) : playMusic()
}
export function seekMusic(seconds) {
  if (!audio) return
  const value = Math.max(0, Math.min(Number(musicState.duration) || 0, Number(seconds) || 0))
  audio.currentTime = value
  musicState.currentTime = value
}

export function playNext() {
  let nextId = musicState.queue[0]
  if (nextId) musicState.queue = musicState.queue.slice(1)
  if (!nextId) {
    const list = musicState.library
    if (!list.length) return false
    const index = Math.max(0, list.findIndex((track) => track.id === musicState.currentId))
    const next = musicState.mode === 'shuffle'
      ? list[Math.floor(Math.random() * list.length)]
      : list[(index + 1) % list.length]
    nextId = next.id
  }
  return playTrack(nextId)
}
export function playPrev() {
  const list = musicState.library
  if (!list.length) return false
  const index = Math.max(0, list.findIndex((track) => track.id === musicState.currentId))
  return playTrack(list[(index - 1 + list.length) % list.length].id)
}
export function handleTrackEnded() {
  const track = currentTrack.value
  if (musicState.mode === 'single') {
    seekMusic(0)
    playMusic()
    return
  }
  if (track && chance(musicSettings.taRandomChance, musicSettings.taRandomChanceRandom)) {
    const pool = musicState.library.filter((item) => item.id !== track.id)
    if (pool.length) {
      musicState.lastAction = 'TA 随机切了一首歌'
      playTrack(pool[Math.floor(Math.random() * pool.length)].id)
      return
    }
  }
  if (track && chance(musicSettings.taModeChance, musicSettings.taModeChanceRandom)) {
    const modes = MUSIC_MODES.map((item) => item.id)
    musicState.mode = modes[(modes.indexOf(musicState.mode) + 1) % modes.length]
    musicState.lastAction = 'TA 切换了播放模式'
  }
  playNext()
}
export function setMusicMode(mode) {
  if (!['list', 'shuffle', 'single'].includes(mode)) return
  musicState.mode = mode
  persistAll()
}

export async function addMusicFiles(files, playlistId = '') {
  const list = Array.from(files || [])
  const added = []
  for (const file of list) {
    if (!file || (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name))) continue
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    try {
      await putFile(id, file)
      const track = {
        id,
        name: cleanTrackName(file.name),
        artist: '本地音乐',
        url: '',
        source: 'upload',
        duration: 0,
        playlistId: playlistId || '',
        addedAt: Date.now(),
      }
      musicState.library.push(track)
      added.push(track)
    } catch {}
  }
  persistLibrary()
  return added
}

export function addMusicUrl({ url, name, artist = '未知歌手', playlistId = '', cover = '', source = 'url', sourceId = '', lyric = '' }) {
  const cleanUrl = String(url || '').trim()
  if (!cleanUrl) return null
  const stableId = sourceId ? `netease-${sourceId}` : ''
  if (stableId && musicState.library.some((track) => track.id === stableId)) return null
  const track = {
    id: stableId || `url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || '').trim() || '在线音频',
    artist: String(artist || '').trim() || '未知歌手',
    url: cleanUrl,
    cover: String(cover || '').trim(),
    lyric: String(lyric || ''),
    source,
    sourceId: String(sourceId || ''),
    duration: 0,
    playlistId: playlistId || '',
    addedAt: Date.now(),
  }
  musicState.library.push(track)
  persistLibrary()
  return track
}

export async function removeMusicTracks(ids) {
  const targets = new Set(Array.isArray(ids) ? ids : [ids])
  for (const id of targets) {
    const track = trackById(id)
    if (!track || track.source === 'builtin') continue
    if (track.source === 'upload') await deleteFile(id)
    const objectUrl = objectUrls.get(id)
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrls.delete(id)
  }
  musicState.library = musicState.library.filter((track) => !targets.has(track.id) || track.source === 'builtin')
  musicState.favorites = musicState.favorites.filter((id) => !targets.has(id))
  musicState.taFavorites = musicState.taFavorites.filter((id) => !targets.has(id))
  musicState.queue = musicState.queue.filter((id) => !targets.has(id))
  if (targets.has(musicState.currentId)) {
    musicState.currentId = ''
    musicState.currentTime = 0
    musicState.duration = 0
    pauseMusic()
  }
  persistAll()
}

/**
 * 待清理的网易云歌曲：只认带 sourceId 的在线歌曲（本地文件、内置曲目、普通直链都不参与）
 */
export function neteaseCleanCandidates() {
  return musicState.library.filter(
    (track) => track && track.source === 'url' && track.sourceId && track.source !== 'builtin'
  )
}

const PROBE_CONCURRENCY = 8
const PROBE_TIMEOUT = 8000
const PROBE_TOTAL_TIMEOUT = 30000
// 网易云的会员歌常给出 30 秒试听片段：能播、也有 302，但时长卡在 30 秒。
// 留 1 秒容差（元数据里有时是 30.02 / 30.5）。
const PREVIEW_MAX_SECONDS = 31

/** 用 audio 元素只拉元数据读时长；读不到返回 null（绝不当成 0 秒） */
function probeDuration(url, timeout = PROBE_TIMEOUT) {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') {
      resolve(null)
      return
    }
    let settled = false
    const audio = new Audio()
    let timer = null
    const finish = (value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      try {
        audio.removeAttribute('src')
        audio.load()
      } catch {}
      resolve(value)
    }
    timer = setTimeout(() => finish(null), timeout)
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => {
      const value = Number(audio.duration)
      finish(Number.isFinite(value) && value > 0 ? value : null)
    }, { once: true })
    audio.addEventListener('error', () => finish(null), { once: true })
    try {
      audio.src = url
    } catch {
      finish(null)
    }
  })
}

/**
 * 单首探测：能不能播，以及是不是 30 秒试听。
 * 可播判据与播放链路一致：免费歌 meting ?type=url 会 302 到网易 CDN（response.redirected），
 * 或响应本身就是 audio/*；会员/付费/失效歌返回 200 + text/html 空正文且无跳转。
 * 探测失败（网络/超时）返回 unknown，绝不当作可删。
 * @returns {Promise<{ verdict: 'playable'|'blocked'|'unknown', duration: number|null }>}
 */
function probePlayable(songId) {
  return new Promise((resolve) => {
    let settled = false
    let controller = null
    let timer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    try {
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    } catch {
      controller = null
    }
    timer = setTimeout(() => {
      try { controller?.abort() } catch {}
      finish({ verdict: 'unknown', duration: null })
    }, PROBE_TIMEOUT)

    fetch(toPlayUrl(songId), controller ? { signal: controller.signal } : undefined)
      .then(async (response) => {
        let type = ''
        try { type = response.headers?.get('content-type') || '' } catch {}
        const playable = Boolean(response.redirected) || /^audio\//i.test(type)
        if (!playable) {
          finish({ verdict: 'blocked', duration: null })
          try { controller?.abort() } catch {}
          try { response.body?.cancel?.() } catch {}
          return
        }
        // 拿到 302 之后的真实 CDN 地址，用它读时长
        const finalUrl = response.url || toPlayUrl(songId)
        try { controller?.abort() } catch {}
        try { response.body?.cancel?.() } catch {}
        const duration = await probeDuration(finalUrl)
        finish({ verdict: 'playable', duration })
      })
      .catch(() => finish({ verdict: 'unknown', duration: null }))
  })
}

/**
 * 批量检测网易云会员/付费歌曲。
 * 两类会被判为可清理：
 *   1. blocked：探测不可播（会员/付费/链接失效）
 *   2. preview：能播但时长只有 30 秒上下，是会员试听片段
 * @param {(progress: { done: number, total: number }) => void} [onProgress]
 * @returns {Promise<{ ok: boolean, total: number, probed: number, candidates: number,
 *   unplayable: object[], preview: object[], removable: object[], unknown: number }>}
 *   ok=false 表示一首都没探到（服务不可用），调用方不应据此删歌。
 */
export async function scanUnplayableNetease(onProgress) {
  const candidates = neteaseCleanCandidates()
  const uniqueIds = []
  candidates.forEach((track) => {
    const id = String(track.sourceId)
    if (!uniqueIds.includes(id)) uniqueIds.push(id)
  })
  if (!uniqueIds.length) {
    return { ok: true, total: 0, probed: 0, candidates: 0, unplayable: [], preview: [], removable: [], unknown: 0 }
  }

  const verdict = new Map()
  let cursor = 0
  let done = 0
  const startedAt = Date.now()
  const expired = () => Date.now() - startedAt > PROBE_TOTAL_TIMEOUT

  async function worker() {
    while (cursor < uniqueIds.length && !expired()) {
      const id = uniqueIds[cursor]
      cursor += 1
      const result = await probePlayable(id)
      verdict.set(id, result)
      done += 1
      if (typeof onProgress === 'function') onProgress({ done, total: uniqueIds.length })
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, uniqueIds.length) }, () => worker())
  )

  const values = [...verdict.values()]
  const probed = values.filter((value) => value.verdict !== 'unknown').length
  const unknown = values.filter((value) => value.verdict === 'unknown').length
  const blockedIds = new Set(
    [...verdict.entries()].filter(([, value]) => value.verdict === 'blocked').map(([id]) => id)
  )
  const previewIds = new Set(
    [...verdict.entries()]
      .filter(([, value]) => value.verdict === 'playable'
        && typeof value.duration === 'number'
        && value.duration > 0
        && value.duration <= PREVIEW_MAX_SECONDS)
      .map(([id]) => id)
  )

  const unplayable = candidates.filter((track) => blockedIds.has(String(track.sourceId)))
  const preview = candidates.filter((track) => previewIds.has(String(track.sourceId)))
  const removable = candidates.filter(
    (track) => blockedIds.has(String(track.sourceId)) || previewIds.has(String(track.sourceId))
  )

  return {
    ok: probed > 0,
    total: uniqueIds.length,
    probed,
    candidates: candidates.length,
    unplayable,
    preview,
    removable,
    unknown,
  }
}

export function setTrackPlaylist(trackId, playlistId) {
  const track = trackById(trackId)
  if (!track || track.source === 'builtin') return false
  track.playlistId = String(playlistId || '')
  persistLibrary()
  return true
}
export function addPlaylist(name) {
  const clean = String(name || '').trim()
  if (!clean) return null
  const playlist = { id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: clean, createdAt: Date.now() }
  musicState.playlists.push(playlist)
  persistAll()
  return playlist
}
export function removePlaylist(id) {
  musicState.playlists = musicState.playlists.filter((playlist) => playlist.id !== id)
  musicState.library.forEach((track) => { if (track.playlistId === id) track.playlistId = '' })
  persistAll()
}
export function toggleFavorite(trackId) {
  if (!trackId) return false
  musicState.favorites = musicState.favorites.includes(trackId)
    ? musicState.favorites.filter((id) => id !== trackId)
    : [trackId, ...musicState.favorites]
  persistAll()
  return musicState.favorites.includes(trackId)
}
export function toggleTaFavorite(trackId) {
  if (!trackId) return false
  musicState.taFavorites = musicState.taFavorites.includes(trackId)
    ? musicState.taFavorites.filter((id) => id !== trackId)
    : [trackId, ...musicState.taFavorites]
  persistAll()
  return musicState.taFavorites.includes(trackId)
}
export function enqueueTrack(trackId) {
  if (!trackById(trackId)) return false
  musicState.queue = [...musicState.queue, trackId]
  persistAll()
  return true
}
export function clearMusicQueue() {
  musicState.queue = []
  persistAll()
}
export function closeFloat() { musicState.floatClosed = true }
export function reopenFloat() { musicState.floatClosed = false }
export function toggleFloatMin() { musicState.floatMin = !musicState.floatMin }
export function clearMusicHistory() {
  musicState.history = []
  musicState.myHistory = []
  persistAll()
}
export function resetMusicSettings() {
  Object.assign(musicSettings, MUSIC_SETTINGS_DEFAULTS)
  persistAll()
}

watch(musicSettings, persistAll, { deep: true })
watch(
  () => [musicState.library.length, musicState.playlists.length, musicState.favorites.length, musicState.taFavorites.length],
  persistAll
)
initAudio()