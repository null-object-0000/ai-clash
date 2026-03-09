import { MSG_TYPES } from '../shared/messages.ts';

// ============================================================================
// 第一部分：尽早注入 hook 到 MAIN world
// ============================================================================
console.log('[AnyBridge] content script 已在该页运行（document_start）');

/** 检测扩展上下文是否仍有效 */
function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** 静默发送消息，忽略"Receiving end does not exist"及上下文失效错误 */
function safeSend(msg: Record<string, unknown>, callback?: (resp: any) => void) {
  if (!isContextValid()) return;
  try {
    chrome.runtime.sendMessage(msg, (resp) => {
      // 读一下 lastError 即可清除，避免 Uncaught error
      void chrome.runtime.lastError;
      callback?.(resp);
    });
  } catch {
    // Extension context invalidated — 静默忽略
  }
}

// hook.js 已由 background 通过 registerContentScripts(world:'MAIN') 注入
// 这里不再通过 <script> 标签重复注入，避免 SyntaxError: Identifier already declared
// 仅作为兜底：如果 background 注册失败，通过 scripting.executeScript 补救
if (isContextValid()) {
  safeSend({ type: MSG_TYPES.INJECT_HOOK }, (response) => {
    if (response?.ok) {
      console.log('[AnyBridge] hook 已通过 scripting API 兜底注入');
    }
    // 若 response 为空或失败，说明 background 的 registerContentScripts 已生效，无需额外操作
  });
}

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
    hookDataReceived = true; // 标记网络层 hook 有数据，优先使用
    const payload = event.data.payload;
    const isThink = typeof payload === 'object' && payload && payload.isThink === true;
    const text = typeof payload === 'string' ? payload : (payload?.text ?? "");
    if (!thinkContent && !responseContent) console.log('[AnyBridge] content 收到首包 CHUNK');
    if (isThink) thinkContent += text; else responseContent += text;

    // 发送增量而不是完整文本，避免 sidepanel 中数据重复
    const stage = responseContent ? 'responding' : 'thinking';
    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: 'deepseek', text: text, stage, isThink }
    });
  }
  else if (event.data.type === 'DEEPSEEK_HOOK_END') {
    console.log('[AnyBridge] content 收到 END');
    stopDomObserver(); // 停止 DOM 观测
    const full = buildDisplayText();
    if (!full) {
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: 'deepseek', text: '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）' }
      });
    }
    safeSend({
      type: MSG_TYPES.TASK_COMPLETED,
      payload: { provider: 'deepseek' }
    });
  }
});

// ============================================================================
// DOM MutationObserver 兜底 — 如果网络层 hook 无数据，直接观测页面渲染
// ============================================================================
let hookDataReceived = false;
let domObserver: MutationObserver | null = null;
let domObserverTimer: ReturnType<typeof setInterval> | null = null;
let lastObservedText = '';

function stopDomObserver() {
  if (domObserver) { domObserver.disconnect(); domObserver = null; }
  if (domObserverTimer) { clearInterval(domObserverTimer); domObserverTimer = null; }
  lastObservedText = '';
}

/** 尝试从 DOM 读取最新的 AI 回复，发送增量 */
function pollDomForResponse() {
  if (hookDataReceived) return; // 网络层 hook 有数据，跳过 DOM 观测

  // DeepSeek 的回复渲染在 .ds-markdown--block 容器中，取最后一个（最新回复）
  const blocks = document.querySelectorAll('.ds-markdown--block');
  if (blocks.length === 0) return;
  const last = blocks[blocks.length - 1];
  const currentText = last.textContent || '';
  if (currentText.length > lastObservedText.length) {
    const newText = currentText.substring(lastObservedText.length);
    lastObservedText = currentText;
    // 首次检测到内容
    if (!responseContent && !thinkContent) {
      console.log('[AnyBridge] DOM 兜底检测到首段文本');
    }
    responseContent += newText;
    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: 'deepseek', text: newText, stage: 'responding', isThink: false }
    });
  }
}

function startDomObserver() {
  stopDomObserver();
  hookDataReceived = false;
  lastObservedText = '';

  // MutationObserver 只用来触发检查，实际读取用定时器控制频率
  domObserver = new MutationObserver(() => {
    pollDomForResponse();
  });
  domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  // 同时以 200ms 间隔主动 poll，避免 MutationObserver 不触发的边界情况
  domObserverTimer = setInterval(pollDomForResponse, 200);

  // 超时保护：60 秒后自动停止（完成信号可能丢失）
  setTimeout(() => {
    if (domObserver) {
      console.log('[AnyBridge] DOM 观测超时，自动停止');
      stopDomObserver();
    }
  }, 60000);
}

