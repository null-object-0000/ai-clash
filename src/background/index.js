import { MSG_TYPES } from '../shared/messages.js';
import { PROVIDERS, getProvider } from './providers.js';

// 存储每个provider对应的tab id，记住我们自己创建的tab
const providerTabMap = {};

// API配置存储键名
const API_CONFIG_KEY = 'aiclash.api.config';

// 加载API配置
async function loadApiConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_CONFIG_KEY], (result) => {
      resolve(result?.[API_CONFIG_KEY] || {});
    });
  });
}

// 保存API配置
async function saveApiConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [API_CONFIG_KEY]: config }, resolve);
  });
}

// 处理API模式请求
async function handleApiRequest(provider, prompt, settings = {}) {
  const apiConfig = provider.apiConfig;
  if (!apiConfig || !apiConfig.enabled) {
    throw new Error(`Provider ${provider.id} 不支持API模式`);
  }

  // 加载用户配置
  const userConfig = await loadApiConfig();
  const providerConfig = userConfig[provider.id] || {};
  const apiKey = providerConfig.apiKey;
  const model = providerConfig.model || apiConfig.defaultModel;

  if (!apiKey) {
    throw new Error(`请先配置 ${provider.name} 的API Key`);
  }

  // 构造请求
  const requestOptions = apiConfig.requestTemplate(prompt, apiKey, model, settings);

  // 超时控制器
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

  try {
    const response = await fetch(apiConfig.endpoint, {
      ...requestOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      const errorMsg = apiConfig.errorParser(response, body);
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const content = apiConfig.responseParser(trimmedLine);
        if (content === null) {
          // 流结束
          chrome.runtime.sendMessage({
            type: MSG_TYPES.TASK_COMPLETED,
            payload: { provider: provider.id }
          });
          return;
        }
        if (content) {
          // 发送内容块
          chrome.runtime.sendMessage({
            type: MSG_TYPES.CHUNK_RECEIVED,
            payload: {
              provider: provider.id,
              text: content,
              stage: 'responding',
              isThink: false
            }
          });
        }
      }
    }

    // 处理剩余的buffer
    if (buffer.trim()) {
      const content = apiConfig.responseParser(buffer.trim());
      if (content && content !== null) {
        chrome.runtime.sendMessage({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: {
            provider: provider.id,
            text: content,
            stage: 'responding',
            isThink: false
          }
        });
      }
    }

    // 任务完成
    chrome.runtime.sendMessage({
      type: MSG_TYPES.TASK_COMPLETED,
      payload: { provider: provider.id }
    });

  } catch (error) {
    clearTimeout(timeoutId);
    chrome.runtime.sendMessage({
      type: MSG_TYPES.ERROR,
      payload: {
        provider: provider.id,
        error: error.message || 'API请求失败'
      }
    });
  }
}

// 测试API Key有效性
async function testApiKey(providerId, apiKey) {
  const provider = getProvider(providerId);
  if (!provider || !provider.apiConfig || !provider.apiConfig.enabled) {
    return { success: false, error: '该通道不支持API模式' };
  }

  const apiConfig = provider.apiConfig;
  const model = apiConfig.defaultModel;

  try {
    // 构造一个简单的测试请求
    const requestOptions = apiConfig.requestTemplate('hi', apiKey, model, { max_tokens: 10 });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(apiConfig.endpoint, {
      ...requestOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'API Key无效' };
    }

    if (!response.ok) {
      const body = await response.text();
      const errorMsg = apiConfig.errorParser(response, body);
      return { success: false, error: errorMsg };
    }

    // 快速读取一下响应头就关闭，不用等完整响应
    reader = response.body.getReader();
    reader.cancel();

    return { success: true, message: 'API Key有效' };

  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: '请求超时' };
    }
    return { success: false, error: error.message || '请求失败' };
  }
}

