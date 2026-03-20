import { MSG_TYPES } from '../../shared/messages.js';
import logger from '../../shared/logger.js';
import {
  isContextValid, safeSend,
  waitForAnyElement,
  createDomObserverContext, startDomObserver, stopDomObserver,
  fillTextInput, fillContentEditable, simulateEnter,
  sendStatus, sendConnecting, sendError, sendCompleted,
} from '../shared/utils.js';
import { thinkingToggle } from './thinking.js';
import { inputFiller } from './input.js';
import { messageSender } from './send.js';
import { newChat } from './new-chat.js';
import { exposeDebugGlobal } from '../shared/debug-bridge.js';

const PROVIDER = 'longcat';

// ============================================================================
// 第一部分：尽早注入 hook 到 MAIN world
// ============================================================================
logger.log(`[AI Clash ${PROVIDER}] content script 已在该页运行（document_start）`);
window.__aiclash_content_script_ready = true;

if (isContextValid()) {
  safeSend({ type: MSG_TYPES.INJECT_HOOK, payload: { provider: PROVIDER } }, (response) => {
    if (response?.ok) {
      logger.log(`[AI Clash ${PROVIDER}] hook 已通过 scripting API 兜底注入`);
    }
  });
}

// ============================================================================
// DEBUG: 暴露能力到全局变量
// ============================================================================
exposeDebugGlobal(PROVIDER, { thinking: thinkingToggle, input: inputFiller, sender: messageSender, newChat });

// ============================================================================
// 流式数据接收
// ============================================================================
let responseContent = "";

const domCtx = createDomObserverContext();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'LONGCAT_HOOK_CHUNK') {
    domCtx.hookDataReceived = true;
    const payload = event.data.payload;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    const isThink = payload?.isThink ?? false;
    if (!isThink && !responseContent) logger.log(`[AI Clash ${PROVIDER}] content 收到首包 CHUNK`);
    if (!isThink) responseContent += text;

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage: isThink ? 'thinking' : 'responding', isThink }
    });
  }
  else if (event.data.type === 'LONGCAT_HOOK_END') {
    logger.log(`[AI Clash ${PROVIDER}] content 收到 END`);
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

function pollLongcatDom() {
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
        executeLongcat(request.payload.prompt, request.payload.settings || {});
      }
    });
  } catch {
    logger.warn(`[AI Clash ${PROVIDER}] 注册消息监听失败，扩展上下文已失效`);
  }
}

/**
 * 确保深度思考模式与期望状态一致
 * @param {boolean} wantEnabled - 是否希望开启深度思考
 */
async function ensureDeepThinkingMode(wantEnabled) {
  const btn = Array.from(document.querySelectorAll('.v-checked-button')).find(
    (el) => el.querySelector('use[href="#icon-sikao"]')
  );
  if (!btn) {
    logger.warn(`[AI Clash ${PROVIDER}] 未找到深度思考按钮`);
    return;
  }

  const isActive = btn.classList.contains('active');
  if (wantEnabled === isActive) return; // 状态已符合，无需操作

  logger.log(`[AI Clash ${PROVIDER}] 切换深度思考模式 → ${wantEnabled ? '开启' : '关闭'}`);
  btn.click();
  await new Promise((r) => setTimeout(r, 400));
}

