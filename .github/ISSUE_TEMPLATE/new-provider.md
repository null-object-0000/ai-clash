---
name: 🆕 新增 AI 通道
about: 申请接入新的 AI 大模型平台
title: 'feat: 接入新通道：{通道名称}'
labels: ['enhancement', 'new provider']
assignees: []
---

## 📋 通道基本信息

| 字段 | 填写内容 |
|------|----------|
| **通道 ID** | `{例如：wenxin}` |
| **通道名称** | `{例如：文心一言}` |
| **官方网址** | `{例如：https://yiyan.baidu.com}` |
| **域名** | `{例如：yiyan.baidu.com}` |
| **启动 URL** | `{例如：https://yiyan.baidu.com/chat/}` |
| **是否需要登录** | `是 / 否` |
| **是否支持 API 模式** | `支持 / 不支持` |

---

## 🔍 前置调研

### 1. 登录状态检测

- [ ] 已找到登录状态标识元素（头像/用户名）
- [ ] 已找到用户名文本选择器
- [ ] 已找到头像图片选择器

```css
/* 登录状态选择器（已登录时存在的元素） */
.loggedInSelectors: ['.your-selector-here']

/* 用户名文本选择器 */
.usernameSelectors: ['.your-selector-here']

/* 头像图片选择器 */
.avatarSelectors: ['.your-selector-here img']
```

### 2. 对话能力

- [ ] 已找到"新对话"按钮选择器
- [ ] 已找到输入框选择器
- [ ] 已找到发送按钮选择器

```css
/* 新对话按钮 */
.newChat.button: ['button[aria-label="新对话"]']

/* 输入框 */
.input.box: ['.dialogue-container textarea']

/* 发送按钮 */
.send.button: ['.send-button']
```

### 3. 会话 ID 提取

- [ ] 已分析 URL 格式
- [ ] 已确定正则 Pattern

```javascript
// URL 格式示例：https://example.com/chat/{sessionId}
// 或：https://example.com/#/chat/{sessionId}

conversation: {
  idFromUrl: {
    pattern: '/chat/([^/]+)',  // 你的 pattern
    captureGroup: 1,
  },
}
```

### 4. SSE 流式响应分析

- [ ] 已抓包分析 SSE 接口
- [ ] 已确认 URL Pattern
- [ ] 已分析数据结构

**SSE 接口 URL**: `{例如：/open-apis/bot/chat}`

**SSE 数据格式示例**:
```
event: message
data: {"type": "text", "content": "增量内容"}

event: finish
data: {"content": "[DONE]"}
```

**检测关键词**: `['event:message', 'data:', '"content":']`

---

## 📝 Provider 配置实现

### 完整配置代码

```typescript
// packages/inject/src/providers/{id}.ts

import type { ProviderConfig, ToggleAction, AuthAction } from '../core/types.js';

const authAction: AuthAction = {
  loggedInSelectors: ['/* 你的选择器 */'],
  usernameSelectors: ['/* 你的选择器 */'],
  avatarSelectors: ['/* 你的选择器 */'],
};

export const {id}Provider: ProviderConfig = {
  id: '{id}',
  name: '{名称}',
  domain: '{域名}',
  actions: {
    chat: {
      newChat: {
        button: ['/* 新对话按钮选择器 */'],
      },
      input: {
        box: ['/* 输入框选择器 */'],
      },
      send: {
        button: ['/* 发送按钮选择器 */'],
        // 如需特殊验证（如验证 SVG Path），实现 customFind 方法
        // customFind: () => Element | null,
      },
    },
    auth: authAction,
    // 思考模式（可选）
    // thinking: {
    //   getState: async () => ({ found, enabled }),
    //   enable: async () => boolean,
    //   disable: async () => boolean,
    // },
    // 搜索模式（可选）
    // search: { ... },
  },
  conversation: {
    idFromUrl: {
      pattern: '/* 你的 pattern */',
      captureGroup: 1,
    },
  },
  sse: {
    urlPattern: '/* SSE 接口 path */',
    detectionKeywords: ['/* 检测关键词 */'],
    parseLine: (line: string) => {
      // TODO: 实现 SSE 解析逻辑
      line = line.trim();
      if (!line || !line.startsWith('data:')) return null;
      
      const jsonStr = line.substring(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') return null;
      
      try {
        const data = JSON.parse(jsonStr);
        
        // TODO: 根据实际数据结构解析
        // - 思考内容：返回 { text, isThink: true, done: false }
        // - 正式内容：返回 { text, isThink: false, done: false }
        // - 流结束：返回 { text: '', isThink: null, done: true }
        
        return {
          text: data.content || '',
          isThink: false,  // 根据实际字段判断
          done: data.is_end === 1 || data.content === '[DONE]',
        };
      } catch {
        return null;
      }
    },
  },
};

export default {id}Provider;
```

---

## ✅ 改动检查清单

### 核心代码

- [ ] `packages/inject/src/providers/{id}.ts` - Provider 配置实现
- [ ] `packages/inject/src/providers/index.ts` - 导出并注册 Provider
- [ ] `packages/inject/src/standalone/entry.ts` - 添加域名检测
- [ ] `src/background/providers.js` - 注册通道配置
- [ ] `src/content/{id}/index.js` - Content Script 入口

### UI 配置（可选但推荐）

- [ ] `src/sidepanel/config/providerIcons.ts` - 添加图标
- [ ] `_locales/zh_CN/messages.json` - 国际化文案
- [ ] `docs/changelog.md` - 更新日志

---

## 🧪 测试验证

### 功能测试

- [ ] 能够在目标网站自动注入
- [ ] 能够检测登录状态
- [ ] 能够发送消息并接收流式回复
- [ ] 能够正确提取会话 ID
- [ ] 思考模式（如有）切换正常
- [ ] 搜索模式（如有）切换正常

### 兼容性测试

- [ ] Chrome 扩展模式正常
- [ ] API 模式（如配置）正常

---

## 📎 参考资料

- [ ] 官方 API 文档链接：
- [ ] SSE 接口抓包文件（如有）：
- [ ] 其他相关说明：

---

## 💡 备注

{其他需要说明的信息}
