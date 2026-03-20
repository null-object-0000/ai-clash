import logger from '../../../shared/logger.js';

const CLICKABLE = '[role="button"], button, a, [tabindex="0"]';

const GENERIC_TEXT_LABELS = ['新对话', '新会话', '开启新对话', '新建对话', 'New Chat'];

const GENERIC_TESTID_SELECTORS = [
  '[data-testid*="new-chat"]',
  '[data-testid*="new"]',
  '[data-testid*="create"]',
];

// ============================================================================
// 内部查找逻辑
// ============================================================================

function resolveClickable(el) {
  if (!el) return null;
  if (el.matches?.(CLICKABLE)) return el;
  return el.closest(CLICKABLE) || el;
}

function findByPriority(selectors) {
  for (const item of selectors) {
    if (typeof item === 'string') {
      const el = document.querySelector(item);
      if (el) return resolveClickable(el);
    } else if (item && typeof item === 'object') {
      const el = document.querySelector(item.selector);
      if (!el) continue;
      const target = item.closest ? el.closest(item.closest) : resolveClickable(el);
      if (target) return target;
    }
  }
  return null;
}

function findByText() {
  for (const label of GENERIC_TEXT_LABELS) {
    const el = Array.from(document.querySelectorAll('span, div, button, a'))
      .find(e => e.textContent?.trim() === label);
    if (el) return resolveClickable(el);
  }
  return null;
}

function findByTestId() {
  for (const sel of GENERIC_TESTID_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) return resolveClickable(el);
  }
  return null;
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建新建对话能力
 *
 * @param {Object} config
 * @param {string} config.provider
 * @param {(string|{selector:string,closest:string})[]} [config.prioritySelectors]
 *   通道特有的按钮选择器，支持字符串或 { selector, closest } 对象
 * @param {number} [config.delayAfterClick=600] - 点击后等待页面切换的时间(ms)
 */
export function createNewConversation(config) {
  const {
    provider,
    prioritySelectors = [],
    delayAfterClick = 600,
  } = config;

  return {
    async start() {
      let target = findByPriority(prioritySelectors);
      if (!target) target = findByText();
      if (!target) target = findByTestId();

      if (!target) {
        logger.warn(`[AI Clash ${provider}] 未找到新建对话按钮`);
        return { success: false, reason: 'button-not-found' };
      }

      target.click();
      await new Promise(r => setTimeout(r, delayAfterClick));

      logger.log(`[AI Clash ${provider}] 已点击新建对话`);
      return { success: true };
    },
  };
}
