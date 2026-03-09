import { MSG_TYPES } from '../../shared/messages.js';
import {
  isContextValid, safeSend,
  waitForAnyElement,
  createDomObserverContext, startDomObserver, stopDomObserver,
  fillTextInput, fillContentEditable, simulateEnter,
  sendStatus, sendConnecting, sendError, sendCompleted,
} from '../shared/utils.js';

const PROVIDER = 'doubao';

// ============================================================================
// 第一部分：尽早注入 hook 到 MAIN world
// ============================================================================
console.log(`[AIClash ${PROVIDER}] content script 已在该页运行（document_start）`);

if (isContextValid()) {
  safeSend({ type: MSG_TYPES.INJECT_HOOK, payload: { provider: PROVIDER } }, (response) => {
    if (response?.ok) {
      console.log(`[AIClash ${PROVIDER}] hook 已通过 scripting API 兜底注入`);
    }
  });
}

// ============================================================================
// 流式数据接收
// ============================================================================
let responseContent = "";

const domCtx = createDomObserverContext();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'DOUBAO_HOOK_CHUNK') {
    domCtx.hookDataReceived = true;
    const payload = event.data.payload;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    if (!responseContent) console.log(`[AIClash ${PROVIDER}] content 收到首包 CHUNK`);
    responseContent += text;

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage: 'responding', isThink: false }
    });
  }
  else if (event.data.type === 'DOUBAO_HOOK_END') {
    console.log(`[AIClash ${PROVIDER}] content 收到 END`);
    stopDomObserver(domCtx);
    if (!responseContent) {
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: PROVIDER, text: '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）' }
      });
    }
    sendCompleted(PROVIDER);
  }
});

// ============================================================================
// DOM 兜底 — 自定义 pollFn
// ============================================================================

const DOM_SELECTORS = [
  '[data-testid="message-content"]',
  '.message-content',
  '.chat-message-content',
  '.markdown-body',
  '[class*="message"][class*="content"]',
  '[class*="answer"][class*="content"]',
  '[class*="reply"][class*="content"]',
];

function pollDoubaoDom() {
  for (const sel of DOM_SELECTORS) {
    const blocks = document.querySelectorAll(sel);
    if (blocks.length > 0) {
      return blocks[blocks.length - 1].textContent || '';
    }
  }
  return null;
}

// ============================================================================
// 第二部分：UI 模拟操作
// ============================================================================

if (isContextValid()) {
  try {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
        responseContent = "";
        executeDoubao(request.payload.prompt);
      }
    });
  } catch {
    console.warn(`[AIClash ${PROVIDER}] 注册消息监听失败，扩展上下文已失效`);
  }
}

/** 尝试点击「新对话」按钮 */
async function tryStartNewConversation() {
  const labels = ['新对话', '新会话', '开启新对话'];
  for (const label of labels) {
    const el = Array.from(document.querySelectorAll('span, div, button, a')).find(
      (e) => e.textContent?.trim() === label
    );
    if (el) {
      const clickable = el.closest('[role="button"], button, a, [tabindex="0"]') || el;
      if (clickable) {
        (clickable).click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }
  }

  const testIdBtns = document.querySelectorAll('[data-testid*="new"], [data-testid*="create"]');
  for (const btn of Array.from(testIdBtns)) {
    (btn).click();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }

  return false;
}

/** 切换到思考模式 */
async function switchToDeepThinking() {
  try {
    // 找到思考模式切换按钮
    const deepThinkingBtn = await waitForAnyElement(['[data-testid="deep-thinking-action-button"] button'], 2000);
    if (!deepThinkingBtn) {
      console.log(`[AIClash ${PROVIDER}] 未找到思考模式按钮，使用默认模式`);
      return false;
    }

    // 检查当前是否已经是思考模式
    const isDeepThinking = deepThinkingBtn.getAttribute('data-checked') === 'true' ||
                          deepThinkingBtn.textContent?.includes('思考');
    if (isDeepThinking) {
      console.log(`[AIClash ${PROVIDER}] 当前已经是思考模式`);
      return true;
    }

    // 点击按钮展开下拉菜单
    deepThinkingBtn.click();
    await new Promise(r => setTimeout(r, 300));

    // 找到思考模式选项
    const deepThinkingOption = await waitForAnyElement(['[data-testid="deep-thinking-action-item-1"]'], 1000);
    if (deepThinkingOption) {
      deepThinkingOption.click();
      await new Promise(r => setTimeout(r, 300));
      console.log(`[AIClash ${PROVIDER}] 已切换到思考模式`);
      return true;
    } else {
      console.log(`[AIClash ${PROVIDER}] 未找到思考模式选项，使用默认模式`);
      // 点击其他地方关闭下拉菜单
      document.body.click();
      return false;
    }
  } catch (e) {
    console.warn(`[AIClash ${PROVIDER}] 切换思考模式失败`, e);
    return false;
  }
}

async function executeDoubao(prompt) {
  console.log(`[AIClash ${PROVIDER}] 开始执行任务...`);
  sendConnecting(PROVIDER);

  await tryStartNewConversation();

  sendStatus(PROVIDER, '正在定位输入框...');

  const inputSelectors = [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ];

  const inputEl = await waitForAnyElement(inputSelectors);

  if (!inputEl) {
    sendError(PROVIDER, '未找到豆包输入框。请确认已登录 doubao.com。');
    return;
  }

  // 切换到思考模式
  sendStatus(PROVIDER, '正在切换思考模式...');
  await switchToDeepThinking();

  sendStatus(PROVIDER, '正在发送消息...');
  (inputEl).focus();

  if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
    fillTextInput(inputEl, prompt);
  } else {
    fillContentEditable(inputEl, prompt);
  }

  setTimeout(async () => {
    let sendBtn = null;

    sendBtn = document.querySelector('[data-testid*="send"], [data-testid*="submit"]');

    if (!sendBtn) {
      sendBtn = document.querySelector('[aria-label*="发送"], [aria-label*="send"]');
    }

    if (!sendBtn) {
      const el = Array.from(document.querySelectorAll('button, [role="button"]')).find(
        (e) => { const t = e.textContent?.trim(); return t === '发送' || t === 'Send'; }
      );
      if (el) sendBtn = el;
    }

    if (!sendBtn) {
      let container = inputEl.parentElement;
      for (let i = 0; i < 6 && container; i++) {
        const btns = container.querySelectorAll('button, [role="button"]');
        if (btns.length > 0) { sendBtn = btns[btns.length - 1]; break; }
        container = container.parentElement;
      }
    }

    if (sendBtn) {
      (sendBtn).focus();
      (sendBtn).click();
    } else {
      simulateEnter(inputEl);
    }

    sendStatus(PROVIDER, '正在等待回复...');
    startDomObserver(domCtx, PROVIDER, pollDoubaoDom);
  }, 800);
}