// ============================================================================
// 第二部分：UI 模拟操作 (填入文本与发送)
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
    console.warn('[AnyBridge] 注册消息监听失败，扩展上下文已失效');
  }
}

async function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
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
      (clickable as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  // 策略 2：通过加号图标 SVG path 特征查找（新对话图标，16px 与 20px 两种）
  const iconBtns = document.querySelectorAll('.ds-icon-button[role="button"][aria-disabled="false"]');
  for (const btn of Array.from(iconBtns)) {
    const path = btn.querySelector('svg path');
    const d = path?.getAttribute('d') ?? '';
    const isPlusIcon = (d.includes('4.93945') && d.includes('7.34961')) || (d.includes('6.36949') && d.includes('9.22487'));
    if (isPlusIcon) {
      (btn as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }
  return false;
}

/** 同步 DeepSeek 页面的「深度思考」开关状态 */
async function syncDeepThinkToggle(wantEnabled: boolean) {
  // 「深度思考」按钮是 .ds-toggle-button，文本包含「深度思考」
  const toggleBtns = document.querySelectorAll('.ds-toggle-button[role="button"]');
  for (const btn of Array.from(toggleBtns)) {
    const label = btn.textContent?.trim();
    if (label && label.includes('深度思考')) {
      const isSelected = btn.classList.contains('ds-toggle-button--selected');
      if (wantEnabled !== isSelected) {
        (btn as HTMLElement).click();
        console.log(`[AnyBridge] 深度思考: ${isSelected ? 'ON→OFF' : 'OFF→ON'}`);
        await new Promise(r => setTimeout(r, 300));
      } else {
        console.log(`[AnyBridge] 深度思考已处于期望状态: ${wantEnabled ? 'ON' : 'OFF'}`);
      }
      return;
    }
  }
  console.warn('[AnyBridge] 未找到深度思考按钮');
}

async function executeDeepSeek(prompt: string, settings?: { isDeepThinkingEnabled?: boolean }) {
  // 0. 每次对话前先尝试开启新对话
  console.log('[AnyBridge] 开始执行 DeepSeek 任务...');
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider: 'deepseek', text: '', stage: 'connecting' }
  });

  await tryStartNewConversation();

  // 0.5 同步深度思考开关
  const deepThinkWanted = settings?.isDeepThinkingEnabled ?? true;
  await syncDeepThinkToggle(deepThinkWanted);

  // 1. 寻找输入框
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider: 'deepseek', text: '正在定位输入框...', stage: 'connecting', isStatus: true }
  });
  const textarea = await waitForElement('textarea') as HTMLTextAreaElement | null;

  if (!textarea) {
    safeSend({
      type: MSG_TYPES.ERROR,
      payload: { provider: 'deepseek', message: '未找到 DeepSeek 输入框。请确认已登录。' }
    });
    return;
  }

  // 2. 强制聚焦
  safeSend({
    type: MSG_TYPES.CHUNK_RECEIVED,
    payload: { provider: 'deepseek', text: '正在发送消息...', stage: 'connecting', isStatus: true }
  });
  textarea.focus();

  // 3. 绕过 React 绑定直接赋值
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(textarea, prompt);
  }
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
      for (const btn of Array.from(allIconBtns)) {
        const path = btn.querySelector('svg path');
        if (path && path.getAttribute('d')?.includes('0.981587')) {
          sendBtn = btn as HTMLElement;
          break;
        }
      }
    }

    if (sendBtn) {
      (sendBtn as HTMLElement).focus();
      (sendBtn as HTMLElement).click();
      // 发送按钮点击后，显示等待回复阶段
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: 'deepseek', text: '正在等待回复...', stage: 'connecting', isStatus: true }
      });
      // 启动 DOM 兜底观测（如果网络层 hook 无数据，将自动从 DOM 读取）
      startDomObserver();
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
      // 模拟回车发送后，也显示等待回复阶段
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: 'deepseek', text: '正在等待回复...', stage: 'connecting', isStatus: true }
      });
      startDomObserver();
    }
  }, 800);
}