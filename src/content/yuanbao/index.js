import { MSG_TYPES } from '../../shared/messages.js';
import logger from '../../shared/logger.js';
import {
  isContextValid, safeSend,
  waitForAnyElement,
  createDomObserverContext, startDomObserver, stopDomObserver,
  fillContentEditable, fillTextInput, simulateEnter,
  sendStatus, sendConnecting, sendError, sendCompleted,
} from '../shared/utils.js';

const PROVIDER = 'yuanbao';

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
let responseContent = "";
let thinkContent = "";

const domCtx = createDomObserverContext();
let taskTimeout = null;

// 监听URL变化（单页应用跳转），用户手动点击新对话时自动重置状态
let lastUrl = location.href;
let isTaskRunning = false;
setInterval(() => {
  if (location.href !== lastUrl) {
    const oldUrl = lastUrl;
    lastUrl = location.href;
    if (!isTaskRunning) {
      logger.log(`[AI Clash ${PROVIDER}] 检测到页面跳转（新对话），自动重置任务状态`);
      stopDomObserver(domCtx);
      if (taskTimeout) clearTimeout(taskTimeout);
      sendCompleted(PROVIDER);
      responseContent = "";
      thinkContent = "";
    } else {
      logger.log(`[AI Clash ${PROVIDER}] 任务执行中，忽略本次URL变化: ${oldUrl} → ${lastUrl}`);
    }
  }
}, 1000);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'YUANBAO_HOOK_CHUNK') {
    domCtx.hookDataReceived = true;
    const payload = event.data.payload;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    const isThink = typeof payload === 'object' ? (payload?.isThink ?? false) : false;
    if (!responseContent && !thinkContent) logger.log(`[AI Clash ${PROVIDER}] content 收到首包 CHUNK`, isThink ? '(思考内容)' : '');

    if (isThink) {
      thinkContent += text;
    } else {
      responseContent += text;
    }

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage: responseContent ? 'responding' : 'thinking', isThink }
    });
  }
  else if (event.data.type === 'YUANBAO_HOOK_END') {
    logger.log(`[AI Clash ${PROVIDER}] content 收到 END`);
    if (taskTimeout) clearTimeout(taskTimeout);
    stopDomObserver(domCtx);
    if (!responseContent && !thinkContent) {
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: PROVIDER, text: '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）' }
      });
    }
    sendCompleted(PROVIDER);
    isTaskRunning = false;
  }
});

// ============================================================================
// DOM 兜底 — 自定义 pollFn
// ============================================================================

const DOM_SELECTORS = [
  '.agent-chat__bubble-content',
  '[class*="bubble"][class*="content"]',
  '[class*="message"][class*="content"]',
  '[class*="chat"][class*="content"]',
  '[class*="answer"]',
  '.markdown-body',
  '[data-testid="message-content"]',
];

function pollYuanbaoDom() {
  for (const sel of DOM_SELECTORS) {
    const blocks = document.querySelectorAll(sel);
    if (blocks.length > 0) {
      let text = blocks[blocks.length - 1].textContent || '';
      // 过滤掉思考内容前缀
      text = text.replace(/^思考中\.\.\./, '');
      text = text.replace(/^已深度思考\(用时\d+秒\)/, '');
      return text;
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
        thinkContent = "";
        stopDomObserver(domCtx);
        if (taskTimeout) clearTimeout(taskTimeout);
        executeYuanbao(request.payload.prompt, request.payload.settings || {});
      }
    });
  } catch {
    logger.warn(`[AI Clash ${PROVIDER}] 注册消息监听失败，扩展上下文已失效`);
  }
}

/**
 * 切换深度思考模式
 * 判断依据：按钮有 ThinkSelector_selected__* 类 → 已开启；否则 → 已关闭
 * 操作：当前状态与目标不一致时点击一次即可切换
 */
async function syncDeepThinkingMode(enable) {
  const btn = document.querySelector('[dt-button-id="deep_think"]');
  if (!btn) {
    logger.log(`[AI Clash ${PROVIDER}] [深度思考] 未找到切换按钮，跳过`);
    return;
  }

  // class 中含 "selected" 即为已开启
  const isSelected = Array.from(btn.classList).some(cls => cls.toLowerCase().includes('selected'));
  logger.log(`[AI Clash ${PROVIDER}] [深度思考] 当前: ${isSelected ? '开启' : '关闭'}，目标: ${enable ? '开启' : '关闭'}`);

  if (isSelected === enable) {
    logger.log(`[AI Clash ${PROVIDER}] [深度思考] 状态一致，无需切换`);
    return;
  }

  btn.click();
  await new Promise(r => setTimeout(r, 500));

  // 验证切换结果
  const nowSelected = Array.from(btn.classList).some(cls => cls.toLowerCase().includes('selected'));
  if (nowSelected === enable) {
    logger.log(`[AI Clash ${PROVIDER}] [深度思考] ✅ 切换成功`);
  } else {
    logger.warn(`[AI Clash ${PROVIDER}] [深度思考] ❌ 切换后状态未变化`);
  }
}

