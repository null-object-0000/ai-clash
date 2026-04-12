# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**项目名称**: @ai-clash/inject - AI Clash 注入库

**项目定位**: 将 AI 网站控制能力抽象成独立的 npm 包，支持多种使用场景：
- Chrome 扩展集成（主项目使用）
- F12 / Bookmarklet 直接注入开发调试
- Puppeteer/Playwright 自动化测试
- WebSocket 远程控制

**当前支持 AI 平台**: DeepSeek、豆包、通义千问、LongCat、腾讯元宝

## 技术栈

- **语言**: TypeScript
- **构建工具**: Vite
- **包管理器**: bun
- **输出格式**:
  - 库模式: esm + umd（给 npm 导入使用）
  - 独立模式: iife（给浏览器直接注入）

## 开发命令

项目使用 bun 作为包管理器：

```bash
cd packages/inject
bun install                      # 安装依赖
bun run dev                      # 开发模式：监听构建 + HTTP 服务器 (端口 5173)
bun run dev:build-only           # 仅监听构建，不启动服务器
bun run build                    # 生产构建：库 (esm/umd) + standalone (iife)
bun run build:esm                # 仅构建库 (esm + umd)
bun run build:standalone         # 仅构建 standalone (iife)
bun run typecheck                # TypeScript 类型检查
```

### 运行单个测试

当前项目暂无自动化测试，主要通过手动注入调试。未来可使用 Playwright 进行集成测试。

## 项目结构

```
packages/inject/
├── src/
│   ├── core/                 # 核心逻辑
│   │   ├── types.ts          # 类型定义（核心接口）
│   │   ├── injector.ts       # 注入器主类 createInjector
│   │   ├── dom-utils.ts      # DOM 操作工具（选择器、点击）
│   │   └── incremental-utils.ts  # SSE 增量内容提取工具
│   ├── providers/            # AI 提供者配置
│   │   ├── index.ts          # Provider 注册表
│   │   ├── deepseek.ts       # DeepSeek 配置实现
│   │   ├── doubao.ts         # 豆包配置实现
│   │   ├── qianwen.ts        # 通义千问配置实现
│   │   ├── longcat.ts        # LongCat 配置实现
│   │   └── yuanbao.ts        # 腾讯元宝配置实现
│   ├── standalone/           # 独立注入版本
│   │   └── entry.ts          # IIFE 打包入口（暴露到 window）
│   └── index.ts              # npm 包主入口
├── examples/                 # 测试用 SSE 示例文件
├── dist/                     # 构建输出（git 忽略）
├── vite.config.ts            # Vite 构建配置
└── tsconfig.json             # TypeScript 配置
```

## 核心架构

### 设计理念

**配置化优于硬编码**：每个 AI 提供者通过声明式配置定义 DOM 选择器、动作实现、SSE 解析规则，不需要修改核心注入逻辑。

**双重输出**：
- 作为库打包成 esm/umd，供主项目（Chrome 扩展）导入使用
- 作为 standalone 打包成 IIFE，供浏览器直接 script 标签注入调试

### 核心类型

位于 `src/core/types.ts`:

| 类型 | 说明 |
|------|------|
| `ProviderId` | AI 提供者 ID（deepseek/doubao/qianwen/longcat/yuanbao）|
| `AdapterType` | 适配器类型（window/extension/ws/broadcast）|
| `InjectorOptions` | 注入器配置 |
| `Injector` | 注入器接口（inject/eject/call）|
| `ProviderConfig` | AI 提供者配置（id/domain/actions/sse）|
| `ProviderActions` | 能力集合（chat/thinking/search/model）|
| `ChatActions` | 对话动作（newChat/input/send）|
| `ToggleAction` | 开关动作（getState/enable/disable）- 用于 thinking/search |
| `SSEConfig` | SSE 流式响应解析配置（urlPattern/parseLine）|
| `SendCallbacks` | 发送消息回调（onDomChunk/onSseChunk/onConversationId/onComplete/onError）|

### 能力抽象

每个 AI 提供者可以实现以下能力：

1. **chat** (必填) - 基础对话能力
   - `newChat()` - 开启新对话
   - `fill(text)` - 填充输入框
   - `send(callbacks)` - 发送消息并监听流式输出

2. **thinking** (可选) - 深度思考模式切换
   - `getState()` - 获取当前开关状态
   - `enable()` - 开启思考模式
   - `disable()` - 关闭思考模式

3. **search** (可选) - 联网搜索模式切换
   - 同 thinking 接口

4. **model** (可选) - 模型切换
   - `getCurrent()` - 获取当前模型
   - `getAvailable()` - 获取可用模型列表
   - `select(id)` - 切换模型

