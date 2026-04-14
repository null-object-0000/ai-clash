import OpenAI from 'openai';
import { MSG_TYPES } from '../shared/messages.js';
import { PROVIDERS, getProvider, deriveProviderConfig } from './providers.js';
import logger from '../shared/logger.js';

// Service Worker 保活机制 - 单个持久化心跳 alarm
const KEEPALIVE_ALARM_NAME = 'aiclash-sw-keepalive';
let activeRequestCount = 0; // 跟踪活跃请求数量
let keepaliveAlarmStarted = false; // 保活 alarm 是否已启动

// 启动保活机制 - 使用单个周期性 alarm 而非每次请求创建新 alarm
function startKeepalive() {
  if (keepaliveAlarmStarted) return;

  // 创建一个周期性 alarm，每 0.3 分钟 (18 秒) 触发一次
  chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: 0.3 });
  keepaliveAlarmStarted = true;
  logger.log('[AI Clash] SW 保活机制已启动');
}

// 停止保活机制 - 当没有活跃请求时清理 alarm
function stopKeepalive() {
  if (!keepaliveAlarmStarted) return;

  chrome.alarms.clear(KEEPALIVE_ALARM_NAME);
  keepaliveAlarmStarted = false;
  logger.log('[AI Clash] SW 保活机制已停止');
}

// 请求开始时调用
function beginRequest() {
  activeRequestCount++;
  if (activeRequestCount === 1) {
    startKeepalive();
  }
}

// 请求结束时调用
function endRequest() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  if (activeRequestCount === 0) {
    // 延迟停止保活，给消息发送留出时间
    setTimeout(() => {
      if (activeRequestCount === 0) {
        stopKeepalive();
      }
    }, 2000);
  }
}