/** 尝试点击「新对话」按钮 */
async function tryStartNewConversation() {
  // 大屏：有 data-desc="new-chat"
  let btn = document.querySelector('[data-desc="new-chat"]');

  // 小屏：无 data-desc，通过图标类名反向找到父容器 .yb-common-nav__trigger
  if (!btn) {
    btn = document.querySelector('.icon-yb-ic_newchat_20')?.closest('.yb-common-nav__trigger');
  }

  if (btn) {
    logger.log(`[AI Clash ${PROVIDER}] 找到新建对话按钮，点击`);
    btn.click();
    await new Promise(r => setTimeout(r, 1500));
    return true;
  }

  logger.log(`[AI Clash ${PROVIDER}] 未找到新建对话按钮，跳过`);
  return false;
}

async function executeYuanbao(prompt, settings = {}) {
  logger.log(`[AI Clash ${PROVIDER}] 开始执行任务...`, settings);
  isTaskRunning = true;
  sendConnecting(PROVIDER);

  if (settings.isNewConversation !== false) {
    await tryStartNewConversation();
  }

  sendStatus(PROVIDER, '正在定位输入框...');

  const inputSelectors = [
    '[contenteditable="true"]',
    'textarea',
    '[role="textbox"]',
    'input[type="text"]',
  ];

  const inputEl = await waitForAnyElement(inputSelectors);

  if (!inputEl) {
    if (taskTimeout) clearTimeout(taskTimeout);
    sendError(PROVIDER, '未找到元宝输入框。请确认已登录 yuanbao.tencent.com。');
    isTaskRunning = false;
    return;
  }

  // 同步深度思考模式
  sendStatus(PROVIDER, '正在同步响应模式...');
  await syncDeepThinkingMode(!!settings.isDeepThinkingEnabled);

  sendStatus(PROVIDER, '正在发送消息...');
  inputEl.focus();

  if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
    fillTextInput(inputEl, prompt);
  } else {
    fillContentEditable(inputEl, prompt);
  }

  setTimeout(async () => {
    let sendBtn = null;

    // 元宝发送按钮固定 id
    sendBtn = document.querySelector('#yuanbao-send-btn');

    if (!sendBtn) {
      sendBtn = document.querySelector('[class*="send-btn"]');
    }

    // 查找包含发送图标的按钮（通过icon-send类定位）
    if (!sendBtn) {
      const sendIcon = document.querySelector('.icon-send');
      if (sendIcon) {
        sendBtn = sendIcon.closest('a, button, [role="button"]');
      }
    }

    if (!sendBtn) {
      sendBtn = document.querySelector('[data-testid*="send"], [data-testid*="submit"]');
    }

    if (!sendBtn) {
      sendBtn = document.querySelector('[aria-label*="发送"], [aria-label*="send"]');
    }

    if (!sendBtn) {
      const el = Array.from(document.querySelectorAll('button, [role="button"], a')).find(
        (e) => { const t = e.textContent?.trim(); return t === '发送' || t === 'Send'; }
      );
      if (el) sendBtn = el;
    }

    if (!sendBtn) {
      let container = inputEl.parentElement;
      for (let i = 0; i < 6 && container; i++) {
        const btns = container.querySelectorAll('button, [role="button"], a[id*="send"], a[class*="send"]');
        if (btns.length > 0) { sendBtn = btns[btns.length - 1]; break; }
        container = container.parentElement;
      }
    }

    if (sendBtn) {
      logger.log(`[AI Clash ${PROVIDER}] 找到发送按钮，尝试触发点击`);
      // 滚动到按钮可见区域
      sendBtn.scrollIntoViewIfNeeded?.();
      sendBtn.focus();

      // 模拟完整的用户点击事件序列（适配静默tab场景）
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0
        });
        sendBtn.dispatchEvent(event);
      });

      // 兜底重试：1秒后如果还没收到首包再点击一次
      setTimeout(() => {
        if (!responseContent && !thinkContent) {
          logger.log(`[AI Clash ${PROVIDER}] 首次点击无响应，重试点击发送按钮`);
          sendBtn.click();
        }
      }, 1000);
    } else {
      logger.log(`[AI Clash ${PROVIDER}] 未找到发送按钮，尝试回车提交`);
      simulateEnter(inputEl);
    }

    sendStatus(PROVIDER, '正在等待回复...');
    startDomObserver(domCtx, PROVIDER, pollYuanbaoDom);
    taskTimeout = setTimeout(() => {
      logger.log(`[AI Clash ${PROVIDER}] 任务全局超时，强制结束`);
      stopDomObserver(domCtx);
      sendError(PROVIDER, '任务执行超时，请检查页面是否正常后重试');
      sendCompleted(PROVIDER);
      isTaskRunning = false;
    }, 90000);
  }, 800);
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
