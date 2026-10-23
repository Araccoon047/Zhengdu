import { settings } from './settings'

// 后台保活：循环播放一段运行时生成的静音 WAV，让套壳 WebView 认为有活跃媒体，
// 避免切后台时 JS 定时器被冻结（主动消息、自动换头像、纪念日倒计时等都依赖定时器）。
// 静音音频是 muted + loop，不产生任何声音，也不占用明显资源。

let audio = null
let started = false

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i))
}

/** 运行时生成一段静音 WAV（8kHz / 8bit / 单声道，全 0x80 中点），无需任何音频文件 */
function makeSilenceWav(seconds = 1) {
  const sr = 8000
  const n = sr * seconds
  const buf = new ArrayBuffer(44 + n)
  const view = new DataView(buf)
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + n, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(0x80)
  return new Blob([buf], { type: 'audio/wav' })
}

function startKeepAlive() {
  if (started || typeof document === 'undefined') return
  started = true
  try {
    audio = document.createElement('audio')
    audio.src = URL.createObjectURL(makeSilenceWav())
    audio.loop = true
    audio.muted = true
    audio.setAttribute('playsinline', '')
    audio.setAttribute('webkit-playsinline', '')
    const play = () => {
      audio.play().catch(() => {
        // 自动播放被拦截时，等首次用户交互再试
        const retry = () => {
          audio.play().catch(() => {})
          document.removeEventListener('touchstart', retry)
          document.removeEventListener('click', retry)
        }
        document.addEventListener('touchstart', retry, { once: true })
        document.addEventListener('click', retry, { once: true })
      })
    }
    play()
  } catch (e) {
    started = false
  }
}

function stopKeepAlive() {
  if (!started) return
  started = false
  try {
    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }
  } catch (e) {}
}

/** 按设置开关同步保活状态；供 App 启动与设置变化时调用 */
export function syncKeepAlive() {
  if (settings.keepAliveEnabled) startKeepAlive()
  else stopKeepAlive()
}
