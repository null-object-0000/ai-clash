/**
 * AI Clash Inject - 核心注入器
 */

import type {
  Injector,
  InjectorOptions,
  Capabilities,
  ChatCapability,
  ProviderConfig,
  SendCallbacks,
  SendOptions,
  AuthInfo,
  ToggleAction,
} from './types.js';
import { getProviderConfig, getProviderIds, type ProviderId } from '../providers/index.js';
import {
  findAnyElement,
  waitForAnyElement,
  simulateRealClick,
  wait,
} from './dom-utils.js';

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_GLOBAL_NAME = '__AI_CLASH';
const DEFAULT_CHANNEL_NAME = 'ai-clash-channel';

// ============================================================================
// SSE 拦截器（四路拦截：fetch / XHR / TextDecoder / ReadableStream）
// ============================================================================

interface SSEMonitorState {
  phase: 'THINK' | 'RESPONSE';
  chunkCount: number;
  endSent: boolean;
  buf: string;
  // 完整文本累积（用于 SSE 完成后直接触发 onComplete）
  fullThinkingText: string;
  fullResponseText: string;
  completeCalled: boolean;
}

let sseState: SSEMonitorState = {
  phase: 'RESPONSE',
  chunkCount: 0,
  endSent: false,
  buf: '',
  fullThinkingText: '',
  fullResponseText: '',
  completeCalled: false,
};

let sseCallbacks: {
  onSseChunk?: (
    text: string,
    isThink: boolean,
    stage: 'thinking' | 'responding',
    conversationId?: string
  ) => void;
  onComplete?: (fullText: string, conversationId?: string) => void;
} | null = null;
let sseConversationId: string | undefined;
let currentProvider: ProviderConfig | null = null;
// 保存完整回调引用，用于 SSE 完成触发
let currentCallbacks: SendCallbacks | null = null;

/**
 * 检查文本是否包含任意一个检测关键词
 */
function shouldTrackSSE(text: string): boolean {
  if (!currentProvider?.sse?.detectionKeywords) return false;
  for (const keyword of currentProvider.sse.detectionKeywords) {
    if (text.indexOf(keyword) >= 0) return true;
  }
  return false;
}

function resetSSEState() {
  sseState = {
    phase: 'RESPONSE',
    chunkCount: 0,
    endSent: false,
    buf: '',
    fullThinkingText: '',
    fullResponseText: '',
    completeCalled: false,
  };
}

/**
 * 解析 SSE 行（通用入口）
 */
function parseSSELine(line: string) {
  if (!currentProvider?.sse?.parseLine) return;

  const result = currentProvider.sse.parseLine(line);
  if (!result) return;

  if (result.done) {
    emitSSEEnd();
    return;
  }

  let { text, isThink } = result;

  if (text) {
    // 处理联网搜索标识（DeepSeek 特有）
    if (text.startsWith('FINISHEDSEARCH')) {
      text = '🔍 已联网搜索\n' + text.substring('FINISHEDSEARCH'.length);
    }
    sseState.chunkCount++;
    // 根据 isThink 确定阶段，默认为 responding
    const isThinkBool = isThink ?? false;
    const stage: 'thinking' | 'responding' = isThinkBool ? 'thinking' : 'responding';

    // 累积完整文本
    if (isThinkBool) {
      sseState.fullThinkingText += text;
    } else {
      sseState.fullResponseText += text;
    }

    if (sseCallbacks?.onSseChunk) {
      sseCallbacks.onSseChunk(text, isThinkBool, stage, sseConversationId);
    }
  }
}

function emitSSEEnd() {
  if (sseState.endSent || sseState.completeCalled) return;
  sseState.endSent = true;

  // 如果 SSE 已经累积了内容，优先用 SSE 数据触发 onComplete
  if (sseState.chunkCount > 0 && currentCallbacks?.onComplete) {
    const fullText = buildFullSSEText();
    sseState.completeCalled = true;
    currentCallbacks.onComplete(fullText, sseConversationId);
  }
}

/**
 * 从 SSE 累积的内容构建完整回复文本
 */
