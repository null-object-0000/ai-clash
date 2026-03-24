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
  ThinkingCapability,
  SearchCapability,
} from './types.js';
import { getProviderConfig, type ProviderId } from '../providers/index.js';

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
}

let sseState: SSEMonitorState = {
  phase: 'RESPONSE',
  chunkCount: 0,
  endSent: false,
  buf: '',
};

let sseCallbacks: {
  onSseChunk?: (
    text: string,
    isThink: boolean,
    stage: 'thinking' | 'responding',
    conversationId?: string
  ) => void
} | null = null;
let sseConversationId: string | undefined;
let currentProvider: ProviderConfig | null = null;

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
  };
}

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
    if (sseCallbacks?.onSseChunk) {
      sseCallbacks.onSseChunk(text, isThinkBool, stage, sseConversationId);
    }
  }
}

function emitSSEEnd() {
  if (sseState.endSent) return;
  sseState.endSent = true;
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
  // 只在 DeepSeek 域名下注入一次
  if (!location.hostname.includes('deepseek')) return;
  if ((window as any).__aiclashSSEHooked) return;
  (window as any).__aiclashSSEHooked = true;

  // ====== fetch 拦截 ======
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    let url = '';
    try {
      const arg0 = args[0];
      url = typeof arg0 === 'string' ? arg0 : (arg0 && (arg0 as Request).url) || '';
    } catch (_) {}

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
              try { if (buf.trim()) parseSSELine(buf.trim()); } catch (_: any) {}
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
            } catch (_: any) {}
          }).catch((err: any) => {
            emitSSEEnd();
            fetchIntercepted = false;
            try { controller.error(err); } catch (_) {}
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
      } catch (_) {}
      if (xhr.readyState === 4) clearInterval(poller);
    }, 50);

    xhr.addEventListener('loadend', () => {
      clearInterval(poller);
      try {
        const txt = rtDesc && rtDesc.get ? rtDesc.get.call(xhr) : xhr.responseText;
        if (txt) processNew(txt);
      } catch (_) {}
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

// ============================================================================
// 工具函数
// ============================================================================

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 从 URL 提取会话 ID
 */
function getConversationIdFromUrl(provider: ProviderConfig): string | undefined {
  const config = provider.conversation?.idFromUrl;
  if (!config) return undefined;

  const url = window.location.href;
  const pattern = config.pattern;

  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      const match = url.match(regex);
      if (match) {
        const group = config.captureGroup ?? 1;
        if (typeof group === 'number') {
          return match[group];
        } else if (typeof group === 'string') {
          return (match as any).groups?.[group];
        }
        return match[1];
      }
    } catch {
      // 正则无效，返回 undefined
    }
  }

  // 没有配置 pattern，尝试从 pathname 最后一段提取
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
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
 * DOM 监听状态
 */
interface MonitorState {
  lastText: string;
  lastThinkText: string;
  isComplete: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * 获取元素文本
 */
function getElementText(el: Element | null): string {
  if (!el) return '';
  return (el as HTMLElement).innerText || el.textContent || '';
}

/**
 * 查找最新的回复块
 */
function findLatestResponseBlock(provider: ProviderConfig): { text: string; thinkText: string } | null {
  // 先找思考块
  let thinkText = '';
  const thinkingSelectors = provider.response?.thinkingSelectors || [];
  for (const selector of thinkingSelectors) {
    const blocks = document.querySelectorAll(selector);
    if (blocks.length > 0) {
      thinkText = getElementText(blocks[blocks.length - 1]);
      break;
    }
  }

  // 再找回复块
  let text = '';
  const responseSelectors = provider.response?.responseSelectors || [];
  for (const selector of responseSelectors) {
    const blocks = document.querySelectorAll(selector);
    if (blocks.length > 0) {
      text = getElementText(blocks[blocks.length - 1]);
      break;
    }
  }

  // 如果还是没找到，尝试通用选择器
  if (!text && !thinkText) {
    const allBlocks = document.querySelectorAll('[role="article"] [class*="message"]:last-child [class*="content"]');
    if (allBlocks.length > 0) {
      text = getElementText(allBlocks[allBlocks.length - 1]);
    }
  }

  return { text, thinkText };
}

/**
 * 监听 AI 回复（DOM 轮询 + SSE 拦截）
 *
 * @param callbacks - 流式回调
 * @param provider - 提供者配置
 */
function monitorResponse(
  callbacks: SendCallbacks,
  provider: ProviderConfig
): void {
  // 设置 SSE 拦截器的回调
  sseCallbacks = { onSseChunk: callbacks.onSseChunk };
  // 注意：不覆盖 sseConversationId，由 _send 方法在调用 setupSSEInterceptor 前设置

  // 同时启动 DOM 轮询监听
  monitorResponseDom(callbacks, provider);
}

/**
 * 监听 AI 回复 - DOM 轮询版本
 */
function monitorResponseDom(
  callbacks: SendCallbacks,
  provider: ProviderConfig
): void {
  const state: MonitorState = {
    lastText: '',
    lastThinkText: '',
    isComplete: false,
    timer: undefined,
  };

  let conversationId: string | undefined;
  let consecutiveEmptyCount = 0;
  const MAX_EMPTY_CHECKS = 10;

  const check = () => {
    if (state.isComplete) return;

    // 尝试获取会话 ID
    if (!conversationId) {
      conversationId = getConversationId(provider);
    }

    const current = findLatestResponseBlock(provider);
    if (!current) {
      state.timer = setTimeout(check, 300);
      return;
    }

    const { text, thinkText } = current;

    // 检查思考内容变化
    if (thinkText && thinkText !== state.lastThinkText) {
      const delta = thinkText.slice(state.lastThinkText.length);
      if (delta && callbacks.onDomChunk) {
        callbacks.onDomChunk(delta, true, 'thinking', conversationId);
      }
      state.lastThinkText = thinkText;
      consecutiveEmptyCount = 0;
    }

    // 检查回复内容变化
    if (text && text !== state.lastText) {
      const delta = text.slice(state.lastText.length);
      if (delta && callbacks.onDomChunk) {
        callbacks.onDomChunk(delta, false, 'responding', conversationId);
      }
      state.lastText = text;
      consecutiveEmptyCount = 0;
    }

    // 如果没有新内容，增加计数器
    if (!deltaChanged(state, current)) {
      consecutiveEmptyCount++;
      if (consecutiveEmptyCount >= MAX_EMPTY_CHECKS && text) {
        state.isComplete = true;
        cleanup();

        const fullText = buildFullText(state.lastThinkText, state.lastText);
        callbacks.onComplete?.(fullText, conversationId);
        return;
      }
    }

    state.timer = setTimeout(check, 200);
  };

  const cleanup = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  };

  const deltaChanged = (s: MonitorState, curr: { text: string; thinkText: string }) => {
    return curr.text !== s.lastText || curr.thinkText !== s.lastThinkText;
  };

  const buildFullText = (think: string, resp: string) => {
    if (!think && !resp) return '';
    if (!think) return resp;
    if (!resp) return `<think>${think}</think>`;
    return `<think>${think}</think>\n\n${resp}`;
  };

  check();
}

/**
 * 解析伪选择器语法
 *
 * 支持以下格式：
 * - 纯 CSS: 'button.btn' → { css: 'button.btn', text: null }
 * - CSS + 文本：'button.btn >> 发送' → { css: 'button.btn', text: '发送' }
 * - 纯文本：'>> 发送' → { css: '*', text: '发送' }
 */
function parseSelector(selector: string): { css: string; text: string | null } {
  const parts = selector.split('>>');

  if (parts.length === 1) {
    // 纯 CSS 选择器
    return { css: parts[0].trim(), text: null };
  }

  // CSS + 文本 或 纯文本
  const css = parts[0].trim() || '*';
  const text = parts.slice(1).join('>>').trim();
  return { css, text: text || null };
}

/**
 * 检查元素文本是否包含指定文本
 */
function elementTextContains(el: Element, text: string): boolean {
  const elText = getElementText(el);
  return elText.includes(text);
}

/**
 * 伪选择器查询 - 支持 >> 语法
 *
 * @example
 * select('button.n-button >> 发送') // 查找 class 为 n-button 且文本包含"发送"的按钮
 * select('span >> 深度思考') // 查找文本包含"深度思考"的 span 元素
 * select('>> 发送') // 查找任意文本包含"发送"的元素
 * select('button.btn') // 纯 CSS 选择器
 */
function select(selector: string): Element | null {
  const { css, text } = parseSelector(selector);

  // 纯 CSS 选择器，直接使用 querySelector
  if (!text) {
    return document.querySelector(css);
  }

  // CSS + 文本过滤
  const elements = document.querySelectorAll(css);
  for (const el of elements) {
    if (elementTextContains(el, text)) {
      return el;
    }
  }

  return null;
}

/**
 * 伪选择器查询所有匹配元素 - 支持 >> 语法
 */
function selectAll(selector: string): Element[] {
  const { css, text } = parseSelector(selector);

  // 纯 CSS 选择器
  if (!text) {
    return Array.from(document.querySelectorAll(css));
  }

  // CSS + 文本过滤
  const elements = document.querySelectorAll(css);
  const result: Element[] = [];
  for (const el of elements) {
    if (elementTextContains(el, text)) {
      result.push(el);
    }
  }
  return result;
}

/**
 * 查找元素 - 支持 >> 伪选择器语法
 */
function findElement(selector: string): Element | null {
  return select(selector);
}

/**
 * 查找元素列表中的第一个匹配项
 */
function findAnyElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = findElement(selector);
    if (el) return el;
  }
  return null;
}

