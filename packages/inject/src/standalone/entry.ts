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

  if (hostname.includes('deepseek') || hostname.includes('chat.deepseek.com')) {
    return 'deepseek';
  }
  if (hostname.includes('doubao') || hostname.includes('doubao.com')) {
    return 'doubao';
  }
  if (hostname.includes('qianwen') || hostname.includes('tongyi.aliyun.com')) {
    return 'qianwen';
  }
  if (hostname.includes('longcat') || hostname.includes('tiangong.cn')) {
    return 'longcat';
  }
  if (hostname.includes('yuanbao') || hostname.includes('yuanbao.tencent.com')) {
    return 'yuanbao';
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

// 立即暴露 API
exposeAPI();
