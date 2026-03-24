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

服务器启动后访问：**<http://localhost:5173>**

### 2. 在 AI 网站页面注入

开发服务器提供**注入代码生成器**，帮助你生成用于在 AI 网站页面注入的脚本。

#### 方式一：Bookmarklet（推荐）

1. 访问 <http://localhost:5173>
2. 点击"生成 Bookmarklet"
3. 将生成的书签拖到书签栏
4. 打开 DeepSeek 等 AI 网站
5. 点击书签栏的"AI Clash Inject"

```text
javascript:(async function(){if(!window.AIClashInject){const s=document.createElement('script');s.src='http://localhost:5173/standalone.js';await new Promise(r=>{s.onload=r;document.head.appendChild(s);});}})();
```

#### 方式二：Console 手动注入

1. 打开 DeepSeek 等 AI 网站
2. 按 F12 打开开发者工具
3. 在 Console 中运行：

```javascript
(async ()=>{
  if(!window.AIClashInject){
    const s=document.createElement('script');
    s.src='http://localhost:5173/standalone.js';
    await new Promise((resolve, reject) => {
      s.onload = () => {
        resolve();
      };
      s.onerror = (err) => {
        console.error('[AI Clash Inject]', '❌ 脚本加载失败', err);
        reject(new Error('脚本加载失败，请检查开发服务器是否启动'));
      };
      document.head.appendChild(s);
    });
  }
})().catch(err => console.error('[AI Clash Inject]', '💥 注入失败:', err));
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
  // 注意：onSseChunk 只在 DeepSeek 平台有效，其他平台仅支持 onDomChunk
  onSseChunk: (data, conversationId) => {
    console.log('收到 SSE chunk:', data, '会话 ID:', conversationId);
  },
  onComplete: (fullText, conversationId) => {
    console.log('完成，完整回复:', fullText, '会话 ID:', conversationId);
  }
})

// 开始新对话
await window.__AI_CLASH.chat.newChat()

// 一站式发送并监听流式输出
await window.__AI_CLASH.chat.send('你好 AI', {
  // 是否开启深度思考模式
  thinking: true,
  // 是否开启联网搜索
  search: true,
  // 是否先开始新对话
  newChat: true
}, {
  onDomChunk: (text, isThink, stage, conversationId) => {
    console.log('收到 DOM chunk:', text, '思考模式:', isThink, '阶段:', stage, '会话 ID:', conversationId);
  },
  // 注意：onSseChunk 只在 DeepSeek 平台有效，其他平台仅支持 onDomChunk
  onSseChunk: (data, conversationId) => {
    console.log('收到 SSE chunk:', data, '会话 ID:', conversationId);
  },
  onComplete: (fullText, conversationId) => {
    console.log('完成，完整回复:', fullText, '会话 ID:', conversationId);
  }
})
```

## 支持的 AI 平台

| Provider | 名称 | 状态 |
| ---------- | ------ | ------ |
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
<script src="http://localhost:5173/standalone.js"></script>
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

### 4. send 方法详解

`send` 方法支持三种调用模式，从简单发送到完整的一站式流程：

#### 模式一：基础发送（只发送）

```typescript
// 假设已经调用过 fill() 填充了消息
await injector.call('chat', 'send')
```

#### 模式二：发送并监听流式输出

```typescript
await injector.call('chat', 'send', {
  // DOM 轮询模式的流式回调
  onDomChunk: (text, isThink, stage, conversationId) => {
    console.log('DOM chunk:', text, '思考:', isThink, '阶段:', stage)
  },
  // SSE 拦截模式的流式回调（如果 Provider 支持）
  onSseChunk: (data, conversationId) => {
    console.log('SSE chunk:', data)
  },
  // 完成回调
  onComplete: (fullText, conversationId) => {
    console.log('完整回复:', fullText)
  },
  // 错误回调
  onError: (error, conversationId) => {
    console.error('出错了:', error)
  }
})
```

#### 模式三：完整一站式发送（推荐）

```typescript
await injector.call('chat', 'send', '你好 AI', {
  // 是否开启深度思考模式
  thinking: true,
  // 是否开启联网搜索
  search: false,
  // 是否先开始新对话
  newChat: true
}, {
  // 回调函数（可选）
  onDomChunk: (text, isThink, stage) => {
    console.log('收到回复:', text)
  },
  onComplete: (fullText) => {
    console.log('回复完成:', fullText)
  }
})
```

**一站式发送的执行流程**：

1. 如果 `newChat: true`，先开启新对话
2. 如果指定了 `thinking`，同步思考模式状态
3. 如果指定了 `search`，同步搜索模式状态
4. 填充消息内容到输入框
5. 点击发送按钮
6. 监听流式输出（如果提供了回调）

**回调参数说明**：

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| `text` / `data` | `string` | 当前内容片段 |
| `isThink` | `boolean` | 是否为思考链内容 |
| `stage` | `'thinking' \| 'responding'` | 当前阶段（思考中/回复中） |
| `conversationId` | `string \| undefined` | 会话 ID，用于追踪对话 |
| `fullText` | `string` | 完整回复内容（思考 + 回答） |

## 许可证

MIT
