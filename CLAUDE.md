# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

项目主目录（`/`）是**浏览器侧边栏扩展**（Chrome/Edge Manifest V3），`packages/` 下存放扩展相关的子项目：

| 位置 | 定位 |
|------|------|
| `/` | 浏览器扩展 — 侧边栏插件本体 |
| `packages/inject` | 独立 npm 包 — 将 AI 网站控制能力抽象为可复用库 |
| `packages/api` | API 服务 — 为扩展和官网提供后端服务 |
| `packages/site` | 官网 — 扩展的产品官网，未来承担 Web 版 AI 对撞机及账号管理等功能 |

## Project Overview

AI Clash (AI 对撞机) is a Chrome/Edge browser extension that lets users ask a single question to multiple AI web platforms simultaneously and compare answers side-by-side. It supports DeepSeek, 豆包 (Doubao), 通义千问 (Qianwen), Qwen International, 腾讯元宝 (Yuanbao), 文心一言 (Wenxin), Xiaomi MIMO, and LongCat. The extension includes a built-in AI judge that summarizes consensus, differences, and the best final answer.

The core insight: instead of using paid APIs (which often lack platform-specific optimizations), the extension uses **local DOM automation** to control each AI website directly, preserving their native system prompts, context memory, and web search capabilities.

## Build & Develop

```bash
# Install dependencies (uses bun)
bun install

# Development (build inject + start Vite dev server with HMR for sidepanel)
bun run dev

# Development with type checking
bun run dev:checked

# Type checking
bun run typecheck

# Full build
bun run build

# Build and run tests
bun run build:test

# Tests (Playwright e2e for the extension)
bun run test
bun run test:ui        # Playwright UI mode

# Build only the inject package
bun run build:inject
# Or filter by workspace:
bun --filter @ai-clash/inject build

# Run the site (landing page) dev server
bun run dev:site

# Run the API backend (Java Spring Boot)
bun run dev:api

# Build API as Docker image
bun run build:api
```

**Important:** `bun run dev` and `bun run build` both run `build:inject` first, because the content scripts depend on `packages/inject/dist/standalone.js` being available. Always ensure inject is built before working on extension code.

## Architecture

### 项目结构

| 路径 | 技术栈 | 定位 |
|------|--------|------|
| `/` (根目录) | Vite + @crxjs/vite-plugin | 浏览器扩展本体（侧边栏、Service Worker、Content Scripts） |
| `packages/inject` | Vite library (IIFE + ESM/UMD) | 独立 npm 包：AI 网站 DOM 控制能力 |
| `packages/api` | Spring Boot 4 + MySQL | API 服务：同时为扩展和官网提供后端（分享链接、内置总结服务代理等） |
| `packages/site` | Vite + React | 产品官网：当前为扩展落地页，未来承担 Web 版 AI 对撞机及账号管理 |

### Extension Architecture (3-layer)

```
┌──────────────────────────────────────────────────────┐
│ Sidepanel (React + Antd + Zustand)                   │
│ src/sidepanel/  —  UI, store, i18n                   │
│   ↕ chrome.runtime.sendMessage                       │
│ Service Worker (Background)                          │
│ src/background/  —  task routing, API mode, summary  │
│   ↕ chrome.tabs.sendMessage / scripting.executeScript │
│ Content Scripts (ISOLATED world)                     │
│ src/content/  —  relay between background & MAIN     │
│   ↕ window.postMessage (to MAIN world)               │
│ packages/inject standalone.js (MAIN world)            │
│   —  DOM manipulation, SSE interception, auth check  │
└──────────────────────────────────────────────────────┘
```

**Critical flow for web mode:**
1. User submits a question in the sidepanel
2. Sidepanel sends `DISPATCH_TASK` to the service worker
3. Service worker opens/activates a tab for the AI provider, waits for page load, then sends `EXECUTE_PROMPT` to the content script
4. Content script (`src/content/{provider}/index.js`) uses the inject library (via `postMessage` RPC to the MAIN world) to fill the input, click send, and intercept SSE chunks
5. SSE chunks flow back: MAIN world → (postMessage) → content script → (chrome.runtime.sendMessage) → sidepanel UI

**API mode:** The service worker uses the OpenAI SDK directly to call provider APIs, streaming chunks back to the sidepanel via `chrome.runtime.sendMessage`.

### Provider Registration (Single Source of Truth)

All AI providers are defined in **`src/background/providers.js`** as entries in the `PROVIDERS` array. Everything else auto-generates from this:
- `manifest.config.js` generates `content_scripts`, `host_permissions`, and `web_accessible_resources`
- `src/shared/config.js` generates UI metadata (`PROVIDER_META`), model options, locale filtering
- `src/sidepanel/types.ts` generates `PROVIDER_IDS`, theme colors, and display names