### 监听机制

**SSE 拦截** - 通过拦截 fetch 获取原始 SSE 流，延迟更低更准确

- 需要配置 `sse.urlPattern` - URL 匹配模式
- 需要实现 `sse.parseLine(line)` - 解析每一行，返回 `{text, isThink, done}`

## 新增 AI 提供者规范

要新增一个 AI 平台支持，只需完成以下步骤：

### 1. 创建提供者配置文件

在 `src/providers/` 新建 `your-provider.ts`:

```typescript
import type { ProviderConfig, ToggleAction } from '../core/types.js';
import { findAnyElement, hasClass, simulateRealClick } from '../core/dom-utils.js';

// 实现思考模式切换（如果支持）
const thinkingAction: ToggleAction = {
  async getState() { /* ... */ },
  async enable() { /* ... */ return true; },
  async disable() { /* ... */ return true; },
};

// 实现搜索模式切换（如果支持）
const searchAction: ToggleAction = { /* ... */ };

export const yourProvider: ProviderConfig = {
  id: 'your-provider',
  name: 'Provider Name',
  domain: 'chat.example.com',
  actions: {
    chat: {
      newChat: {
        button: ['.new-chat-button-selector'],
      },
      input: {
        box: ['textarea[placeholder*="Hint"]'],
      },
      send: {
        button: ['.send-button-selector'],
      },
    },
    thinking: thinkingAction,   // 若支持
    search: searchAction,       // 若支持
  },
  // 会话 ID 提取（从 URL 或 DOM）
  conversation: {
    idFromUrl: {
      pattern: '/chat/([^/]+)',
      captureGroup: 1,
    },
  },
  // SSE 拦截配置（优先）
  sse: {
    urlPattern: '/v1/chat/completions',
    parseLine: (line: string) => {
      // 返回: { text: string, isThink: boolean|null, done: boolean } | null
      // null 表示这行不包含内容
      return { text: 'chunk', isThink: false, done: false };
    },
    detectionKeywords: ['data: ', 'id:'],
  },
};
```

### 2. 注册提供者

编辑 `src/providers/index.ts`:

```typescript
export { yourProvider } from './your-provider.js';  // 添加这行

// 在 PROVIDERS 对象中添加
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  // ... 现有提供者
  yourProvider: yourProvider,  // 添加这行
};
```

### 3. 测试验证

```bash
cd packages/inject
bun run dev
# 打开 http://localhost:5173 生成 Bookmarklet
# 在 AI 网站注入并测试
bun run typecheck  # 确认类型正确
```

### 4. 构建

```bash
bun run build
```

## 开发调试

### 快速开始调试

1. 启动开发服务器：
   ```bash
   cd packages/inject && bun run dev
   ```

2. 在浏览器打开 `http://localhost:5173`，生成 Bookmarklet 并添加到书签栏

3. 打开目标 AI 网站（如 https://chat.deepseek.com），点击书签栏注入

4. 在控制台调用 API 测试：
   ```javascript
   // 一站式测试：发送消息并开启思考+搜索
   await window.__AI_CLASH.chat.send('你好 AI', {
     thinking: true,
     search: true,
     newChat: true
   }, {
     onSseChunk: (text, isThink) => console.log('SSE:', text, 'isThink:', isThink),
     onDomChunk: (text, isThink) => console.log('DOM:', text, 'isThink:', isThink),
     onComplete: (fullText) => console.log('Complete:', fullText),
   })
   ```

### 选择器语法

支持特殊语法：
- `selector >> text` - 选择包含特定文本的元素
- 多个选择器按顺序尝试，返回第一个找到的元素

### 增量解析工具

`IncrementalHelper` 用于处理 SSE 流式响应的增量内容提取：
- 处理不完整的行分割
- 维护已发送状态，只返回增量内容
- 支持 JSON 流和 text/event-stream 两种格式

## 注意事项

1. **选择器稳定性**：AI 网站可能更新 DOM 结构，选择器可能需要定期更新
2. **CORS**：开发服务器默认启用 CORS，允许跨域注入
3. **Sourcemap**：开发构建默认生成 sourcemap 方便调试
4. **不压缩**：开发构建不压缩代码，便于调试
5. **修改后需要重新构建**：主项目使用本库需要重新构建才能应用改动

## 与主项目关系

- 主项目（AI Clash Chrome 扩展）通过 npm 导入本库
- 本库独立发布为 `@ai-clash/inject` npm 包
- 核心控制逻辑全部抽离到这里，便于独立开发调试
