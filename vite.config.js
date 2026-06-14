import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

export default defineConfig(({ command }) => {
  const isWatchBuild = command === 'build' && process.argv.includes('--watch')

  return {
    root: path.resolve(__dirname),
    resolve: {
      alias: {
        '@': `${path.resolve(__dirname, 'src')}`,
      }
    },
    plugins: [
      react(),
      crx({ manifest }),
      ...(command === 'build' && !isWatchBuild
        ? [zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` })]
        : []),
    ],
    build: {
      chunkSizeWarningLimit: 700,
      minify: isWatchBuild ? false : 'esbuild',
      cssMinify: isWatchBuild ? false : undefined,
      reportCompressedSize: !isWatchBuild,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react'
            }

            if (id.includes('node_modules/@ant-design/x-markdown')
              || id.includes('node_modules/marked')
              || id.includes('node_modules/katex')
              || id.includes('node_modules/dompurify')
              || id.includes('node_modules/html-react-parser')) {
              return 'vendor-markdown'
            }

            if (id.includes('node_modules/@ant-design/x')) {
              return 'vendor-ant-design-x'
            }

            if (id.includes('node_modules/antd')
              || id.includes('node_modules/antd-style')
              || id.includes('node_modules/@ant-design')
              || id.includes('node_modules/@rc-component')
              || id.includes('node_modules/rc-')) {
              return 'vendor-antd'
            }
          },
        },
      },
    },
    server: {
      port: 5171,
      strictPort: true,
      cors: {
        origin: '*', // 允许任何源跨域访问
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['*'],
      },
      // 强制指定资源的根路径
      origin: 'http://localhost:5171',
      hmr: {
        port: 5171,
      },
    },
  }
})
