/**
 * Content Script 基座 - 基于 @ai-clash/inject 实现
 *
 * 所有 provider 共享的执行逻辑，只暴露 providerId 配置接口
 *
 * 用法 (在每个 provider 的 index.js 中):
 *   import { bootstrapProvider } from '../base.js';
 *   bootstrapProvider('deepseek');
 */

import { MSG_TYPES } from '../../shared/messages.js';
import logger from '../../shared/logger.js';
import { isContextValid, safeSend } from '../shared/utils.js';
import { createInjector } from '@ai-clash/inject';

/**
 * 启动 provider
 * @param {string} providerId - 提供者 ID (deepseek/doubao/qianwen/longcat/yuanbao)
 */
export function bootstrapProvider(providerId) {
  const PROVIDER = providerId;

  // ============================================================================
  // 初始化注入器
  // ============================================================================
  logger.log(`[AI Clash ${PROVIDER}] content script 已在该页运行（document_start）`);

  // 标记 content script 已就绪，供 background 检查
  window.__aiclash_content_script_ready = true;

  // 创建注入器实例（使用 extension 适配器）
  let injector = null;
  let capabilities = null;

  /**
   * 初始化注入器
   */
  async function initInjector() {
    if (injector) return capabilities;

    try {
      injector = createInjector({
        provider: providerId,
        adapter: 'extension',
      });

      await injector.inject();

      // 获取能力引用
      capabilities = {
        chat: injector.call.bind(injector, 'chat'),
        thinking: injector.call.bind(injector, 'thinking'),
        search: injector.call.bind(injector, 'search'),
        auth: injector.call.bind(injector, 'auth'),
      };

      logger.log(`[AI Clash ${PROVIDER}] 注入器初始化成功`);
      return capabilities;
    } catch (err) {
      logger.error(`[AI Clash ${PROVIDER}] 注入器初始化失败:`, err);
      return null;
    }
  }

  // ============================================================================
  // 消息处理
  // ============================================================================

  if (isContextValid()) {
    // 注入 hook（通过 background scripting API）
    safeSend({ type: MSG_TYPES.INJECT_HOOK, payload: { provider: PROVIDER } }, (response) => {
      if (response?.ok) {
        logger.log(`[AI Clash ${PROVIDER}] hook 已通过 scripting API 兜底注入`);
      }
    });

    // 监听执行请求
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.type === MSG_TYPES.EXECUTE_PROMPT) {
        executeTask(request.payload.prompt, request.payload.settings);
        sendResponse({ ok: true });
      }
      return true;
    });
  }

  // ============================================================================
  // 任务执行
  // ============================================================================

  /**
   * 执行 AI 对话任务
   * @param {string} prompt - 用户问题
   * @param {object} settings - 设置选项
   */
  async function executeTask(prompt, settings) {
    logger.log(`[AI Clash ${PROVIDER}] 开始执行任务...`, settings);

    // 初始化注入器
    const caps = await initInjector();
    if (!caps) {
      safeSend({
        type: MSG_TYPES.ERROR,
        payload: { provider: PROVIDER, message: '注入器初始化失败' }
      });
      return;
    }

    safeSend({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: { provider: PROVIDER, text: '', stage: 'connecting' }
    });

    try {
      // 1. 开启新对话（如果需要）
      if (settings?.isNewConversation !== false) {
        const newChatResult = await caps.chat('newChat');
        if (newChatResult?.success) {
          logger.log(`[AI Clash ${PROVIDER}] 已开启新对话`);
        }
      }

      // 2. 同步深度思考开关
      if (caps.thinking && settings?.isDeepThinkingEnabled !== undefined) {
        const current = await caps.thinking('getState');
        const wantEnabled = settings.isDeepThinkingEnabled;

        if (current?.found && current.enabled !== wantEnabled) {
          const result = await caps.thinking(wantEnabled ? 'enable' : 'disable');
          logger.log(`[AI Clash ${PROVIDER}] 深度思考切换结果:`, result);
        }
      }

      // 3. 同步智能搜索开关（如果支持）
      if (caps.search && settings?.isWebSearchEnabled !== undefined) {
        const current = await caps.search('getState');
        const wantEnabled = settings.isWebSearchEnabled;

        if (current?.found && current.enabled !== wantEnabled) {
          const result = await caps.search(wantEnabled ? 'enable' : 'disable');
          logger.log(`[AI Clash ${PROVIDER}] 智能搜索切换结果:`, result);
        }
      }

      // 4. 发送消息并监听流式响应
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: PROVIDER, text: '正在发送消息...', stage: 'connecting', isStatus: true }
      });

      await caps.chat('send', {
        onSseChunk: (text, isThink, stage) => {
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text, stage, isThink }
          });
        },
        onDomChunk: (text, isThink, stage) => {
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text, stage, isThink }
          });
        },
        onConversationId: (conversationId) => {
          logger.log(`[AI Clash ${PROVIDER}] 会话 ID:`, conversationId);
        },
        onComplete: (fullText) => {
          logger.log(`[AI Clash ${PROVIDER}] 任务完成`);
          safeSend({
            type: MSG_TYPES.TASK_COMPLETED,
            payload: { provider: PROVIDER }
          });
        },
        onError: (error, conversationId) => {
          logger.error(`[AI Clash ${PROVIDER}] 错误:`, error);
          safeSend({
            type: MSG_TYPES.ERROR,
            payload: { provider: PROVIDER, message: error }
          });
        }
      });

    } catch (err) {
      logger.error(`[AI Clash ${PROVIDER}] 任务执行失败:`, err);
      safeSend({
        type: MSG_TYPES.ERROR,
        payload: { provider: PROVIDER, message: err.message || '任务执行失败' }
      });
      safeSend({
        type: MSG_TYPES.TASK_COMPLETED,
        payload: { provider: PROVIDER }
      });
    }
  }

  // ============================================================================
  // DEBUG: 暴露能力到页面主世界
  // ============================================================================
  /**
   * 将能力对象暴露到页面主世界的 window.__AI_CLASH
   */
  function exposeDebugGlobal(provider, capabilities) {
    window.addEventListener('__aiclash_call', async (event) => {
      const { callId, path, args } = event.detail;
      try {
        const [capName, method] = path.split('.');
        const cap = capabilities[capName];
        const result = cap && typeof cap[method] === 'function'
          ? await cap[method](...(args || []))
          : undefined;
        window.dispatchEvent(new CustomEvent('__aiclash_result', {
          detail: { callId, result },
        }));
      } catch (err) {
        window.dispatchEvent(new CustomEvent('__aiclash_result', {
          detail: { callId, error: String(err) },
        }));
      }
    });

    const methods = {};
    for (const [name, cap] of Object.entries(capabilities)) {
      methods[name] = Object.keys(cap).filter(k => typeof cap[k] === 'function');
    }

    if (isContextValid()) {
      safeSend({
        type: MSG_TYPES.INJECT_DEBUG_GLOBAL,
        payload: { provider, methods },
      });
    }
  }

  exposeDebugGlobal(PROVIDER, {
    async send(prompt, settings) {
      await executeTask(prompt, settings);
    },
    async call(capability, method, ...args) {
      if (!injector) await initInjector();
      return injector?.call(capability, method, ...args);
    }
  });

  // ============================================================================
  // 同步 debug 状态到 MAIN world
  // ============================================================================
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

  // 监听 storage 变化，实时同步
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isDebugEnabled) {
      window.postMessage({
        type: 'AICLASH_DEBUG_STATE',
        enabled: !!changes.isDebugEnabled.newValue
      }, '*');
    }
  });
}
