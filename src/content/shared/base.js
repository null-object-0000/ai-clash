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

  // 能力引用
  let capabilities = null;

  /**
   * 初始化注入器
   * 优先使用 MAIN 世界注入的 standalone（因为它能正确拦截 fetch）
   * fallback 到本地 extension 注入器
   */
  async function initInjector() {
    // 已经初始化过了，直接返回缓存的 capabilities
    if (capabilities) {
      return capabilities;
    }

    // 如果 MAIN 世界还没有，尝试自动注入 standalone.js（开发模式）
    // 这和你手动注入效果完全一样
    if (!document.querySelector('script[src*="standalone.js"]')) {
      logger.log(`[AI Clash ${PROVIDER}] 自动注入 standalone.js 到 MAIN 世界`);
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'http://localhost:5173/standalone.js';
        script.async = true;
        document.documentElement.appendChild(script);
        script.onload = () => {
          logger.log(`[AI Clash ${PROVIDER}] ✓ standalone.js 加载完成，注入 MAIN 世界成功`);
          resolve();
        };
        script.onerror = () => {
          logger.warn(`[AI Clash ${PROVIDER}] standalone.js 加载失败，请检查 bun dev 是否运行在 http://localhost:5173`);
          resolve();
        };
      });
    }

    // standalone 已经注入 MAIN 世界，现在我们来设置监听
    // standalone 会把 SSE 消息通过 postMessage 发过来
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) return;

      // SSE chunk 从 MAIN 世界发来 → 转发给 background
      if (event.data.type === '__aiclash_sse_chunk') {
        const { text, isThink, stage, conversationId } = event.data;
        logger.log(`[AI Clash ${PROVIDER}] 收到 MAIN 世界 SSE chunk:`, text.slice(0, 50) + (text.length > 50 ? '...' : ''), 'isThink:', isThink);
        safeSend({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: { provider: PROVIDER, text, stage, isThink }
        });
        return;
      }

      // 任务完成 → 通知 background
      if (event.data.type === '__aiclash_complete') {
        logger.log(`[AI Clash ${PROVIDER}] 收到 MAIN 世界完成信号`);
        safeSend({
          type: MSG_TYPES.TASK_COMPLETED,
          payload: { provider: PROVIDER }
        });
        return;
      }

      // 错误 → 通知 background
      if (event.data.type === '__aiclash_error') {
        const { error } = event.data;
        logger.error(`[AI Clash ${PROVIDER}] 收到 MAIN 世界错误:`, error);
        safeSend({
          type: MSG_TYPES.ERROR,
          payload: { provider: PROVIDER, message: error }
        });
        return;
      }
    });

    // 创建代理 capabilities，符合原来的调用约定: caps.chat('send', ...args)
    const rpcCapabilities = {
      chat: (method, ...args) => {
        logger.log(`[AI Clash ${PROVIDER}] RPC 调用 MAIN 世界 __AI_CLASH.chat.${method}`);

        // 通过 postMessage RPC 调用 MAIN 世界的方法
        // standalone 注入 MAIN 世界后会监听这个调用
        const seq = Math.random().toString(36).slice(2);

        // chat.send: (method='send', prompt, options, callbacks)
        // callbacks 包含函数不能 postMessage，所以只传前两个参数，callbacks 在 standalone 重建
        const cleanArgs = method === 'send' ? args.slice(0, 2) : args;

        // 发送调用请求到 MAIN 世界
        window.postMessage({
          type: '__aiclash_call',
          seq,
          capability: 'chat',
          method: method,
          args: cleanArgs
        }, '*');

        // SSE chunks, complete, error 已经通过上面的 postMessage 监听处理了
      }
    };

    // 检查 standalone 是否真的注入成功
    // 我们通过 postMessage ping 一下看有没有响应
    let hasMainWorld = false;
    try {
      await new Promise((resolve) => {
        const pingSeq = 'ping_' + Math.random();
        const timeout = setTimeout(() => {
          resolve(false);
        }, 500);
        const onPong = (event) => {
          if (event.data?.type === '__aiclash_pong' && event.data.seq === pingSeq) {
            window.removeEventListener('message', onPong);
            clearTimeout(timeout);
            hasMainWorld = true;
            resolve(true);
          }
        };
        window.addEventListener('message', onPong);
        window.postMessage({
          type: '__aiclash_ping',
          seq: pingSeq
        }, '*');
      });
    } catch (_) {}

    if (hasMainWorld) {
      logger.log(`[AI Clash ${PROVIDER}] ✓ 使用 MAIN 世界 standalone 注入，RPC 通信就绪`);
      capabilities = rpcCapabilities;
      return capabilities;
    }

    // MAIN 世界 standalone 注入失败，无法继续
    logger.error(`[AI Clash ${PROVIDER}] MAIN 世界 standalone 注入失败，ping 探测无响应`);
    return null;
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
      // 一站式发送消息并监听流式响应
      // 所有前置步骤（新对话、同步思考/搜索开关、填充消息）都在内部完成
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: PROVIDER, text: '正在发送消息...', stage: 'connecting', isStatus: true }
      });

      const options = {
        newChat: settings?.isNewConversation !== false,
        thinking: settings?.isDeepThinkingEnabled,
        search: settings?.isWebSearchEnabled,
      };

      await caps.chat('send', prompt, options, {
        onSseChunk: (text, isThink, stage, conversationId) => {
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text, stage, isThink }
          });
        },
        onConversationId: (conversationId) => {
          logger.log(`[AI Clash ${PROVIDER}] 会话 ID:`, conversationId);
          // 发送完成，已获取会话 ID，进入等待回复阶段
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text: '发送完成，等待 AI 回复...', stage: 'waiting', isStatus: true }
          });
        },
        onComplete: (fullText, conversationId) => {
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
