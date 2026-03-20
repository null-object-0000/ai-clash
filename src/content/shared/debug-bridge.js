import { MSG_TYPES } from '../../shared/messages.js';
import { isContextValid, safeSend } from './utils.js';

/**
 * 将能力对象暴露到页面主世界的 window.__AI_CLASH
 *
 * Content Script 运行在 isolated world，直接赋值 window 变量在 DevTools
 * 默认控制台中不可见。此模块通过两步实现跨世界暴露：
 *
 * 1. 请求 background 用 chrome.scripting.executeScript({ world: 'MAIN' })
 *    在主世界创建 RPC 代理对象（绕过 CSP）
 * 2. 在 isolated world 监听 CustomEvent 调用请求，桥接到实际能力方法
 *
 * 用法:
 *   exposeDebugGlobal('deepseek', { thinking: thinkingToggle });
 *
 * 控制台:
 *   await __AI_CLASH.thinking.getState()
 *   await __AI_CLASH.thinking.sync(true)
 */
export function exposeDebugGlobal(provider, capabilities) {
  // ---- isolated world: 监听来自 main world 的 RPC 调用 ----
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

  // ---- 收集方法名，请求 background 注入 main world 代理 ----
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
