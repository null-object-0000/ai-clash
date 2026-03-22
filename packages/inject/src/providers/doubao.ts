/**
 * 豆包 (Doubao) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const doubaoProvider: ProviderConfig = {
  id: 'doubao',
  name: '豆包',
  domain: 'doubao.com',
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-testid*="new"]',
          '[data-testid*="create"]',
          '[aria-label*="新对话"], [aria-label*="新会话"]',
          'button:has-text("新对话"), button:has-text("新会话"), button:has-text("开启新对话")',
        ],
      },
      // 输入消息
      input: {
        box: [
          'textarea',
          '[contenteditable="true"]',
          '[role="textbox"]',
          'input[type="text"]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-testid*="send"]',
          '[data-testid*="submit"]',
          '[aria-label*="发送"]',
          '[aria-label*="send"]',
        ],
      },
    },
    // 思考模式
    thinking: {
      button: ['[data-testid="deep-thinking-action-button"]'],
      enabledState: { textContains: '思考' },
      toggle: {
        type: 'dropdown',
        wait: 800,
        menuItemSelectors: [
          '[data-testid*="deep-thinking-action-item"]',
          '[role="menuitem"]',
          '[data-slot="dropdown-menu-item"]',
        ],
        enableMatch: {
          texts: ['思考', '擅长解决更难的问题'],
          fallbackTestId: 'deep-thinking-action-item-1',
        },
        disableMatch: {
          texts: ['快速', '适用于大部分情况'],
          fallbackTestId: 'deep-thinking-action-item-0',
        },
      },
    },
    // 智能搜索（联网搜索）
    search: {
      button: ['[data-testid="search-toggle-button"]'],
      enabledState: { textContains: '搜索' },
      toggle: { type: 'click', wait: 300 },
    },
  },
};

export default doubaoProvider;
