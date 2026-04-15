import { create } from 'zustand';
import { message } from 'antd';
import { MSG_TYPES } from '../../shared/messages.js';
import logger, { setDebugEnabled } from '../../shared/logger.js';
import { PROVIDER_META, getModelOptions, getNoLoginRequiredProviders } from '../../shared/config.js';
import {
  PROVIDER_IDS, PROVIDER_NAME_MAP,
  type ProviderId, type ProviderMode, type ProviderStatus, type StageType,
  type ProviderStats, type ProviderHistoryEntry, type SummaryHistoryEntry,
  type CompletedTurn, type ChatHistoryItem, type MultiChannelHistoryItem,
  type SingleChannelHistoryItem,
} from '../types';
import {
  SETTINGS_KEY, API_CONFIG_KEY, SUMMARY_CONFIG_KEY, SUMMARY_PROMPT_KEY, ENABLED_PROVIDERS_KEY,
  HISTORY_STORAGE_KEY, HISTORY_STORAGE_KEY_SINGLE,
  MAX_HISTORY_COUNT, CHARS_PER_FRAME,
  createSessionId, createDefaultRecord,
  buffers, resetBuffers,
} from './helpers';
import type { AppStore, SidepanelSettings, SummaryConfig, ApiConfig } from './types';
import { createMessageListener } from './messageHandler';

// 默认的归纳总结系统提示词
const DEFAULT_SUMMARY_PROMPT = `# Role
你是一个搭载在「AI 对撞机」上的高级仲裁与决策引擎。你的任务是深度分析多位顶尖 AI 专家针对同一问题给出的独立回答，去伪存真、提炼共识、保留分歧，最终为用户生成一份集大成的终极回复。

# Core Directives (核心准则)
1. 交叉核实 (Fact-Checking)：剔除明显的幻觉和事实性错误。
2. 视角碰撞 (Collision)：敏锐捕捉不同模型之间的【观点分歧】。不要掩盖分歧，而是客观展现它们在主观判断、代码实现或策略选择上的差异。
3. 降噪重构 (De-noising)：拒绝简单的复制拼接，消除各回答中的冗余废话（如"好的，我来为您解答"）。

# Output Workflow (输出自适应路由)
请严格根据用户输入的问题类型，选择对应的输出框架：

### 🟢 场景 A：明确任务类（如：写代码、翻译、食谱、公文写作、数学题）
*用户需要的是一个直接可用的最终成品。*
直接输出一份整合了各方优点的【终极最优解】。在最优解下方，用简短的 \`### 💡 对撞机点评\` 补充说明各模型的贡献或差异即可，无需长篇大论。

### 🔴 场景 B：开放决策/深度探讨类（如：行业分析、人生建议、技术选型、哲理探讨）
*用户需要的是深度视角的碰撞与决策支持。请严格按照以下 Markdown 结构输出：*

### 核心共识
> 一针见血地提炼所有专家都认同的核心事实和底层逻辑。

### 观点对撞
> 梳理专家们存在的分歧点。列出具体的争议，客观剖析各自的底层论据及合理性。

### 综合解析
> 打破单一视角，将信息重新编排，多维度（如长短期/微观宏观等）将各专家的独到见解融入其中。

### 终极建议
> 基于对撞分析，给出具有极高可操作性的结论或 \`If-Then\` 情景化建议。`;

export { buffers } from './helpers';
export type { AppStore } from './types';

// ════════════════════════════════════════════════════════════════════
// Store
// ════════════════════════════════════════════════════════════════════

