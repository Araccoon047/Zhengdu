import { createApp } from 'vue'
import { initializePersistence } from './persistence'
import './theme/tokens.css'
import './theme/echoes.css'
import './style.css'
import './flat-ui.css'
import './theme/peach.css'
import './theme/thin-cocoa.css'
import './theme/daidai-tu.css'
import './theme/berlin-snow.css'
import './theme/faint-silk.css'

async function bootstrap() {
  await initializePersistence()
  const [{ default: App }, { settings }, { store }] = await Promise.all([
    import('./App.vue'),
    import('./settings'),
    import('./store'),
  ])
  document.documentElement.dataset.siteTheme = settings.siteTheme
  document.documentElement.dataset.font = settings.siteFont
  document.documentElement.dataset.viewMode = store.view
  createApp(App).mount('#app')
}

bootstrap()