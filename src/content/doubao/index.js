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

// 标记content script已就绪，供background检查
window.__aiclash_content_script_ready = true;

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
    const isThink = typeof payload === 'object' ? (payload?.isThink ?? false) : false;
    if (!responseContent) console.log(`[AIClash ${PROVIDER}] content 收到首包 CHUNK`, isThink ? '(思考内容)' : '');
    responseContent += text;

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text, stage: 'responding', isThink: isThink }
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
        executeDoubao(request.payload.prompt, request.payload.settings || {});
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

/** 模拟真实用户点击，解决Radix UI按钮点击无响应问题 */
function simulateRealClick(element) {
  if (!element) return;
  // 强制聚焦
  element.focus();
  // 依次派发完整的鼠标事件序列，模拟真实人类点击
  const events = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
    new MouseEvent('click', { bubbles: true, cancelable: true })
  ];
  events.forEach(ev => element.dispatchEvent(ev));
}

/** 切换到思考模式 */
async function switchToDeepThinking() {
  try {
    console.log(`[AIClash ${PROVIDER}] [思考模式切换] 开始执行...`);

    // 找到内部wrapper，然后查找最外层的dropdown触发按钮
    const innerWrapper = await waitForAnyElement(['[data-testid="deep-thinking-action-button"]'], 2000);
    if (!innerWrapper) {
      console.log(`[AIClash ${PROVIDER}] [思考模式切换] 未找到思考模式按钮`);
      return false;
    }

    // 核心：通过closest找到真正的Radix触发器按钮
    const targetBtn = innerWrapper.closest('[data-slot="dropdown-menu-trigger"]') ||
                      innerWrapper.closest('button[aria-haspopup="menu"]') ||
                      innerWrapper.querySelector('button');

    console.log(`[AIClash ${PROVIDER}] [思考模式切换] 找到触发按钮:`, targetBtn.tagName, targetBtn.textContent?.slice(0, 50));

    // 检查当前是否已经是思考模式
    const btnText = targetBtn.textContent || '';
    const isDeepThinking = btnText.includes('思考') || targetBtn.querySelector('button')?.getAttribute('data-checked') === 'true';

    console.log(`[AIClash ${PROVIDER}] [思考模式切换] 当前模式: ${isDeepThinking ? '思考模式' : '快速模式'}`);

    if (isDeepThinking) {
      console.log(`[AIClash ${PROVIDER}] [思考模式切换] 已经是思考模式，无需切换`);
      return true;
    }

    // 使用真实点击模拟展开菜单
    console.log(`[AIClash ${PROVIDER}] [思考模式切换] 模拟真实点击展开菜单...`);
    simulateRealClick(targetBtn);
    await new Promise(r => setTimeout(r, 800)); // 等待菜单展开

    // 查找菜单项（Radix菜单会渲染到body末尾，所以全局查找）
    const menuItems = [
      ...Array.from(document.querySelectorAll('[data-testid*="deep-thinking-action-item"]')),
      ...Array.from(document.querySelectorAll('[role="menuitem"]')),
      ...Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    ];

    console.log(`[AIClash ${PROVIDER}] [思考模式切换] 找到菜单项数量:`, menuItems.length);

    // 找到思考模式选项
    let deepThinkingOption = menuItems.find(el => el.textContent?.includes('思考')) ||
                              menuItems.find(el => el.textContent?.includes('擅长解决更难的问题')) ||
                              document.querySelector('[data-testid="deep-thinking-action-item-1"]');

    if (deepThinkingOption) {
      // 找到真正可点击的菜单项元素（可能在内部）
      const clickableOption = deepThinkingOption.closest('[role="menuitem"]') ||
                              deepThinkingOption.querySelector('[role="menuitem"]') ||
                              deepThinkingOption;

      console.log(`[AIClash ${PROVIDER}] [思考模式切换] 找到思考模式选项，点击切换...`, clickableOption.tagName);
      simulateRealClick(clickableOption); // 同样用真实点击
      await new Promise(r => setTimeout(r, 800)); // 等待切换完成

      // ✅ 最终验证：确认当前是否真的切换到了思考模式
      const updatedBtnText = targetBtn.textContent || '';
      const isReallyDeepThinking = updatedBtnText.includes('思考') || targetBtn.querySelector('button')?.getAttribute('data-checked') === 'true';

      if (isReallyDeepThinking) {
        console.log(`[AIClash ${PROVIDER}] [思考模式切换] ✅ 切换成功！当前模式：思考模式`);
        return true;
      } else {
        console.error(`[AIClash ${PROVIDER}] [思考模式切换] ❌ 切换失败！点击后仍为快速模式`);
        return false;
      }
    } else {
      console.log(`[AIClash ${PROVIDER}] [思考模式切换] 未找到思考模式选项`);
      // 关闭菜单
      simulateRealClick(document.body);
      return false;
    }
  } catch (e) {
    console.warn(`[AIClash ${PROVIDER}] [思考模式切换] 切换失败，异常:`, e);
    return false;
  }
}