function buildFullSSEText(): string {
  const think = sseState.fullThinkingText;
  const resp = sseState.fullResponseText;
  if (!think && !resp) return '';
  if (!think) return resp;
  if (!resp) return `<think>${think}</think>`;
  return `<think>${think}</think>\n\n${resp}`;
}

function isCompletionUrl(url: string): boolean {
  if (!currentProvider?.sse?.urlPattern) return false;
  try {
    const regex = new RegExp(currentProvider.sse.urlPattern);
    return regex.test(url);
  } catch {
    return false;
  }
}

let fetchIntercepted = false;
const rawGetReader = ReadableStream.prototype.getReader;
const rawDecode = TextDecoder.prototype.decode;

function setupSSEInterceptor() {
  // 只在当前 provider 域名下注入一次（修改原型只需要一次）
  if (!currentProvider?.sse) return;
  const domain = currentProvider.domain;
  if (!domain || !location.hostname.includes(domain)) return;
  const alreadyHooked = (window as any).__aiclashSSEHooked;
  if (!alreadyHooked) {
    (window as any).__aiclashSSEHooked = true;
    // ====== fetch 拦截 ======
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      let url = '';
      try {
        const arg0 = args[0];
        url = typeof arg0 === 'string' ? arg0 : (arg0 && (arg0 as Request).url) || '';
      } catch (_) { }

      if (!isCompletionUrl(url)) {
        return origFetch.apply(this, args);
      }

      resetSSEState();
      fetchIntercepted = true;

      return origFetch.apply(this, args).then((response) => {
        if (!response.body) {
          fetchIntercepted = false;
          return response;
        }

        const dec = new TextDecoder('utf-8');
        let buf = '';
        const sourceReader = rawGetReader.call(response.body) as any;

        const readable = new ReadableStream({
          pull: (controller) => {
            return (sourceReader.read() as any).then((result: any) => {
              if (result.done) {
                try { if (buf.trim()) parseSSELine(buf.trim()); } catch (_: any) { }
                emitSSEEnd();
                fetchIntercepted = false;
                controller.close();
                return;
              }
              controller.enqueue(result.value);
              try {
                const chunk = rawDecode.call(dec, result.value, { stream: true });
                buf += chunk;
                const lines = buf.split('\n');
                buf = lines.pop() || '';
                for (let i = 0; i < lines.length; i++) {
                  const t = lines[i].trim();
                  if (t) parseSSELine(t);
                }
              } catch (_: any) { }
            }).catch((err: any) => {
              emitSSEEnd();
              fetchIntercepted = false;
              try { controller.error(err); } catch (_) { }
            });
          },
          cancel: () => {
            fetchIntercepted = false;
            sourceReader.cancel();
          },
        });

        return new Response(readable, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }).catch((err) => {
        fetchIntercepted = false;
        throw err;
      });
    };

    // ====== XHR 拦截 ======
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;
    const rtDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

    XMLHttpRequest.prototype.open = function (method: string, url: any) {
      (this as any)._ab = { url: typeof url === 'string' ? url : '', pos: 0, ended: false };
      return origXhrOpen.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function () {
      const ab = (this as any)._ab;
      if (!ab || !isCompletionUrl(ab.url)) {
        return origXhrSend.apply(this, arguments as any);
      }

      resetSSEState();
      const xhr = this;

      const processNew = (fullText: string) => {
        if (typeof fullText !== 'string' || fullText.length <= ab.pos) return;
        const newData = fullText.substring(ab.pos);
        ab.pos = fullText.length;
        const lines = newData.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const t = lines[i].trim();
          if (t) parseSSELine(t);
        }
      };

      const poller = setInterval(() => {
        try {
          const txt = rtDesc && rtDesc.get ? rtDesc.get.call(xhr) : xhr.responseText;
          if (txt) processNew(txt);
        } catch (_) { }
        if (xhr.readyState === 4) clearInterval(poller);
      }, 50);

      xhr.addEventListener('loadend', () => {
        clearInterval(poller);
        try {
          const txt = rtDesc && rtDesc.get ? rtDesc.get.call(xhr) : xhr.responseText;
          if (txt) processNew(txt);
        } catch (_) { }
        if (!ab.ended) {
          ab.ended = true;
          emitSSEEnd();
        }
      });

      return origXhrSend.apply(this, arguments as any);
    };

    // ====== TextDecoder 拦截 ======
    const origDecode = TextDecoder.prototype.decode;
    const decoderStates = new WeakMap();

    TextDecoder.prototype.decode = function (input, options) {
      const result = origDecode.apply(this, arguments as any);
      if (!result || result.length < 5) return result;
      if (fetchIntercepted) return result;

      let st = decoderStates.get(this);
      if (!st) { st = { tracked: false, rejected: false, buf: '', n: 0 }; decoderStates.set(this, st); }
      if (st.rejected) return result;

      if (!st.tracked) {
        if (shouldTrackSSE(result)) {
          st.tracked = true;
          resetSSEState();
        } else { st.n++; if (st.n > 3) st.rejected = true; return result; }
      }

      st.buf += result;
      const lines = st.buf.split('\n');
      st.buf = lines.pop() || '';
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t) parseSSELine(t);
      }
      return result;
    };

    // ====== ReadableStream 拦截 ======
    const origGetReader = ReadableStream.prototype.getReader;
    ReadableStream.prototype.getReader = function () {
      const reader = origGetReader.apply(this, arguments as any) as any;
      const origRead = reader.read.bind(reader);
      const st: any = { tracked: false, rejected: false, buf: '', dec: new TextDecoder('utf-8'), n: 0 };

      reader.read = function () {
        return (origRead as any)().then((result: any) => {
          if (st.rejected || fetchIntercepted) return result;
          if (result.done) {
            if (st.tracked) { if (st.buf.trim()) parseSSELine(st.buf.trim()); emitSSEEnd(); }
            return result;
          }
          if (!result.value) return result;
          let text;
          try { text = typeof result.value === 'string' ? result.value : rawDecode.call(st.dec, result.value, { stream: true }); }
          catch (_) { st.rejected = true; return result; }

          if (!st.tracked) {
            if (shouldTrackSSE(text)) {
              st.tracked = true; resetSSEState();
            } else { st.n++; if (st.n > 3) st.rejected = true; return result; }
          }

          st.buf += text;
          const lines = st.buf.split('\n');
          st.buf = lines.pop() || '';
          for (let i = 0; i < lines.length; i++) { const t = lines[i].trim(); if (t) parseSSELine(t); }
          return result;
        });
      };
      return reader;
    };
  }
}

