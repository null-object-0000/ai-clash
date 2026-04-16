/**
 * DOM 操作工具函数
 *
 * 提供通用的 DOM 查找、事件模拟等工具函数
 */

/**
 * 等待指定毫秒数
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 转换支持通配符的 class 选择器 (如 .avatar__* 或 avatar__*)
 * 以解决部分网站随机生成的动态 class hash 的痛点
 */
export function compileWildcardSelector(selector: string): string {
  if (!selector || typeof selector !== 'string' || !selector.includes('*')) return selector;
  
  // 匹配：边界/点号 + 类名前缀 + *
  return selector.replace(/(^|\s|>|\+|~|\]|\.)([a-zA-Z0-9_-]+)\*/g, (match, boundary, classPrefix) => {
    const keepBoundary = boundary === '.' ? '' : boundary;
    return `${keepBoundary}:is([class^="${classPrefix}"], [class*=" ${classPrefix}"])`;
  });
}

/**
 * 查找元素（支持 >> 和 * 通配符伪选择器语法）
 */
export function findElement(selector: string): Element | null {
  if (!selector) return null;

  selector = compileWildcardSelector(selector);

  // 处理 >> 伪选择器语法（用于文本匹配）
  if (selector.includes('>>')) {
    const parts = selector.split('>>').map(s => s.trim());
    const baseEls = document.querySelectorAll(parts[0]);
    if (!baseEls || parts.length < 2) return null;

    const text = parts[1];
    for (const baseEl of baseEls) {
      const walker = document.createTreeWalker(
        baseEl,
      NodeFilter.SHOW_TEXT,
      null
    );

      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.textContent?.includes(text)) {
          return node.parentElement;
        }
      }
    }

    return null;
  }

  return document.querySelector(selector);
}

/**
 * 查找元素列表中的第一个匹配项
 */
export function findAnyElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = findElement(selector);
    if (el) return el;
  }
  return null;
}

/**
 * 等待元素出现 - 支持 >> 伪选择器语法
 */
export function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      const el = findElement(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeout) {
        resolve(null);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/**
 * 等待任意元素出现
 */
export async function waitForAnyElement(selectors: string[], timeout = 8000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const selector of selectors) {
      const el = findElement(selector);
      if (el) return el;
    }
    await wait(100);
  }
  return null;
}

/**
 * 模拟真实点击（完整的事件序列）
 */
export function simulateRealClick(element: Element): void {
  if (!element) return;

  const events = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  ];
  events.forEach(ev => element.dispatchEvent(ev));
}

/**
 * 检查元素是否包含指定 class
 */
export function hasClass(el: Element, className: string): boolean {
  return el.classList.contains(className);
}

/**
 * 检查元素的 class 是否包含指定关键词（部分匹配）
 */
export function classContains(el: Element, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  return Array.from(el.classList).some(c => c.toLowerCase().includes(kw));
}

/**
 * 检查元素的 class 是否以指定关键词开头（前缀匹配）
 */
export function classStartsWith(el: Element, prefix: string): boolean {
  const pre = prefix.toLowerCase();
  return Array.from(el.classList).some(c => c.toLowerCase().startsWith(pre));
}

/**
 * 检查元素的 class 是否以指定关键词结尾（后缀匹配）
 */
export function classEndsWith(el: Element, suffix: string): boolean {
  const suf = suffix.toLowerCase();
  return Array.from(el.classList).some(c => c.toLowerCase().endsWith(suf));
}

/**
 * 构建可靠的类名模糊匹配 CSS 选择器
 * 解决 `[class^="xxx"]` 无法匹配 `<div class="other xxx">` 的问题
 * 
 * @param className 基准类名
 * @param matchType 匹配类型：prefix (前缀), suffix (后缀), contains (包含)
 * @returns 完整的 CSS 选择器
 */
export function buildFuzzyClassSelector(className: string, matchType: 'prefix' | 'suffix' | 'contains' = 'prefix'): string {
  if (matchType === 'prefix') {
    return `:is([class^="${className}"], [class*=" ${className}"])`;
  }
  if (matchType === 'suffix') {
    return `:is([class$="${className}"], [class*="${className} "])`;
  }
  return `[class*="${className}"]`;
}
