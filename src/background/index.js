import OpenAI from 'openai';
import { MSG_TYPES } from '../shared/messages.js';
import { PROVIDERS, getProvider } from './providers.js';

// 存储每个provider对应的tab id，记住我们自己创建的tab
let providerTabMap = {};
const TAB_MAP_STORAGE_KEY = 'aiclash.provider.tab.map';

// 加载持久化的Tab映射，并清理无效条目
async function loadProviderTabMap() {
  return new Promise((resolve) => {
    chrome.storage.local.get([TAB_MAP_STORAGE_KEY], async (result) => {
      providerTabMap = result?.[TAB_MAP_STORAGE_KEY] || {};

      // 清理无效的Tab映射
      const validMap = {};
      for (const providerId in providerTabMap) {
        const tabId = providerTabMap[providerId];
        const provider = getProvider(providerId);
        if (provider && await isTabValid(tabId, provider)) {
          validMap[providerId] = tabId;
        }
      }

      // 如果有变化，更新映射并保存
      if (Object.keys(validMap).length !== Object.keys(providerTabMap).length) {
        providerTabMap = validMap;
        await saveProviderTabMap();
      }

      resolve(providerTabMap);
    });
  });
}

// 保存Tab映射到持久化存储
async function saveProviderTabMap() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TAB_MAP_STORAGE_KEY]: providerTabMap }, resolve);
  });
}

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

function sendProviderError(providerId, message) {
  chrome.runtime.sendMessage({
    type: MSG_TYPES.ERROR,
    payload: {
      provider: providerId,
      message,
    }
  });
}

/**
 * 为指定 provider 构建 OpenAI 客户端实例
 */
function createOpenAIClient(apiConfig, apiKey) {
  return new OpenAI({
    apiKey,
    baseURL: apiConfig.baseURL,
    dangerouslyAllowBrowser: true,
  });
}

// 处理API模式请求（统一使用 OpenAI SDK）
async function handleApiRequest(provider, prompt, settings = {}) {
  const apiConfig = provider.apiConfig;
  if (!apiConfig || !apiConfig.enabled) {
    throw new Error(`Provider ${provider.id} 不支持API模式`);
  }

  const userConfig = await loadApiConfig();
  const providerConfig = userConfig[provider.id] || {};
  const apiKey = providerConfig.apiKey;
  const model = providerConfig.model || apiConfig.defaultModel;

  if (!apiKey) {
    throw new Error(`请先配置 ${provider.name} 的API Key`);
  }

  const client = createOpenAIClient(apiConfig, apiKey);

  // 按模型取默认 max_tokens，settings 中显式传值时优先使用
  const defaultMaxTokens = apiConfig.modelDefaultMaxTokens?.[model] ?? 4096;
  const maxTokens = settings.max_tokens ?? defaultMaxTokens;

  // 深度思考开关：当 UI 开启且该模型支持通过 extra_body 注入思考参数时生效
  const supportsThinkingExtraBody = apiConfig.thinkingExtraBodyModels?.includes(model) ?? false;
  const extraBody = (settings.isDeepThinkingEnabled && supportsThinkingExtraBody)
    ? { thinking: { type: 'enabled' } }
    : undefined;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: settings.temperature ?? 0.7,
      max_tokens: maxTokens,
      ...(extraBody ? { extra_body: extraBody } : {}),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta ?? {};

      // 思考链内容（reasoning_content）
      if (delta.reasoning_content) {
        chrome.runtime.sendMessage({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: { provider: provider.id, text: delta.reasoning_content, stage: 'thinking', isThink: true }
        });
      }

      // 正文内容
      if (delta.content) {
        chrome.runtime.sendMessage({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: { provider: provider.id, text: delta.content, stage: 'responding', isThink: false }
        });
      }
    }

    chrome.runtime.sendMessage({
      type: MSG_TYPES.TASK_COMPLETED,
      payload: { provider: provider.id }
    });

  } catch (error) {
    sendProviderError(provider.id, error.message || 'API请求失败');
  }
}

