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
 * @param {string} providerId - 提供者 ID (deepseek/doubao/qianwen/longcat/yuanbao/wenxin)
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

  // pending Resolves 和 Callbacks - 在 bootstrapProvider 作用域内，所有函数共享
  const pendingCallbacks = new Map();
  const pendingResolves = new Map();

  /**
   * 当检测到登录页时，resolve 所有 pending 的 Promise，让串行流程继续
   * 只在消息发送前（未获取到会话 ID）时调用
   */
  function resolvePendingWithError() {
    logger.log(`[AI Clash ${PROVIDER}] 检测到登录页，resolve pending Promise`);
    // 找到所有 pendingResolves 中的条目，resolve 它们
    for (const [seq, entry] of pendingResolves.entries()) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      if (entry.resolve) {
        entry.resolve({ success: false, error: 'login_required' });
      }
      pendingResolves.delete(seq);
    }
    // 同时清理 pendingCallbacks，避免重复触发
    pendingCallbacks.clear();
  }

  /**
   * 标记消息已发送（获取到会话 ID），之后不再调用 resolvePendingWithError
   */
  let messageSent = false;
  function markMessageSent() {
    messageSent = true;
  }

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

    // 如果 MAIN 世界还没有，尝试自动注入 standalone.js
    if (!document.querySelector('script[src*="standalone.js"]')) {
      logger.log(`[AI Clash ${PROVIDER}] 自动注入 standalone.js 到 MAIN 世界`);
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('packages/inject/dist/standalone.js');
        script.async = true;
        document.documentElement.appendChild(script);
        script.onload = () => {
          logger.log(`[AI Clash ${PROVIDER}] ✓ standalone.js 加载完成，注入 MAIN 世界成功`);
          resolve();
        };
        script.onerror = () => {
          logger.warn(`[AI Clash ${PROVIDER}] standalone.js 加载失败`);
          resolve();
        };
      });
    }

    // standalone 已经注入 MAIN 世界，现在我们来设置监听
    // 用于保存 chat.send 的回调和 Promise resolve 函数
    // （pendingCallbacks 和 pendingResolves 已在外层作用域定义）

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

      // 会话 ID 已获取 → 调用回调并 resolve Promise（让串行流程继续）
      if (event.data.type === '__aiclash_conversation_id') {
        const { seq, conversationId } = event.data;
        logger.log(`[AI Clash ${PROVIDER}] 收到 MAIN 世界会话 ID:`, conversationId);
        const callbacks = pendingCallbacks.get(seq);
        if (callbacks?.onConversationId) {
          callbacks.onConversationId(conversationId);
        }
        // 标记消息已发送，之后检测到登录页不再 resolve pending
        markMessageSent();
        // resolve Promise，让串行流程继续执行下一个 provider
        const entry = pendingResolves.get(seq);
        if (entry?.resolve) {
          // 先清除定时器，避免超时错误
          if (entry.timeoutId) clearTimeout(entry.timeoutId);
          entry.resolve({ success: true, conversationId });
        }
        // 清理 pending 数据，但保留 callbacks 用于后续的 complete/error
        pendingResolves.delete(seq);
        return;
      }

      // 任务完成 → 通知 background
      if (event.data.type === '__aiclash_complete') {
        logger.log(`[AI Clash ${PROVIDER}] 收到 MAIN 世界完成信号`);
        const { seq, fullText, conversationId } = event.data;
        const callbacks = pendingCallbacks.get(seq);
        if (callbacks?.onComplete) {
          callbacks.onComplete(fullText, conversationId);
        }
        pendingCallbacks.delete(seq);
        safeSend({
          type: MSG_TYPES.TASK_COMPLETED,
          payload: { provider: PROVIDER }
        });
        return;
      }

      // 错误 → 通知 background
      if (event.data.type === '__aiclash_error') {
        const { error, seq } = event.data;
        logger.error(`[AI Clash ${PROVIDER}] 收到 MAIN 世界错误:`, error);
        const callbacks = pendingCallbacks.get(seq);
        if (callbacks?.onError) {
          callbacks.onError(error);
        }
        pendingCallbacks.delete(seq);
        safeSend({
          type: MSG_TYPES.ERROR,
          payload: { provider: PROVIDER, message: error }
        });
        return;
      }
    });

    // 创建代理 capabilities，符合原来的调用约定：caps.chat('send', ...args)
    const rpcCapabilities = {
      chat: async (method, ...args) => {
        logger.log(`[AI Clash ${PROVIDER}] RPC 调用 MAIN 世界 __AI_CLASH.chat.${method}`);

        // 通过 postMessage RPC 调用 MAIN 世界的方法
        const seq = Math.random().toString(36).slice(2);

        // chat.send: (method='send', prompt, options, callbacks)
        // callbacks 包含函数不能 postMessage，所以需要在本地保存
        if (method === 'send' && args.length >= 3) {
          const [prompt, options, callbacks] = args;
          pendingCallbacks.set(seq, callbacks);

          // 发送调用请求到 MAIN 世界
          window.postMessage({
            type: '__aiclash_call',
            seq,
            capability: 'chat',
            method: method,
            args: [prompt, options] // callbacks 不传，在本地保存
          }, '*');

          // 等待消息成功发送（获取到会话 ID）后返回
          // 返回一个 Promise，等待 __aiclash_conversation_id 消息
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              logger.error(`[AI Clash ${PROVIDER}] ✗ 等待会话 ID 超时 (20s)，可能是页面响应慢或 SSE 拦截失败`);
              pendingCallbacks.delete(seq);
              pendingResolves.delete(seq);
              reject(new Error('等待会话 ID 超时'));
            }, 20000);
            pendingResolves.set(seq, { resolve, timeoutId });
          });
        } else {
          // 其他方法直接发送
          window.postMessage({
            type: '__aiclash_call',
            seq,
            capability: 'chat',
            method: method,
            args: args
          }, '*');
        }
      }
    };

    // 检查 standalone 是否真的注入成功
    // 我们通过 postMessage ping 一下看有没有响应
    let hasMainWorld = false;
    try {
      await new Promise((resolve) => {
        const pingSeq = 'ping_' + Math.random();
        const timeout = setTimeout(() => {
          logger.warn(`[AI Clash ${PROVIDER}] ping 探测超时 (2s)，standalone.js 可能未完全加载`);
          resolve(false);
        }, 2000);
        const onPong = (event) => {
          if (event.data?.type === '__aiclash_pong' && event.data.seq === pingSeq) {
            window.removeEventListener('message', onPong);
            clearTimeout(timeout);
            hasMainWorld = true;
            logger.log(`[AI Clash ${PROVIDER}] ✓ ping 探测成功，standalone.js 已就绪`);
            resolve(true);
          }
        };
        window.addEventListener('message', onPong);
        window.postMessage({
          type: '__aiclash_ping',
          seq: pingSeq
        }, '*');
      });
    } catch (_) { }

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
        // 等待任务真正开始执行（消息已发送）后再返回
        executeTask(request.payload.prompt, request.payload.settings)
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true; // 表示异步返回
      }
      return false;
    });
  }

  // ============================================================================
  // 登录态检测
  // ============================================================================

  /**
   * 同步检测当前页面是否处于未登录状态（不等待，直接检查）
   * @returns {{isLoggedOut: boolean, loginUrl?: string, isOnLoginPage?: boolean} | null}
   */
  function checkLoginStatusSync() {
    // 页面未加载完成时不检测，避免误判
    if (document.readyState !== 'complete') {
      return null;
    }

    const currentPath = window.location.pathname;
    const currentHref = window.location.href;

    // 各平台的登录态检测选择器
    const LOGIN_SELECTORS = {
      deepseek: {
        check: () => {
          if (currentPath.includes('/sign_in') || currentPath.includes('/login') || currentPath.includes('/signup')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], button[class*="sign-in"], a[href*="/login"], a[href*="/signin"]');
          const notLoggedInMsg = document.querySelector('*[class*="not-logged"], *[class*="please-login"]');
          if (loginBtn || notLoggedInMsg) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://chat.deepseek.com/sign_in'
      },
      yuanbao: {
        check: () => {
          if (currentPath.includes('/login') || currentPath.includes('/signin')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginModal = document.querySelector('[class*="login"], [class*="auth"]');
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"]');
          if (loginModal || loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://yuanbao.tencent.com/login'
      },
      longcat: {
        check: () => {
          if (currentPath.includes('/login') || currentPath.includes('/signin')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"], a[href*="/signin"]');
          if (loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://longcat.chat/login'
      },
      xiaomi: {
        check: () => {
          // 小米登录页是 account.xiaomi.com 域名
          if (window.location.hostname === 'account.xiaomi.com') {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          if (currentPath.includes('/login') || currentHref.includes('#/login')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"], a[href*="/signin"]');
          if (loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://account.xiaomi.com/fe/service/login'
      },
      doubao: {
        check: () => {
          if (currentPath.includes('/login') || currentPath.includes('/signin')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"], a[href*="/signin"]');
          if (loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://www.doubao.com/login'
      },
      qianwen: {
        check: () => {
          if (currentPath.includes('/login') || currentPath.includes('/signin')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"], a[href*="/signin"]');
          if (loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://www.qianwen.com/login'
      },
      wenxin: {
        check: () => {
          if (currentPath.includes('/login') || currentPath.includes('/signin')) {
            return { isLoggedOut: true, isOnLoginPage: true };
          }
          const loginBtn = document.querySelector('button[class*="login"], a[href*="/login"], a[href*="/signin"]');
          if (loginBtn) {
            return { isLoggedOut: true, isOnLoginPage: false };
          }
          return { isLoggedOut: false };
        },
        loginUrl: 'https://yiyan.baidu.com/login'
      }
    };

    const config = LOGIN_SELECTORS[PROVIDER];
    if (!config) {
      return null;
    }

    const result = config.check();
    if (result?.isLoggedOut && config.loginUrl) {
      return { ...result, loginUrl: config.loginUrl };
    }
    return result;
  }

  // ============================================================================
  // 任务执行
  // ============================================================================

  // 登录页轮询检测器 ID
  let loginCheckIntervalId = null;
  let beforeUnloadHandler = null;
  let loginCheckStarted = false;

  /**
   * 启动登录页轮询检测
   */
  function startLoginCheck() {
    if (loginCheckStarted) {
      return;
    }
    loginCheckStarted = true;

    // 清除之前的检测器（如果有）
    stopLoginCheck();

    // 监听页面卸载事件（检测跳转到登录页）
    beforeUnloadHandler = () => {
      const loginStatus = checkLoginStatusSync();
      if (loginStatus?.isLoggedOut) {
        safeSend({
          type: MSG_TYPES.LOGIN_REQUIRED,
          payload: {
            provider: PROVIDER,
            loginUrl: loginStatus.loginUrl
          }
        });
        safeSend({
          type: MSG_TYPES.TASK_COMPLETED,
          payload: { provider: PROVIDER }
        });
        if (!messageSent) {
          resolvePendingWithError();
        }
      }
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);

    // 每 500ms 检查一次 URL
    loginCheckIntervalId = setInterval(() => {
      const loginStatus = checkLoginStatusSync();
      if (loginStatus?.isLoggedOut) {
        stopLoginCheck();
        const loginUrl = loginStatus.loginUrl;
        safeSend({
          type: MSG_TYPES.LOGIN_REQUIRED,
          payload: {
            provider: PROVIDER,
            loginUrl: loginUrl
          }
        });
        safeSend({
          type: MSG_TYPES.TASK_COMPLETED,
          payload: { provider: PROVIDER }
        });
        if (!messageSent) {
          resolvePendingWithError();
        }
      }
    }, 500);
  }

  /**
   * 停止登录页轮询检测
   */
  function stopLoginCheck() {
    if (loginCheckIntervalId) {
      clearInterval(loginCheckIntervalId);
      loginCheckIntervalId = null;
    }
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      beforeUnloadHandler = null;
    }
  }

  /**
   * 执行 AI 对话任务
   * @param {string} prompt - 用户问题
   * @param {object} settings - 设置选项
   * @returns {Promise<void>} 当消息成功发送后（获取到会话 ID）返回
   */
  async function executeTask(prompt, settings) {
    // 初始化注入器
    const caps = await initInjector();
    if (!caps) {
      safeSend({
        type: MSG_TYPES.ERROR,
        payload: { provider: PROVIDER, message: '注入器初始化失败' }
      });
      throw new Error('注入器初始化失败');
    }

    // 启动登录页轮询检测
    startLoginCheck();

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

      // 等待消息成功发送（获取到会话 ID）后返回
      // SSE 流式响应由回调继续处理，不阻塞返回
      await caps.chat('send', prompt, options, {
        onSseChunk: (text, isThink, stage, conversationId) => {
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text, stage, isThink }
          });
        },
        onConversationId: (conversationId) => {
          // 消息发送成功，但**不要**停止登录检测——因为页面可能会在发送后跳转到登录页
          // stopLoginCheck();  // 移除这行，让登录检测继续运行
          // 发送完成，已获取会话 ID，进入等待回复阶段
          safeSend({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: { provider: PROVIDER, text: '发送完成，等待 AI 回复...', stage: 'waiting', isStatus: true }
          });
        },
        onComplete: (fullText, conversationId) => {
          stopLoginCheck();
          safeSend({
            type: MSG_TYPES.TASK_COMPLETED,
            payload: { provider: PROVIDER }
          });
        },
        onError: (error, conversationId) => {
          stopLoginCheck();
          safeSend({
            type: MSG_TYPES.ERROR,
            payload: { provider: PROVIDER, message: error }
          });
        }
      });

      // 等待到这里表示消息已经成功发送（获取到会话 ID）

      // 清除之前可能发送过的错误状态（重试成功场景）
      safeSend({
        type: MSG_TYPES.CHUNK_RECEIVED,
        payload: { provider: PROVIDER, text: '', stage: 'connecting', isStatus: true, clearError: true }
      });

    } catch (err) {
      // 发生错误时停止登录检测
      stopLoginCheck();
      safeSend({
        type: MSG_TYPES.ERROR,
        payload: { provider: PROVIDER, message: err.message || '任务执行失败' }
      });
      safeSend({
        type: MSG_TYPES.TASK_COMPLETED,
        payload: { provider: PROVIDER }
      });
      throw err; // 重新抛出错误，让调用者知道失败了
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
