/**
 * 豆包 (Doubao) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const doubaoProvider: ProviderConfig = {
  id: 'doubao',
  name: '豆包',
  domain: 'doubao.com',
  selectors: {
    input: [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]',
    ],
    sendButton: [
      '[data-testid*="send"]',
      '[data-testid*="submit"]',
      '[aria-label*="发送"]',
      '[aria-label*="send"]',
    ],
    newChat: [
      // 豆包新对话按钮选择器
      '[data-testid*="new"]',
      '[data-testid*="create"]',
      '[aria-label*="新对话"], [aria-label*="新会话"]',
      'button:has-text("新对话"), button:has-text("新会话"), button:has-text("开启新对话")',
    ],
    thinking: {
      find: {
        selector: '[data-testid="deep-thinking-action-button"]',
      },
      isEnabled: { textContains: '思考' },
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
  },
  toggles: {
    findToggle: '[data-testid="deep-thinking-action-button"]',
    isEnabled: { textContains: '思考' },
    toggle: 'dropdown',
    waitAfterToggle: 800,
  },
};

export default doubaoProvider;