// 测试API Key有效性（统一使用 OpenAI SDK）
async function testApiKey(providerId, apiKey) {
  const provider = getProvider(providerId);
  if (!provider || !provider.apiConfig || !provider.apiConfig.enabled) {
    return { success: false, error: '该通道不支持API模式' };
  }

  const apiConfig = provider.apiConfig;
  const client = createOpenAIClient(apiConfig, apiKey);

  try {
    await client.chat.completions.create({
      model: apiConfig.defaultModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 10,
      stream: false,
    });
    return { success: true, message: 'API Key 有效' };
  } catch (error) {
    const status = error?.status;
    if (status === 401 || status === 403) {
      return { success: false, error: 'API Key 无效' };
    }
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
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
            loadApiConfig().then(userConfig => {
                const providerConfig = userConfig[providerId] || {};
                const effectiveMode = mode ?? providerConfig.mode ?? 'web';

                if (effectiveMode === 'api') {
                    if (!provider.apiConfig?.enabled) {
                        sendProviderError(provider.id, `${provider.name} 暂不支持API模式`);
                        return;
                    }

                    if (!providerConfig.apiKey) {
                        sendProviderError(provider.id, `请先配置 ${provider.name} 的API Key`);
                        return;
                    }

                    handleApiRequest(provider, prompt, settings).catch((error) => {
                        sendProviderError(provider.id, error.message || 'API请求失败');
                    });
                    return;
                }

                routeToTab(provider, prompt, settings);
            }).catch((error) => {
                sendProviderError(providerId, error.message || '任务派发失败');
            });
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

    // ---- 打开或激活provider对应的tab ----
    if (request.type === MSG_TYPES.OPEN_PROVIDER_TAB) {
        const { providerId, activate } = request.payload;
        openOrActivateProviderTab(providerId, activate ?? false).then(result => {
            sendResponse(result);
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    // ---- 查询provider是否有有效绑定的tab ----
    if (request.type === MSG_TYPES.CHECK_PROVIDER_TAB_VALID) {
        const { providerId } = request.payload;
        const provider = getProvider(providerId);
        if (!provider) {
            sendResponse({ valid: false });
            return true;
        }
        const rememberedTabId = providerTabMap[provider.id];
        isTabValid(rememberedTabId, provider).then(valid => {
            sendResponse({ valid });
        }).catch(() => {
            sendResponse({ valid: false });
        });
        return true;
    }

    if (request.type === MSG_TYPES.GET_PROVIDER_RAW_URLS) {
        const providerIds = request.payload?.providerIds || [];
        getProviderRawUrls(providerIds).then((urlMap) => {
            sendResponse({ success: true, urlMap });
        }).catch((err) => {
            sendResponse({ success: false, error: err.message, urlMap: {} });
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

async function getProviderRawUrls(providerIds = []) {
    const urlMap = {};
    const targetProviderIds = providerIds.length ? providerIds : Object.keys(providerTabMap);

    for (const providerId of targetProviderIds) {
        const provider = getProvider(providerId);
        if (!provider) {
            urlMap[providerId] = '';
            continue;
        }

        const tabId = providerTabMap[providerId];
        if (!tabId) {
            urlMap[providerId] = '';
            continue;
        }

        try {
            const tab = await chrome.tabs.get(tabId);
            urlMap[providerId] = tab.url || '';
        } catch {
            urlMap[providerId] = '';
        }
    }

    return urlMap;
}

// 等待页面准备就绪的辅助函数
async function waitForPageReady(tabId, provider, maxWaitTime = 30000) {
    const startTime = Date.now();
    const checkInterval = 500; // 每500ms检查一次
    const pageReadySelectors = provider.id === 'longcat'
        ? ['.tiptap.ProseMirror', '[contenteditable="true"]', 'textarea', 'input[type="text"]']
        : ['textarea', 'input[type="text"]', '[contenteditable="true"]'];

    while (Date.now() - startTime < maxWaitTime) {
        try {
            // 检查页面是否加载完成，并且content script已经就绪
            const result = await chrome.scripting.executeScript({
                target: { tabId },
                func: (selectors) => {
                    // 检查页面是否已经加载完成
                    if (document.readyState !== 'complete') return false;
                    // 检查是否有我们的content script注入的标记，或者页面关键元素存在
                    return !!window.__aiclash_content_script_ready ||
                           selectors.some((selector) => document.querySelector(selector) !== null);
                },
                args: [pageReadySelectors],
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

    // 记住的tab无效，直接新建tab（不复用用户自行打开的tab）
    // 发送状态更新，告诉用户正在打开页面
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'opening',
            text: `正在打开${provider.name}页面...`
        }
    });

    // 新建tab，并记住它
    chrome.tabs.create({ url: provider.startUrl, active: false }, async (newTab) => {
        if (newTab.id) {
            providerTabMap[provider.id] = newTab.id;
            saveProviderTabMap(); // 保存映射
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
            sendProviderError(provider.id, error.message || `打开${provider.name}页面失败`);
        }
    });
}

// 打开或激活provider对应的tab（处理"前往"按钮请求）
async function openOrActivateProviderTab(providerId, activate = false) {
    const provider = getProvider(providerId);
    if (!provider) {
        return { success: false, error: '未知的provider' };
    }

    const rememberedTabId = providerTabMap[provider.id];

    // 检查我们记住的tab是否有效
    if (rememberedTabId && await isTabValid(rememberedTabId, provider)) {
        // 如果需要激活才激活tab并聚焦窗口
        if (activate) {
            await chrome.tabs.update(rememberedTabId, { active: true });
            const tab = await chrome.tabs.get(rememberedTabId);
            await chrome.windows.update(tab.windowId, { focused: true });
        }
        return { success: true, tabId: rememberedTabId, action: activate ? 'activated' : 'validated' };
    }

    // 没有有效绑定的tab，新建一个
    try {
        const newTab = await chrome.tabs.create({ url: provider.startUrl, active: activate });
        if (newTab.id) {
            providerTabMap[provider.id] = newTab.id;
            saveProviderTabMap(); // 保存映射
        }
        return { success: true, tabId: newTab.id, action: 'created' };
    } catch (error) {
        return { success: false, error: error.message || '创建tab失败' };
    }
}

// 后台启动时加载持久化的Tab映射
loadProviderTabMap();

// 监听tab关闭事件，清除对应的映射
chrome.tabs.onRemoved.addListener((tabId) => {
    for (const providerId in providerTabMap) {
        if (providerTabMap[providerId] === tabId) {
            delete providerTabMap[providerId];
            saveProviderTabMap(); // 保存修改
            break;
        }
    }
});