/**
 * 等待元素出现 - 支持 >> 伪选择器语法
 */
function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      const el = findElement(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start > timeout) {
        resolve(null);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/**
 * 等待任意元素出现
 */
async function waitForAnyElement(selectors: string[], timeout = 8000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const selector of selectors) {
      const el = findElement(selector);
      if (el) return el;
    }
    await wait(100);
  }
  return null;
}

// ============================================================================
// 能力实现工厂
// ============================================================================

/**
 * 创建基础对话能力
 */
function createChatCapability(provider: ProviderConfig): ChatCapability {
  const { chat } = provider.actions;

  return {
    async newChat() {
      const target = findAnyElement(chat.newChat.button);
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
            await thinking.sync(options.thinking);
            await wait(300);
          }
        }

        // 3. 如果指定了搜索模式，同步搜索模式
        if (options?.search !== undefined && provider.actions.search) {
          const search = createSearchCapability(provider);
          if (search) {
            await search.sync(options.search);
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
      const inputEl = await waitForAnyElement(chat.input.box, 2000);
      const sendBtn = findAnyElement(chat.send.button);

      // 如果有回调，先设置 SSE 拦截器（在点击按钮前）
      if (callbacks?.onDomChunk || callbacks?.onSseChunk || callbacks?.onComplete || callbacks?.onError) {
        // 设置当前 provider 供 SSE 拦截器使用
        currentProvider = provider;
        // 设置 SSE 拦截器（只在对应域名下注入一次）
        setupSSEInterceptor();
      }

      // 点击发送按钮
      if (sendBtn) {
        simulateRealClick(sendBtn);
      } else if (inputEl) {
        simulateEnter(inputEl);
      } else {
        return { success: false, reason: 'no-button-no-input' };
      }

      // 等待会话 ID 出现（发送后 URL 会变化）
      const conversationId = await waitForConversationId(provider, 3000);

      if (!conversationId) {
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

      // 点击发送后才启动回调监听（DOM + SSE）
      if (callbacks?.onDomChunk || callbacks?.onSseChunk || callbacks?.onComplete || callbacks?.onError) {
        // 设置 SSE 拦截器的会话 ID
        sseConversationId = conversationId;
        // 设置 SSE 拦截器的回调，同时启动 DOM 轮询
        monitorResponse(callbacks, provider);
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

  // 对于 Slate 等特殊编辑器，尝试粘贴事件
  if (el.hasAttribute('data-slate-editor')) {
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      }));
      return;
    } catch {
      // 兜底
    }
  }

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

function simulateRealClick(element: Element): void {
  if (!element) return;
  (element as HTMLElement).focus();
  const events = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  ];
  events.forEach(ev => element.dispatchEvent(ev));
}

