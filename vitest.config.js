import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/unit/setup.js'],
    include: ['test/unit/**/*.spec.js'],
    alias: {
      '@': '/src'
    }
  }
})
