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
      'div[id="root"] div div div div div div div.ds-icon:has(path[d="M8 0.599609C3.91309 0.599609 0.599609 3.91309 0.599609 8C0.599609 9.13376 0.855461 10.2098 1.3125 11.1719L1.5918 11.7588L2.76562 11.2012L2.48633 10.6143C2.11034 9.82278 1.90039 8.93675 1.90039 8C1.90039 4.63106 4.63106 1.90039 8 1.90039C11.3689 1.90039 14.0996 4.63106 14.0996 8C14.0996 11.3689 11.3689 14.0996 8 14.0996C7.31041 14.0996 6.80528 14.0514 6.35742 13.9277C5.91623 13.8059 5.49768 13.6021 4.99707 13.2529C4.26492 12.7422 3.21611 12.5616 2.35156 13.1074L2.33789 13.1162L2.32422 13.126L1.58789 13.6436L2.01953 14.9297L3.0459 14.207C3.36351 14.0065 3.83838 14.0294 4.25293 14.3184C4.84547 14.7317 5.39743 15.011 6.01172 15.1807C6.61947 15.3485 7.25549 15.4004 8 15.4004C12.0869 15.4004 15.4004 12.0869 15.4004 8C15.4004 3.91309 12.0869 0.599609 8 0.599609ZM7.34473 4.93945V7.34961H4.93945V8.65039H7.34473V11.0605H8.64551V8.65039H11.0605V7.34961H8.64551V4.93945H7.34473Z"])',
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
