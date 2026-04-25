import OpenAI from 'openai';
import { MSG_TYPES } from '../shared/messages.js';
import { SUMMARY_SYSTEM_PROMPT } from '../shared/summaryPrompt.js';
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

// Web 模式任务串行队列：避免多个 provider 同时抢占 tab 激活与页面就绪流程
let webTaskQueue = Promise.resolve();

function enqueueWebTask(task, label) {
  const run = webTaskQueue.catch(() => {}).then(async () => {
    beginRequest();
    try {
      await task();
    } finally {
      endRequest();
    }
  });

  webTaskQueue = run.catch((error) => {
    logger.error(`[AI Clash] Web 队列任务失败: ${label}`, error);
  });

  return run;
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

function sendProviderError(providerId, message, errorType = 'system_error') {
  chrome.runtime.sendMessage({
    type: MSG_TYPES.ERROR,
    payload: {
      provider: providerId,
      message,
      errorType,
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
  const configuredModel = providerConfig.model || apiConfig.defaultModel;
  const configuredModelExists = apiConfig.models?.some(m => m.id === configuredModel);
  const model = configuredModelExists ? configuredModel : apiConfig.defaultModel;

  if (!apiKey) {
    throw new Error(`请先配置 ${provider.name} 的API Key`);
  }

  const client = createOpenAIClient(apiConfig, apiKey);

  // 按模型取默认 max_tokens，settings 中显式传值时优先使用
  // 从 models 数组中查找模型的 maxTokens 配置
  const modelConfig = apiConfig.models?.find(m => m.id === model);
  const defaultMaxTokens = modelConfig?.maxTokens ?? 4096;
  const maxTokens = settings.max_tokens ?? defaultMaxTokens;

  // 深度思考开关：模型默认开启思考时，关闭状态也需要显式传 disabled
  const supportsThinkingExtraBody = modelConfig?.supportThinking ?? false;
  const extraBody = supportsThinkingExtraBody
    ? { thinking: { type: settings.isDeepThinkingEnabled ? 'enabled' : 'disabled' } }
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

function createSummaryAnalysisRouter() {
  const ANALYSIS_TAGS = [
    {
      open: '[[AI_CLASH_SUMMARY_ANALYSIS_BEGIN]]',
      close: '[[AI_CLASH_SUMMARY_ANALYSIS_END]]',
    },
    {
      open: '<think>',
      close: '</think>',
    },
  ];
  let buffer = '';
  let insideAnalysis = false;
  let hasClosedAnalysis = false;
  let bufferPart = 'final';
  let activeCloseTag = ANALYSIS_TAGS[0].close;

  const emit = (text, summaryPart) => {
    if (!text) return;
    chrome.runtime.sendMessage({
      type: MSG_TYPES.CHUNK_RECEIVED,
      payload: {
        provider: '_summary',
        text,
        stage: summaryPart === 'analysis' ? 'thinking' : 'responding',
        isThink: summaryPart !== 'final',
        summaryPart,
      }
    });
  };

  const getHeldTagPrefixLength = (text, tags) => {
    const lowerText = text.toLowerCase();
    let held = 0;
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      for (let len = 1; len < lowerTag.length; len++) {
        if (lowerText.endsWith(lowerTag.slice(0, len))) {
          held = Math.max(held, len);
        }
      }
    }
    return held;
  };

  const findTag = (text, tags) => {
    const lowerText = text.toLowerCase();
    let best = null;
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      const index = lowerText.indexOf(lowerTag);
      if (index >= 0 && (!best || index < best.index)) {
        best = { index, tag };
      }
    }
    return best;
  };

  const drain = (flush = false) => {
    while (buffer) {
      const tagCandidates = insideAnalysis
        ? [activeCloseTag]
        : ANALYSIS_TAGS.map(t => t.open);
      const match = findTag(buffer, tagCandidates);

      if (match) {
        emit(buffer.slice(0, match.index), insideAnalysis ? 'analysis' : (hasClosedAnalysis ? 'final' : bufferPart));
        buffer = buffer.slice(match.index + match.tag.length);
        if (insideAnalysis) {
          insideAnalysis = false;
          hasClosedAnalysis = true;
          bufferPart = 'final';
        } else {
          insideAnalysis = true;
          activeCloseTag = ANALYSIS_TAGS.find(t => t.open.toLowerCase() === match.tag.toLowerCase())?.close || ANALYSIS_TAGS[0].close;
        }
        continue;
      }

      if (flush) {
        emit(buffer, insideAnalysis ? 'analysis' : (hasClosedAnalysis ? 'final' : bufferPart));
        buffer = '';
        return;
      }

      const held = getHeldTagPrefixLength(buffer, tagCandidates);
      const emitLength = buffer.length - held;
      if (emitLength <= 0) return;

      emit(buffer.slice(0, emitLength), insideAnalysis ? 'analysis' : (hasClosedAnalysis ? 'final' : bufferPart));
      buffer = buffer.slice(emitLength);
      return;
    }
  };

  return {
    push(text, defaultPart = 'final') {
      if (!buffer) bufferPart = hasClosedAnalysis ? 'final' : defaultPart;
      buffer += text;
      drain(false);
    },
    flush() {
      drain(true);
    },
  };
}

/**
 * 处理归纳总结请求：收集各通道回答，调用指定 API 进行汇总分析
 * @param {string} question - 用户原始问题
 * @param {Array<{providerId: string, name: string, text: string}>} responses - 各通道回答
 * @param {{providerId: string, model: string, customPrompt?: string}} summaryConfig - 归纳总结配置
 */
async function handleSummaryRequest(question, responses, summaryConfig) {
  const { providerId, model, customPrompt } = summaryConfig;
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
  const supportsThinkingExtraBody = modelConfig?.supportThinking ?? false;
  const extraBody = supportsThinkingExtraBody
    ? { thinking: { type: 'enabled' } }
    : undefined;

  const responseParts = validResponses
    .map(r => `【${r.name} 的回答】\n${r.text}`)
    .join('\n\n');

  const userContent = `【用户原始问题】\n${question}\n\n${responseParts}`;

  // 使用自定义提示词，如果未设置则使用默认提示词
  const systemPrompt = customPrompt ?? SUMMARY_SYSTEM_PROMPT;

  // 使用统一的保活机制
  beginRequest();

  try {
    const summaryAnalysisRouter = createSummaryAnalysisRouter();
    const stream = await client.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: maxTokens,
      ...(extraBody ? { extra_body: extraBody } : {}),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta ?? {};

      if (delta.reasoning_content) {
        summaryAnalysisRouter.push(delta.reasoning_content, 'think');
      }

      if (delta.content) {
        summaryAnalysisRouter.push(delta.content, 'final');
      }
    }
    summaryAnalysisRouter.flush();

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
            logger.log(`[AI Clash] DISPATCH_TASK: provider ${providerId} 不存在`);
            sendResponse({ status: 'error', error: 'provider 不存在' });
            return true;
        }

        logger.log(`[AI Clash] DISPATCH_TASK: 收到任务派发请求 provider=${providerId}`);

        // 立即返回响应，避免 sidepanel 超时（5 秒）
        sendResponse({ status: 'routed' });

        // 异步处理任务派发
        (async () => {
            try {
                logger.log(`[AI Clash] DISPATCH_TASK: 开始处理 ${providerId}`);
                const userConfig = await loadApiConfig();
                const providerConfig = userConfig[providerId] || {};
                const effectiveMode = mode ?? providerConfig.mode ?? 'web';

                logger.log(`[AI Clash] DISPATCH_TASK: ${providerId} effectiveMode=${effectiveMode}`);

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
                await enqueueWebTask(async () => {
                    logger.log(`[AI Clash] DISPATCH_TASK: ${providerId} 开始 routeToTab`);
                    await routeToTab(provider, prompt, settings);
                    logger.log(`[AI Clash] DISPATCH_TASK: ${providerId} routeToTab 完成`);
                }, `dispatch:${providerId}`);
            } catch (error) {
                logger.error(`[AI Clash] DISPATCH_TASK: ${providerId} 失败:`, error);
                sendProviderError(providerId, error.message || '任务派发失败');
            }
        })();

        // 返回 true 表示我们会异步调用 sendResponse（已经同步返回过了）
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

    if (request.type === MSG_TYPES.GET_PROVIDER_LOGIN_STATE) {
        const { providerId } = request.payload || {};
        getProviderLoginState(providerId).then((state) => {
            sendResponse({ success: true, state });
        }).catch((err) => {
            sendResponse({
                success: false,
                state: { status: 'unknown', message: err.message || '无法确认登录状态' },
            });
        });
        return true;
    }

    if (request.type === MSG_TYPES.TRY_FOCUS_FOLLOW) {
        const { completedProvider } = request.payload;
        const completedTabId = providerTabMap[completedProvider];
        if (!completedTabId) return false;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            // Only switch if the completed tab IS the currently active tab
            if (!activeTab || activeTab.id !== completedTabId) return;

            // Wait 1.2s for DOM to flush and user to see the final output
            setTimeout(() => {
                // Check if still active
                chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    const currentActiveTab = tabs[0];
                    if (!currentActiveTab || currentActiveTab.id !== completedTabId) return;

                    // Get running providers from sidepanel
                    chrome.runtime.sendMessage({ type: MSG_TYPES.GET_RUNNING_PROVIDERS }, (res) => {
                        const runningIds = res?.runningIds || [];
                        if (runningIds.length > 0) {
                            const nextId = runningIds[0];
                            const nextTabId = providerTabMap[nextId];
                            if (nextTabId) {
                                logger.log(`[Focus Follow] Switching to ${nextId}`);
                                chrome.tabs.update(nextTabId, { active: true });
                                const completedName = getProvider(completedProvider)?.name || completedProvider;
                                const nextName = getProvider(nextId)?.name || nextId;
                                chrome.runtime.sendMessage({
                                    type: MSG_TYPES.SHOW_TOAST,
                                    payload: { message: `✅ ${completedName} 完成，正为您切换至等候中的 ${nextName}...` }
                                }).catch(() => {});
                            }
                        }
                    });
                });
            }, 1200);
        });
        return false;
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