// ============================================================================
// 工具函数
// ============================================================================

// 注意：wait 函数已从 dom-utils.js 导入

/**
 * 从 URL 提取会话 ID
 */
function getConversationIdFromUrl(provider: ProviderConfig): string | undefined {
  const config = provider.conversation?.idFromUrl;
  if (!config) return undefined;

  // 先从 pathname 提取，如果失败再尝试 hash（支持 hash 路由如 MiMo）
  const urlParts = [window.location.pathname, window.location.hash];
  const pattern = config.pattern;
  const excludePattern = config.excludePattern;

  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      for (const urlPart of urlParts) {
        const match = urlPart.match(regex);
        if (match) {
          const group = config.captureGroup ?? 1;
          let id: string | undefined;
          if (typeof group === 'number') {
            id = match[group];
          } else if (typeof group === 'string') {
            id = (match as any).groups?.[group];
          } else {
            id = match[1];
          }
          // 检查是否需要排除
          if (id && excludePattern) {
            try {
              const excludeRegex = new RegExp(excludePattern);
              if (excludeRegex.test(id)) {
                continue;
              }
            } catch {
              // excludePattern 正则无效，忽略
            }
          }
          return id;
        }
      }
      return undefined;
    } catch {
      // 正则无效，返回 undefined
    }
  }

  // 没有配置 pattern，尝试从 pathname 最后一段提取
  const segments = pathname.split('/').filter(Boolean);
  let id = segments.length > 0 ? segments[segments.length - 1] : undefined;

  // 检查是否需要排除
  if (id && excludePattern) {
    try {
      const excludeRegex = new RegExp(excludePattern);
      if (excludeRegex.test(id)) {
        return undefined;
      }
    } catch {
      // excludePattern 正则无效，忽略
    }
  }

  return id;
}

/**
 * 从 DOM 提取会话 ID
 */
