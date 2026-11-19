import './assets/main.css'
import 'primeicons/primeicons.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'
import App from './App.vue'
import { AppPreset } from './theme/preset'
import { DARK_MODE_CLASS, initThemeMode } from './theme/useThemeMode'

// before mount, so the first paint already has the right colors
initThemeMode()

const app = createApp(App)

app.use(createPinia())
app.use(PrimeVue, {
  // Community License, key from .env (not committed)
  license: import.meta.env.VITE_PRIMEUI_LICENSE,
  theme: { preset: AppPreset, options: { darkModeSelector: `.${DARK_MODE_CLASS}` } },
})

app.use(ToastService)

app.mount('#app')
