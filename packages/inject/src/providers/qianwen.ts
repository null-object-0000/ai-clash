/**
 * 通义千问 (Qianwen) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const qianwenProvider: ProviderConfig = {
  id: 'qianwen',
  name: '通义千问',
  domain: 'tongyi.aliyun.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '.new-chat-btn',
          '[data-testid*="new-chat"]',
          '[data-testid*="new"]',
          '[aria-label*="新对话"], [aria-label*="新建对话"]',
          'button:has-text("新对话"), button:has-text("新建对话"), button:has-text("新会话")',
        ],
      },
      // 输入消息
      input: {
        box: [
          '#chat-input',
          'textarea[placeholder*="输入"]',
          '[contenteditable="true"]',
          '[data-slate-editor]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-testid*="send"]',
          '[aria-label*="发送"]',
          'button[type="submit"]',
        ],
      },
    },
    // 思考模式（如果有）
    thinking: {
      button: ['[data-testid*="thinking"], .thinking-toggle'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
    // 智能搜索（联网搜索）
    search: {
      button: ['[data-testid*="search"], [data-testid*="联网"]', '.search-toggle'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
};

export default qianwenProvider;
