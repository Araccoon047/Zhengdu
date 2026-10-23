import { reactive } from 'vue'

let nextId = 1
const queue = []

export const cropState = reactive({
  task: null,
})

function activateNext() {
  if (cropState.task || !queue.length) return
  const item = queue.shift()
  cropState.task = {
    id: nextId++,
    file: item.file,
    url: URL.createObjectURL(item.file),
    options: item.options || {},
    resolve: item.resolve,
    reject: item.reject,
  }
}

export function cropImage(file, options = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return Promise.resolve(null)
  }
  return new Promise((resolve, reject) => {
    queue.push({ file, options, resolve, reject })
    activateNext()
  })
}

export function completeCrop(dataUrl) {
  const task = cropState.task
  if (!task) return
  URL.revokeObjectURL(task.url)
  cropState.task = null
  task.resolve(dataUrl)
  queueMicrotask(activateNext)
}

export function cancelCrop() {
  const task = cropState.task
  if (!task) return
  URL.revokeObjectURL(task.url)
  cropState.task = null
  task.resolve(null)
  queueMicrotask(activateNext)
}
