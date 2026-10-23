const DEFAULT_METING = 'https://api.injahow.cn/meting/'
const DEFAULT_PLAYLIST = 'https://api.qijieya.cn/meting/'
let metingUrl = DEFAULT_METING
let playlistUrl = DEFAULT_PLAYLIST

function enc(value) { return encodeURIComponent(String(value)) }

export function parseSongId(input) {
  const value = String(input || '').trim()
  if (!value) return ''
  if (/^\d+$/.test(value)) return value
  let match = value.match(/[?&]id=(\d+)/)
  if (match) return match[1]
  match = value.match(/\/(?:song|playlist)\/(\d+)/i)
  if (match) return match[1]
  match = value.match(/\/(\d{5,})(?:\.mp3)?(?:\?|#|$)/)
  return match ? match[1] : ''
}

export function parsePlaylistId(input) {
  const value = String(input || '').trim()
  if (!value || /\.mp3/i.test(value)) return ''
  const match = value.match(/playlist[\/?#&!\s]*(?:id=)?(\d+)/i)
  return match ? match[1] : ''
}

export function isShortLink(input) {
  return /(?:^|[\s/])163cn\.tv\/[\w-]+/i.test(String(input || '').trim())
}

export function toPlayUrl(id) {
  return `${metingUrl}?type=url&id=${enc(id)}`
}

export function toPicUrl(picId) {
  return `${metingUrl}?server=netease&type=pic&id=${enc(picId)}`
}

export async function fetchSongInfo(id) {
  const response = await fetch(`${metingUrl}?server=netease&type=song&id=${enc(id)}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const list = await response.json()
  const song = Array.isArray(list) ? list[0] : null
  if (!song?.name) return null
  return {
    id: String(id),
    name: song.name,
    artist: song.artist || '',
    cover: song.pic || '',
    lyric: song.lrc || '',
    playUrl: toPlayUrl(id),
  }
}

export async function resolveShortLink(link) {
  const target = String(link || '').trim().replace(/^http:\/\//i, 'https://')
  const proxies = [
    `https://api.allorigins.win/raw?url=${enc(target)}`,
    `https://proxy.cors.sh/${target}`,
  ]
  const results = await Promise.all(proxies.map(async (url) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = setTimeout(() => controller?.abort(), 7000)
    try {
      const response = await fetch(url, controller ? { signal: controller.signal } : undefined)
      if (!response.ok) return ''
      const text = await response.text()
      const match = text.match(/music\.163\.com[^"'<>]*?\/song[^"'<>]*?(?:id=)?(\d{5,})/i) ||
        text.match(/(?:song[\/?#]+id=|song\/)[^"'<>]{0,40}?(\d{5,})/i)
      return match ? match[1] : ''
    } catch {
      return ''
    } finally {
      clearTimeout(timer)
    }
  }))
  return results.find(Boolean) || ''
}

function parseMetingList(text) {
  let data
  try { data = JSON.parse(text) } catch { return [] }
  if (!Array.isArray(data)) return []
  return data.map((track) => {
    if (!track) return null
    const match = String(track.url || '').match(/[?&]id=(\d+)/)
    const id = match ? match[1] : ''
    if (!id) return null
    return {
      id,
      name: track.name || track.title || '',
      artist: track.artist || track.author || '',
      cover: track.pic || '',
      playUrl: toPlayUrl(id),
    }
  }).filter(Boolean)
}

export async function fetchPlaylist(playlistId) {
  const id = enc(playlistId)
  const sources = [
    `${playlistUrl}?server=netease&type=playlist&id=${id}`,
    `${metingUrl}?type=playlist&id=${id}`,
  ]
  const results = await Promise.all(sources.map(async (url) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = setTimeout(() => controller?.abort(), 9000)
    try {
      const response = await fetch(url, controller ? { signal: controller.signal } : undefined)
      if (!response.ok) return []
      return parseMetingList(await response.text())
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }))
  return results[0].length >= results[1].length ? results[0] : results[1]
}

export function resolveInput(raw) {
  const lines = String(raw || '').split(/\r?\n+/).map((line) => line.trim()).filter(Boolean)
  const playlistIds = []
  const tracks = []
  for (const line of lines) {
    if (isShortLink(line)) { tracks.push({ short: line }); continue }
    const playlistId = parsePlaylistId(line)
    if (playlistId) {
      if (!playlistIds.includes(playlistId)) playlistIds.push(playlistId)
      continue
    }
    const songId = parseSongId(line)
    if (songId) {
      if (!tracks.includes(songId)) tracks.push(songId)
      continue
    }
    if (/^https?:\/\//i.test(line)) tracks.push({ direct: line })
  }
  return { playlistIds, tracks }
}

export function setNeteaseSources(options = {}) {
  if (options.meting) metingUrl = options.meting
  if (options.playlist) playlistUrl = options.playlist
}