function getConversationIdFromDom(provider: ProviderConfig): string | undefined {
  const config = provider.conversation?.idFromDom;
  if (!config) return undefined;

  const el = document.querySelector(config.selector);
  if (!el) return undefined;

  const attr = config.attribute || 'textContent';
  if (attr === 'textContent') {
    return el.textContent?.trim() || undefined;
  }
  return (el as HTMLElement).getAttribute(attr) || undefined;
}

/**
 * 获取当前会话 ID（优先从 URL，其次从 DOM）
 */
function getConversationId(provider: ProviderConfig): string | undefined {
  // 先从 URL 提取
  let id = getConversationIdFromUrl(provider);
  if (id) return id;

  // 再从 DOM 提取
  id = getConversationIdFromDom(provider);
  return id;
}

/**
 * 等待会话 ID 出现（轮询 URL 变化）
 */
async function waitForConversationId(
  provider: ProviderConfig,
  timeout = 5000
): Promise<string | undefined> {
  const start = Date.now();

  // 先尝试立即获取
  let id = getConversationId(provider);
  if (id) return id;

  // 轮询等待
  while (Date.now() - start < timeout) {
    await wait(100);
    id = getConversationId(provider);
    if (id) return id;
  }

  return undefined;
}
/**
 * 监听 AI 回复（仅 SSE 拦截）
 *
 * @param callbacks - 流式回调
 * @param provider - 提供者配置
 */
function monitorResponse(
  callbacks: SendCallbacks,
  provider: ProviderConfig
): void {
  // 设置 SSE 拦截器的回调，保存完整 callbacks 引用
  sseCallbacks = {
    onSseChunk: callbacks.onSseChunk,
    onComplete: callbacks.onComplete,
  };
  currentCallbacks = callbacks;
  // 注意：不覆盖 sseConversationId，由 _send 方法在调用 setupSSEInterceptor 前设置
}

// ============================================================================

/**
 * DOM 监听状态
 */
// 注意：findElement, findAnyElement, waitForElement, waitForAnyElement,
// 能力实现工厂
// ============================================================================

/**
 * 创建基础对话能力
 */