**To add a new provider:**
1. Add an entry to `PROVIDERS` in `src/background/providers.js`
2. Create a content script at `src/content/{id}/index.js` that calls `bootstrapProvider('{id}')`
3. Add the provider's DOM automation logic in `packages/inject/src/providers/{id}.ts` and register it in `packages/inject/src/providers/index.ts`

### Inject Package (`packages/inject`)

A standalone library for controlling AI chat interfaces via DOM manipulation. It has two build outputs:
- **ESM/UMD** (`dist/index.esm.js`, `dist/index.umd.js`) — importable by other projects
- **Standalone IIFE** (`dist/standalone.js`) — loaded via `<script>` tag into AI websites' MAIN world, exposes `window.__AI_CLASH`

The standalone entry (`src/standalone/entry.ts`) initializes all provider adapters and exposes a unified API:
- `__AI_CLASH.chat.send(prompt, options, callbacks)` — send message and stream response
- `__AI_CLASH.chat.newChat()` — start a new conversation
- `__AI_CLASH.thinking.getState()/enable()/disable()` — control deep thinking
- `__AI_CLASH.auth.getLoginState()` — check if logged in

Communication with the extension's ISOLATED world happens via `window.postMessage` with custom event types (`__aiclash_sse_chunk`, `__aiclash_conversation_id`, `__aiclash_complete`, `__aiclash_error`).

### Sidepanel State Management

The sidepanel uses **Zustand** (`src/sidepanel/store/index.ts`) with a single large store. Key patterns:
- **Buffered streaming display:** Responses accumulate in `buffers` (module-level mutable objects in `helpers.ts`) and are rendered incrementally via `requestAnimationFrame` (`tickStreamDisplay`). The `CHARS_PER_FRAME` constant controls display speed.
- **Session persistence:** Current session state is periodically saved to `chrome.storage.local` as history items via `schedulePersist()` (debounced).
- **Multi-channel vs single-channel:** If only one provider is enabled, the UI switches to "single channel" mode with multi-turn conversation support. Multiple enabled providers triggers multi-channel comparison mode.

### Content Script Base (`src/content/shared/base.js`)

All content scripts share the same logic via `bootstrapProvider(providerId)`. On initialization it:
1. Injects `standalone.js` into the page's MAIN world
2. Sets up `postMessage` listeners for SSE chunks, completion, and errors
3. Listens for `EXECUTE_PROMPT` from the service worker
4. Proxies calls to the MAIN world via `window.postMessage` RPC

### Summary / AI Judge

When multiple channels complete, the service worker can call an AI model (configurable, defaults to the built-in `summarizer` service) to generate a comparative summary. The summary response is parsed by `createSummaryAnalysisRouter()` which splits content inside `[[AI_CLASH_SUMMARY_ANALYSIS_BEGIN]]…[[AI_CLASH_SUMMARY_ANALYSIS_END]]` markers into an "analysis" section (displayed as collapsible thinking) and a "final" section.

## Key Files

| File | Role |
|------|------|
| `src/background/providers.js` | Provider registry — single source of truth |
| `src/background/index.js` | Service worker: task routing, API mode, summary, tab management |
| `src/content/shared/base.js` | Content script base — shared by all providers |
| `src/sidepanel/store/index.ts` | Zustand store — all sidepanel state and actions |
| `src/shared/messages.js` | Message type constants for extension IPC |
| `src/shared/config.js` | UI config derived from providers.js |
| `manifest.config.js` | Manifest V3 config, auto-generates from providers |
| `packages/inject/src/standalone/entry.ts` | Standalone IIFE entry point |
| `packages/inject/src/providers/` | Per-provider DOM automation adapters |

## i18n

- Chrome extension i18n: `_locales/{zh_CN,en}/messages.json` (for manifest name/description)
- Sidepanel UI i18n: `src/sidepanel/i18n.ts` (TypeScript dictionary with interpolation)
- Locale resolution: `system` → follows browser language; `zh-CN` and `en` are explicit options
- Providers have `supportedLocales` — the UI hides providers not available in the current locale

## Testing

Tests use Playwright (`test/e2e/sidebar.spec.js`). They load the built extension in a persistent Chromium context. Run `bun run build:test` to build and test in one step.

## Tech Stack Summary

- **Runtime:** Bun (package manager & scripts)
- **Build:** Vite + @crxjs/vite-plugin (extension), Vite library mode (inject), Vite + React (site), Maven (api)
- **UI:** React 19, Ant Design 6, Zustand, @ant-design/x (AI chat components)
- **API Mode:** OpenAI SDK (unified client for all providers)
- **API Backend:** Java 25, Spring Boot 4, MySQL
- **Analytics:** Umami (self-hosted compatible)
- **Testing:** Playwright
