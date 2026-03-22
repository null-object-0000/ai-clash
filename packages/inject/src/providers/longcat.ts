/**
 * LongCat (天工) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const longcatProvider: ProviderConfig = {
  id: 'longcat',
  name: 'LongCat (天工)',
  domain: 'www.tiangong.cn',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '.new-chat-btn',
          '[data-testid*="new"]',
          '[aria-label*="新对话"], [aria-label*="新建对话"]',
          'button:has-text("新对话"), button:has-text("新建对话")',
        ],
      },
      // 输入消息
      input: {
        box: [
          'textarea',
          '#input',
          '[contenteditable="true"]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-testid*="send"]',
          '[aria-label*="发送"]',
          '.send-btn',
        ],
      },
    },
    // 思考模式（如果有）
    thinking: {
      button: ['[data-testid*="thinking"], .thinking-mode'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
    // 智能搜索（如果有）
    search: {
      button: ['[data-testid*="search"], .search-toggle'],
      enabledState: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
};

export default longcatProvider;
