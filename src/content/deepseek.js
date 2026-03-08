import { MSG_TYPES } from '../shared/messages.js';

// ============================================================================
// 第一部分：请求 background 在 MAIN world 注入 hook（绕过页面 CSP 禁止内联脚本）
// ============================================================================
console.log('[AnyBridge] content script 已在该页运行');

chrome.runtime.sendMessage({ type: MSG_TYPES.INJECT_HOOK }, (response) => {
  if (response?.ok) {
    console.log('[AnyBridge] hook 已通过 scripting 注入（MAIN world）');
  } else {
    console.warn('[AnyBridge] hook 注入失败', response?.err);
  }
});

// 分别缓存思考与正式回复，最终组合为 <think>...</think>\n\n回复
let thinkContent = "";
let responseContent = "";

function buildDisplayText() {
  const think = (thinkContent || "").trim();
  const resp = (responseContent || "").trim();
  if (!think && !resp) return "";
  if (!think) return resp;
  if (!resp) return "<think>" + think + "</think>";
  return "<think>" + think + "</think>\n\n" + resp;
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'DEEPSEEK_HOOK_CHUNK') {
    const payload = event.data.payload;
    const isThink = typeof payload === 'object' && payload && payload.isThink === true;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    if (!thinkContent && !responseContent) console.log('[AnyBridge] content 收到首包 CHUNK');
    if (isThink) thinkContent += text; else responseContent += text;

    const stage = responseContent ? 'responding' : 'thinking';
    chrome.runtime.sendMessage({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: 'deepseek', text: buildDisplayText(), stage }
    });
  }
  else if (event.data.type === 'DEEPSEEK_HOOK_END') {
    console.log('[AnyBridge] content 收到 END');
    const full = buildDisplayText();
    if (!full) {
      chrome.runtime.sendMessage({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: 'deepseek', text: '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）' }
      });
    }
    chrome.runtime.sendMessage({
      type: MSG_TYPES.TASK_COMPLETED,
      payload: { provider: 'deepseek' }
    });
  }
});

// ============================================================================
// 第二部分：UI 模拟操作 (填入文本与发送)
// ============================================================================

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
    thinkContent = "";
    responseContent = "";
    executeDeepSeek(request.payload.prompt);
  }
});

async function waitForElement(selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

/** 尝试点击「开启新对话」，确保每次在新会话中发送 */
async function tryStartNewConversation() {
  // 策略 1：通过文案「开启新对话」查找可点击元素
  const byText = Array.from(document.querySelectorAll('span, div, button')).find(
    (el) => el.textContent?.trim() === '开启新对话'
  );
  if (byText) {
    const clickable = byText.closest('[role="button"], button, a, [tabindex="0"]') || byText;
    if (clickable && !clickable.getAttribute?.('aria-disabled')) {
      clickable.click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  // 策略 2：通过加号图标 SVG path 特征查找（新对话图标，16px 与 20px 两种）
  const iconBtns = document.querySelectorAll('.ds-icon-button[role="button"][aria-disabled="false"]');
  for (const btn of iconBtns) {
    const path = btn.querySelector('svg path');
    const d = path?.getAttribute('d') ?? '';
    const isPlusIcon = (d.includes('4.93945') && d.includes('7.34961')) || (d.includes('6.36949') && d.includes('9.22487'));
    if (isPlusIcon) {
      btn.click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  return false;
}

async function executeDeepSeek(prompt) {
  // 0. 每次对话前先尝试开启新对话
  await tryStartNewConversation();

  // 1. 寻找输入框
  const textarea = await waitForElement('textarea');

  if (!textarea) {
    chrome.runtime.sendMessage({
      type: MSG_TYPES.ERROR,
      payload: { provider: 'deepseek', message: '未找到 DeepSeek 输入框。请确认已登录。' }
    });
    return;
  }

  // 2. 强制聚焦
  textarea.focus();

  // 3. 绕过 React 绑定直接赋值
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  nativeInputValueSetter.call(textarea, prompt);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // 4. 等待 React 响应后点击发送
  setTimeout(async () => {
    // 策略 1：在输入框所在容器内查找发送按钮（避免点到其他图标）
    let sendBtn = null;
    let container = textarea.parentElement;
    for (let i = 0; i < 6 && container; i++) {
      const btns = container.querySelectorAll('.ds-icon-button[role="button"][aria-disabled="false"]');
      // 发送按钮通常是最后一个（箭头图标）
      if (btns.length > 0) {
        sendBtn = btns[btns.length - 1];
        break;
      }
      container = container.parentElement;
    }

    // 策略 2：通过 SVG path 特征识别发送箭头图标（path 含 8.3125 0.981587）
    if (!sendBtn) {
      const allIconBtns = document.querySelectorAll('.ds-icon-button[role="button"]');
      for (const btn of allIconBtns) {
        const path = btn.querySelector('svg path');
        if (path && path.getAttribute('d')?.includes('0.981587')) {
          sendBtn = btn;
          break;
        }
      }
    }

    if (sendBtn) {
      sendBtn.focus();
      sendBtn.click();
    } else {
      // 找不到按钮就模拟回车发送（DeepSeek 默认 Enter 发送）
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    }
  }, 800);
}