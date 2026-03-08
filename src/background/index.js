import { MSG_TYPES } from '../shared/messages.js';

// 点击图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// 监听派发任务 & 注入 hook（绕过 CSP：用 scripting.executeScript world: MAIN）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === MSG_TYPES.INJECT_HOOK && sender.tab?.id) {
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            files: ['src/content/hook.js'],
        }).then(() => { sendResponse({ ok: true }); }).catch((err) => { sendResponse({ ok: false, err: String(err) }); });
        return true; // 保持 channel 开放以异步 sendResponse
    }
    if (request.type === MSG_TYPES.DISPATCH_TASK) {
        const { provider, prompt } = request.payload;

        if (provider === 'deepseek') {
            routeToTab('https://chat.deepseek.com/*', 'https://chat.deepseek.com/', prompt);
        }
        sendResponse({ status: 'routed' });
    }
    return true;
});

// 核心路由逻辑：寻找或新建标签页
function routeToTab(matchPattern, targetUrl, prompt) {
    chrome.tabs.query({ url: matchPattern }, (tabs) => {
        if (tabs.length > 0) {
            // 找到已有标签页，直接发指令
            chrome.tabs.sendMessage(tabs[0].id, { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt } });
        } else {
            // 没找到，静默打开一个新标签页
            chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        // 延迟一点等 React/Vue 挂载完 DOM
                        setTimeout(() => {
                            chrome.tabs.sendMessage(newTab.id, { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt } });
                        }, 2000);
                    }
                });
            });
        }
    });
}