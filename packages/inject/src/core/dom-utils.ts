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
 * 查找元素（支持 >> 伪选择器语法）
 */
export function findElement(selector: string): Element | null {
  if (!selector) return null;

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