// ============================================================================
// 注册所有通道的 hook.js 到 MAIN world（最早时机，在页面任何 JS 之前执行）
// ============================================================================
const hookScripts = PROVIDERS.map(p => ({
  id: p.hookScriptId,
  matches: [p.matchPattern],
  js: [p.hookFile],
  runAt: 'document_start',
  world: 'MAIN',
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
            func: (varName) => !!(window)[varName],
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

    // ---- 派发任务到对应通道 ----
    if (request.type === MSG_TYPES.DISPATCH_TASK) {
        const { provider: providerId, prompt, settings, mode } = request.payload;
        const provider = getProvider(providerId);
        if (provider) {
            // 如果指定了API模式，或者用户配置为API模式
            if (mode === 'api' || (provider.apiConfig?.enabled && !mode)) {
                // 先加载用户配置确认模式
                loadApiConfig().then(userConfig => {
                    const providerConfig = userConfig[providerId] || {};
                    if (providerConfig.mode === 'api' && providerConfig.apiKey) {
                        handleApiRequest(provider, prompt, settings);
                    } else {
                        // 默认走Web模式
                        routeToTab(provider, prompt, settings);
                    }
                });
            } else {
                // 走Web模式
                routeToTab(provider, prompt, settings);
            }
        }
        sendResponse({ status: 'routed' });
        return true;
    }

    // ---- 保存API配置 ----
    if (request.type === MSG_TYPES.SAVE_API_CONFIG) {
        const { providerId, config } = request.payload;
        loadApiConfig().then(existingConfig => {
            const newConfig = {
                ...existingConfig,
                [providerId]: {
                    ...existingConfig[providerId],
                    ...config
                }
            };
            saveApiConfig(newConfig).then(() => {
                sendResponse({ success: true });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        });
        return true;
    }

    // ---- 获取API配置 ----
    if (request.type === MSG_TYPES.GET_API_CONFIG) {
        loadApiConfig().then(config => {
            sendResponse({ success: true, config });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    // ---- 测试API Key ----
    if (request.type === MSG_TYPES.TEST_API_KEY) {
        const { providerId, apiKey } = request.payload;
        testApiKey(providerId, apiKey).then(result => {
            sendResponse(result);
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    return false;
});

// 核心路由逻辑：寻找或新建标签页
async function injectContentScriptAndSendMessage(tabId, provider, msg) {
    try {
        // 先尝试直接发送消息
        await chrome.tabs.sendMessage(tabId, msg);
    } catch {
        // 如果发送失败，说明content script未注入，先手动注入对应provider的content script
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [provider.contentScriptFile],
        });
        // 注入完成后等待一小段时间让content script初始化
        setTimeout(async () => {
            try {
                await chrome.tabs.sendMessage(tabId, msg);
            } catch (err) {
                console.error(`Failed to send message to ${provider.id} after injection:`, err);
            }
        }, 500);
    }
}

// 检查tab是否有效
async function isTabValid(tabId, provider) {
    try {
        const tab = await chrome.tabs.get(tabId);
        return tab.url?.startsWith(provider.matchPattern.replace('/*', '')) ?? false;
    } catch {
        return false;
    }
}

// 等待页面准备就绪的辅助函数
async function waitForPageReady(tabId, provider, maxWaitTime = 30000) {
    const startTime = Date.now();
    const checkInterval = 500; // 每500ms检查一次

    while (Date.now() - startTime < maxWaitTime) {
        try {
            // 检查页面是否加载完成，并且content script已经就绪
            const result = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // 检查页面是否已经加载完成
                    if (document.readyState !== 'complete') return false;
                    // 检查是否有我们的content script注入的标记，或者页面关键元素存在
                    return !!window.__aiclash_content_script_ready ||
                           document.querySelector('textarea, input[type="text"]') !== null;
                }
            });

            if (result?.[0]?.result) {
                return { success: true };
            }
        } catch (e) {
            // 忽略错误，继续等待
        }

        // 等待一段时间再检查
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return { success: false, error: '页面加载超时' };
}

async function routeToTab(provider, prompt, settings) {
    const msg = { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } };
    const rememberedTabId = providerTabMap[provider.id];

    // 首先检查我们记住的tab是否有效
    if (rememberedTabId && await isTabValid(rememberedTabId, provider)) {
        injectContentScriptAndSendMessage(rememberedTabId, provider, msg);
        return;
    }

    // 记住的tab无效，查询所有符合条件的tab
    chrome.tabs.query({ url: provider.matchPattern }, async (tabs) => {
        let targetTabId;

        if (tabs.length > 0 && tabs[0].id) {
            // 有符合条件的tab，使用第一个，并记住它
            targetTabId = tabs[0].id;
            providerTabMap[provider.id] = targetTabId;
            injectContentScriptAndSendMessage(targetTabId, provider, msg);
        } else {
            // 发送状态更新，告诉用户正在打开页面
            chrome.runtime.sendMessage({
                type: MSG_TYPES.TASK_STATUS_UPDATE,
                payload: {
                    provider: provider.id,
                    stage: 'opening',
                    text: `正在打开${provider.name}页面...`
                }
            });

            // 没有符合条件的tab，新建一个，并记住它
            chrome.tabs.create({ url: provider.startUrl, active: false }, async (newTab) => {
                if (newTab.id) {
                    providerTabMap[provider.id] = newTab.id;
                }

                try {
                    // 先等待页面加载完成事件
                    await new Promise((resolve, reject) => {
                        const timeoutId = setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(listener);
                            reject(new Error('页面加载超时'));
                        }, 30000);

                        function listener(tabId, info) {
                            if (tabId === newTab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                clearTimeout(timeoutId);
                                resolve();
                            }
                        }

                        chrome.tabs.onUpdated.addListener(listener);
                    });

                    // 发送状态更新，告诉用户正在等待页面准备就绪
                    chrome.runtime.sendMessage({
                        type: MSG_TYPES.TASK_STATUS_UPDATE,
                        payload: {
                            provider: provider.id,
                            stage: 'loading',
                            text: `正在等待${provider.name}页面加载完成...`
                        }
                    });

                    // 等待页面真正准备就绪
                    const readyResult = await waitForPageReady(newTab.id, provider);
                    if (!readyResult.success) {
                        throw new Error(readyResult.error);
                    }

                    // 注入content script并发送消息
                    await injectContentScriptAndSendMessage(newTab.id, provider, msg);

                } catch (error) {
                    // 发送错误消息
                    chrome.runtime.sendMessage({
                        type: MSG_TYPES.ERROR,
                        payload: {
                            provider: provider.id,
                            error: error.message || `打开${provider.name}页面失败`
                        }
                    });
                }
            });
        }
    });
}

// 监听tab关闭事件，清除对应的映射
chrome.tabs.onRemoved.addListener((tabId) => {
    for (const providerId in providerTabMap) {
        if (providerTabMap[providerId] === tabId) {
            delete providerTabMap[providerId];
            break;
        }
    }
});