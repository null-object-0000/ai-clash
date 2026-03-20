/**
 * LongCat (天工) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const longcatProvider: ProviderConfig = {
  id: 'longcat',
  name: 'LongCat (天工)',
  domain: 'www.tiangong.cn',
  selectors: {
    input: [
      'textarea',
      '#input',
      '[contenteditable="true"]',
    ],
    sendButton: [
      '[data-testid*="send"]',
      '[aria-label*="发送"]',
      '.send-btn',
    ],
    newChat: [
      // LongCat 新对话按钮选择器
      '.new-chat-btn',
      '[data-testid*="new"]',
      '[aria-label*="新对话"], [aria-label*="新建对话"]',
      'button:has-text("新对话"), button:has-text("新建对话")',
    ],
    thinking: {
      // LongCat 思考模型选择
      find: '[data-testid*="thinking"], .thinking-mode',
      isEnabled: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
  toggles: undefined,
};

export default longcatProvider;