export const useStore = create<AppStore>()((set, get) => {

  // ─── Chrome storage helpers ───

  const saveSettings = () => {
    const s = get();
    chrome.storage?.local.set({
      [SETTINGS_KEY]: {
        isDeepThinkingEnabled: s.isDeepThinkingEnabled,
        isWebSearchEnabled: s.isWebSearchEnabled,
        isSummaryEnabled: s.isSummaryEnabled,
        isDebugEnabled: s.isDebugEnabled,
      },
    });
  };

  const saveEnabledProviders = () => {
    const s = get();
    chrome.storage?.local.set({
      [ENABLED_PROVIDERS_KEY]: Object.fromEntries(
        PROVIDER_IDS.filter(id => s.enabledMap[id]).map(id => [id, true])
      ),
    });
  };

  const saveApiConfig = (providerId: string, config: ApiConfig) => {
    chrome.storage?.local.get([API_CONFIG_KEY], (result) => {
      const existing = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
      chrome.storage?.local.set({
        [API_CONFIG_KEY]: { ...existing, [providerId]: { ...existing[providerId], ...config } },
      });
    });
  };

  const saveSummaryConfig = () => {
    const s = get();
    chrome.storage?.local.set({
      [SUMMARY_CONFIG_KEY]: { providerId: s.summaryProviderId, model: s.summaryModel },
    });
  };

  const saveSummaryPrompt = () => {
    const s = get();
    chrome.storage?.local.set({
      [SUMMARY_PROMPT_KEY]: s.summaryCustomPrompt,
    });
  };

  const saveHistory = (list: ChatHistoryItem[]) => {
    const multi = list.filter(item => item.type === 'multi') as MultiChannelHistoryItem[];
    const single = list.filter(item => item.type === 'single') as SingleChannelHistoryItem[];
    chrome.storage?.local.set({
      [HISTORY_STORAGE_KEY]: multi.slice(0, MAX_HISTORY_COUNT),
      [HISTORY_STORAGE_KEY_SINGLE]: single.slice(0, MAX_HISTORY_COUNT),
    });
  };

  // ─── History persistence helpers ───

  const buildHistoryProviders = (rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) => {
    const s = get();
    return Object.fromEntries(PROVIDER_IDS.map(id => [id, {
      enabled: s.enabledMap[id],
      mode: s.modeMap[id],
      status: s.statusMap[id],
      stage: 'connecting' as StageType,
      response: s.responses[id],
      thinkResponse: s.thinkResponses[id],
      operationStatus: s.operationStatus[id],
      rawUrl: rawUrlOverrides[id] ?? s.rawUrlMap[id] ?? '',
      stats: s.statsMap[id] ?? null,
    }])) as Record<ProviderId, ProviderHistoryEntry>;
  };

  const buildSummaryHistoryEntry = (): SummaryHistoryEntry | null => {
    const s = get();
    if (s.summaryStatus === 'idle') return null;
    return {
      status: s.summaryStatus,
      response: buffers.summaryFull || '',
      thinkResponse: buffers.summaryThink || '',
      stats: s.summaryStats ?? null,
    };
  };

  const upsertHistoryItem = (item: ChatHistoryItem) => {
    set(prev => {
      const next = [item, ...prev.historyList.filter(h => h.id !== item.id)].slice(0, MAX_HISTORY_COUNT * 2);
      saveHistory(next);
      return { historyList: next };
    });
  };

  const upsertSingleChannelSession = (
    providerId: ProviderId, question: string, response: string,
    thinkResponse: string, stats?: ProviderStats, rawUrl?: string,
  ) => {
    const s = get();
    const isMultiTurn = s.isMultiTurnSession && s.conversationTurns.length > 0;
    const now = Date.now();

    set(prev => {
      let session = prev.historyList.find(
        item => item.id === s.activeSessionId && item.type === 'single',
      ) as SingleChannelHistoryItem | undefined;

      if (session && isMultiTurn) {
        session = { ...session, turns: [...session.turns] };
        const lastTurn = session.turns[session.turns.length - 1];
        if (lastTurn && lastTurn.question === question) {
          session.turns[session.turns.length - 1] = { ...lastTurn, response, thinkResponse, stats, rawUrl: rawUrl || lastTurn.rawUrl };
        } else {
          session.turns.push({ question, response, thinkResponse, createdAt: now, stats, rawUrl });
        }
        session.updatedAt = now;
        session.summary = buildSummaryHistoryEntry() ?? undefined;
      } else if (session) {
        session = { ...session, turns: [...session.turns] };
        if (session.turns[0]) {
          session.turns[0] = { ...session.turns[0], response, thinkResponse, stats, rawUrl: rawUrl || session.turns[0].rawUrl };
        }
        session.updatedAt = now;
        session.summary = buildSummaryHistoryEntry() ?? undefined;
      } else {
        session = {
          id: s.activeSessionId, type: 'single', providerId,
          providerName: PROVIDER_NAME_MAP[providerId] || providerId,
          createdAt: now, updatedAt: now,
          turns: [{ question, response, thinkResponse, createdAt: now, stats, rawUrl }],
          summary: buildSummaryHistoryEntry() ?? undefined,
        };
      }
      const next = [session, ...prev.historyList.filter(h => h.id !== session!.id)].slice(0, MAX_HISTORY_COUNT * 2);
      saveHistory(next);
      return { historyList: next };
    });
  };

  const persistCurrentSession = (rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) => {
    const s = get();
    if (!s.activeSessionId || !s.hasAsked || !s.currentQuestion.trim()) return;
    const merged = { ...buffers.pendingRawUrlOverrides, ...rawUrlOverrides };
    buffers.pendingRawUrlOverrides = {};

    const enabledProviders = PROVIDER_IDS.filter(id => s.enabledMap[id]);
    if (enabledProviders.length === 1) {
      const pid = enabledProviders[0];
      const ps = buildHistoryProviders(merged)[pid];
      upsertSingleChannelSession(pid, s.currentQuestion, ps.response, ps.thinkResponse, ps.stats ?? undefined, ps.rawUrl);
    } else {
      upsertHistoryItem({
        id: s.activeSessionId, type: 'multi',
        question: s.currentQuestion, createdAt: Date.now(),
        providers: buildHistoryProviders(merged),
        summary: buildSummaryHistoryEntry(),
        conversationTurns: s.conversationTurns.length > 0 ? [...s.conversationTurns] : undefined,
      });
    }
  };

  // ─── Provider tab helpers ───

  const checkProviderTabValid = async (providerId: string) => {
    try {
      const r = await chrome.runtime?.sendMessage({ type: MSG_TYPES.CHECK_PROVIDER_TAB_VALID, payload: { providerId } });
      return r?.valid ?? false;
    } catch { return false; }
  };

  const fetchProviderRawUrls = async (providerIds: ProviderId[]) => {
    if (!providerIds.length) return {} as Partial<Record<ProviderId, string>>;
    try {
      const r = await chrome.runtime?.sendMessage({ type: MSG_TYPES.GET_PROVIDER_RAW_URLS, payload: { providerIds } });
      return (r?.urlMap || {}) as Partial<Record<ProviderId, string>>;
    } catch { return {} as Partial<Record<ProviderId, string>>; }
  };

  const syncProviderRawUrls = async (providerIds: ProviderId[]) => {
    if (!providerIds.length) return;
    const s = get();
    const apiOverrides = providerIds.reduce((acc, id) => {
      if (s.modeMap[id] === 'api') acc[id] = 'api';
      return acc;
    }, {} as Partial<Record<ProviderId, string>>);
    const webIds = providerIds.filter(id => s.modeMap[id] === 'web');
    const webUrls = await fetchProviderRawUrls(webIds);
    const merged = { ...apiOverrides, ...webUrls };
    set(prev => {
      const next = { ...prev.rawUrlMap };
      for (const id of providerIds) next[id] = merged[id] ?? apiOverrides[id] ?? prev.rawUrlMap[id] ?? '';
      return { rawUrlMap: next };
    });
    get().schedulePersist(0, merged);
  };

  const getProviderMeta = (id: ProviderId) => PROVIDER_META.find((p: any) => p.id === id);
  const supportsApi = (id: ProviderId) => getProviderMeta(id)?.supportsApi ?? false;

  // ════════════════════════════════════════════════════════════════
  // Return the store definition
  // ════════════════════════════════════════════════════════════════

  return {
    // ─── Initial State ───
    isDeepThinkingEnabled: true,
    isWebSearchEnabled: false,
    isDebugEnabled: false,
    isSummaryEnabled: true,
    summaryProviderId: 'summarizer',
    summaryModel: 'summarizer-v1',

    enabledMap: createDefaultRecord(false),
    modeMap: createDefaultRecord<ProviderMode>('web'),
    apiKeyMap: createDefaultRecord(''),
    modelMap: createDefaultRecord(''),

    inputStr: '',
    currentQuestion: '',
    hasAsked: false,
    activeSessionId: '',
    isCurrentSessionFromHistory: false,
    conversationTurns: [],
    isMultiTurnSession: false,

    statusMap: createDefaultRecord<ProviderStatus>('idle'),
    stageMap: createDefaultRecord<StageType>('waiting'),
    responses: createDefaultRecord(''),
    thinkResponses: createDefaultRecord(''),
    operationStatus: createDefaultRecord(''),
    rawUrlMap: createDefaultRecord(''),
    statsMap: createDefaultRecord<ProviderStats | null>(null),
    collapseMap: { ...createDefaultRecord(false), summary: false }, // false = 展开，true = 折叠
    thinkExpandedMap: { ...createDefaultRecord(false), summary: true }, // true = 展开思考，false = 折叠思考

    summaryStatus: 'idle',
    summaryStage: 'responding',
    summaryResponse: '',
    summaryThinkResponse: '',
    summaryOperationStatus: '',
    summaryStats: null,
    summaryCustomPrompt: DEFAULT_SUMMARY_PROMPT,  // 自定义总结提示词

    isHistoryPanelOpen: false,
    activeProviderSettings: '',
    showNoChannelTip: false,
    isSummarySettingsOpen: false,
    testingApiKey: {},
    apiKeyTestResult: {},
    showApiKey: {},

    historyList: [],

    // ─── Settings Actions ───

    toggleDeepThinking: () => {
      set(prev => {
        const next = !prev.isDeepThinkingEnabled;
        if (!next) {
          for (const id of PROVIDER_IDS) { buffers.thinkText[id] = ''; buffers.thinkDisplayedLen[id] = 0; }
        }
        return {
          isDeepThinkingEnabled: next,
          ...(!next ? { thinkResponses: createDefaultRecord('') } : {}),
        };
      });
      saveSettings();
      get().schedulePersist();
    },

    toggleWebSearch: () => {
      set(prev => ({ isWebSearchEnabled: !prev.isWebSearchEnabled }));
      saveSettings();
      get().schedulePersist();
    },

    toggleDebug: () => {
      set(prev => {
        const next = !prev.isDebugEnabled;
        setDebugEnabled(next);
        return { isDebugEnabled: next };
      });
      saveSettings();
    },

    toggleSummary: () => {
      const s = get();
      if (!s.isSummaryConfigValid()) { set({ isSummarySettingsOpen: true }); return; }
      const enabled = PROVIDER_IDS.filter(id => s.enabledMap[id]);
      if (enabled.length < 2) return;
      set(prev => ({ isSummaryEnabled: !prev.isSummaryEnabled }));
      saveSettings();
    },

    setSummaryProviderId: (v) => { set({ summaryProviderId: v }); saveSummaryConfig(); },
    setSummaryModel: (v) => { set({ summaryModel: v }); saveSummaryConfig(); },
    setSummaryCustomPrompt: (v) => { set({ summaryCustomPrompt: v }); saveSummaryPrompt(); },
    resetSummaryPrompt: () => { set({ summaryCustomPrompt: DEFAULT_SUMMARY_PROMPT }); saveSummaryPrompt(); },

    // ─── Provider Config Actions ───

    toggleProvider: async (providerId) => {
      const id = providerId as ProviderId;
      const s = get();
      if (s.enabledMap[id]) {
        set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: false } }));
      } else {
        // 开启通道
        set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: true } }));
      }
      // 保存启用的通道列表
      saveEnabledProviders();
    },

    setProviderMode: (id, mode) => {
      if (mode === 'api' && !get().apiKeyMap[id]?.trim()) return;
      set(prev => ({ modeMap: { ...prev.modeMap, [id]: mode } }));
      saveApiConfig(id, { mode });
      if (mode === 'web' && get().enabledMap[id]) {
        get().goToProvider(id, false).then(result => {
          if (!result?.success) {
            set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: false } }));
            window.alert(`${PROVIDER_NAME_MAP[id]}切换到网页模式失败：${result?.error || '无法创建页面'}`);
          }
        });
      }
    },

    setProviderApiKey: (id, value) => {
      set(prev => ({ apiKeyMap: { ...prev.apiKeyMap, [id]: value } }));
      saveApiConfig(id, { apiKey: value });
    },

    setProviderModel: (id, value) => {
      set(prev => ({ modelMap: { ...prev.modelMap, [id]: value } }));
      saveApiConfig(id, { model: value });
    },

    testApiKey: async (providerId, apiKey) => {
      set(prev => ({ testingApiKey: { ...prev.testingApiKey, [providerId]: true } }));
      try {
        const r = await chrome.runtime?.sendMessage({ type: MSG_TYPES.TEST_API_KEY, payload: { providerId, apiKey } });
        const success = !!r?.success;
        const msg = r?.message || r?.error || '请求失败';
        set(prev => ({ apiKeyTestResult: { ...prev.apiKeyTestResult, [providerId]: { success, message: msg } } }));
        if (success) {
          message.success(msg);
        } else {
          message.error(msg);
        }
      } catch {
        set(prev => ({ apiKeyTestResult: { ...prev.apiKeyTestResult, [providerId]: { success: false, message: '请求失败' } } }));
        message.error('请求失败');
      } finally {
        set(prev => ({ testingApiKey: { ...prev.testingApiKey, [providerId]: false } }));
      }
    },

    // ─── Session Actions ───

    setInputStr: (v) => set({ inputStr: v }),

    submit: async () => {
      const s = get();
      const prompt = s.inputStr.trim();
      if (!prompt) return;
      const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
      if (!enabledIds.length) { set({ showNoChannelTip: true }); return; }

      buffers.userHasScrolled = false;
      const isSingleChannel = enabledIds.length === 1;
      const isMultiTurnContinuation = s.isMultiTurnSession && isSingleChannel && s.hasAsked && !s.isCurrentSessionFromHistory;

      let newTurns = [...s.conversationTurns];
      let newSessionId = s.activeSessionId;
      let newIsMultiTurn = s.isMultiTurnSession;

      if (isMultiTurnContinuation) {
        const pid = enabledIds[0];
        newTurns = [...s.conversationTurns, {
          question: s.currentQuestion, providerId: pid,
          response: buffers.fullText[pid] || s.responses[pid] || '',
          thinkResponse: buffers.thinkText[pid] || '',
          rawUrl: s.rawUrlMap[pid] || '',
          stats: s.statsMap[pid] ?? null,
        }];
      } else {
        newTurns = [];
        newSessionId = createSessionId();
        newIsMultiTurn = isSingleChannel;
      }

      // 重置折叠状态：所有启用的通道默认展开，深度思考默认展开
      const newCollapseMap: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(false), summary: false };
      const newThinkExpandedMap: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(true), summary: true };
      for (const id of PROVIDER_IDS) {
        newCollapseMap[id] = !s.enabledMap[id];
        newThinkExpandedMap[id] = true;
      }

      get().resetTaskState();

      const newRawUrlMap = createDefaultRecord('');
      for (const id of enabledIds) newRawUrlMap[id] = s.modeMap[id] === 'api' ? 'api' : '';

      const newStatusMap = createDefaultRecord<ProviderStatus>('idle');
      for (const id of enabledIds) {
        newStatusMap[id] = 'running';
        buffers.timing[id].startTime = Date.now();
      }

      set({
        conversationTurns: newTurns,
        activeSessionId: newSessionId,
        isMultiTurnSession: newIsMultiTurn,
        currentQuestion: prompt,
        hasAsked: true,
        isCurrentSessionFromHistory: false,
        isHistoryPanelOpen: false,
        activeProviderSettings: '',
        collapseMap: newCollapseMap,
        thinkExpandedMap: newThinkExpandedMap,
        rawUrlMap: newRawUrlMap,
        statusMap: newStatusMap,
        inputStr: '',
      });

      get().schedulePersist(0);
      syncProviderRawUrls(enabledIds);

      const conversationHistory = (isSingleChannel && newTurns.length > 0)
        ? newTurns.map(t => ({ question: t.question, response: t.response }))
        : [];
      const isNewConversation = !isMultiTurnContinuation;

      // 串行执行：每个提供者提交成功后再执行下一个
      for (const id of enabledIds) {
        await new Promise<void>((resolve) => {
          chrome.runtime?.sendMessage({
            type: MSG_TYPES.DISPATCH_TASK,
            payload: {
              provider: id, prompt,
              mode: s.modeMap[id] === 'web' && id === 'yuanbao' ? 'web' : s.modeMap[id],
              settings: {
                isDeepThinkingEnabled: s.isDeepThinkingEnabled,
                isWebSearchEnabled: s.isWebSearchEnabled,
                conversationHistory,
                isNewConversation,
              },
            },
          }, (response) => {
            logger.log(`[${id}] 任务提交完成:`, response);
            resolve();
          });
        });
      }
    },

    createNewChat: () => {
      get().resetTaskState();
      const s = get();
      const newCollapseMap: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(false), summary: false };
      const newThinkExpandedMap: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(true), summary: true };
      for (const id of PROVIDER_IDS) {
        newCollapseMap[id] = !s.enabledMap[id];
        newThinkExpandedMap[id] = true;
      }
      set({
        currentQuestion: '', hasAsked: false, activeSessionId: '',
        isCurrentSessionFromHistory: false, isHistoryPanelOpen: false,
        activeProviderSettings: '', conversationTurns: [],
        isMultiTurnSession: false, collapseMap: newCollapseMap,
        thinkExpandedMap: newThinkExpandedMap, inputStr: '',
      });
    },

    restoreHistorySession: (item) => {
      get().resetTaskState();
      set({ activeSessionId: item.id, hasAsked: true, isHistoryPanelOpen: false, isCurrentSessionFromHistory: true });

      if (item.type === 'single') {
        const { providerId, turns, summary } = item;
        const lastTurn = turns[turns.length - 1];
        const newEnabled = createDefaultRecord(false);
        for (const id of PROVIDER_IDS) newEnabled[id] = id === providerId;

        set(prev => ({
          enabledMap: newEnabled,
          collapseMap: { ...prev.collapseMap, [providerId]: false },
          thinkExpandedMap: { ...prev.thinkExpandedMap, [providerId]: true },
          currentQuestion: lastTurn?.question || '',
          conversationTurns: turns.slice(0, -1).map(t => ({
            question: t.question, providerId, response: t.response, thinkResponse: t.thinkResponse,
            rawUrl: t.rawUrl || '', stats: t.stats || null,
          })),
          isMultiTurnSession: turns.length > 0,
        }));

        if (lastTurn) {
          buffers.fullText[providerId] = lastTurn.response;
          buffers.thinkText[providerId] = lastTurn.thinkResponse;
          buffers.displayedLen[providerId] = lastTurn.response.length;
          buffers.thinkDisplayedLen[providerId] = lastTurn.thinkResponse.length;
          set(prev => ({
            statusMap: { ...prev.statusMap, [providerId]: 'completed' as ProviderStatus },
            stageMap: { ...prev.stageMap, [providerId]: 'responding' as StageType },
            responses: { ...prev.responses, [providerId]: lastTurn.response },
            thinkResponses: { ...prev.thinkResponses, [providerId]: lastTurn.thinkResponse },
            rawUrlMap: { ...prev.rawUrlMap, [providerId]: lastTurn.rawUrl || '' },
            statsMap: { ...prev.statsMap, [providerId]: lastTurn.stats || null },
          }));
        }
      } else {
        const newEnabled = createDefaultRecord(false);
        const newStatus = createDefaultRecord<ProviderStatus>('idle');
        const newStage = createDefaultRecord<StageType>('connecting');
        const newResp = createDefaultRecord('');
        const newThink = createDefaultRecord('');
        const newOp = createDefaultRecord('');
        const newRaw = createDefaultRecord('');
        const newStats = createDefaultRecord<ProviderStats | null>(null);
        // 多通道历史：默认折叠所有通道，折叠深度思考
        const newCollapse: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(true), summary: false };
        const newThinkExpanded: Record<ProviderId | 'summary', boolean> = { ...createDefaultRecord(false), summary: true };

        for (const id of PROVIDER_IDS) {
          const ps = item.providers[id] || { enabled: false, mode: 'web' as ProviderMode, status: 'idle' as ProviderStatus, stage: 'connecting' as StageType, response: '', thinkResponse: '', operationStatus: '', rawUrl: '', stats: null };
          newEnabled[id] = ps.enabled;
          newStatus[id] = ps.status;
          newStage[id] = ps.stage;
          newResp[id] = ps.response;
          newThink[id] = ps.thinkResponse;
          newOp[id] = ps.operationStatus;
          newRaw[id] = ps.rawUrl;
          newStats[id] = ps.stats ?? null;
          newCollapse[id] = true; // 多通道历史默认全部折叠
          newThinkExpanded[id] = false; // 深度思考默认折叠
          buffers.fullText[id] = ps.response;
          buffers.thinkText[id] = ps.thinkResponse;
          buffers.displayedLen[id] = ps.response.length;
          buffers.thinkDisplayedLen[id] = ps.thinkResponse.length;
        }

        set({
          currentQuestion: item.question,
          conversationTurns: item.conversationTurns ? [...item.conversationTurns] : [],
          isMultiTurnSession: false,
          enabledMap: newEnabled, statusMap: newStatus, stageMap: newStage,
          responses: newResp, thinkResponses: newThink, operationStatus: newOp,
          rawUrlMap: newRaw, statsMap: newStats, collapseMap: newCollapse,
          thinkExpandedMap: newThinkExpanded,
        });
      }

      const se = item.type === 'single' ? item.summary : item.summary;
      if (se) {
        buffers.summaryFull = se.response;
        buffers.summaryThink = se.thinkResponse;
        buffers.summaryDisplayedLen = se.response.length;
        buffers.summaryThinkDisplayedLen = se.thinkResponse.length;
        buffers.summaryTriggered = true;
        set({
          summaryStatus: se.status,
          summaryStage: 'responding',
          summaryResponse: se.response,
          summaryThinkResponse: se.thinkResponse,
          summaryStats: se.stats ?? null,
        });
      }
    },

    // ─── UI Actions ───

    setIsHistoryPanelOpen: (v) => set({ isHistoryPanelOpen: v }),
    openProviderSettings: (id) => set({ activeProviderSettings: id, isHistoryPanelOpen: false }),
    closeProviderSettings: () => set({ activeProviderSettings: '' }),
    setShowNoChannelTip: (v) => set({ showNoChannelTip: v }),
    setIsSummarySettingsOpen: (v) => set({ isSummarySettingsOpen: v }),
    toggleShowApiKey: (id) => set(prev => ({ showApiKey: { ...prev.showApiKey, [id]: !prev.showApiKey[id] } })),

    // ─── Collapse Actions ───

    toggleCollapse: (providerId) => {
      set(prev => ({ collapseMap: { ...prev.collapseMap, [providerId]: !prev.collapseMap[providerId] } }));
    },

    collapseAll: () => {
      set({ collapseMap: createDefaultRecord(true) });
    },

    expandAll: () => {
      set({ collapseMap: createDefaultRecord(false) });
    },

    setThinkExpanded: (providerId, expanded) => {
      set(prev => ({ thinkExpandedMap: { ...prev.thinkExpandedMap, [providerId]: expanded } }));
    },

    // ─── History Actions ───

    deleteHistoryItem: (id) => {
      set(prev => {
        const next = prev.historyList.filter(h => h.id !== id);
        saveHistory(next);
        return { historyList: next };
      });
    },

    renameHistoryItem: (id, label) => {
      set(prev => {
        const next = prev.historyList.map(h =>
          h.id === id ? { ...h, customLabel: label } : h,
        );
        saveHistory(next);
        return { historyList: next };
      });
    },

    clearHistory: () => {
      saveHistory([]);
      set({ historyList: [], isHistoryPanelOpen: false });
    },

    // ─── Internal Actions ───

    resetTaskState: () => {
      resetBuffers();
      set({
        statusMap: createDefaultRecord('idle'),
        stageMap: createDefaultRecord('waiting'),
        responses: createDefaultRecord(''),
        thinkResponses: createDefaultRecord(''),
        operationStatus: createDefaultRecord(''),
        rawUrlMap: createDefaultRecord(''),
        statsMap: createDefaultRecord(null),
        summaryStatus: 'idle',
        summaryStage: 'responding',
        summaryResponse: '',
        summaryThinkResponse: '',
        summaryOperationStatus: '',
        summaryStats: null,
      });
    },

    tickStreamDisplay: () => {
      let anyPending = false;
      const newResp: Partial<Record<ProviderId, string>> = {};
      const newThink: Partial<Record<ProviderId, string>> = {};

      for (const id of PROVIDER_IDS) {
        const tf = buffers.thinkText[id] || '';
        let tl = buffers.thinkDisplayedLen[id] || 0;
        if (tl < tf.length) { tl = Math.min(tl + CHARS_PER_FRAME, tf.length); buffers.thinkDisplayedLen[id] = tl; newThink[id] = tf.slice(0, tl); anyPending = true; }

        const ff = buffers.fullText[id] || '';
        let fl = buffers.displayedLen[id] || 0;
        if (fl < ff.length) { fl = Math.min(fl + CHARS_PER_FRAME, ff.length); buffers.displayedLen[id] = fl; newResp[id] = ff.slice(0, fl); anyPending = true; }
      }
      if (Object.keys(newResp).length) set(prev => ({ responses: { ...prev.responses, ...Object.fromEntries(Object.entries(newResp).filter(([, v]) => v !== undefined)) as Record<string, string> } }));
      if (Object.keys(newThink).length) set(prev => ({ thinkResponses: { ...prev.thinkResponses, ...Object.fromEntries(Object.entries(newThink).filter(([, v]) => v !== undefined)) as Record<string, string> } }));

      const stf = buffers.summaryThink;
      let stl = buffers.summaryThinkDisplayedLen;
      if (stl < stf.length) { stl = Math.min(stl + CHARS_PER_FRAME, stf.length); buffers.summaryThinkDisplayedLen = stl; set({ summaryThinkResponse: stf.slice(0, stl) }); anyPending = true; }
      const sf = buffers.summaryFull;
      let sl = buffers.summaryDisplayedLen;
      if (sl < sf.length) { sl = Math.min(sl + CHARS_PER_FRAME, sf.length); buffers.summaryDisplayedLen = sl; set({ summaryResponse: sf.slice(0, sl) }); anyPending = true; }

      buffers.autoScrollFn?.();

      if (anyPending) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
      else buffers.animationId = null;
    },

    schedulePersist: (delay = 120, rawUrlOverrides = {}) => {
      buffers.pendingRawUrlOverrides = { ...buffers.pendingRawUrlOverrides, ...rawUrlOverrides };
      if (buffers.persistTimer != null) window.clearTimeout(buffers.persistTimer);
      buffers.persistTimer = window.setTimeout(() => {
        buffers.persistTimer = null;
        persistCurrentSession();
      }, delay);
    },

    triggerSummary: (forceTrigger = false) => {
      // forceTrigger 为 true 时，忽略 buffers.summaryTriggered 检查，支持手动触发和重新生成
      if (!forceTrigger && buffers.summaryTriggered) return;
      const s = get();
      // 手动触发时（forceTrigger=true）不需要检查 isSummaryEnabled，允许用户在关闭自动总结时手动触发
      if (!forceTrigger && !s.isSummaryEnabled) return;
      if (!s.isSummaryConfigValid()) return;
      const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
      const completed = enabledIds
        .filter(id => (s.statusMap[id] === 'completed' || s.statusMap[id] === 'error') && buffers.fullText[id]?.trim())
        .map(id => ({ providerId: id, name: PROVIDER_NAME_MAP[id], text: buffers.fullText[id] }));
      if (completed.length < 2) return;

      // 如果是重新生成（已有总结内容），先清空状态
      if (buffers.summaryTriggered && (buffers.summaryFull || buffers.summaryThink)) {
        buffers.summaryFull = '';
        buffers.summaryThink = '';
        buffers.summaryDisplayedLen = 0;
        buffers.summaryThinkDisplayedLen = 0;
        set({
          summaryResponse: '',
          summaryThinkResponse: '',
          summaryStats: null,
        });
      }

      buffers.summaryTriggered = true;
      buffers.summaryTiming.startTime = Date.now();
      set({ summaryStatus: 'running', summaryOperationStatus: '' });

      chrome.runtime?.sendMessage({
        type: MSG_TYPES.DISPATCH_SUMMARY,
        payload: {
          question: s.currentQuestion, responses: completed,
          summaryConfig: {
            providerId: s.summaryProviderId,
            model: s.summaryModel,
            customPrompt: s.summaryCustomPrompt,
          },
        },
      });
    },

    regenerateSummary: () => {
      // 重新生成总结：清空状态后触发
      get().triggerSummary(true);
    },

    goToProvider: async (providerId, activate = true) => {
      try {
        return await chrome.runtime?.sendMessage({ type: MSG_TYPES.OPEN_PROVIDER_TAB, payload: { providerId, activate } });
      } catch (err) {
        logger.error('打开provider tab失败:', err);
        return { success: false, error: String(err) };
      }
    },

    // ─── Derived Getters ───

    getEnabledProviderIds: () => PROVIDER_IDS.filter(id => get().enabledMap[id]),
    isSummaryConfigValid: () => {
      const s = get();
      const pid = s.summaryProviderId as string;
      if (!pid) return false;
      // summarizer 是内置总结服务，不需要 API Key，始终有效
      if (pid === 'summarizer') return true;
      // 其他通道需要在 PROVIDER_IDS 中且支持 API 且有 API Key
      if (!(PROVIDER_IDS as readonly string[]).includes(pid)) return false;
      return supportsApi(pid as ProviderId) && !!s.apiKeyMap[pid as ProviderId]?.trim();
    },
    summaryBlockReason: () => {
      const s = get();
      if (!s.isSummaryConfigValid()) return '请先配置归纳总结通道';
      if (PROVIDER_IDS.filter(id => s.enabledMap[id]).length < 2) return '请选择 2 个或以上通道';
      return null;
    },
    getSummaryProviderOptions: () => {
      const s = get();
      return PROVIDER_META
        .filter((p: any) => {
          // summarizer 是内置总结服务，始终显示
          if (p.id === 'summarizer') return true;
          // 其他通道需要支持 API 且有 API Key 才显示
          return p.supportsApi && s.apiKeyMap[p.id as ProviderId]?.trim();
        })
        .map((p: any) => ({ value: p.id, label: p.name }));
    },
    getSummaryModelOptions: () => {
      const s = get();
      if (!s.summaryProviderId) return [];
      return getModelOptions(s.summaryProviderId);
    },

    // ─── Init (called once on mount) ───

    init: () => {
      chrome.storage?.local.get(
        [SETTINGS_KEY, API_CONFIG_KEY, SUMMARY_CONFIG_KEY, SUMMARY_PROMPT_KEY, ENABLED_PROVIDERS_KEY, HISTORY_STORAGE_KEY, HISTORY_STORAGE_KEY_SINGLE],
        async (result) => {
          const saved = (result?.[SETTINGS_KEY] || {}) as SidepanelSettings;
          const debugVal = saved.isDebugEnabled ?? false;
          setDebugEnabled(debugVal);

          const apiConfig = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
          const newModes = createDefaultRecord<ProviderMode>('web');
          const newKeys = createDefaultRecord('');
          const newModels = createDefaultRecord('');
          for (const id of PROVIDER_IDS) {
            newModes[id] = (apiConfig[id]?.mode as ProviderMode) || 'web';
            newKeys[id] = apiConfig[id]?.apiKey || '';
            newModels[id] = apiConfig[id]?.model || '';
          }
          newModes.yuanbao = 'web';

          const sc = (result?.[SUMMARY_CONFIG_KEY] || {}) as SummaryConfig;
          const customPrompt = result?.[SUMMARY_PROMPT_KEY] as string | undefined;

          // 从存储中读取用户上次开启的通道，不再检查 tab 有效性
          // 首次使用时，默认开启所有不需要登录的通道
          const savedEnabled = (result?.[ENABLED_PROVIDERS_KEY] || {}) as Record<ProviderId, boolean>;
          const hasSavedEnabled = Object.keys(savedEnabled).length > 0;
          const newEnabled = createDefaultRecord(false);

          if (hasSavedEnabled) {
            // 有保存的配置，使用用户上次的选择
            PROVIDER_IDS.forEach(id => {
              newEnabled[id] = !!savedEnabled[id];
            });
          } else {
            // 首次使用，默认开启所有不需要登录的通道
            const noLoginRequired = getNoLoginRequiredProviders() as ProviderId[];
            noLoginRequired.forEach(id => {
              newEnabled[id] = true;
            });
          }

          const multiHistory = Array.isArray(result?.[HISTORY_STORAGE_KEY]) ? result[HISTORY_STORAGE_KEY] : [];
          const singleHistory = Array.isArray(result?.[HISTORY_STORAGE_KEY_SINGLE]) ? result[HISTORY_STORAGE_KEY_SINGLE] : [];

          const normalizedMulti = multiHistory
            .map((item: any) => ({
              id: item.id || createSessionId(), type: 'multi' as const,
              question: item.question || '', createdAt: item.createdAt || Date.now(),
              providers: Object.fromEntries(PROVIDER_IDS.map(id => [id, {
                enabled: false, mode: 'web', status: 'idle', stage: 'connecting',
                response: '', thinkResponse: '', operationStatus: '', rawUrl: '', stats: null,
                ...(item.providers?.[id] || {}),
              }])) as Record<ProviderId, ProviderHistoryEntry>,
              summary: item.summary ?? null,
              customLabel: item.customLabel,
              conversationTurns: Array.isArray(item.conversationTurns) ? item.conversationTurns : undefined,
            }))
            .filter((item: any) => item.question.trim());

          const normalizedSingle = singleHistory
            .map((item: any) => {
              let turns: any[] = [];
              if (Array.isArray(item.turns)) turns = item.turns;
              else if (item.turns && typeof item.turns === 'object') {
                turns = Object.values(item.turns as any).sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
              }
              return {
                id: item.id || createSessionId(), type: 'single' as const,
                providerId: item.providerId || 'deepseek', providerName: item.providerName || 'DeepSeek',
                createdAt: item.createdAt || Date.now(), updatedAt: item.updatedAt || Date.now(),
                turns, summary: item.summary ?? null,
                customLabel: item.customLabel,
              };
            })
            .filter((item: any) => item.turns.length > 0);

          const allHistory = [...normalizedMulti, ...normalizedSingle]
            .sort((a: any, b: any) => {
              const tA = a.type === 'single' ? a.updatedAt : a.createdAt;
              const tB = b.type === 'single' ? b.updatedAt : b.createdAt;
              return tB - tA;
            })
            .slice(0, MAX_HISTORY_COUNT * 2);

          set({
            isDeepThinkingEnabled: saved.isDeepThinkingEnabled ?? true,
            isWebSearchEnabled: saved.isWebSearchEnabled ?? false,
            isSummaryEnabled: saved.isSummaryEnabled ?? true,
            isDebugEnabled: debugVal,
            modeMap: newModes, apiKeyMap: newKeys, modelMap: newModels,
            summaryProviderId: sc.providerId || 'summarizer', summaryModel: sc.model || 'summarizer-v1',
            summaryCustomPrompt: customPrompt ?? DEFAULT_SUMMARY_PROMPT,
            enabledMap: newEnabled,
            historyList: allHistory,
          });
        },
      );

      const listener = createMessageListener(get, set, syncProviderRawUrls);
      chrome.runtime?.onMessage.addListener(listener);
      return () => { chrome.runtime?.onMessage.removeListener(listener); };
    },
  };
});