async function sendLoginStateRequest(tabId, provider) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: MSG_TYPES.GET_PROVIDER_LOGIN_STATE,
            payload: { providerId: provider.id },
        });
        if (response?.ok && response.state) {
            return response.state;
        }
        return response?.state || { status: 'unknown', message: response?.error || '无法确认登录状态' };
    } catch {
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
            return { status: 'unknown', message: readyResult.error || 'content script 未就绪' };
        }

        const response = await chrome.tabs.sendMessage(tabId, {
            type: MSG_TYPES.GET_PROVIDER_LOGIN_STATE,
            payload: { providerId: provider.id },
        });
        if (response?.ok && response.state) {
            return response.state;
        }
        return response?.state || { status: 'unknown', message: response?.error || '无法确认登录状态' };
    }
}

async function getProviderLoginState(providerId) {
    const provider = getProvider(providerId);
    if (!provider) {
        return { status: 'unknown', message: 'provider 不存在' };
    }

    const tabResult = await openOrActivateProviderTab(providerId, false);
    if (!tabResult.success || !tabResult.tabId) {
        return { status: 'unknown', message: `无法打开${provider.name}页面` };
    }

    await waitForTabComplete(tabResult.tabId);
    const readyResult = await waitForPageReady(tabResult.tabId, provider);
    if (!readyResult.success) {
        return { status: 'unknown', message: readyResult.error || 'content script 未就绪' };
    }

    return sendLoginStateRequest(tabResult.tabId, provider);
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
    logger.log(`[AI Clash] openAndActivateTab: ${provider.id} start`);
    const rememberedTabId = providerTabMap[provider.id];
    logger.log(`[AI Clash] openAndActivateTab: ${provider.id} rememberedTabId=${rememberedTabId}`);

    // 检查我们记住的 tab 是否有效
    if (rememberedTabId && await isTabValid(rememberedTabId, provider)) {
        logger.log(`[AI Clash] openAndActivateTab: ${provider.id} 使用已存在的 tab ${rememberedTabId}`);
        // 激活 tab 并聚焦窗口
        await chrome.tabs.update(rememberedTabId, { active: true });
        const tab = await chrome.tabs.get(rememberedTabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        return { success: true, tabId: rememberedTabId };
    }

    // 没有有效绑定的 tab，新建一个
    logger.log(`[AI Clash] openAndActivateTab: ${provider.id} 创建新 tab`);
    const newTab = await chrome.tabs.create({ url: provider.startUrl, active: true });
    logger.log(`[AI Clash] openAndActivateTab: ${provider.id} 新 tab id=${newTab.id}, url=${newTab.url}`);
    if (newTab.id) {
        providerTabMap[provider.id] = newTab.id;
        await saveProviderTabMap();
    }
    return { success: true, tabId: newTab.id };
}

// 等待页面加载完成
async function waitForTabComplete(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
        let resolved = false;

        const cleanup = () => {
            resolved = true;
            chrome.tabs.onUpdated.removeListener(listener);
            clearInterval(pollIntervalId);
            clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
            if (!resolved) {
                cleanup();
                reject(new Error('页面加载超时'));
            }
        }, timeout);

        function listener(updatedTabId, info) {
            if (updatedTabId === tabId && info.status === 'complete') {
                cleanup();
                resolve();
            }
        }

        // 轮询检查作为后备（扩展重新加载后 onUpdated 事件可能不会触发）
        const pollIntervalId = setInterval(async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === 'complete') {
                    cleanup();
                    resolve();
                }
            } catch (e) {
                if (!resolved) {
                    cleanup();
                    reject(new Error('Tab 已关闭'));
                }
            }
        }, 500);

        chrome.tabs.onUpdated.addListener(listener);

        getTabPromise(tabId).then((tab) => {
            if (tab.status === 'complete') {
                cleanup();
                resolve();
            }
        }).catch((e) => {
            if (!resolved) {
                cleanup();
                reject(new Error(`Tab 检查失败：${e.message}`));
            }
        });
    });
}

