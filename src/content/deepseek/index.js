import { MSG_TYPES } from '../../shared/messages.js';
import logger from '../../shared/logger.js';
import {
  isContextValid, safeSend,
  waitForElement,
  createDomObserverContext, startDomObserver, stopDomObserver,
  fillTextInput, simulateEnter,
  sendStatus, sendConnecting, sendError, sendCompleted,
} from '../shared/utils.js';

const PROVIDER = 'deepseek';

// ============================================================================
// 第一部分：尽早注入 hook 到 MAIN world
// ============================================================================
logger.log(`[AI Clash ${PROVIDER}] content script 已在该页运行（document_start）`);

// 标记content script已就绪，供background检查
window.__aiclash_content_script_ready = true;

if (isContextValid()) {
  safeSend({ type: MSG_TYPES.INJECT_HOOK, payload: { provider: PROVIDER } }, (response) => {
    if (response?.ok) {
      logger.log(`[AI Clash ${PROVIDER}] hook 已通过 scripting API 兜底注入`);
    }
  });
}

// ============================================================================
// 流式数据接收
// ============================================================================
let thinkContent = "";
let responseContent = "";

const domCtx = createDomObserverContext();

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
    domCtx.hookDataReceived = true;
    const payload = event.data.payload;
    const isThink = typeof payload === 'object' && payload && payload.isThink === true;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    if (!thinkContent && !responseContent) logger.log(`[AI Clash ${PROVIDER}] content 收到首包 CHUNK`);
    if (isThink) thinkContent += text; else responseContent += text;

    const stage = responseContent ? 'responding' : 'thinking';
    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage, isThink }
    });
  }
  else if (event.data.type === 'DEEPSEEK_HOOK_END') {
    logger.log(`[AI Clash ${PROVIDER}] content 收到 END`);
    stopDomObserver(domCtx);
    const full = buildDisplayText();
    if (!full) {
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

function pollDeepSeekDom() {
  const blocks = document.querySelectorAll('.ds-markdown--block');
  if (blocks.length === 0) return null;
  return blocks[blocks.length - 1].textContent || '';
}

// ============================================================================
// 第二部分：UI 模拟操作
// ============================================================================

if (isContextValid()) {
  try {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
        thinkContent = "";
        responseContent = "";
        executeDeepSeek(request.payload.prompt, request.payload.settings);
      }
    });
  } catch {
    logger.warn(`[AI Clash ${PROVIDER}] 注册消息监听失败，扩展上下文已失效`);
  }
}

/** 尝试点击「开启新对话」 */
async function tryStartNewConversation() {
  const byText = Array.from(document.querySelectorAll('span, div, button')).find(
    (el) => el.textContent?.trim() === '开启新对话'
  );
  if (byText) {
    const clickable = byText.closest('[role="button"], button, a, [tabindex="0"]') || byText;
    if (clickable && !clickable.getAttribute?.('aria-disabled')) {
      (clickable).click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  const iconBtns = document.querySelectorAll('.ds-icon-button[role="button"][aria-disabled="false"]');
  for (const btn of Array.from(iconBtns)) {
    const path = btn.querySelector('svg path');
    const d = path?.getAttribute('d') ?? '';
    const isPlusIcon = (d.includes('4.93945') && d.includes('7.34961')) || (d.includes('6.36949') && d.includes('9.22487'));
    if (isPlusIcon) {
      (btn).click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  return false;
}

/** 同步 DeepSeek 页面的「深度思考」开关状态 */
async function syncDeepThinkToggle(wantEnabled) {
  const toggleBtns = document.querySelectorAll('.ds-toggle-button[role="button"]');
  for (const btn of Array.from(toggleBtns)) {
    const label = btn.textContent?.trim();
    if (label && label.includes('深度思考')) {
      const isSelected = btn.classList.contains('ds-toggle-button--selected');
      if (wantEnabled !== isSelected) {
        (btn).click();
        logger.log(`[AI Clash ${PROVIDER}] 深度思考: ${isSelected ? 'ON→OFF' : 'OFF→ON'}`);
        await new Promise(r => setTimeout(r, 300));
      } else {
        logger.log(`[AI Clash ${PROVIDER}] 深度思考已处于期望状态: ${wantEnabled ? 'ON' : 'OFF'}`);
      }
      return;
    }
  }
  logger.warn(`[AI Clash ${PROVIDER}] 未找到深度思考按钮`);
}

async function executeDeepSeek(prompt, settings) {
  logger.log(`[AI Clash ${PROVIDER}] 开始执行任务...`);
  sendConnecting(PROVIDER);

  if (settings?.isNewConversation !== false) {
    await tryStartNewConversation();
  }

  const deepThinkWanted = settings?.isDeepThinkingEnabled ?? true;
  await syncDeepThinkToggle(deepThinkWanted);

  sendStatus(PROVIDER, '正在定位输入框...');
  const textarea = await waitForElement('textarea');

  if (!textarea) {
    sendError(PROVIDER, '未找到 DeepSeek 输入框。请确认已登录。');
    return;
  }

  sendStatus(PROVIDER, '正在发送消息...');
  textarea.focus();
  fillTextInput(textarea, prompt);

  setTimeout(async () => {
    let sendBtn = null;
    let container = textarea.parentElement;
    for (let i = 0; i < 6 && container; i++) {
      const btns = container.querySelectorAll('.ds-icon-button[role="button"][aria-disabled="false"]');
      if (btns.length > 0) { sendBtn = btns[btns.length - 1]; break; }
      container = container.parentElement;
    }

    if (!sendBtn) {
      const allIconBtns = document.querySelectorAll('.ds-icon-button[role="button"]');
      for (const btn of Array.from(allIconBtns)) {
        const path = btn.querySelector('svg path');
        if (path && path.getAttribute('d')?.includes('0.981587')) { sendBtn = btn; break; }
      }
    }

    if (sendBtn) {
      (sendBtn).focus();
      (sendBtn).click();
    } else {
      simulateEnter(textarea);
    }

    sendStatus(PROVIDER, '正在等待回复...');
    startDomObserver(domCtx, PROVIDER, pollDeepSeekDom);
  }, 800);
}
