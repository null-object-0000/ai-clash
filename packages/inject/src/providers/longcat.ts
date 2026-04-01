/**
 * LongCat (天工) Provider Configuration
 */

import type { ProviderConfig, ToggleAction, AuthAction } from '../core/types.js';
import { findAnyElement, hasClass, simulateRealClick } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ToggleAction = {
  async getState() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 深度思考'];
    const el = findAnyElement(selectors);
    const parent = el?.parentElement;
    if (!parent || !el) return { found: false, enabled: false };
    return { found: true, enabled: hasClass(parent, 'active') };
  },

  async enable() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 深度思考'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 深度思考'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

// 联网搜索实现
const searchAction: ToggleAction = {
  async getState() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 联网搜索'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    const parent = el.parentElement;
    if (!parent) return { found: false, enabled: false };
    return { found: true, enabled: hasClass(parent, 'active') };
  },

  async enable() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 联网搜索'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['.chat-input-footer .v-checked-button span >> 联网搜索'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

// Auth 登录信息配置
const authAction: AuthAction = {
  loggedInSelectors: [
    '.slider-footer-content .userAvatar + span',
    '.slider-footer-content .userAvatar img',
  ],
  usernameSelectors: [
    '.slider-footer-content .userAvatar + span',
  ],
  avatarSelectors: [
    '.slider-footer-content .userAvatar img',
  ],
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
    // 登录信息检测
    auth: authAction,
  },
};

export default longcatProvider;