function createChatCapability(provider: ProviderConfig): ChatCapability {
  const { chat } = provider.actions;

  return {
    async newChat() {
      const target = await waitForAnyElement(chat.newChat.button, 3000);
      if (!target) {
        return { success: false, reason: 'button-not-found' };
      }
      (target as HTMLElement).click();
      await wait(600);
      return { success: true };
    },

    async fill(text: string) {
      const el = await waitForAnyElement(chat.input.box);
      if (!el) {
        return { success: false, reason: 'input-not-found' };
      }

      const htmlEl = el as HTMLElement;
      htmlEl.focus();
      await wait(100);

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        fillTextInput(htmlEl, text);
      } else {
        await fillContentEditable(htmlEl, text);
      }

      return { success: true };
    },

    async send(
      callbacksOrMessage?: SendCallbacks | string,
      optionsOrCallbacks?: SendOptions | SendCallbacks,
      maybeCallbacks?: SendCallbacks
    ) {
      // 处理重载：判断第一个参数是否为字符串，是则为封装调用
      const isFullSend = typeof callbacksOrMessage === 'string';

      let callbacks: SendCallbacks | undefined;
      let message: string | undefined;
      let options: SendOptions | undefined;

      if (isFullSend) {
        message = callbacksOrMessage;
        options = (optionsOrCallbacks as SendOptions) || {};
        callbacks = maybeCallbacks;
      } else {
        callbacks = callbacksOrMessage as SendCallbacks | undefined;
      }

      // === 封装模式：执行完整流程 ===
      if (isFullSend && message) {
        // 1. 如果需要新对话，先开启新对话
        if (options?.newChat) {
          const newChatResult = await this.newChat();
          if (!newChatResult.success) {
            return {
              success: false,
              reason: `new-chat-failed: ${newChatResult.reason}`,
            };
          }
          await wait(500);
        }

        // 2. 如果指定了思考模式，同步思考模式
        if (options?.thinking !== undefined && provider.actions.thinking) {
          const thinking = createThinkingCapability(provider);
          if (thinking) {
            await (options.thinking ? thinking.enable() : thinking.disable());
            await wait(300);
          }
        }

        // 3. 如果指定了搜索模式，同步搜索模式
        if (options?.search !== undefined && provider.actions.search) {
          const search = createSearchCapability(provider);
          if (search) {
            await (options.search ? search.enable() : search.disable());
            await wait(300);
          }
        }

        // 4. 填充消息
        const fillResult = await this.fill(message);
        if (!fillResult.success) {
          return {
            success: false,
            reason: `fill-failed: ${fillResult.reason}`,
          };
        }
        await wait(200);
      }

      // 调用基础发送
      return this._send(callbacks);
    },

    /**
     * 基础发送 - 不处理选项填充，直接发送
     * @internal
     */
    async _send(callbacks?: SendCallbacks) {
      console.log(`[AI Clash Inject] ${provider.id}: _send 开始执行，等待输入框...`);
      const inputEl = await waitForAnyElement(chat.input.box, 8000);
      console.log(`[AI Clash Inject] ${provider.id}: 输入框${inputEl ? '找到' : '未找到'}`);

      // 查找发送按钮 - 优先使用 customFind 方法（用于需要特殊验证的场景如 MiMo）
      let sendBtn: Element | null = null;
      if (chat.send.customFind) {
        sendBtn = chat.send.customFind();
      } else {
        sendBtn = findAnyElement(chat.send.button);
      }
      console.log(`[AI Clash Inject] ${provider.id}: 发送按钮${sendBtn ? '找到' : '未找到'}`);

      // 如果有回调，先设置 SSE 拦截器和回调（在点击按钮前）
      // 必须提前设置，否则 SSE 数据到达时回调还是 null 会丢失
      if (callbacks) {
        // 设置当前 provider 供 SSE 拦截器使用
        currentProvider = provider;
        // 设置 SSE 拦截器的回调
        monitorResponse(callbacks, provider);
        // 设置 SSE 拦截器（只在对应域名下注入一次）
        setupSSEInterceptor();
      }

      // 点击发送按钮
      if (sendBtn) {
        simulateRealClick(sendBtn);
        console.log(`[AI Clash Inject] ${provider.id}: 已点击发送按钮`);
        // 清空输入框（千问等不会自动清空的网站需要手动清空）
        await wait(300);
        if (inputEl) {
          if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            (inputEl as HTMLInputElement).value = '';
          } else {
            inputEl.textContent = '';
          }
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(`[AI Clash Inject] ${provider.id}: 已清空输入框`);
        }
      } else if (inputEl) {
        simulateEnter(inputEl);
        console.log(`[AI Clash Inject] ${provider.id}: 已模拟回车发送`);
      } else {
        console.error(`[AI Clash Inject] ${provider.id}: 无法发送消息 - 没有输入框或发送按钮`);
        return { success: false, reason: 'no-button-no-input' };
      }

      // 等待会话 ID 出现（发送后 URL 会变化）
      // 千问等 SPA 应用第一次请求可能需要较长时间，给 8 秒超时
      console.log(`[AI Clash Inject] ${provider.id}: 开始等待会话 ID...`);
      const conversationId = await waitForConversationId(provider, 8000);

      if (!conversationId) {
        console.warn(`[AI Clash Inject] ${provider.id}: 等待会话 ID 超时 (8s)，当前 URL:`, window.location.href);
        // 没有获取到会话 ID，视为失败
        if (callbacks?.onError) {
          callbacks.onError('未能获取会话 ID', undefined);
        }
        return {
          success: false,
          reason: 'no-conversation-id',
          method: sendBtn ? 'button' : 'enter',
        };
      }

      console.log(`[AI Clash Inject] ${provider.id}: ✓ 获取到会话 ID:`, conversationId);

      // 触发会话 ID 回调
      callbacks?.onConversationId?.(conversationId);

      // 设置 SSE 拦截器的会话 ID
      if (callbacks) {
        sseConversationId = conversationId;
      }

      return {
        success: true,
        method: sendBtn ? 'button' : 'enter',
        conversationId,
      };
    },
  };
}

