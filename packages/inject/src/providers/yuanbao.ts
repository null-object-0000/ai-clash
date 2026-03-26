/**
 * 腾讯元宝 (Yuanbao) Provider Configuration
 */

import type { ProviderConfig, ThinkingAction, SearchAction } from '../core/types.js';
import { findAnyElement, simulateRealClick, classContains } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ThinkingAction = {
  async getState() {
    const selectors = ['[data-testid*="deep-thought"], .deep-thought-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    return { found: true, enabled: classContains(el, 'active') };
  },

  async enable() {
    const selectors = ['[data-testid*="deep-thought"], .deep-thought-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[data-testid*="deep-thought"], .deep-thought-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

// 智能搜索实现
const searchAction: SearchAction = {
  async getState() {
    const selectors = ['[data-testid*="search"], .search-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    return { found: true, enabled: classContains(el, 'active') };
  },

  async enable() {
    const selectors = ['[data-testid*="search"], .search-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[data-testid*="search"], .search-toggle'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

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
    // 思考模式 - 使用抽象接口
    thinking: thinkingAction,
    // 智能搜索（联网搜索） - 使用抽象接口
    search: searchAction,
  },
};

export default yuanbaoProvider;
