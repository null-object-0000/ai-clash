# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**项目名称**: AI 对撞机 (AI Clash) - 一个问题问多个 AI

**项目类型**: Chrome 浏览器扩展

**主要功能**: 聚合多个 AI 平台（DeepSeek、豆包、千问）的能力，统一接口调用，实现混合专家模式（MoE）

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite + @crxjs/vite-plugin
- **语言**: TypeScript
- **UI**: Tailwind CSS
- **扩展清单**: Manifest V3

## 项目结构

```
src/
├── background/          # Service Worker 后台服务
│   ├── index.ts        # 主入口，消息路由、任务分发
│   └── providers.ts    # AI 提供者配置注册表
├── content/            # Content Scripts 内容脚本
│   ├── deepseek/       # DeepSeek 集成
│   ├── doubao/         # 豆包集成
│   ├── qianwen/        # 千问集成
│   └── shared/         # 共享工具 (DOM 操作、通信等)
├── sidepanel/          # 侧边栏 UI (Vue 3 + Tailwind)
└── shared/             # 共享类型定义
```

## 核心架构

1. **Side Panel UI**: 用户交互界面，支持输入、设置、流式输出
2. **Background SW**: 消息路由、任务分发、Hook 注入管理
3. **Content Scripts**: DOM 交互、消息监听、UI 自动化
4. **Hook Scripts**: 注入 MAIN world，拦截 fetch/SSE 获取原始响应

## 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式 (HMR 热重载)
npm run build        # 类型检查 + 生产构建
```

## 开发流程

1. 运行 `npm run dev` 启动开发服务器
2. 打开 Chrome 扩展管理 `chrome://extensions/`
3. 开启"开发者模式"，点击"加载已解压的扩展程序"
4. 选择项目的 `dist` 目录

## 关键文件说明

- `manifest.config.ts`: Chrome 扩展清单配置
- `vite.config.ts`: Vite 构建配置（包含 HMR 修复插件）
- `src/background/providers.ts`: AI 提供者配置，添加新 AI 时修改
- `src/shared/messages.ts`: 消息类型定义

## AI 提供者配置

在 `src/background/providers.ts` 中添加新的 AI 提供者：

```typescript
export const PROVIDERS: Provider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    matchPattern: 'https://chat.deepseek.com/*',
    // ... 其他配置
  },
  // ...
];
```

## 重要技术细节

### HMR 修复

项目包含自定义 Vite 插件修复 @crxjs/vite-plugin 的 HMRPort 崩溃问题：

```typescript
// vite.config.ts 中的 crxHmrFix 插件
// 自动为 /@crx/client-port 添加错误处理
```

### Hook 注入机制

- Hook 脚本注入到 MAIN world，在 `document_start` 时运行
- 拦截 fetch 请求，捕获 SSE 流式响应
- 通过 postMessage 与 content script 通信

### 消息类型

定义在 `src/shared/messages.ts`：
- `DISPATCH`: 从 UI 分发任务
- `EXECUTE`: 从后台发送到 content script 执行
- `CHUNK_RECEIVED`: 流式内容块
- 等等

## Git 分支

- `main`: 主分支
- `chrome-extension`: 当前开发分支

## 注意事项

1. 修改 providers.js 后需要重新加载扩展
2. Content script 调试需要在对应网页的开发者工具中查看
3. Service Worker 调试在扩展管理页面的"Service Worker"链接中

## 新AI通道接入规范

新增一个AI通道需要完成以下7个步骤：

### 1. 注册提供者配置
在 `src/background/providers.js` 的 `PROVIDERS` 数组中添加新通道配置：
```javascript
{
  id: 'provider-id', // 唯一标识，全小写
  matchPattern: 'https://example.com/*', // 匹配的网站域名
  startUrl: 'https://example.com/chat/', // 网站首页/对话页地址
  hookFile: 'src/content/provider-id/hook.js', // hook脚本路径
  hookScriptId: 'aiclash-provider-id-hook', // hook脚本DOM ID
  hookGlobalVar: '__abProviderIdHookV', // 全局变量用于去重
  contentScriptFile: 'src/content/provider-id/index.js', // content script路径
}
```

### 2. 创建content script目录
```bash
mkdir -p src/content/provider-id
```

### 3. 实现content script（index.js）
参考现有通道的实现，主要包含：
- Hook注入逻辑（document_start时注入）
- 流式消息接收处理（监听postMessage）
- DOM兜底抓取逻辑（当hook失效时从DOM提取内容）
- UI模拟操作（定位输入框、填充内容、点击发送按钮等）

### 4. 实现hook脚本（hook.js）
参考现有通道的四路拦截实现：
- fetch 拦截（最高优先级）
- XHR 拦截
- TextDecoder 拦截
- ReadableStream 拦截
根据目标网站的API响应格式调整SSE解析逻辑和文本提取规则。

### 5. 更新manifest配置
在 `manifest.config.js` 中添加：
1. 在 `content_scripts` 数组中添加content script注入规则：
```javascript
{
  js: ["src/content/provider-id/index.js"],
  matches: ["https://example.com/*"],
  run_at: "document_start"
}
```
2. 在 `host_permissions` 数组中添加域名权限：
```javascript
"https://example.com/*"
```
3. 确认 `web_accessible_resources` 中已包含对应资源（CRXJS会自动根据providers配置生成）

### 6. 更新UI配置
在 `src/sidepanel/App.vue` 中添加：
1. 在设置面板中添加通道开关
2. 添加对应的响应式变量（开关状态、折叠状态）
3. 添加通道折叠面板组件
4. 更新所有状态管理逻辑（初始化、重置、任务分发等）
5. 更新底部支持列表文字

### 7. 测试验证
1. 运行 `npm run dev` 重新构建扩展
2. 在Chrome扩展管理页面重新加载扩展
3. 打开目标网站，确认控制台有 `[AI Clash xxx] content script 已在该页运行` 日志
4. 测试消息发送功能，确认可以正常触发UI操作
5. 测试流式响应接收，确认可以正常获取AI回复
6. 确认UI面板显示正常，状态更新正确