// 注册保活 alarm 监听器 - 空回调即可，仅用于保持 SW 活跃
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM_NAME) {
    // 仅用于保活，无需执行任何逻辑
  }
});

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
  // 从 models 数组中查找模型的 maxTokens 配置
  const modelConfig = apiConfig.models?.find(m => m.id === model);
  const defaultMaxTokens = modelConfig?.maxTokens ?? 4096;
  const maxTokens = settings.max_tokens ?? defaultMaxTokens;

  // 深度思考开关：当 UI 开启且该模型支持通过 extra_body 注入思考参数时生效
  const supportsThinkingExtraBody = modelConfig?.supportThinking ?? false;
  const extraBody = (settings.isDeepThinkingEnabled && supportsThinkingExtraBody)
    ? { thinking: { type: 'enabled' } }
    : undefined;

  // 构建消息数组：若有多轮历史则拼接，否则单条
  const conversationHistory = settings.conversationHistory || [];
  const messages = [
    ...conversationHistory.flatMap(turn => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.response },
    ]),
    { role: 'user', content: prompt },
  ];

  // 使用统一的保活机制
  beginRequest();

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
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
  } finally {
    endRequest();
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

// 归纳总结的系统提示词
const SUMMARY_SYSTEM_PROMPT = `# Role
你是一个搭载在「AI对撞机」上的高级仲裁与决策引擎。你的任务是深度分析多位顶尖AI专家针对同一问题给出的独立回答，去伪存真、提炼共识、保留分歧，最终为用户生成一份集大成的终极回复。

# Core Directives (核心准则)
1. 交叉核实 (Fact-Checking)：剔除明显的幻觉和事实性错误。
2. 视角碰撞 (Collision)：敏锐捕捉不同模型之间的【观点分歧】。不要掩盖分歧，而是客观展现它们在主观判断、代码实现或策略选择上的差异。
3. 降噪重构 (De-noising)：拒绝简单的复制拼接，消除各回答中的冗余废话（如“好的，我来为您解答”）。

# Output Workflow (输出自适应路由)
请严格根据用户输入的问题类型，选择对应的输出框架：

### 🟢 场景 A：明确任务类（如：写代码、翻译、食谱、公文写作、数学题）
*用户需要的是一个直接可用的最终成品。*
直接输出一份整合了各方优点的【终极最优解】。在最优解下方，用简短的 \`### 💡 对撞机点评\` 补充说明各模型的贡献或差异即可，无需长篇大论。

### 🔴 场景 B：开放决策/深度探讨类（如：行业分析、人生建议、技术选型、哲理探讨）
*用户需要的是深度视角的碰撞与决策支持。请严格按照以下 Markdown 结构输出：*

### 💡 核心共识 (The Consensus)
> 一针见血地提炼所有专家都认同的核心事实和底层逻辑。

### ⚡ 观点对撞 (The Collision)
> 梳理专家们存在的分歧点。列出具体的争议，客观剖析各自的底层论据及合理性。

### 🧠 综合解析 (Deep Dive)
> 打破单一视角，将信息重新编排，多维度（如长短期/微观宏观等）将各专家的独到见解融入其中。

### 🎯 终极建议 (Actionable Conclusion)
> 基于对撞分析，给出具有极高可操作性的结论或 \`If-Then\` 情景化建议。`;

/**
 * 处理归纳总结请求：收集各通道回答，调用指定 API 进行汇总分析
 * @param {string} question - 用户原始问题
 * @param {Array<{providerId: string, name: string, text: string}>} responses - 各通道回答
 * @param {{providerId: string, model: string}} summaryConfig - 归纳总结配置
 */
async function handleSummaryRequest(question, responses, summaryConfig) {
  const { providerId, model } = summaryConfig;
  const provider = getProvider(providerId);
  if (!provider || !provider.apiConfig?.enabled) {
    throw new Error('归纳总结 API 配置无效，请在设置中选择有效通道');
  }

  // summarizer 是内置服务，不需要 API Key
  const isBuiltInSummarizer = providerId === 'summarizer';
  let apiKey = 'builtin-no-key-needed';

  if (!isBuiltInSummarizer) {
    const userConfig = await loadApiConfig();
    apiKey = userConfig[providerId]?.apiKey;
    if (!apiKey) {
      throw new Error(`请先配置 ${provider.name} 的 API Key`);
    }
  }

  const validResponses = responses.filter(r => r.text && r.text.trim());
  if (!validResponses.length) {
    throw new Error('没有有效的 AI 回答可供总结');
  }

  chrome.runtime.sendMessage({
    type: MSG_TYPES.TASK_STATUS_UPDATE,
    payload: { provider: '_summary', text: '正在归纳总结各通道回答...' }
  });

  const client = createOpenAIClient(provider.apiConfig, apiKey);
  const effectiveModel = model || provider.apiConfig.defaultModel;
  // 从 models 数组中查找模型的 maxTokens 配置
  const modelConfig = provider.apiConfig.models?.find(m => m.id === effectiveModel);
  const maxTokens = modelConfig?.maxTokens ?? 8192;

  const responseParts = validResponses
    .map(r => `【${r.name} 的回答】\n${r.text}`)
    .join('\n\n');

  const userContent = `【用户原始问题】\n${question}\n\n${responseParts}`;

  // 使用统一的保活机制
  beginRequest();

  try {
    const stream = await client.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta ?? {};

      if (delta.reasoning_content) {
        chrome.runtime.sendMessage({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: { provider: '_summary', text: delta.reasoning_content, stage: 'thinking', isThink: true }
        });
      }

      if (delta.content) {
        chrome.runtime.sendMessage({
          type: MSG_TYPES.CHUNK_RECEIVED,
          payload: { provider: '_summary', text: delta.content, stage: 'responding', isThink: false }
        });
      }
    }

    chrome.runtime.sendMessage({
      type: MSG_TYPES.TASK_COMPLETED,
      payload: { provider: '_summary' }
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      type: MSG_TYPES.ERROR,
      payload: { provider: '_summary', message: error.message || '归纳总结请求失败' }
    });
  } finally {
    endRequest();
  }
}

// 注意：inject 包的 SSE 拦截逻辑在 content script 中直接执行
// 不再需要单独的 hook.js 文件注入

// 点击图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});