/**
 * 创建思考模式切换能力
 */
function createThinkingCapability(provider: ProviderConfig): Capabilities['thinking'] {
  const { actions } = provider;
  const thinking = actions.thinking;

  if (!thinking) {
    return undefined;
  }

  const findToggleEl = () => findAnyElement(thinking.button);

  // Type guard for string config
  const isStringConfig = (cfg: any): cfg is string => typeof cfg === 'string';
  // Type guard for hasClass config
  const isHasClassConfig = (cfg: any): cfg is { hasClass: string } =>
    typeof cfg === 'object' && cfg !== null && 'hasClass' in cfg && cfg.hasClass;
  // Type guard for classContains config
  const isClassContainsConfig = (cfg: any): cfg is { classContains: string } =>
    typeof cfg === 'object' && cfg !== null && 'classContains' in cfg && cfg.classContains;
  // Type guard for textContains config
  const isTextContainsConfig = (cfg: any): cfg is { textContains: string } =>
    typeof cfg === 'object' && cfg !== null && 'textContains' in cfg && cfg.textContains;

  const checkEnabled: (el: Element) => boolean = typeof thinking.enabledState === 'function'
    ? thinking.enabledState
    : (el) => {
        if (isStringConfig(thinking.enabledState)) {
          return el.classList.contains(thinking.enabledState);
        }
        if (isHasClassConfig(thinking.enabledState)) {
          return el.classList.contains(thinking.enabledState.hasClass);
        }
        if (isClassContainsConfig(thinking.enabledState)) {
          const kw = thinking.enabledState.classContains.toLowerCase();
          return Array.from(el.classList).some(c => c.toLowerCase().includes(kw));
        }
        if (isTextContainsConfig(thinking.enabledState)) {
          return (el.textContent || '').includes(thinking.enabledState.textContains);
        }
        return false;
      };

  const doToggle = async (): Promise<void> => {
    const el = findToggleEl();
    if (!el) return;

    if (thinking.toggle.type === 'click') {
      (el as HTMLElement).click();
      await wait(thinking.toggle.wait || 300);
    } else if (thinking.toggle.type === 'dropdown') {
      // 点击展开菜单
      (el as HTMLElement).click();
      await wait(thinking.toggle.wait || 800);

      // TODO: 实现下拉菜单项点击（需要额外配置）
      // 这里暂时只展开菜单
    }
  };

  return {
    async getState() {
      const el = findToggleEl();
      if (!el) return { found: false, enabled: false };
      return { found: true, enabled: checkEnabled(el) };
    },

    async sync(wantEnabled) {
      const el = findToggleEl();
      if (!el) {
        return { success: false, changed: false, reason: 'not-found' };
      }

      const current = checkEnabled(el);
      if (current === wantEnabled) {
        return { success: true, changed: false };
      }

      await doToggle();

      // 验证切换结果
      const afterEl = findToggleEl();
      if (!afterEl) {
        return { success: false, changed: true, reason: 'disappeared-after-toggle' };
      }

      const after = checkEnabled(afterEl);
      return { success: after === wantEnabled, changed: true };
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

  // 复用 thinking 的实现逻辑
  const findToggleEl = () => findAnyElement(search.button);

  const isStringConfig = (cfg: any): cfg is string => typeof cfg === 'string';
  const isHasClassConfig = (cfg: any): cfg is { hasClass: string } =>
    typeof cfg === 'object' && cfg !== null && 'hasClass' in cfg && cfg.hasClass;
  const isClassContainsConfig = (cfg: any): cfg is { classContains: string } =>
    typeof cfg === 'object' && cfg !== null && 'classContains' in cfg && cfg.classContains;
  const isTextContainsConfig = (cfg: any): cfg is { textContains: string } =>
    typeof cfg === 'object' && cfg !== null && 'textContains' in cfg && cfg.textContains;

  const checkEnabled: (el: Element) => boolean = typeof search.enabledState === 'function'
    ? search.enabledState
    : (el) => {
        if (isStringConfig(search.enabledState)) {
          return el.classList.contains(search.enabledState);
        }
        if (isHasClassConfig(search.enabledState)) {
          return el.classList.contains(search.enabledState.hasClass);
        }
        if (isClassContainsConfig(search.enabledState)) {
          const kw = search.enabledState.classContains.toLowerCase();
          return Array.from(el.classList).some(c => c.toLowerCase().includes(kw));
        }
        if (isTextContainsConfig(search.enabledState)) {
          return (el.textContent || '').includes(search.enabledState.textContains);
        }
        return false;
      };

  const doToggle = async (): Promise<void> => {
    const el = findToggleEl();
    if (!el) return;

    if (search.toggle.type === 'click') {
      (el as HTMLElement).click();
      await wait(search.toggle.wait || 300);
    } else if (search.toggle.type === 'dropdown') {
      (el as HTMLElement).click();
      await wait(search.toggle.wait || 800);
    }
  };

  return {
    async getState() {
      const el = findToggleEl();
      if (!el) return { found: false, enabled: false };
      return { found: true, enabled: checkEnabled(el) };
    },

    async sync(wantEnabled) {
      const el = findToggleEl();
      if (!el) {
        return { success: false, changed: false, reason: 'not-found' };
      }

      const current = checkEnabled(el);
      if (current === wantEnabled) {
        return { success: true, changed: false };
      }

      await doToggle();

      const afterEl = findToggleEl();
      if (!afterEl) {
        return { success: false, changed: true, reason: 'disappeared-after-toggle' };
      }

      const after = checkEnabled(afterEl);
      return { success: after === wantEnabled, changed: true };
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
    throw new Error(`Unknown provider: ${providerId}. Available providers: deepseek, doubao, qianwen, longcat, yuanbao`);
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
