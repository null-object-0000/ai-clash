import { MSG_TYPES } from '../shared/messages.js';

// ============================================================================
// 注册 hook.js 到 MAIN world（最早时机，在页面任何 JS 之前执行）
// 这是确保 fetch/XHR 等 API 被 patch 后被页面缓存的关键
// ============================================================================
chrome.scripting.registerContentScripts([{
  id: 'anybridge-main-hook',
  matches: ['https://chat.deepseek.com/*'],
  js: ['src/content/hook.js'],
  runAt: 'document_start',
  world: 'MAIN' as chrome.scripting.ExecutionWorld,
}]).catch(() => {
  // 已注册过 → 更新内容（扩展重载后 id 可能冲突）
  chrome.scripting.updateContentScripts([{
    id: 'anybridge-main-hook',
    matches: ['https://chat.deepseek.com/*'],
    js: ['src/content/hook.js'],
    runAt: 'document_start',
    world: 'MAIN' as chrome.scripting.ExecutionWorld,
  }]).catch(() => {});
});

// 点击图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// 监听派发任务 & 注入 hook（绕过 CSP：用 scripting.executeScript world: MAIN）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === MSG_TYPES.INJECT_HOOK && sender.tab?.id) {
        // 先检查 hook 是否已注入（由 registerContentScripts 完成），避免重复注入导致 SyntaxError
        const tabId = sender.tab.id;
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => !!(window as any).__abHookV,
        }).then((results) => {
            if (results?.[0]?.result) {
                // hook 已存在，无需再注入
                sendResponse({ ok: true });
            } else {
                chrome.scripting.executeScript({
                    target: { tabId },
                    world: 'MAIN',
                    files: ['src/content/hook.js'],
                }).then(() => { sendResponse({ ok: true }); }).catch((err) => { sendResponse({ ok: false, err: String(err) }); });
            }
        }).catch((err) => { sendResponse({ ok: false, err: String(err) }); });
        return true; // 保持 channel 开放以异步 sendResponse
    }
    if (request.type === MSG_TYPES.DISPATCH_TASK) {
        const { provider, prompt, settings } = request.payload;

        if (provider === 'deepseek') {
            routeToTab('https://chat.deepseek.com/*', 'https://chat.deepseek.com/', prompt, settings);
        }
        sendResponse({ status: 'routed' });
        return true;
    }
    // 对于 CHUNK_RECEIVED / TASK_COMPLETED 等消息不需要 background 处理
    // 不 return true，让 Chrome 立即释放消息通道
    return false;
});

// 核心路由逻辑：寻找或新建标签页
function routeToTab(matchPattern: string, targetUrl: string, prompt: string, settings?: Record<string, unknown>) {
    chrome.tabs.query({ url: matchPattern }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
            // 找到已有标签页，直接发指令
            chrome.tabs.sendMessage(tabs[0].id, { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } });
        } else {
            // 没找到，静默打开一个新标签页
            chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete' && newTab.id) {
                        chrome.tabs.onUpdated.removeListener(listener);
                        // 延迟一点等 React/Vue 挂载完 DOM
                        setTimeout(() => {
                            if (newTab.id) {
                                chrome.tabs.sendMessage(newTab.id, { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } });
                            }
                        }, 2000);
                    }
                });
            });
        }
    });
}