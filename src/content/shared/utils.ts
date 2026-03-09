import { MSG_TYPES } from '../../shared/messages.ts';

// ============================================================================
// 扩展上下文 & 安全通信
// ============================================================================

/** 检测扩展上下文是否仍有效 */
export function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** 静默发送消息，忽略"Receiving end does not exist"及上下文失效错误 */
export function safeSend(msg: Record<string, unknown>, callback?: (resp: any) => void) {
  if (!isContextValid()) return;
  try {
    chrome.runtime.sendMessage(msg, (resp) => {
      void chrome.runtime.lastError;
      callback?.(resp);
    });
  } catch {
    // Extension context invalidated — 静默忽略
  }
}

// ============================================================================
// DOM 元素等待
// ============================================================================

/** 等待单个选择器匹配的元素出现 */
export async function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

/** 尝试多种选择器，返回第一个匹配的元素 */
export async function waitForAnyElement(selectors: string[], timeout = 8000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

// ============================================================================
// DOM MutationObserver 兜底观测器
// ============================================================================

export interface DomObserverContext {
  hookDataReceived: boolean;
  observer: MutationObserver | null;
  timer: ReturnType<typeof setInterval> | null;
  lastObservedText: string;
}

export function createDomObserverContext(): DomObserverContext {
  return { hookDataReceived: false, observer: null, timer: null, lastObservedText: '' };
}

export function stopDomObserver(ctx: DomObserverContext) {
  if (ctx.observer) { ctx.observer.disconnect(); ctx.observer = null; }
  if (ctx.timer) { clearInterval(ctx.timer); ctx.timer = null; }
  ctx.lastObservedText = '';
}

/**
 * 启动 DOM 兜底观测
 * @param ctx       观测器上下文
 * @param provider  通道名称（用于消息中的 provider 字段）
 * @param pollFn    自定义 DOM 轮询函数 —— 需读取页面 DOM 并返回当前最新全文
 */
export function startDomObserver(
  ctx: DomObserverContext,
  provider: string,
  pollFn: () => string | null,
) {
  stopDomObserver(ctx);
  ctx.hookDataReceived = false;
  ctx.lastObservedText = '';

  const doPoll = () => {
    if (ctx.hookDataReceived) return;
    const currentText = pollFn();
    if (currentText == null) return;
    if (currentText.length > ctx.lastObservedText.length) {
      const newText = currentText.substring(ctx.lastObservedText.length);
      ctx.lastObservedText = currentText;
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider, text: newText, stage: 'responding', isThink: false }
      });
    }
  };

  ctx.observer = new MutationObserver(() => doPoll());
  ctx.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  ctx.timer = setInterval(doPoll, 200);

  // 超时保护
  setTimeout(() => {
    if (ctx.observer) {
      console.log(`[AIClash ${provider}] DOM 观测超时，自动停止`);
      stopDomObserver(ctx);
    }
  }, 60000);
}

// ============================================================================
// UI 模拟：通用文本填入 & 发送
// ============================================================================

/** 向 textarea / input 填入文本（绕过 React/Vue 绑定） */
export function fillTextInput(el: HTMLTextAreaElement | HTMLInputElement, text: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 向 contenteditable 元素填入文本 */
export function fillContentEditable(el: HTMLElement, text: string) {
  el.innerText = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 模拟 Enter 键发送 */
export function simulateEnter(el: Element) {
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true
  }));
}

// ============================================================================
// 消息快捷方法
// ============================================================================

export function sendStatus(provider: string, text: string) {
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider, text, stage: 'connecting', isStatus: true }
  });
}

export function sendConnecting(provider: string) {
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider, text: '', stage: 'connecting' }
  });
}

export function sendError(provider: string, message: string) {
  safeSend({
    type: MSG_TYPES.ERROR,
    payload: { provider, message }
  });
}

export function sendCompleted(provider: string) {
  safeSend({
    type: MSG_TYPES.TASK_COMPLETED,
    payload: { provider }
  });
}