function fillTextInput(el: HTMLElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;
  if (setter) setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fillContentEditable(el: HTMLElement, text: string): Promise<void> {
  el.focus();
  await wait(100);

  // 尝试使用 execCommand
  document.execCommand('selectAll', false, null as any);
  document.execCommand('delete', false, null as any);
  await wait(100);

  // 对于 Slate、Draft 等特殊 React/Vue 编辑器（通常这些都不会响应简单的 innerText 赋值），
  // 模拟一次逼真的 ClipboardEvent('paste') 往往是最有效的通用方案。
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });
    
    // 如果阻止了默认行为，说明网页自己接管了 paste
    const prevented = !el.dispatchEvent(pasteEvent);
    if (prevented) {
      // 成功触发拦截
      return;
    }
  } catch {
    // 兜底
  }

  // 最后的一道兜底：原生赋值（可能会在某些 React 编辑器里敲下一个键就被重置）
  el.innerText = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function simulateEnter(el: Element): void {
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  }));
}

// 注意：simulateRealClick 函数已从 dom-utils.js 导入

/**
 * 创建思考模式切换能力
 */
function createThinkingCapability(provider: ProviderConfig): Capabilities['thinking'] {
  const { actions } = provider;
  const thinking = actions.thinking;

  if (!thinking) {
    return undefined;
  }

  const impl = thinking as ToggleAction;
  return {
    async getState() {
      return impl.getState();
    },
    async enable() {
      const current = await impl.getState();
      if (!current.found) {
        return { success: false, changed: false, reason: 'not-found' };
      }
      if (current.enabled) {
        return { success: true, changed: false };
      }
      const success = await impl.enable();
      return { success, changed: success };
    },
    async disable() {
      const current = await impl.getState();
      if (!current.found) {
        return { success: false, changed: false, reason: 'not-found' };
      }
      if (!current.enabled) {
        return { success: true, changed: false };
      }
      const success = await impl.disable();
      return { success, changed: success };
    },
  };
}

/**
 * 创建智能搜索切换能力
 */
function createSearchCapability(provider: ProviderConfig): Capabilities['search'] {
  const { actions } = provider;
  const search = actions.search;

  if (!search) {
    return undefined;
  }

  const impl = search as ToggleAction;
  return {
    async getState() {
      return impl.getState();
    },
    async enable() {
      const current = await impl.getState();
      if (!current.found) {
        return { success: false, changed: false, reason: 'not-found' };
      }
      if (current.enabled) {
        return { success: true, changed: false };
      }
      const success = await impl.enable();
      return { success, changed: success };
    },
    async disable() {
      const current = await impl.getState();
      if (!current.found) {
        return { success: false, changed: false, reason: 'not-found' };
      }
      if (!current.enabled) {
        return { success: true, changed: false };
      }
      const success = await impl.disable();
      return { success, changed: success };
    },
  };
}

/**
 * 创建 Auth 能力（获取登录信息）
 */
function createAuthCapability(provider: ProviderConfig): Capabilities['auth'] {
  const { actions } = provider;
  const auth = actions.auth;

  if (!auth) {
    return undefined;
  }

  return {
    async getInfo(): Promise<AuthInfo> {
      // 检查是否已登录：只要 loggedInSelectors 中任意一个元素存在即视为已登录
      const loggedInEl = findAnyElement(auth.loggedInSelectors);
      if (!loggedInEl) {
        return { loggedIn: false };
      }

      // 提取用户名
      let username: string | undefined;
      if (auth.usernameSelectors) {
        const usernameEl = findAnyElement(auth.usernameSelectors);
        if (usernameEl) {
          username = usernameEl.textContent?.trim() || undefined;
        }
      }

      // 提取头像 URL
      let avatarUrl: string | undefined;
      if (auth.avatarSelectors) {
        const avatarEl = findAnyElement(auth.avatarSelectors);
        if (avatarEl && avatarEl.tagName === 'IMG') {
          avatarUrl = (avatarEl as HTMLImageElement).src || (avatarEl as HTMLImageElement).dataset.src || undefined;
        }
      }

      return {
        loggedIn: true,
        username,
        avatarUrl,
      };
    },
  };
}

/**
 * 创建完整能力对象
 */
function createCapabilities(provider: ProviderConfig): Capabilities {
  return {
    chat: createChatCapability(provider),
    thinking: createThinkingCapability(provider),
    search: createSearchCapability(provider),
    auth: createAuthCapability(provider),
    // model: createModelCapability(provider), // TODO: 实现模型切换能力
  };
}

