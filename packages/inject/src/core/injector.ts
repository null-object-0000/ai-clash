/**
 * AI Clash Inject - 核心注入器
 */

import type {
  Injector,
  InjectorOptions,
  Capabilities,
  ProviderConfig,
  EventHandler,
} from './types.js';
import { getProviderConfig, type ProviderId } from '../providers/index.js';

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_GLOBAL_NAME = '__AI_CLASH';
const DEFAULT_CHANNEL_NAME = 'ai-clash-channel';

// ============================================================================
// 工具函数
// ============================================================================

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// 能力实现工厂
// ============================================================================

/**
 * 创建思考模式切换能力
 */
function createThinkingCapability(provider: ProviderConfig): Capabilities['thinking'] {
  const { toggles } = provider;

  if (!toggles) {
    return {
      async getState() {
        return { found: false, enabled: false };
      },
      async sync() {
        return { success: false, changed: false, reason: 'not-supported' };
      },
    };
  }

  const findToggleEl = typeof toggles.findToggle === 'function'
    ? toggles.findToggle
    : () => document.querySelector(toggles.findToggle as string);

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

  const checkEnabled: (el: Element) => boolean = typeof toggles.isEnabled === 'function'
    ? toggles.isEnabled
    : (el) => {
        if (isStringConfig(toggles.isEnabled)) {
          return el.classList.contains(toggles.isEnabled);
        }
        if (isHasClassConfig(toggles.isEnabled)) {
          return el.classList.contains(toggles.isEnabled.hasClass);
        }
        if (isClassContainsConfig(toggles.isEnabled)) {
          const kw = toggles.isEnabled.classContains.toLowerCase();
          return Array.from(el.classList).some(c => c.toLowerCase().includes(kw));
        }
        if (isTextContainsConfig(toggles.isEnabled)) {
          return (el.textContent || '').includes(toggles.isEnabled.textContains);
        }
        return false;
      };

  const doToggle = async (): Promise<void> => {
    const el = findToggleEl();
    if (!el) return;

    if (toggles.toggle === 'click') {
      (el as HTMLElement).click();
      await wait(toggles.waitAfterToggle || 300);
    } else if (toggles.toggle === 'dropdown') {
      // 点击展开菜单
      (el as HTMLElement).click();
      await wait(toggles.waitAfterToggle || 800);

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
 * 创建输入框填充能力
 */
function createInputCapability(provider: ProviderConfig): Capabilities['input'] {
  const { selectors } = provider;

  function waitForElement(selector: string, timeout = 8000): Promise<Element | null> {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
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

  async function waitForAnyElement(selectors: string[], timeout = 8000): Promise<Element | null> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      await wait(100);
    }
    return null;
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

  return {
    async fill(text) {
      const el = await waitForAnyElement(selectors.input);
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
  };
}

/**
 * 创建消息发送能力
 */
function createSendCapability(provider: ProviderConfig): Capabilities['send'] {
  const { selectors } = provider;

  async function waitForAnyElement(selectors: string[], timeout = 2000): Promise<Element | null> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      await wait(100);
    }
    return null;
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

  function findSendButton(inputEl: Element | null): Element | null {
    // 1. 优先级选择器
    for (const sel of selectors.sendButton) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // 2. 通用选择器
    const genericSelectors = [
      '[data-testid*="send"]',
      '[data-testid*="submit"]',
      '[aria-label*="发送"]',
      '[aria-label*="send"]',
      '[aria-label*="Send"]',
    ];
    for (const sel of genericSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // 3. 文字匹配
    const sendLabels = ['发送', 'Send', '发送消息'];
    for (const label of sendLabels) {
      const el = Array.from(document.querySelectorAll('button, [role="button"]'))
        .find(e => e.textContent?.trim() === label);
      if (el) return el;
    }

    // 4. 父级遍历
    if (inputEl) {
      let container = inputEl.parentElement;
      for (let i = 0; i < 6 && container; i++) {
        const btns = container.querySelectorAll('button, [role="button"]');
        if (btns.length > 0) return btns[btns.length - 1];
        container = container.parentElement;
      }
    }

    return null;
  }

  return {
    async send() {
      const inputEl = await waitForAnyElement(selectors.input, 2000);
      const sendBtn = findSendButton(inputEl);

      if (sendBtn) {
        simulateRealClick(sendBtn);
        return { success: true, method: 'button' };
      }

      if (inputEl) {
        simulateEnter(inputEl);
        return { success: true, method: 'enter' };
      }

      return { success: false, reason: 'no-button-no-input' };
    },
  };
}

/**
 * 创建新建对话能力
 */
function createNewChatCapability(provider: ProviderConfig): Capabilities['newChat'] {
  const { selectors } = provider;
  const newChatSelectors = selectors.newChat;

  function findClickable(el: Element | null): Element | null {
    if (!el) return null;
    if (el.matches?.('[role="button"], button, a, [tabindex="0"]')) return el;
    return el.closest('[role="button"], button, a, [tabindex="0"]') || el;
  }

  function findBySelectors(): Element | null {
    if (!newChatSelectors) return null;
    for (const sel of newChatSelectors) {
      const el = document.querySelector(sel);
      if (el) return findClickable(el);
    }
    return null;
  }

  return {
    async start() {
      const target = findBySelectors();

      if (!target) {
        return { success: false, reason: 'button-not-found' };
      }

      (target as HTMLElement).click();
      await wait(600);

      return { success: true };
    },
  };
}

/**
 * 创建完整能力对象
 */
function createCapabilities(provider: ProviderConfig): Capabilities {
  return {
    thinking: createThinkingCapability(provider),
    input: createInputCapability(provider),
    send: createSendCapability(provider),
    newChat: createNewChatCapability(provider),
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
        thinking: capabilities.thinking,
        input: capabilities.input,
        send: capabilities.send,
        newChat: capabilities.newChat,
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