/** 尝试点击「新对话」按钮 */
async function tryStartNewConversation() {
  // 优先匹配LongCat特有的两个新对话按钮
  const prioritySelectors = ['.new-content', '.chat-icon-box'];
  for (const selector of prioritySelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const clickable = el.closest('[role="button"], button, a, [tabindex="0"]') || el;
      if (clickable) {
        (clickable).click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }
  }

  const labels = ['新对话', '新会话', '开启新对话', '新建对话', 'New Chat', 'New'];
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

  const iconBtns = document.querySelectorAll('[class*="icon"], svg');
  for (const btn of Array.from(iconBtns)) {
    const parent = btn.closest('[role="button"], button, a');
    if (parent) {
      const d = btn.querySelector('path')?.getAttribute('d') || '';
      if (d.includes('M12 5v14M5 12h14') || d.includes('plus') || d.includes('+')) {
        (parent).click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }
  }

  return false;
}

async function executeLongcat(prompt, settings = {}) {
  logger.log(`[AI Clash ${PROVIDER}] 开始执行任务...`, settings);
  sendConnecting(PROVIDER);

  if (settings.isNewConversation !== false) {
    await tryStartNewConversation();
  }

  // 根据设置同步深度思考模式
  await ensureDeepThinkingMode(!!settings.isDeepThinkingEnabled);

  sendStatus(PROVIDER, '正在定位输入框...');

  const inputSelectors = [
    '.tiptap.ProseMirror', // LongCat的Tiptap编辑器（优先匹配）
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ];

  const inputEl = await waitForAnyElement(inputSelectors);

  if (!inputEl) {
    sendError(PROVIDER, '未找到LongCat输入框。请确认已登录 longcat.chat。');
    return;
  }

  sendStatus(PROVIDER, '正在发送消息...');
  inputEl.focus();
  await new Promise(r => setTimeout(r, 200));

  if (inputEl.getAttribute('contenteditable') === 'true' || inputEl.tagName !== 'TEXTAREA' && inputEl.tagName !== 'INPUT') {
    await fillContentEditable(inputEl, prompt);
  } else {
    fillTextInput(inputEl, prompt);
  }

  await new Promise(r => setTimeout(r, 500)); // 等待输入完成

  setTimeout(async () => {
    let sendBtn = null;

    // 优先匹配LongCat的发送按钮
    sendBtn = document.querySelector('.send-btn:not(.send-btn-disabled)');

    if (!sendBtn) {
      sendBtn = document.querySelector('[data-testid*="send"], [data-testid*="submit"], [data-testid*="Send"]');
    }

    if (!sendBtn) {
      sendBtn = document.querySelector('[aria-label*="发送"], [aria-label*="send"], [aria-label*="Send"]');
    }

    if (!sendBtn) {
      // 查找包含发送图标的按钮
      const iconBtns = document.querySelectorAll('button svg, [role="button"] svg');
      for (const icon of Array.from(iconBtns)) {
        const d = icon.querySelector('path')?.getAttribute('d') || '';
        // 常见的发送图标路径特征
        if (d.includes('M12') && d.includes('19l') && d.includes('v-8') ||
            d.includes('send') || d.includes('paper-plane') ||
            d.includes('arrow') && d.includes('right')) {
          const parent = icon.closest('button, [role="button"]');
          if (parent && !parent.getAttribute('aria-disabled')) {
            sendBtn = parent;
            break;
          }
        }
      }
    }

    if (!sendBtn) {
      const el = Array.from(document.querySelectorAll('button, [role="button"]')).find(
        (e) => {
          const t = e.textContent?.trim();
          return t === '发送' || t === 'Send' || t === '发送消息';
        }
      );
      if (el) sendBtn = el;
    }

    if (!sendBtn) {
      // 从输入框向上查找最近的按钮
      let container = inputEl.parentElement;
      for (let i = 0; i < 8 && container; i++) {
        const btns = container.querySelectorAll('button, [role="button"]');
        for (const btn of Array.from(btns)) {
          if (!btn.getAttribute('aria-disabled')) {
            sendBtn = btn;
            break;
          }
        }
        if (sendBtn) break;
        container = container.parentElement;
      }
    }

    if (sendBtn) {
      logger.log(`[AI Clash ${PROVIDER}] 找到发送按钮`, sendBtn);
      (sendBtn).focus();
      // 尝试多次点击，避免单次点击失效
      setTimeout(() => (sendBtn).click(), 100);
      setTimeout(() => (sendBtn).click(), 300);
    } else {
      logger.warn(`[AI Clash ${PROVIDER}] 未找到发送按钮，尝试按Enter提交`);
      simulateEnter(inputEl);
    }

    sendStatus(PROVIDER, '正在等待回复...');
    startDomObserver(domCtx, PROVIDER, pollLongcatDom);
  }, 1000);
}

// 同步debug状态到MAIN world
function syncDebugState() {
  chrome.storage.local.get('isDebugEnabled', (result) => {
    window.postMessage({
      type: 'AICLASH_DEBUG_STATE',
      enabled: !!result.isDebugEnabled
    }, '*');
  });
}

// 初始化时同步一次
syncDebugState();

// 监听storage变化，实时同步
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isDebugEnabled) {
    window.postMessage({
      type: 'AICLASH_DEBUG_STATE',
      enabled: !!changes.isDebugEnabled.newValue
    }, '*');
  }
});