// ============================================================================
// 适配器实现
// ============================================================================

/**
 * Window 适配器 - 暴露到全局变量
 */
function createWindowAdapter(
  capabilities: Capabilities,
  globalName: string
): { setup(): void; cleanup(): void } {
  const originalValue = (window as any)[globalName];

  // 创建 RPC 处理
  const callHandler = async (event: Event) => {
    const customEvent = event as CustomEvent<{ callId: string; path: string; args: any[] }>;
    const { callId, path, args } = customEvent.detail;
    try {
      const [capName, method] = path.split('.');
      const cap = capabilities[capName as keyof Capabilities];
      const result = cap && typeof (cap as any)[method] === 'function'
        ? await (cap as any)[method](...(args || []))
        : undefined;
      window.dispatchEvent(new CustomEvent(`${globalName}_result`, {
        detail: { callId, result },
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent(`${globalName}_result`, {
        detail: { callId, error: String(err) },
      }));
    }
  };

  return {
    setup() {
      window.addEventListener(`${globalName}_call`, callHandler as EventListener);
      (window as any)[globalName] = {
        chat: capabilities.chat,
        thinking: capabilities.thinking,
        search: capabilities.search,
        auth: capabilities.auth,
        _isInjected: true,
      };
    },
    cleanup() {
      window.removeEventListener(`${globalName}_call`, callHandler as EventListener);
      if (originalValue !== undefined) {
        (window as any)[globalName] = originalValue;
      } else {
        delete (window as any)[globalName];
      }
    },
  };
}

/**
 * Extension 适配器 - Chrome 扩展消息通信
 */
function createExtensionAdapter(
  capabilities: Capabilities,
  provider: string
): { setup(): void; cleanup(): void } {
  const messageHandler = (request: any, _sender: any, sendResponse: (resp: any) => void) => {
    if (request.type !== 'INJECT_CALL') {
      sendResponse({ ok: false, reason: 'unknown-type' });
      return true;
    }

    const { capability, method, args } = request;
    const cap = capabilities[capability as keyof Capabilities];

    if (!cap || typeof (cap as any)[method] !== 'function') {
      sendResponse({ ok: false, reason: 'unknown-method' });
      return true;
    }

    Promise.resolve()
      .then(() => (cap as any)[method](...(args || [])))
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));

    return true;
  };

  return {
    setup() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(messageHandler);
      }
    },
    cleanup() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageHandler);
      }
    },
  };
}

/**
 * WebSocket 客户端适配器
 */
function createWsAdapter(
  capabilities: Capabilities,
  wsUrl: string,
  provider: string
): { setup(): void; cleanup(): void; connect(): Promise<void> } {
  let ws: WebSocket | null = null;
  let connectionPromise: Promise<void> | null = null;

  const handleRpc = async (data: any) => {
    const { callId, capability, method, args } = data;
    const cap = capabilities[capability as keyof Capabilities];

    if (!cap || typeof (cap as any)[method] !== 'function') {
      ws?.send(JSON.stringify({ callId, error: 'Unknown method' }));
      return;
    }

    try {
      const result = await (cap as any)[method](...(args || []));
      ws?.send(JSON.stringify({ callId, result }));
    } catch (err) {
      ws?.send(JSON.stringify({ callId, error: String(err) }));
    }
  };

  return {
    setup() {
      // 延迟连接
    },
    cleanup() {
      if (ws) {
        ws.close();
        ws = null;
      }
    },
    async connect() {
      if (connectionPromise) return connectionPromise;

      connectionPromise = new Promise((resolve, reject) => {
        try {
          ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log(`[AI Clash Inject] WebSocket connected to ${wsUrl}`);
            resolve();
          };

          ws.onerror = () => {
            reject(new Error('WebSocket connection failed'));
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleRpc(data);
            } catch (err) {
              console.error('[AI Clash Inject] RPC parse error:', err);
            }
          };

          ws.onclose = () => {
            console.log('[AI Clash Inject] WebSocket closed');
            ws = null;
            connectionPromise = null;
          };
        } catch (err) {
          reject(err);
          connectionPromise = null;
        }
      });

      return connectionPromise;
    },
  };
}

