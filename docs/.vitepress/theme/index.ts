import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import SupportedAiStrip from './components/SupportedAiStrip.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'home-hero-actions-after': () => h(SupportedAiStrip),
  }),
}
