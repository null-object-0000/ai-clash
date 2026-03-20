import logger from '../../../shared/logger.js';
import { waitForAnyElement, simulateRealClick, simulateEnter } from '../utils.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

// ============================================================================
// 点击方式处理器
// ============================================================================

const clickHandlers = {
  async click(el) {
    el.focus();
    el.click();
  },
  async 'double-click'(el) {
    el.focus();
    await wait(100);
    el.click();
    await wait(200);
    el.click();
  },
  async 'real-click'(el) {
    el.scrollIntoViewIfNeeded?.();
    simulateRealClick(el);
  },
};

// ============================================================================
// 通用发送按钮搜索
// ============================================================================

const GENERIC_SELECTORS = [
  '[data-testid*="send"]',
  '[data-testid*="submit"]',
  '[aria-label*="发送"]',
  '[aria-label*="send"]',
  '[aria-label*="Send"]',
];

const SEND_TEXT_LABELS = ['发送', 'Send', '发送消息'];

function findBySelector(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function findByTextContent() {
  for (const label of SEND_TEXT_LABELS) {
    const el = Array.from(document.querySelectorAll('button, [role="button"]'))
      .find(e => e.textContent?.trim() === label);
    if (el) return el;
  }
  return null;
}

/**
 * 从输入框向上遍历父级查找按钮
 * @param {Element} inputEl
 * @param {Object} config
 * @param {string} [config.selector='button, [role="button"]']
 * @param {number} [config.depth=6]
 * @param {'last'|'first-enabled'} [config.pick='last']
 */
function findByParentTraversal(inputEl, config = {}) {
  const {
    selector = 'button, [role="button"]',
    depth = 6,
    pick = 'last',
  } = config;

  let container = inputEl?.parentElement;
  for (let i = 0; i < depth && container; i++) {
    const btns = container.querySelectorAll(selector);
    if (btns.length > 0) {
      if (pick === 'first-enabled') {
        for (const btn of btns) {
          if (!btn.getAttribute('aria-disabled')) return btn;
        }
      } else {
        return btns[btns.length - 1];
      }
    }
    container = container.parentElement;
  }
  return null;
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建消息发送能力
 *
 * @param {Object} config
 * @param {string} config.provider
 * @param {string[]} [config.prioritySelectors] - 通道特有的按钮选择器（优先级最高）
 * @param {'click'|'double-click'|'real-click'} [config.clickMethod='click']
 * @param {string[]} config.inputSelectors - 输入框选择器（用于父级遍历和 Enter 兜底）
 * @param {Object} [config.parentTraversal] - 父级遍历配置
 * @param {string} [config.parentTraversal.selector='button, [role="button"]']
 * @param {number} [config.parentTraversal.depth=6]
 * @param {'last'|'first-enabled'} [config.parentTraversal.pick='last']
 */
export function createMessageSender(config) {
  const {
    provider,
    prioritySelectors = [],
    clickMethod = 'click',
    inputSelectors = [],
    parentTraversal,
  } = config;

  const doClick = clickHandlers[clickMethod] || clickHandlers.click;

  function findSendButton(inputEl) {
    // 1. 通道特有选择器
    const priority = findBySelector(prioritySelectors);
    if (priority) return priority;

    // 2. 通用选择器
    const generic = findBySelector(GENERIC_SELECTORS);
    if (generic) return generic;

    // 3. 文字匹配
    const textMatch = findByTextContent();
    if (textMatch) return textMatch;

    // 4. 从输入框向上遍历
    if (inputEl) {
      const traversal = findByParentTraversal(inputEl, parentTraversal);
      if (traversal) return traversal;
    }

    return null;
  }

  return {
    async send() {
      const inputEl = inputSelectors.length > 0
        ? await waitForAnyElement(inputSelectors, 2000)
        : null;

      const sendBtn = findSendButton(inputEl);

      if (sendBtn) {
        logger.log(`[AI Clash ${provider}] 找到发送按钮，执行点击`);
        await doClick(sendBtn);
        return { success: true, method: 'button' };
      }

      if (inputEl) {
        logger.log(`[AI Clash ${provider}] 未找到发送按钮，使用 Enter 提交`);
        simulateEnter(inputEl);
        return { success: true, method: 'enter' };
      }

      logger.warn(`[AI Clash ${provider}] 未找到发送按钮和输入框`);
      return { success: false, reason: 'no-button-no-input' };
    },
  };
}
