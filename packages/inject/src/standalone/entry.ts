/**
 * Standalone Entry Point for AI Clash Inject
 *
 * This file is built as a standalone IIFE bundle that automatically
 * exposes capabilities to window.__AI_CLASH when loaded via script tag.
 *
 * Usage:
 * ```html
 * <script src="standalone.js"></script>
 * <script>
 *   // Auto-exposed as window.__AI_CLASH
 *   await window.__AI_CLASH.thinking.sync(true);
 * </script>
 * ```
 */

import { createInjector, getProviderIds } from '../index.js';

// ============================================================================
// 全局状态
// ============================================================================

let injector: any = null;
let isInitialized = false;

// ============================================================================
// 自动注入（仅在 AI 网站页面）
// ============================================================================

(function autoInject() {
  // 只在 AI 网站页面自动注入
  const provider = detectProviderFromDomain();
  if (!provider) {
    // 非 AI 网站页面，仅暴露 API 供手动使用
    exposeAPI();
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

async function init() {
  if (isInitialized) return;

  try {
    const provider = detectProviderFromDomain();
    if (!provider) return;

    injector = createInjector({
      provider,
      adapter: 'window',
    });

    await injector.inject();
    isInitialized = true;

    console.log(`[AI Clash Inject] Auto-injected for ${provider} on ${location.hostname}`);
    console.log('[AI Clash Inject] Access capabilities via window.__AI_CLASH');
  } catch (err) {
    console.error('[AI Clash Inject] Auto-inject failed:', err);
  }
}

// ============================================================================
// Provider 自动检测
// ============================================================================

function detectProviderFromDomain(): string | null {
  const hostname = location.hostname;

  if (hostname.includes('chat.deepseek.com')) {
    return 'deepseek';
  }
  if (hostname.includes('doubao.com')) {
    return 'doubao';
  }
  if (hostname.includes('www.qianwen.com')) {
    return 'qianwen';
  }
  if (hostname.includes('tiangong.cn')) {
    return 'longcat';
  }
  if (hostname.includes('yuanbao.tencent.com')) {
    return 'yuanbao';
  }
  if (hostname.includes('yiyan.baidu.com')) {
    return 'wenxin';
  }
  if (hostname.includes('aistudio.xiaomimimo.com')) {
    return 'xiaomi';
  }

  return null;
}

// ============================================================================
// API 暴露
// ============================================================================

function exposeAPI() {
  (window as any).AIClashInject = {
    createInjector,
    getProviderIds,
    getInjector: () => injector,
    isInjected: () => isInitialized,
  };
}

// ============================================================================
// RPC 监听：来自 content script (ISOLATED 世界) 的调用
// ============================================================================

// content script 通过 postMessage 调用我们 (MAIN 世界)
// 我们执行后把结果和 SSE chunks 发回去
window.addEventListener('message', async (event) => {
  if (!event.data || !event.data.type) return;

  // ping 探测 - 只要脚本加载了就回复 pong，不管 injector 是否初始化完成
  if (event.data.type === '__aiclash_ping') {
    window.postMessage({
      type: '__aiclash_pong',
      seq: event.data.seq,
    }, '*');
    return;
  }

  // RPC 调用 - 如果 injector 还没初始化好，等待它
  if (event.data.type === '__aiclash_call') {
    // 等待 injector 初始化完成
    const waitInjector = (): Promise<typeof injector> => {
      if (injector && isInitialized) {
        return Promise.resolve(injector);
      }
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (injector && isInitialized) {
            clearInterval(interval);
            resolve(injector);
          }
        }, 100);
        // 超时 5 秒
        setTimeout(() => {
          clearInterval(interval);
          resolve(null);
        }, 5000);
      });
    };

    const waitingInjector = await waitInjector();
    if (!waitingInjector) {
      console.error('[AI Clash Inject] Timeout waiting for injector initialization');
      return;
    }

    const { seq, capability, method, args } = event.data;

    // 处理 chat.send 的特殊回调转发
    if (capability === 'chat' && method === 'send') {
      const [prompt, options] = args;

      // 包装回调，把所有回调转发回 content script（ISOLATED 世界）
      const wrappedCallbacks = {
        onSseChunk: (text: string, isThink: boolean, stage: 'thinking' | 'responding', conversationId?: string) => {
          console.log(`[AI Clash Inject] MAIN world onSseChunk: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}, isThink: ${isThink}`);
          window.postMessage({
            type: '__aiclash_sse_chunk',
            text,
            isThink,
            stage,
            conversationId,
          }, '*');
        },
        onConversationId: (conversationId: string) => {
          // 转发会话 ID 回 content script，让它知道消息已成功发送
          console.log(`[AI Clash Inject] Conversation ID: ${conversationId}`);
          window.postMessage({
            type: '__aiclash_conversation_id',
            seq,
            conversationId,
          }, '*');
        },
        onComplete: (fullText: string, conversationId?: string) => {
          console.log(`[AI Clash Inject] MAIN world onComplete: total length ${fullText.length}`);
          window.postMessage({
            type: '__aiclash_complete',
            seq,
            fullText,
            conversationId,
          }, '*');
        },
        onError: (error: string, conversationId?: string) => {
          console.error(`[AI Clash Inject] MAIN world onError: ${error}`);
          window.postMessage({
            type: '__aiclash_error',
            seq,
            error,
            conversationId,
          }, '*');
        },
      };

      // 实际调用
      console.log('[AI Clash Inject] MAIN world receive RPC call: chat.send');
      console.log('[AI Clash Inject] Sending message:', prompt.slice(0, 50), 'options:', options);

      // 不调用，直接返回空结果（调试用）
      // waitingInjector.call(capability, method, prompt, options, wrappedCallbacks);
      // console.log('[AI Clash Inject] SKIPPED for debugging');

      // 正常调用
      waitingInjector.call(capability, method, prompt, options, wrappedCallbacks)
        .then((result: any) => {
          console.log('[AI Clash Inject] chat.send completed:', result);
        })
        .catch((err: any) => {
          console.error('[AI Clash Inject] chat.send failed:', err);
        });
      return;
    }

    // 通用调用
    try {
      const result = waitingInjector.call(capability, method, ...args);
      window.postMessage({
        type: '__aiclash_result',
        seq,
        result,
      }, '*');
    } catch (error) {
      window.postMessage({
        type: '__aiclash_result',
        seq,
        error: String(error),
      }, '*');
    }
  }
});

// 立即暴露 API
exposeAPI();
