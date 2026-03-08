import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    vue(),
    crx({ manifest }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // 🚀 核心修复：显式配置 CORS，允许 Chrome 插件发起的请求
    cors: {
      origin: '*', // 允许任何源跨域访问
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
    },
    // 强制指定资源的根路径
    origin: 'http://localhost:5173',
    hmr: {
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'index.html',
      },
    },
  },
})