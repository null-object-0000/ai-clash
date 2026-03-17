import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import compression from 'vite-plugin-compression'
import manifest from './manifest.config.js'
import { name, version } from './package.json'

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
    // 排除不需要的Node.js原生模块
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
    },
    // 模块解析优化
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  // 禁用不必要的模块预加载
  modulePreload: false,
  // 拆分CSS到独立文件
  cssCodeSplit: true,
  plugins: [
    react(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
    // Brotli压缩（更高压缩率）
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
      compressionOptions: { level: 11 },
    }),
  ],
  // 构建优化
  build: {
    target: 'chrome110', // 针对Chrome 110+优化，减少兼容代码
    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },
    // 启用增量构建缓存
    cache: true,
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'zustand': ['zustand'],
          'lobe-icons': ['@lobehub/icons'],
        },
      },
      // 摇树优化
      treeshake: {
        preset: 'smallest',
        annotations: true,
        moduleSideEffects: false,
      },
    },
    // 报告产物体积
    reportCompressedSize: true,
    commonjsOptions: {
      strictRequires: true,
    },
  },
  // 依赖预构建优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      '@lobehub/ui/chat',
    ],
    exclude: [
      '@lobehub/icons-static-svg',
    ],
  },
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
})
