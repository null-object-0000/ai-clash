import logger from '../../../shared/logger.js';
import { waitForAnyElement, fillTextInput, fillContentEditable } from '../utils.js';

/**
 * 创建消息填充能力
 *
 * @param {Object} config
 * @param {string} config.provider
 * @param {string[]} config.selectors - 输入框选择器（按优先级排列）
 * @param {number} [config.delayAfterFill=0] - 填充后等待时间(ms)
 * @param {number} [config.waitTimeout=8000] - 等待输入框出现的超时(ms)
 */
export function createInputFiller(config) {
  const {
    provider,
    selectors,
    delayAfterFill = 0,
    waitTimeout = 8000,
  } = config;

  return {
    async fill(text) {
      const el = await waitForAnyElement(selectors, waitTimeout);
      if (!el) {
        logger.warn(`[AI Clash ${provider}] 未找到输入框`);
        return { success: false, reason: 'input-not-found' };
      }

      el.focus();
      await new Promise(r => setTimeout(r, 100));

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        fillTextInput(el, text);
      } else {
        await fillContentEditable(el, text);
      }

      if (delayAfterFill > 0) {
        await new Promise(r => setTimeout(r, delayAfterFill));
      }

      logger.log(`[AI Clash ${provider}] 已填充消息到 <${el.tagName.toLowerCase()}>`);
      return { success: true };
    },
  };
}
