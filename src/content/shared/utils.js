import { MSG_TYPES } from '../../shared/messages.js';

// ============================================================================
// 扩展上下文 & 安全通信
// ============================================================================

/** 检测扩展上下文是否仍有效 */
export function isContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** 静默发送消息，忽略"Receiving end does not exist"及上下文失效错误 */
export function safeSend(msg, callback) {
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
export async function waitForElement(selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

/** 尝试多种选择器，返回第一个匹配的元素 */
export async function waitForAnyElement(selectors, timeout = 8000) {
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

export function createDomObserverContext() {
  return { hookDataReceived: false, observer: null, timer: null, lastObservedText: '' };
}

export function stopDomObserver(ctx) {
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
  ctx,
  provider,
  pollFn,
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
export function fillTextInput(el, text) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 向 contenteditable 元素填入文本 */
export async function fillContentEditable(el, text) {
  el.focus();
  await new Promise(r => setTimeout(r, 100));

  // 先清空现有内容
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await new Promise(r => setTimeout(r, 100));

  // 特殊处理Slate编辑器（千问使用）
  if (el.hasAttribute('data-slate-editor')) {
    try {
      // 方案1：构造ClipboardEvent模拟粘贴（不需要授权，最可靠）
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      el.dispatchEvent(pasteEvent);
      console.log('[fillContentEditable] 使用模拟粘贴事件成功');

      // 作为兜底补一刀 execCommand
      document.execCommand('insertText', false, text);

      // 触发输入事件
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      // 尝试触发React事件（如果是React应用）
      const reactPropsKey = Object.keys(el).find(key => key.startsWith('__reactProps'));
      if (reactPropsKey) {
        const props = el[reactPropsKey];
        if (props && props.onInput) props.onInput({ target: el, currentTarget: el });
        if (props && props.onChange) props.onChange({ target: el, currentTarget: el });
        console.log('[fillContentEditable] 已触发React Fiber事件');
      }

      return;
    } catch (e) {
      console.warn('[fillContentEditable] 模拟粘贴失败，尝试逐字输入:', e);
    }

    try {
      // 方案2：逐字模拟键盘输入
      for (const char of text) {
        // 模拟keydown
        el.dispatchEvent(new KeyboardEvent('keydown', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          bubbles: true,
          cancelable: true
        }));

        // 模拟keypress
        el.dispatchEvent(new KeyboardEvent('keypress', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          bubbles: true,
          cancelable: true
        }));

        // 输入字符
        document.execCommand('insertText', false, char);

        // 模拟keyup
        el.dispatchEvent(new KeyboardEvent('keyup', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          bubbles: true,
          cancelable: true
        }));

        // 每个字符间隔一点时间，更像真人输入
        await new Promise(r => setTimeout(r, 10));
      }
      console.log('[fillContentEditable] 逐字输入成功');
      return;
    } catch (e) {
      console.warn('[fillContentEditable] 逐字输入失败，使用普通方式:', e);
    }
  }

  // 普通contenteditable处理（兜底方案）
  el.innerText = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 模拟 Enter 键发送 */
export function simulateEnter(el) {
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true
  }));
}

// ============================================================================
// 消息快捷方法
// ============================================================================

export function sendStatus(provider, text) {
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider, text, stage: 'connecting', isStatus: true }
  });
}

export function sendConnecting(provider) {
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider, text: '', stage: 'connecting' }
  });
}

export function sendError(provider, message) {
  safeSend({
    type: MSG_TYPES.ERROR,
    payload: { provider, message }
  });
}

export function sendCompleted(provider) {
  safeSend({
    type: MSG_TYPES.TASK_COMPLETED,
    payload: { provider }
  });
}
