import { MSG_TYPES } from '../shared/messages.js';
import { PROVIDERS, getProvider } from './providers.js';

// ============================================================================
// 注册所有通道的 hook.js 到 MAIN world（最早时机，在页面任何 JS 之前执行）
// ============================================================================
const hookScripts = PROVIDERS.map(p => ({
  id: p.hookScriptId,
  matches: [p.matchPattern],
  js: [p.hookFile],
  runAt: 'document_start' as const,
  world: 'MAIN' as chrome.scripting.ExecutionWorld,
}));

chrome.scripting.registerContentScripts(hookScripts).catch(() => {
  chrome.scripting.updateContentScripts(hookScripts).catch(() => {});
});

// 点击图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// 监听派发任务 & 兜底注入 hook
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ---- 兜底注入 hook（通用，根据 payload.provider 查配置） ----
    if (request.type === MSG_TYPES.INJECT_HOOK && sender.tab?.id) {
        const provider = getProvider(request.payload?.provider);
        if (!provider) { sendResponse({ ok: false, err: 'unknown provider' }); return true; }

        const tabId = sender.tab.id;
        const globalVar = provider.hookGlobalVar;
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (varName: string) => !!(window as any)[varName],
            args: [globalVar],
        }).then((results) => {
            if (results?.[0]?.result) {
                sendResponse({ ok: true });
            } else {
                chrome.scripting.executeScript({
                    target: { tabId },
                    world: 'MAIN',
                    files: [provider.hookFile],
                }).then(() => { sendResponse({ ok: true }); })
                  .catch((err) => { sendResponse({ ok: false, err: String(err) }); });
            }
        }).catch((err) => { sendResponse({ ok: false, err: String(err) }); });
        return true;
    }

    // ---- 派发任务到对应通道标签页 ----
    if (request.type === MSG_TYPES.DISPATCH_TASK) {
        const { provider: providerId, prompt, settings } = request.payload;
        const provider = getProvider(providerId);
        if (provider) {
            routeToTab(provider.matchPattern, provider.startUrl, prompt, settings);
        }
        sendResponse({ status: 'routed' });
        return true;
    }

    return false;
});

// 核心路由逻辑：寻找或新建标签页
function routeToTab(matchPattern: string, targetUrl: string, prompt: string, settings?: Record<string, unknown>) {
    const msg = { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } };
    chrome.tabs.query({ url: matchPattern }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
        } else {
            chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete' && newTab.id) {
                        chrome.tabs.onUpdated.removeListener(listener);
                        setTimeout(() => {
                            if (newTab.id) {
                                chrome.tabs.sendMessage(newTab.id, msg).catch(() => {});
                            }
                        }, 2000);
                    }
                });
            });
        }
    });
}