// 将 chrome.tabs.get 包装成 Promise
function getTabPromise(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(tab);
        });
    });
}

// 提交任务到指定 provider 的 tab
async function routeToTab(provider, prompt, settings) {
    const msg = { type: MSG_TYPES.EXECUTE_PROMPT, payload: { prompt, settings } };

    logger.log(`[AI Clash] ${provider.id} routeToTab 开始执行`);

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
    logger.log(`[AI Clash] ${provider.id} 正在打开/激活 tab`);
    chrome.runtime.sendMessage({
        type: MSG_TYPES.TASK_STATUS_UPDATE,
        payload: {
            provider: provider.id,
            stage: 'opening',
            text: `正在启动${provider.name}...`
        }
    }).catch(() => {});

    const tabResult = await openAndActivateTab(provider);
    logger.log(`[AI Clash] ${provider.id} openAndActivateTab 完成：`, tabResult);
    if (!tabResult.success || !tabResult.tabId) {
        sendProviderError(provider.id, `无法打开${provider.name}页面`);
        return;
    }

    const tabId = tabResult.tabId;

    // 2. 等待页面加载完成
    logger.log(`[AI Clash] ${provider.id} 等待页面加载完成 (tabId: ${tabId})`);
    await waitForTabComplete(tabId);
    logger.log(`[AI Clash] ${provider.id} 页面加载完成`);

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
    logger.log(`[AI Clash] ${provider.id} 等待 content script 就绪`);
    const readyResult = await waitForPageReady(tabId, provider);
    logger.log(`[AI Clash] ${provider.id} waitForPageReady 结果：`, readyResult);
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

    // 6. 发送消息执行任务（登录前置检查由侧边栏负责）
    logger.log(`[AI Clash] ${provider.id} 开始注入 content script 并发送消息`);
    await injectContentScriptAndSendMessage(tabId, provider, msg);
    logger.log(`[AI Clash] ${provider.id} routeToTab 执行完成`);
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
