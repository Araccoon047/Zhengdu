export function imageFileToOriginalDataUrl(file) {
  if (!file || !file.type?.startsWith('image/')) return Promise.resolve('')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}
const IMAGE_PROXY_PREFIX = 'https://wsrv.nl/?url='

export function imageProxyUrl(url) {
  return `${IMAGE_PROXY_PREFIX}${encodeURIComponent(String(url || '').trim())}&n=-1`
}

export function normalizeImageUrl(value, options = {}) {
  let url = String(value || '').trim()
  if (!url) return ''
  const markdown = url.match(/!\[[^\]]*]\(\s*([^)\s]+)\s*\)/)
  if (markdown) url = markdown[1]
  url = url
    .replace(/^<|>$/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .trim()
  if (!url) return ''
  if (/^(data:image\/|blob:)/i.test(url)) return url
  if (url.startsWith('//')) url = `https:${url}`
  if (/^github\.com\//i.test(url)) url = `https://${url}`
  const githubBlob = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i)
  if (githubBlob) {
    url = `https://raw.githubusercontent.com/${githubBlob[1]}/${githubBlob[2]}/${githubBlob[3]}/${githubBlob[4]}`
  }
  const driveFile = url.match(/^https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/i)
  if (driveFile) url = `https://drive.google.com/uc?export=view&id=${driveFile[1]}`
  if (!/^https?:\/\//i.test(url)) return ''
  if (options.proxyHttp !== false) {
    const pageIsHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
    if (pageIsHttps && /^http:\/\//i.test(url)) return imageProxyUrl(url)
  }
  return url
}
export async function imageFileToDataUrl(file, maxSide, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
          const width = Math.max(1, Math.round(img.width * scale))
          const height = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (e) {
          reject(e)
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
