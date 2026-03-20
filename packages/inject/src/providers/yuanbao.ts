/**
 * 腾讯元宝 (Yuanbao) Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const yuanbaoProvider: ProviderConfig = {
  id: 'yuanbao',
  name: '腾讯元宝',
  domain: 'yuanbao.tencent.com',
  selectors: {
    input: [
      'textarea',
      '#chat-input',
      '[contenteditable="true"]',
    ],
    sendButton: [
      '[data-testid*="send"]',
      '[aria-label*="发送"]',
      '.send-button',
    ],
    newChat: [
      // 腾讯元宝新对话按钮选择器
      '[data-testid*="new"]',
      '[data-testid*="create"]',
      '[aria-label*="新建对话"], [aria-label*="新对话"]',
      'button:has-text("新建对话"), button:has-text("新对话")',
    ],
    thinking: {
      // 元宝的思考模式配置（如果有）
      find: '[data-testid*="deep-thought"], .deep-thought-toggle',
      isEnabled: { classContains: 'active' },
      toggle: { type: 'click', wait: 300 },
    },
  },
  toggles: undefined,
};

export default yuanbaoProvider;
