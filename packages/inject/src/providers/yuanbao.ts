/**
 * 腾讯元宝 (Yuanbao) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const yuanbaoProvider: ProviderConfig = {
  id: 'yuanbao',
  name: '腾讯元宝',
  domain: 'yuanbao.tencent.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-testid*="new"]',
          '[data-testid*="create"]',
          '[aria-label*="新建对话"], [aria-label*="新对话"]',
          'button:has-text("新建对话"), button:has-text("新对话")',
        ],
      },
      // 输入消息
      input: {
        box: [
          'textarea',
          '#chat-input',
          '[contenteditable="true"]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-testid*="send"]',
          '[aria-label*="发送"]',
          '.send-button',
        ],
      },
    },
    // 思考模式（如果有）
    thinking: {
      button: ['[data-testid*="deep-thought"], .deep-thought-toggle'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
    // 智能搜索（联网搜索）
    search: {
      button: ['[data-testid*="search"], .search-toggle'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
};

export default yuanbaoProvider;
