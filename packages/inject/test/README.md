# AI Clash Inject - Dev Server

开发服务器模式，用于在浏览器控制台中调试和测试注入脚本。

## 启动开发服务器

```bash
cd packages/inject
bun run dev
```

服务器启动后访问 `http://localhost:5173`

## 使用方式

### 1. 打开目标 AI 网站

在浏览器中打开任意支持的 AI 网站：

- DeepSeek: https://chat.deepseek.com
- 豆包：https://doubao.com
- 通义千问：https://tongyi.aliyun.com
- LongCat: https://tiangong.cn
- 腾讯元宝：https://yuanbao.tencent.com

### 2. 在控制台注入脚本

打开浏览器开发者工具 (F12)，在 Console 中运行：

```javascript
// 从本地开发服务器加载脚本
const script = document.createElement('script');
script.src = 'http://localhost:5173/standalone.js';
script.onload = () => console.log('✅ AI Clash Inject 已加载，使用 window.AIClashInject.createInjector() 创建注入器');
document.head.appendChild(script);
```

### 3. 创建注入器并测试

```javascript
// DeepSeek 示例
const injector = window.AIClashInject.createInjector({
  provider: 'deepseek',
  adapter: 'window'
});

await injector.inject();

// 测试能力
await window.__AI_CLASH.thinking.getState();
await window.__AI_CLASH.input.fill('Hello AI');
await window.__AI_CLASH.send.send();
```

## Bookmarklet（书签脚本）

创建一个书签，将以下代码保存为书签 URL：

```javascript
javascript:(async function(){
  const s=document.createElement('script');
  s.src='http://localhost:5173/standalone.js';
  s.onload=()=>console.log('✅ AI Clash Inject loaded. Run: await window.AIClashInject.createInjector({provider:"deepseek"}).inject()');
  document.head.appendChild(s);
})();
```

使用时点击书签即可注入。

## 快速测试代码片段

```javascript
// === 快速注入（一键）===
(async ()=>{
  if(!window.AIClashInject){
    const s=document.createElement('script');
    s.src='http://localhost:5173/standalone.js';
    await new Promise(r=>s.onload=r);
    document.head.appendChild(s);
  }
  const inj=window.AIClashInject.createInjector({provider:'deepseek'});
  await inj.inject();
  console.log('✅ 注入完成，使用 window.__AI_CLASH 测试功能');
})();

// === 测试能力 ===
// 获取思考状态
await window.__AI_CLASH.thinking.getState()

// 填充输入框
await window.__AI_CLASH.input.fill('测试消息')

// 发送
await window.__AI_CLASH.send.send()

// 新建对话
await window.__AI_CLASH.newChat.start()
```

## 调试技巧

### HMR 热重载

开发服务器支持热重载，修改 `src/` 源码后会自动重新构建：

```bash
# 终端 1：监听构建
bun run dev:lib

# 终端 2：启动服务器
bun run dev
```

然后在 AI 网站页面刷新即可加载最新代码。

### 使用测试页面辅助

`http://localhost:5173/` 提供：
- API 状态检测
- 快速复制的代码片段
- 日志输出（用于验证注入状态）

### 调试模式

在控制台设置断点或添加 `debugger` 语句：

```javascript
// 在调用前暂停
debugger;
await window.__AI_CLASH.thinking.sync(true);
```

## Provider 自动检测

Standalone 脚本支持根据域名自动检测 Provider：

```javascript
// 自动检测当前网站的 Provider
console.log('当前域名:', location.hostname);
// 脚本会自动选择对应的 provider
```

## 常见问题

### 跨域问题

如果加载 `standalone.js` 失败，可能是跨域限制：
- 确保开发服务器运行正常 (`bun run dev`)
- 检查浏览器是否允许本地资源

### 注入后无反应

- 确认当前页面是支持的 AI 网站
- 检查控制台是否有报错
- 刷新页面后重新注入

### 能力调用失败

- 确认已调用 `inject()` 完成注入
- 检查 `window.__AI_CLASH` 是否存在
- 确认当前页面 DOM 结构未发生大变化