// 监听派发任务
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // ---- 在 MAIN world 注入 debug 代理（绕过 CSP）----
    if (request.type === MSG_TYPES.INJECT_DEBUG_GLOBAL && sender.tab?.id) {
        const { provider, methods } = request.payload;
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            func: (provider, methods) => {
                var seq = 0;
                function rpc(path, args) {
                    return new Promise(function(resolve, reject) {
                        var id = ++seq;
                        function h(e) {
                            if (e.detail && e.detail.callId === id) {
                                window.removeEventListener('__aiclash_result', h);
                                if (e.detail.error) reject(new Error(e.detail.error));
                                else resolve(e.detail.result);
                            }
                        }
                        window.addEventListener('__aiclash_result', h);
                        window.dispatchEvent(new CustomEvent('__aiclash_call', {
                            detail: { callId: id, path: path, args: args }
                        }));
                    });
                }
                var obj = { provider: provider };
                Object.keys(methods).forEach(function(cap) {
                    obj[cap] = {};
                    methods[cap].forEach(function(fn) {
                        obj[cap][fn] = function() {
                            return rpc(cap + '.' + fn, Array.prototype.slice.call(arguments));
                        };
                    });
                });
                window.__AI_CLASH = obj;
            },
            args: [provider, methods],
        }).then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, err: String(err) }));
        return true;
    }

    // ---- 派发任务到对应通道 ----
    if (request.type === MSG_TYPES.DISPATCH_TASK) {
        const { provider: providerId, prompt, settings, mode } = request.payload;
        const provider = getProvider(providerId);
        if (!provider) {
            sendResponse({ status: 'error', error: 'provider 不存在' });
            return true;
        }

        // 异步处理任务派发
        (async () => {
            try {
                const userConfig = await loadApiConfig();
                const providerConfig = userConfig[providerId] || {};
                const effectiveMode = mode ?? providerConfig.mode ?? 'web';

                if (effectiveMode === 'api') {
                    if (!provider.apiConfig?.enabled) {
                        sendProviderError(provider.id, provider.name + ' 暂不支持 API 模式');
                        return;
                    }

                    if (!providerConfig.apiKey) {
                        sendProviderError(provider.id, '请先配置 ' + provider.name + ' 的 API Key');
                        return;
                    }

                    await handleApiRequest(provider, prompt, settings);
                    return;
                }

                // Web 模式：等待任务成功提交到 tab 后再返回
                await routeToTab(provider, prompt, settings);
            } catch (error) {
                sendProviderError(providerId, error.message || '任务派发失败');
            } finally {
                sendResponse({ status: 'routed' });
            }
        })();

        // 返回 true 表示我们会异步调用 sendResponse
        return true;
    }

    // ---- 归纳总结 ----
    if (request.type === MSG_TYPES.DISPATCH_SUMMARY) {
        const { question, responses, summaryConfig } = request.payload;
        handleSummaryRequest(question, responses, summaryConfig).catch((error) => {
            chrome.runtime.sendMessage({
                type: MSG_TYPES.ERROR,
                payload: { provider: '_summary', message: error.message || '归纳总结失败' }
            });
        });
        sendResponse({ status: 'dispatched' });
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
        // 先尝试直接发送消息，并等待 content script 响应
        const response = await chrome.tabs.sendMessage(tabId, msg);
        if (!response?.ok) {
            throw new Error('content script 返回错误');
        }
        // 消息发送成功，更新为 sending 阶段
        chrome.runtime.sendMessage({
            type: MSG_TYPES.TASK_STATUS_UPDATE,
            payload: { provider: provider.id, stage: 'sending', text: `消息已发送，等待${provider.name}响应...` }
        }).catch(() => {});
        logger.log(`[AI Clash] ${provider.id} 消息发送成功，等待执行...`);
    } catch {
        // 发送失败，说明 content script 已失效（常见于扩展重新加载后旧 Tab 的孤儿上下文）
        // 不能用 executeScript({ files }) 重注入——那会以普通脚本执行 ES Module 文件，导致 import 报错
        // 正确做法：重载该 Tab，让 manifest 声明的 content script 自动重新注入
        logger.log(`[AI Clash] ${provider.id} content script 未响应，正在重载页面以重新注入...`);

        chrome.runtime.sendMessage({
            type: MSG_TYPES.TASK_STATUS_UPDATE,
            payload: { provider: provider.id, stage: 'loading', text: `正在重新加载${provider.name}页面...` }
        }).catch(() => {});

        try {
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    reject(new Error('页面重载超时'));
                }, 30000);

                function listener(updatedTabId, info) {
                    if (updatedTabId === tabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        clearTimeout(timeoutId);
                        resolve();
                    }
                }

                chrome.tabs.onUpdated.addListener(listener);
                chrome.tabs.reload(tabId);
            });

            const readyResult = await waitForPageReady(tabId, provider);
            if (!readyResult.success) {
                throw new Error(readyResult.error || 'content script 未就绪');
            }

            const response = await chrome.tabs.sendMessage(tabId, msg);
            if (!response?.ok) {
                throw new Error('content script 返回错误');
            }
            // 消息发送成功（重载后），更新为 sending 阶段
            chrome.runtime.sendMessage({
                type: MSG_TYPES.TASK_STATUS_UPDATE,
                payload: { provider: provider.id, stage: 'sending', text: `消息已发送（重载后），等待${provider.name}响应...` }
            }).catch(() => {});
            logger.log(`[AI Clash] ${provider.id} 消息发送成功（重载后），等待执行...`);
        } catch (err) {
            logger.error(`[AI Clash] Failed to send message to ${provider.id} after reload:`, err);
            sendProviderError(provider.id, `${provider.name} 页面重载后仍无法连接：${err.message}`);
        }
    }
}

