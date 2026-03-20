/**
 * DeepSeek Provider Configuration
 */

import type { ProviderConfig } from '../core/types.js';

export const deepseekProvider: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  domain: 'chat.deepseek.com',
  selectors: {
    // 输入框选择器
    input: [
      'textarea[placeholder*="DeepSeek"]'
    ],
    // 发送按钮选择器 - 使用完整的 SVG path 精确匹配
    sendButton: [
      // 匹配包含特定 SVG path 的最外层 [role="button"] 元素
      '[role="button"]:has(path[d="M8.3125 0.981587C8.66767 1.0545 8.97902 1.20558 9.2627 1.43374C9.48724 1.61438 9.73029 1.85933 9.97949 2.10854L14.707 6.83608L13.293 8.25014L9 3.95717V15.0431H7V3.95717L2.70703 8.25014L1.29297 6.83608L6.02051 2.10854C6.26971 1.85933 6.51277 1.61438 6.7373 1.43374C6.97662 1.24126 7.28445 1.04542 7.6875 0.981587C7.8973 0.94841 8.1031 0.956564 8.3125 0.981587Z"])',
    ],
    // 新对话按钮 - 选择器列表（按优先级）
    newChat: [
      'div.ds-icon:has(path[d^="M8 0.599609C3.91309"])',
    ],
    // 深度思考切换按钮
    thinking: {
      find: '.ds-toggle-button[role="button"]',
      isEnabled: { hasClass: 'ds-toggle-button--selected' },
      toggle: { type: 'click', wait: 300 },
    },
  },
  // 思考模式切换配置（用于能力调用）
  toggles: {
    findToggle: '.ds-toggle-button[role="button"]',
    isEnabled: { hasClass: 'ds-toggle-button--selected' },
    toggle: 'click',
    waitAfterToggle: 300,
  },
};

export default deepseekProvider;
