import { createApp } from 'vue'
import App from './App.vue'
import { settings } from './settings'
import { store } from './store'
import './theme/tokens.css'

// 主题：直接来自《echoes│淡海蓝章by淅沥沥.docx》的原始 CSS，未改动
import './theme/echoes.css'
// 站点布局：只负责排版与响应式，不覆盖主题的配色 / 圆角 / 阴影
import './style.css'
// 扁平化收口：纯色底、无泛光、浮层不透明（必须最后加载）
import './flat-ui.css'
// 芝芝桃主题效果：在 flat-ui 之后加载，用更高优先级恢复气泡样式
import './theme/peach.css'

document.documentElement.dataset.siteTheme = settings.siteTheme
document.documentElement.dataset.font = settings.siteFont
document.documentElement.dataset.viewMode = store.view

createApp(App).mount('#app')
