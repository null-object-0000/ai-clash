import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.ts'
import { name, version } from './package.json'

// 修复 @crxjs/vite-plugin 的 HMRPort 在扩展上下文失效时崩溃的问题
function crxHmrFix(): Plugin {
  return {
    name: 'crx-hmr-fix',
    enforce: 'post',
    transform(code, id) {
      if (id !== '/@crx/client-port') return
      return code
        .replace(
          `initPort = () => {\n    this.port?.disconnect();\n    this.port = chrome.runtime.connect({ name: "@crx/client" });\n    this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));\n    this.port.onMessage.addListener(this.handleMessage.bind(this));\n    this.port.postMessage({ type: "connected" });\n  };`,
          `initPort = () => {\n    try {\n      this.port?.disconnect();\n      this.port = chrome.runtime.connect({ name: "@crx/client" });\n      this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));\n      this.port.onMessage.addListener(this.handleMessage.bind(this));\n      this.port.postMessage({ type: "connected" });\n    } catch (e) {\n      if (e instanceof Error && e.message.includes("Extension context invalidated")) {\n        console.warn("[crx] Extension context invalidated, reloading...");\n        setTimeout(() => location.reload(), 1000);\n        return;\n      }\n      throw e;\n    }\n  };`,
        )
        .replace(
          `throw new Error("HMRPort is not initialized")`,
          `console.warn("[crx] HMRPort not initialized"); return`,
        )
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    vue(),
    crx({ manifest }),
    crxHmrFix(),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
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
})
