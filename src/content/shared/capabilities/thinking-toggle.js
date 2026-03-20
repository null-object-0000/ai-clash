import logger from '../../../shared/logger.js';
import { simulateRealClick } from '../utils.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

// ============================================================================
// findToggle 解析 — 支持字符串 / 配置对象 / 函数
// ============================================================================

function resolveFindToggle(raw) {
  // 函数：直接使用
  if (typeof raw === 'function') return raw;
  // 字符串：当作选择器
  if (typeof raw === 'string') return () => document.querySelector(raw);
  // 配置对象：selector + 可选过滤
  const { selector, textContains, hasChild } = raw;
  return () => {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      if (textContains && !el.textContent?.includes(textContains)) continue;
      if (hasChild && !el.querySelector(hasChild)) continue;
      return el;
    }
    return null;
  };
}

// ============================================================================
// isEnabled 解析 — 支持声明式配置 / 函数
// ============================================================================

function resolveIsEnabled(raw) {
  if (typeof raw === 'function') return raw;
  if (raw.hasClass) return (el) => el.classList.contains(raw.hasClass);
  if (raw.classContains) {
    const kw = raw.classContains.toLowerCase();
    return (el) => Array.from(el.classList).some(c => c.toLowerCase().includes(kw));
  }
  if (raw.classPrefix) {
    return (el) => Array.from(el.classList).some(c => c.startsWith(raw.classPrefix));
  }
  if (raw.textContains) return (el) => (el.textContent || '').includes(raw.textContains);
  throw new Error('Invalid isEnabled config');
}

// ============================================================================
// 切换方式处理器
// ============================================================================

const toggleHandlers = {
  /**
   * click — 点击按钮直接切换
   * config: { wait?: number }
   */
  async click(el, _wantEnabled, config) {
    el.click();
    await wait(config.wait ?? 300);
  },

  /**
   * click-with-close — 开启时点击按钮，关闭时点击按钮内的关闭图标
   * config: { closeSelector: string, wait?: number }
   */
  async 'click-with-close'(el, wantEnabled, config, provider) {
    if (wantEnabled) {
      el.click();
    } else {
      const closeBtn = el.querySelector(config.closeSelector);
      if (closeBtn) {
        closeBtn.click();
      } else {
        logger.warn(`[AI Clash ${provider}] 未找到关闭图标 (${config.closeSelector})，回退为点击`);
        el.click();
      }
    }
    await wait(config.wait ?? 300);
  },

  /**
   * dropdown — 展开下拉菜单，选择对应选项
   * config: {
   *   menuItemSelectors: string[],
   *   enableMatch:  { texts: string[], fallbackTestId?: string },
   *   disableMatch: { texts: string[], fallbackTestId?: string },
   *   waitAfterOpen?: number,
   *   waitAfterSelect?: number,
   * }
   */
  async dropdown(el, wantEnabled, config, provider) {
    simulateRealClick(el);
    await wait(config.waitAfterOpen ?? 800);

    // 收集所有菜单项（Radix 等框架会渲染到 body 末尾）
    const items = [];
    for (const sel of config.menuItemSelectors) {
      items.push(...document.querySelectorAll(sel));
    }

    const match = wantEnabled ? config.enableMatch : config.disableMatch;

    // 按优先级匹配文本
    let target = null;
    for (const text of match.texts) {
      target = items.find(item => item.textContent?.includes(text));
      if (target) break;
    }
    if (!target && match.fallbackTestId) {
      target = document.querySelector(`[data-testid="${match.fallbackTestId}"]`);
    }

    if (!target) {
      logger.warn(`[AI Clash ${provider}] 未在下拉菜单中找到目标选项`);
      simulateRealClick(document.body);
      return;
    }

    const clickable = target.closest('[role="menuitem"]')
      || target.querySelector('[role="menuitem"]')
      || target;
    simulateRealClick(clickable);
    await wait(config.waitAfterSelect ?? 800);
  },
};

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建思考模式切换能力
 *
 * @param {Object} config
 * @param {string} config.provider
 *
 * @param {string | Object | Function} config.findToggle
 *   查找切换控件:
 *   - 字符串: CSS 选择器
 *   - 对象: { selector, textContains?, hasChild? }
 *   - 函数: () => Element | null
 *
 * @param {Object | Function} config.isEnabled
 *   判断是否已开启:
 *   - { hasClass: 'xxx' }
 *   - { classContains: 'xxx' }
 *   - { classPrefix: 'xxx' }
 *   - { textContains: 'xxx' }
 *   - (el) => boolean
 *
 * @param {Object} config.toggle
 *   切换方式:
 *   - { type: 'click', wait?: number }
 *   - { type: 'click-with-close', closeSelector: string, wait?: number }
 *   - { type: 'dropdown', menuItemSelectors, enableMatch, disableMatch, ... }
 */
export function createThinkingToggle(config) {
  const { provider, toggle } = config;

  const findToggle = resolveFindToggle(config.findToggle);
  const isEnabled = resolveIsEnabled(config.isEnabled);
  const handler = toggleHandlers[toggle.type];
  if (!handler) throw new Error(`Unknown toggle type: ${toggle.type}`);

  return {
    async getState() {
      const el = await Promise.resolve(findToggle());
      if (!el) return { found: false, enabled: false };
      return { found: true, enabled: isEnabled(el) };
    },

    async sync(wantEnabled) {
      const el = await Promise.resolve(findToggle());
      if (!el) {
        logger.warn(`[AI Clash ${provider}] 未找到深度思考切换控件`);
        return { success: false, changed: false, reason: 'not-found' };
      }

      const current = isEnabled(el);
      if (current === wantEnabled) {
        logger.log(`[AI Clash ${provider}] 深度思考已是期望状态: ${wantEnabled ? 'ON' : 'OFF'}`);
        return { success: true, changed: false };
      }

      logger.log(`[AI Clash ${provider}] 切换深度思考 ${current ? 'ON→OFF' : 'OFF→ON'}`);
      await handler(el, wantEnabled, toggle, provider);

      const afterEl = await Promise.resolve(findToggle());
      if (!afterEl) {
        logger.warn(`[AI Clash ${provider}] 切换后控件消失`);
        return { success: false, changed: true, reason: 'disappeared-after-toggle' };
      }

      const after = isEnabled(afterEl);
      if (after === wantEnabled) {
        logger.log(`[AI Clash ${provider}] 深度思考切换成功`);
      } else {
        logger.warn(`[AI Clash ${provider}] 深度思考切换失败，状态未变`);
      }

      return { success: after === wantEnabled, changed: true };
    },
  };
}
