/**
 * 腾讯元宝 (Yuanbao) Provider Configuration
 */

import type { ProviderConfig, ToggleAction } from '../core/types.js';
import { findAnyElement, hasClass, simulateRealClick } from '../core/dom-utils.js';

// 思考模式实现
const thinkingAction: ToggleAction = {
  async getState() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };
    const hasSelectedClass = Array.from(el.classList).some(c => c.startsWith('ThinkSelector_selected__'));
    return { found: true, enabled: hasSelectedClass };
  },

  async enable() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[dt-button-id="deep_think"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },
};

// 智能搜索实现
const searchAction: ToggleAction = {
  async getState() {
    // 元宝有点特殊，它可以开启自动搜索，如果开启自动搜索，我们认为智能搜索是关闭的
    const selectors = ['[dt-button-id="internet_search"]'];
    const el = findAnyElement(selectors);
    if (!el) return { found: false, enabled: false };

    // 找 el 子节点中类名为 index_v2_mainSection__ 的子节点中 index_v2_contentText__ 开头的，看他的文本内容，如果包含"自动搜索"则认为智能搜索是关闭的，否则认为是开启的
    const mainSectionEl = Array.from(el.children).find(child => Array.from(child.classList).some(c => c.startsWith('index_v2_mainSection__')));
    const contentEl = mainSectionEl ? Array.from(mainSectionEl.children).find(child => Array.from(child.classList).some(c => c.startsWith('index_v2_contentText__'))) : null;
    console.log('Yuanbao search button content element:', contentEl);
    if (contentEl && contentEl.textContent === '自动搜索') {
      // 强行改成手动模式并关闭智能搜索
      simulateRealClick(el);

      await new Promise(resolve => setTimeout(resolve, 300));

      // 找 .internet-search-switch-popup .t-dropdown__item-text 的子节点的子节点的内部 index_v2_dropDownItemName__ 开头的元素且内部文本等于"手动"，点击它
      const popupItem = Array.from(document.querySelectorAll('.internet-search-switch-popup .t-dropdown__item-text div div'))
        .find(item => Array.from(item.classList).some(c => c.startsWith('index_v2_dropDownItemName__')) && item.textContent === '手动');
      if (popupItem) {
        simulateRealClick(popupItem.parentElement?.parentElement!);

        await new Promise(resolve => setTimeout(resolve, 300));

        return await this.getState(); // 重新获取状态，应该就变成智能搜索已开启了
      }

      return { found: true, enabled: false };
    }

    const hasSelectedClass = Array.from(el.classList).some(c => c.startsWith('index_v2_active__'));
    return { found: true, enabled: hasSelectedClass };
  },

  async enable() {
    const selectors = ['[dt-button-id="internet_search"]'];
    const el = findAnyElement(selectors);
    if (!el) return false;
    simulateRealClick(el);
    return true;
  },

  async disable() {
    const selectors = ['[dt-button-id="internet_search"]'];
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
