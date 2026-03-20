/**
 * 通义千问 (Qianwen) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const qianwenProvider: ProviderConfig = {
  id: 'qianwen',
  name: '通义千问',
  domain: 'tongyi.aliyun.com',
  selectors: {
    input: [
      '#chat-input',
      'textarea[placeholder*="输入"]',
      '[contenteditable="true"]',
      '[data-slate-editor]',
    ],
    sendButton: [
      '[data-testid*="send"]',
      '[aria-label*="发送"]',
      'button[type="submit"]',
    ],
    newChat: [
      // 通义千问新对话按钮选择器
      '.new-chat-btn',
      '[data-testid*="new-chat"]',
      '[data-testid*="new"]',
      '[aria-label*="新对话"], [aria-label*="新建对话"]',
      'button:has-text("新对话"), button:has-text("新建对话"), button:has-text("新会话")',
    ],
    thinking: {
      // 千问的思考模式配置（如果有）
      find: '[data-testid*="thinking"], .thinking-toggle',
      isEnabled: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
  // 千问可能没有思考模式切换
  toggles: undefined,
};

export default qianwenProvider;
