# AI Clash Inject - 开发调试指南

## 项目定位

将 AI 网站控制能力抽象成独立的 npm 包，支持多种使用场景：
- Chrome 扩展集成
- F12 / Bookmarklet 直接使用
- Puppeteer/Playwright 自动化测试
- WebSocket 远程控制

## 快速开始

### 1. 启动开发服务器

```bash
cd packages/inject
bun run dev
```

服务器启动后访问：**http://localhost:5173**

### 2. 在 AI 网站页面注入

开发服务器提供**注入代码生成器**，帮助你生成用于在 AI 网站页面注入的脚本。

#### 方式一：Bookmarklet（推荐）

1. 访问 http://localhost:5173
2. 点击"生成 Bookmarklet"
3. 将生成的书签拖到书签栏
4. 打开 DeepSeek 等 AI 网站
5. 点击书签栏的"AI Clash Inject"

#### 方式二：Console 手动注入

1. 打开 DeepSeek 等 AI 网站
2. 按 F12 打开开发者工具
3. 在 Console 中运行：

```javascript
(async ()=>{
  if(!window.AIClashInject){
    const s=document.createElement('script');
    s.src='http://localhost:5173/standalone.js';
    await new Promise(r=>s.onload=r);
    document.head.appendChild(s);
  }
  const inj=window.AIClashInject.createInjector({provider:'deepseek'});
  await inj.inject();
  console.log('✅ 注入完成');
})();
```

### 3. 测试能力

注入成功后，在 Console 中运行：

```javascript
// 获取思考模式状态
await window.__AI_CLASH.thinking.getState()

// 填充输入框
await window.__AI_CLASH.chat.fill('你好 AI')

// 发送消息并监听流式输出
await window.__AI_CLASH.chat.send({
  onDomChunk: (text, isThink, stage, conversationId) => {
    console.log('收到 DOM chunk:', text, '思考模式:', isThink, '阶段:', stage, '会话 ID:', conversationId);
  },
  onSseChunk: (text, isThink, stage, conversationId) => {
    console.log('收到 SSE chunk:', text, '思考模式:', isThink, '阶段:', stage, '会话 ID:', conversationId);
  },
  onComplete: (fullText, conversationId) => {
    console.log('完成，完整回复:', fullText, '会话 ID:', conversationId);
  }
})

// 开始新对话
await window.__AI_CLASH.chat.newChat()
```

## 支持的 AI 平台

| Provider | 名称 | 状态 |
|----------|------|------|
| deepseek | DeepSeek | ✅ 稳定可用 |
| doubao | 豆包 | 🧪 测试优化中 |
| qianwen | 通义千问 | 🧪 测试优化中 |
| longcat | LongCat (天工) | 🧪 测试优化中 |
| yuanbao | 腾讯元宝 | 🧪 测试优化中 |

## 使用方式

### 1. NPM 包导入

```typescript
import { createInjector } from '@ai-clash/inject';

const injector = createInjector({
  provider: 'deepseek',
  adapter: 'window'
});

await injector.inject();

// 发送消息并监听流式输出
await injector.call('chat', 'send', {
  onDomChunk: (text, isThink, stage, conversationId) => {
    console.log('DOM chunk:', text, isThink, stage, conversationId);
  },
  onComplete: (fullText, conversationId) => {
    console.log('complete:', fullText, conversationId);
  }
});
```

### 2. CDN 直接使用

```html
<script src="https://unpkg.com/@ai-clash/inject/dist/standalone.js"></script>
<script>
  await window.__AI_CLASH.thinking.sync(true);
</script>
```

### 3. Puppeteer/Playwright

```typescript
await page.addScriptTag({
  url: 'http://localhost:5173/standalone.js'
});

await page.evaluate(async () => {
  const injector = window.__AI_CLASH;
  await injector.chat.fill('Hello');
  await injector.chat.send({
    onDomChunk: (text, isThink) => console.log('DOM chunk:', text, isThink),
    onComplete: (fullText) => console.log('complete:', fullText)
  });
});
```

### 4. 配置会话 ID 提取

不同 AI 平台的 URL 格式不同，需要在 provider 配置中声明会话 ID 提取规则：

```typescript
// DeepSeek: https://chat.deepseek.com/c/{conversationId}
conversation: {
  idFromUrl: {
    pattern: '/c/([^/]+)',
    captureGroup: 1,
  },
}

// 从 DOM 提取（某些平台会话 ID 在页面元素上）
conversation: {
  idFromDom: {
    selector: '[data-conversation-id]',
    attribute: 'data-conversation-id',
  },
}
}```

### 5. send 方法回调

```typescript
// 只发送，不监听
await injector.call('chat', 'send')

// 监听 DOM 轮询模式的 chunk
await injector.call('chat', 'send', {
  onDomChunk: (text, isThink, stage) => {
    console.log('chunk:', text, isThink, stage)
  },
  onComplete: (fullText) => {
    console.log('complete:', fullText)
  }
})

// 同时监听 DOM 和 SSE（如果 provider 支持）
await injector.call('chat', 'send', {
  onDomChunk: (text, isThink, stage) => {
    console.log('DOM chunk:', text, isThink, stage)
  },
  onSseChunk: (data) => {
    console.log('SSE chunk:', data)
  },
  onComplete: (fullText) => {
    console.log('complete:', fullText)
  }
})
```

## 开发调试

### HMR 热重载

开发服务器支持热重载，修改 `src/` 源码后会自动重新构建。

### 代码生成器

开发服务器提供两个代码生成器页面：

- **Standalone 注入生成器** (`/test-standalone.html`)
  - 配置 Provider、适配器类型
  - 生成 Bookmarklet 或 Console 代码

- **ESM 代码生成器** (`/test-esm.html`)
  - 用于 Puppeteer/Playwright 项目
  - 生成 ES Module 导入代码

### 调试技巧

```javascript
// 检查是否已注入
console.log(window.__AI_CLASH)

// 检查能力状态
await window.__AI_CLASH.thinking.getState()

// 调试模式下添加断点
debugger;
await window.__AI_CLASH.thinking.sync(true);
```

## 构建

```bash
# 开发模式（带 HMR）
bun run dev

# 监听构建
bun run dev:lib

# 生产构建
bun run build
```

## 许可证

MIT
