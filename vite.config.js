import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import compression from 'vite-plugin-compression'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    }
  },
  plugins: [
    react(),
    crx({ manifest }),
    ...(command === 'build'
      ? [zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` })]
      : []),
  ],
  server: {
    port: 5173,
    strictPort: true,
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
}))