/** 切换到快速模式 */
async function switchToFastMode() {
  try {
    console.log(`[AIClash ${PROVIDER}] [快速模式切换] 开始执行...`);

    // 找到内部wrapper，然后查找最外层的dropdown触发按钮
    const innerWrapper = await waitForAnyElement(['[data-testid="deep-thinking-action-button"]'], 2000);
    if (!innerWrapper) {
      console.log(`[AIClash ${PROVIDER}] [快速模式切换] 未找到模式切换按钮`);
      return false;
    }

    // 核心：通过closest找到真正的Radix触发器按钮
    const targetBtn = innerWrapper.closest('[data-slot="dropdown-menu-trigger"]') ||
                      innerWrapper.closest('button[aria-haspopup="menu"]') ||
                      innerWrapper.querySelector('button');

    console.log(`[AIClash ${PROVIDER}] [快速模式切换] 找到触发按钮:`, targetBtn.tagName, targetBtn.textContent?.slice(0, 50));

    // 检查当前是否已经是快速模式
    const btnText = targetBtn.textContent || '';
    const isFastMode = btnText.includes('快速') || targetBtn.querySelector('button')?.getAttribute('data-checked') !== 'true';

    console.log(`[AIClash ${PROVIDER}] [快速模式切换] 当前模式: ${isFastMode ? '快速模式' : '思考模式'}`);

    if (isFastMode) {
      console.log(`[AIClash ${PROVIDER}] [快速模式切换] 已经是快速模式，无需切换`);
      return true;
    }

    // 使用真实点击模拟展开菜单
    console.log(`[AIClash ${PROVIDER}] [快速模式切换] 模拟真实点击展开菜单...`);
    simulateRealClick(targetBtn);
    await new Promise(r => setTimeout(r, 800)); // 等待菜单展开

    // 查找菜单项
    const menuItems = [
      ...Array.from(document.querySelectorAll('[data-testid*="deep-thinking-action-item"]')),
      ...Array.from(document.querySelectorAll('[role="menuitem"]')),
      ...Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'))
    ];

    console.log(`[AIClash ${PROVIDER}] [快速模式切换] 找到菜单项数量:`, menuItems.length);

    // 找到快速模式选项
    const fastModeOption = menuItems.find(el => el.textContent?.includes('快速')) ||
                          menuItems.find(el => el.textContent?.includes('适用于大部分情况')) ||
                          document.querySelector('[data-testid="deep-thinking-action-item-0"]');

    if (fastModeOption) {
      // 找到真正可点击的菜单项元素
      const clickableOption = fastModeOption.closest('[role="menuitem"]') ||
                              fastModeOption.querySelector('[role="menuitem"]') ||
                              fastModeOption;

      console.log(`[AIClash ${PROVIDER}] [快速模式切换] 找到快速模式选项，点击切换...`, clickableOption.tagName);
      simulateRealClick(clickableOption);
      await new Promise(r => setTimeout(r, 800)); // 等待切换完成

      // ✅ 最终验证
      const updatedBtnText = targetBtn.textContent || '';
      const isReallyFastMode = updatedBtnText.includes('快速') || targetBtn.querySelector('button')?.getAttribute('data-checked') !== 'true';

      if (isReallyFastMode) {
        console.log(`[AIClash ${PROVIDER}] [快速模式切换] ✅ 切换成功！当前模式：快速模式`);
        return true;
      } else {
        console.error(`[AIClash ${PROVIDER}] [快速模式切换] ❌ 切换失败！点击后仍为思考模式`);
        return false;
      }
    } else {
      console.log(`[AIClash ${PROVIDER}] [快速模式切换] 未找到快速模式选项`);
      // 关闭菜单
      simulateRealClick(document.body);
      return false;
    }
  } catch (e) {
    console.warn(`[AIClash ${PROVIDER}] [快速模式切换] 切换失败，异常:`, e);
    return false;
  }
}

async function executeDoubao(prompt, settings = {}) {
  console.log(`[AIClash ${PROVIDER}] 开始执行任务...`, settings);
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

  // 强制同步模式：确保页面模式和扩展开关完全一致
  sendStatus(PROVIDER, '正在同步响应模式...');
  if (settings.isDeepThinkingEnabled) {
    // 需要切换到思考模式
    const switchSuccess = await switchToDeepThinking();
    if (!switchSuccess) {
      sendError(PROVIDER, '开启思考模式失败，请手动检查页面是否正常');
      return;
    }
  } else {
    // 需要切换到快速模式
    const switchSuccess = await switchToFastMode();
    if (!switchSuccess) {
      sendError(PROVIDER, '切换到快速模式失败，请手动检查页面是否正常');
      return;
    }
  }

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
