/**
 * LongCat (天工) Provider Configuration
 */

import type { ProviderConfig, ThinkingAction, SearchAction } from '../core/types.js';
import { findAnyElement, hasClass, simulateRealClick, classContains } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ThinkingAction = {
  async getState() {
    const selectors = ['[data-testid*="thinking"], .thinking-mode'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    return { found: true, enabled: classContains(el, 'active') };
  },

  async enable() {
    const selectors = ['[data-testid*="thinking"], .thinking-mode'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[data-testid*="thinking"], .thinking-mode'];
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
    // 思考模式 - 使用抽象接口
    thinking: thinkingAction,
    // 智能搜索 - 使用抽象接口
    search: searchAction,
  },
};

export default longcatProvider;