// 检查tab是否有效
async function isTabValid(tabId, provider) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.discarded) return false;
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

// 打开或激活 provider 对应的 tab，并返回 tab id
async function openAndActivateTab(provider) {
    const rememberedTabId = providerTabMap[provider.id];

    // 检查我们记住的 tab 是否有效
    if (rememberedTabId && await isTabValid(rememberedTabId, provider)) {
        // 激活 tab 并聚焦窗口
        await chrome.tabs.update(rememberedTabId, { active: true });
        const tab = await chrome.tabs.get(rememberedTabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        return { success: true, tabId: rememberedTabId };
    }

    // 没有有效绑定的 tab，新建一个
    const newTab = await chrome.tabs.create({ url: provider.startUrl, active: true });
    if (newTab.id) {
        providerTabMap[provider.id] = newTab.id;
        await saveProviderTabMap();
    }
    return { success: true, tabId: newTab.id };
}

// 等待页面加载完成
async function waitForTabComplete(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
        // 先检查页面是否已经加载完成
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                reject(new Error('Tab 不存在'));
                return;
            }
            if (tab.status === 'complete') {
                resolve();
                return;
            }

            // 页面还在加载，监听 onUpdated 事件
            const timeoutId = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error('页面加载超时'));
            }, timeout);

            function listener(updatedTabId, info) {
                if (updatedTabId === tabId && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    clearTimeout(timeoutId);
                    resolve();
                }
            }
            chrome.tabs.onUpdated.addListener(listener);
        });
    });
}

// 提交任务到指定 provider 的 tab
async function routeToTab(provider, prompt, settings) {
    const msg = { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } };

    // 0. 任务开始，先显示等待启动状态（logo 会在此时展示）
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'waiting',
            text: `等待启动${provider.name}...`
        }
    }).catch(() => {});

    // 1. 先打开或激活 tab（总是激活，确保 standalone 注入和通信正常）
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'opening',
            text: `正在启动${provider.name}...`
        }
    }).catch(() => {});

    const tabResult = await openAndActivateTab(provider);
    if (!tabResult.success || !tabResult.tabId) {
        sendProviderError(provider.id, `无法打开${provider.name}页面`);
        return;
    }

    const tabId = tabResult.tabId;

    // 2. 等待页面加载完成
    await waitForTabComplete(tabId);

    // 3. 发送状态更新
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'loading',
            text: `正在等待${provider.name}页面加载完成...`
        }
    });

    // 4. 等待页面真正准备就绪（content script 注入完成）
    const readyResult = await waitForPageReady(tabId, provider);
    if (!readyResult.success) {
        throw new Error(readyResult.error || 'content script 未就绪');
    }

    // 5. 连接通道成功，准备发送消息
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'connecting',
            text: `${provider.name} 已就绪，正在发送消息...`
        }
    }).catch(() => {});

    // 6. 发送消息执行任务
    await injectContentScriptAndSendMessage(tabId, provider, msg);
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