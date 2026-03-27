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
// 填充输入框
await window.__AI_CLASH.chat.fill('你好 AI')

// 发送消息并监听流式输出
await window.__AI_CLASH.chat.send({
  onConversationId: (conversationId) => {
    console.log('获取到会话 ID:', conversationId);
  },
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

// 获取思考模式状态
await window.__AI_CLASH.thinking.getState()

await window.__AI_CLASH.thinking.enable()
await window.__AI_CLASH.thinking.getState()

await window.__AI_CLASH.thinking.disable()
await window.__AI_CLASH.thinking.getState()

// 一站式发送并监听流式输出
await window.__AI_CLASH.chat.send('你好 AI', {
  thinking: true,
  search: true,
  newChat: true
}, {
  onConversationId: (conversationId) => {
    console.log('获取到会话 ID:', conversationId);
  },
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
```

## 支持的 AI 平台

功能测试状态：

| 名称 | 普通模式 | 深度思考 | 联网搜索 | 思考+搜索 | 获取会话 ID | SSE 拦截 | DOM 轮询 |
| ----- | -------- | -------- | -------- | ---------- | ----------- | -------- | -------- |
| DeepSeek | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 豆包 | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| 通义千问 | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ➖ |

图例：

- ✅ - 已完成测试，稳定可用
- 🧪 - 基本可用，仍在测试优化
- ⚠️ - 部分支持，需要完善
- ➖ - 不支持该功能

### 已知问题

- 搜索过程的产出会过滤掉，暂不输出给用户
- 豆包是内置联网搜索，自动触发的；豆包的快速（非思考、普通模式）模式会将首包算作 think 内容
- 千问若触发多阶段思考，目前初始阶段思考不会被监测到（"mime_type": "plan_cot/post"）

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
  await window.__AI_CLASH.thinking.enable();
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

## 许可证

MIT
