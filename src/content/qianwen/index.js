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

const PROVIDER = 'qianwen';

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

  if (event.data.type === 'QIANWEN_HOOK_CHUNK') {
    domCtx.hookDataReceived = true;
    const payload = event.data.payload;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    if (!responseContent) logger.log(`[AI Clash ${PROVIDER}] content 收到首包 CHUNK`);
    responseContent += text;

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage: 'responding', isThink: false }
    });
  }
  else if (event.data.type === 'QIANWEN_HOOK_END') {
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

function pollQianwenDom() {
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
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
        responseContent = "";
        executeQianwen(request.payload.prompt, request.payload.settings || {});
      }
      // 支持查询当前模式
      else if (request.type === 'GET_QIANWEN_MODE') {
        sendResponse({ mode: getDeepThinkMode() });
      }
      // 支持主动设置模式
      else if (request.type === 'SET_QIANWEN_MODE') {
        setDeepThinkMode(request.payload.enable).then(success => {
          sendResponse({ success, mode: getDeepThinkMode() });
        });
        return true; // 异步响应
      }
    });
  } catch {
    logger.warn(`[AI Clash ${PROVIDER}] 注册消息监听失败，扩展上下文已失效`);
  }
}

/** 尝试点击「新对话」按钮 */
async function tryStartNewConversation() {
  // 策略1：侧边栏大按钮 —— class 含 newChatButton（带 hash 后缀的稳定前缀）
  const sidebarBtn = document.querySelector('[class*="newChatButton"]');
  if (sidebarBtn) {
    logger.log(`[AI Clash ${PROVIDER}] 新对话：命中 newChatButton`);
    sidebarBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }

  // 策略2：通过图标 data-icon-type 定位（两种图标名均兼容）
  for (const iconType of ['qwpcicon-newDialogueMedium', 'qwpcicon-newDialogue']) {
    const iconEl = document.querySelector(`[data-icon-type="${iconType}"]`);
    if (iconEl) {
      const btn = iconEl.closest('button, [role="button"], a') || iconEl.parentElement;
      if (btn) {
        logger.log(`[AI Clash ${PROVIDER}] 新对话：命中 icon ${iconType}`);
        btn.click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }
  }

  // 策略3：文字兜底
  const labels = ['新对话', '新会话', '开启新对话', '新建对话'];
  for (const label of labels) {
    const el = Array.from(document.querySelectorAll('span, div, button, a')).find(
      (e) => e.textContent?.trim() === label
    );
    if (el) {
      const clickable = el.closest('[role="button"], button, a, [tabindex="0"]') || el;
      if (clickable) {
        logger.log(`[AI Clash ${PROVIDER}] 新对话：命中文字"${label}"`);
        clickable.click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }
  }

  logger.warn(`[AI Clash ${PROVIDER}] 新对话：未找到任何入口按钮`);
  return false;
}

/** 获取当前深度思考模式状态 */
function getDeepThinkMode() {
  const deepThinkBtn = document.querySelector('[data-log-params*="deepThink"]');
  if (!deepThinkBtn) return 'unknown';
  return deepThinkBtn.classList.contains('selected-WK762S') ? 'deepthink' : 'normal';
}

/** 设置千问深度思考模式 */
async function setDeepThinkMode(enable = true) {
  const deepThinkBtn = document.querySelector('[data-log-params*="deepThink"]');
  if (!deepThinkBtn) return false;

  const currentMode = getDeepThinkMode();
  const isEnabled = currentMode === 'deepthink';

  if (enable && !isEnabled) {
    // 开启深度思考
    deepThinkBtn.click();
    await new Promise(r => setTimeout(r, 300));
    logger.log(`[AI Clash ${PROVIDER}] 已开启深度思考模式`);
    return true;
  } else if (!enable && isEnabled) {
    // 关闭深度思考：点击内部的关闭叉号
    const closeBtn = deepThinkBtn.querySelector('[data-icon-type="qwpcicon-close2"]');
    if (closeBtn) {
      closeBtn.click();
      await new Promise(r => setTimeout(r, 300));
      logger.log(`[AI Clash ${PROVIDER}] 已关闭深度思考模式`);
      return true;
    }
    // fallback：如果没有找到关闭按钮，直接点击按钮本身切换
    deepThinkBtn.click();
    await new Promise(r => setTimeout(r, 300));
    return true;
  }
  return false;
}

async function executeQianwen(prompt, settings = {}) {
  logger.log(`[AI Clash ${PROVIDER}] 开始执行任务...`, settings);
  sendConnecting(PROVIDER);

  if (settings.isNewConversation !== false) {
    await tryStartNewConversation();
  }

  // 根据全局深度思考开关调整模式
  if (settings.isDeepThinkingEnabled !== undefined) {
    sendStatus(PROVIDER, `正在${settings.isDeepThinkingEnabled ? '开启' : '关闭'}深度思考模式...`);
    await setDeepThinkMode(settings.isDeepThinkingEnabled);
  }

  sendStatus(PROVIDER, '正在定位输入框...');

  const inputSelectors = [
    '[data-slate-editor="true"]', // 优先匹配千问的Slate编辑器
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'input[type="text"]',
  ];

  const inputEl = await waitForAnyElement(inputSelectors);

  if (!inputEl) {
    sendError(PROVIDER, '未找到千问输入框。请确认已登录 www.qianwen.com。');
    return;
  }

  sendStatus(PROVIDER, '正在发送消息...');
  inputEl.focus();
  await new Promise(r => setTimeout(r, 200));

  // 千问使用Slate编辑器，需要特殊处理
  if (inputEl.getAttribute('contenteditable') === 'true' || inputEl.tagName !== 'TEXTAREA' && inputEl.tagName !== 'INPUT') {
    await fillContentEditable(inputEl, prompt);
  } else {
    fillTextInput(inputEl, prompt);
  }

  await new Promise(r => setTimeout(r, 500)); // 等待输入完成

  setTimeout(async () => {
    let sendBtn = null;

    // 优先查找千问最新的发送按钮class
    sendBtn = document.querySelector('.operateBtn-ehxNOr');

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
        // 常见的发送图标路径特征：包含M12 19l9 2-9-18-9 18 9-2zm0 0v-8这样的形状
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
    startDomObserver(domCtx, PROVIDER, pollQianwenDom);
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