/**
 * BroadcastChannel 适配器
 */
function createBroadcastAdapter(
  capabilities: Capabilities,
  channelName: string
): { setup(): void; cleanup(): void } {
  let channel: BroadcastChannel | null = null;

  const handleRpc = async (data: any) => {
    const { callId, capability, method, args } = data;
    const cap = capabilities[capability as keyof Capabilities];

    if (!cap || typeof (cap as any)[method] !== 'function') {
      channel?.postMessage({ callId, error: 'Unknown method' });
      return;
    }

    try {
      const result = await (cap as any)[method](...(args || []));
      channel?.postMessage({ callId, result });
    } catch (err) {
      channel?.postMessage({ callId, error: String(err) });
    }
  };

  return {
    setup() {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(channelName);
        channel.onmessage = (event) => {
          handleRpc(event.data);
        };
      }
    },
    cleanup() {
      if (channel) {
        channel.close();
        channel = null;
      }
    },
  };
}

// ============================================================================
// 主注入器
// ============================================================================

export function createInjector(options: InjectorOptions): Injector {
  const {
    provider: providerId,
    adapter = 'window',
    wsUrl,
    globalName = DEFAULT_GLOBAL_NAME,
    channelName = DEFAULT_CHANNEL_NAME,
  } = options;

  let capabilities: Capabilities | null = null;
  let adapterCleanup: (() => void) | null = null;
  let isInjected = false;

  const provider = getProviderConfig(providerId as ProviderId);

  if (!provider) {
    const availableIds = getProviderIds().join(', ');
    throw new Error(`Unknown provider: ${providerId}. Available providers: ${availableIds}`);
  }

  function setupCapabilities() {
    capabilities = createCapabilities(provider!);
  }

  function setupAdapter(): Promise<void> {
    switch (adapter) {
      case 'window': {
        if (!capabilities) throw new Error('Capabilities not initialized');
        const { setup } = createWindowAdapter(capabilities, globalName);
        setup();
        adapterCleanup = () => { /* cleanup handled in eject */ };
        return Promise.resolve();
      }
      case 'extension': {
        if (!capabilities) throw new Error('Capabilities not initialized');
        const { setup } = createExtensionAdapter(capabilities, providerId);
        setup();
        adapterCleanup = () => { /* cleanup handled in eject */ };
        return Promise.resolve();
      }
      case 'ws': {
        if (!capabilities) throw new Error('Capabilities not initialized');
        if (!wsUrl) throw new Error('wsUrl is required for ws adapter');
        const wsAdapter = createWsAdapter(capabilities, wsUrl, providerId);
        adapterCleanup = wsAdapter.cleanup;
        return wsAdapter.connect();
      }
      case 'broadcast': {
        if (!capabilities) throw new Error('Capabilities not initialized');
        const { setup, cleanup } = createBroadcastAdapter(capabilities, channelName);
        setup();
        adapterCleanup = cleanup;
        return Promise.resolve();
      }
      default:
        throw new Error(`Unknown adapter type: ${adapter}`);
    }
  }

  return {
    async inject() {
      if (isInjected) {
        console.warn('[AI Clash Inject] Already injected');
        return;
      }

      setupCapabilities();
      await setupAdapter();
      isInjected = true;
      console.log(`[AI Clash Inject] Injected for provider: ${providerId}`);
    },

    eject() {
      if (!isInjected) return;

      if (adapterCleanup) {
        adapterCleanup();
        adapterCleanup = null;
      }

      // 清理全局变量
      if (adapter === 'window') {
        delete (window as any)[globalName];
      }

      capabilities = null;
      isInjected = false;
      console.log('[AI Clash Inject] Ejected');
    },

    async call(capability: string, method: string, ...args: any[]) {
      if (!capabilities) {
        throw new Error('Not injected yet. Call inject() first.');
      }

      const cap = capabilities[capability as keyof Capabilities];
      if (!cap || typeof (cap as any)[method] !== 'function') {
        throw new Error(`Unknown capability or method: ${capability}.${method}`);
      }

      return (cap as any)[method](...(args || []));
    },
  };
}
