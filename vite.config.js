import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 子路径与 Capacitor 本地外壳都能正确加载资源。
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    // 独立输出目录，避免旧构建文件被系统进程占用。
    outDir: 'dist-web',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    watch: {
      // 本地装饰图片只作为静态资源使用，不需要热更新监听。
      ignored: ['**/.cache/**', '**/dist*/**', '**/src/assets/theme/**'],
    },
  },
})