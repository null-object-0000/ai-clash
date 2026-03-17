import { create } from 'zustand';
import { message } from 'antd';
import { MSG_TYPES } from '../../shared/messages.js';
import logger, { setDebugEnabled } from '../../shared/logger.js';
import { PROVIDER_META, getModelOptions } from '../../shared/config.js';
import {
  PROVIDER_IDS, PROVIDER_NAME_MAP,
  type ProviderId, type ProviderMode, type ProviderStatus, type StageType,
  type ProviderStats, type ProviderHistoryEntry, type SummaryHistoryEntry,
  type CompletedTurn, type ChatHistoryItem, type MultiChannelHistoryItem,
  type SingleChannelHistoryItem,
} from '../types';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════

type SidepanelSettings = { isDeepThinkingEnabled?: boolean; isSummaryEnabled?: boolean; isDebugEnabled?: boolean };
type SummaryConfig = { providerId?: string; model?: string };
type ApiConfig = { mode?: ProviderMode; apiKey?: string; model?: string; enabled?: boolean };

// ════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════

const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
const HISTORY_STORAGE_KEY_SINGLE = 'aiclash.chat.history.single';
const MAX_HISTORY_COUNT = 30;
const CHARS_PER_FRAME = 8;

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultRecord<T>(defaultValue: T): Record<ProviderId, T> {
  return Object.fromEntries(PROVIDER_IDS.map(id => [id, defaultValue])) as Record<ProviderId, T>;
}

// ════════════════════════════════════════════════════════════════════
// Non-reactive mutable buffers (streaming, timers, etc.)
// These intentionally live OUTSIDE the store to avoid re-renders.
// ════════════════════════════════════════════════════════════════════

export const buffers = {
  fullText: createDefaultRecord(''),
  thinkText: createDefaultRecord(''),
  displayedLen: createDefaultRecord(0),
  thinkDisplayedLen: createDefaultRecord(0),
  timing: Object.fromEntries(
    PROVIDER_IDS.map(id => [id, { startTime: 0, firstContentTime: 0 }]),
  ) as Record<ProviderId, { startTime: number; firstContentTime: number }>,

  summaryFull: '',
  summaryThink: '',
  summaryDisplayedLen: 0,
  summaryThinkDisplayedLen: 0,
  summaryTriggered: false,
  summaryTiming: { startTime: 0, firstContentTime: 0 },

  animationId: null as number | null,
  persistTimer: null as number | null,
  pendingRawUrlOverrides: {} as Partial<Record<ProviderId, string>>,
  userHasScrolled: false,

  autoScrollFn: null as (() => void) | null,
};

function resetBuffers() {
  for (const id of PROVIDER_IDS) {
    buffers.fullText[id] = '';
    buffers.thinkText[id] = '';
    buffers.displayedLen[id] = 0;
    buffers.thinkDisplayedLen[id] = 0;
    buffers.timing[id] = { startTime: 0, firstContentTime: 0 };
  }
  buffers.summaryFull = '';
  buffers.summaryThink = '';
  buffers.summaryDisplayedLen = 0;
  buffers.summaryThinkDisplayedLen = 0;
  buffers.summaryTriggered = false;
  buffers.summaryTiming = { startTime: 0, firstContentTime: 0 };
  if (buffers.animationId != null) {
    cancelAnimationFrame(buffers.animationId);
    buffers.animationId = null;
  }
}

// ════════════════════════════════════════════════════════════════════
// Store interface
// ════════════════════════════════════════════════════════════════════

interface AppState {
  // ─── Settings (persisted) ───
  isDeepThinkingEnabled: boolean;
  isDebugEnabled: boolean;
  isSummaryEnabled: boolean;
  summaryProviderId: string;
  summaryModel: string;

  // ─── Provider Config (persisted) ───
  enabledMap: Record<ProviderId, boolean>;
  modeMap: Record<ProviderId, ProviderMode>;
  apiKeyMap: Record<ProviderId, string>;
  modelMap: Record<ProviderId, string>;

  // ─── Session ───
  inputStr: string;
  currentQuestion: string;
  hasAsked: boolean;
  activeSessionId: string;
  isCurrentSessionFromHistory: boolean;
  conversationTurns: CompletedTurn[];
  isMultiTurnSession: boolean;

  // ─── Provider Responses ───
  statusMap: Record<ProviderId, ProviderStatus>;
  stageMap: Record<ProviderId, StageType>;
  responses: Record<ProviderId, string>;
  thinkResponses: Record<ProviderId, string>;
  operationStatus: Record<ProviderId, string>;
  rawUrlMap: Record<ProviderId, string>;
  statsMap: Record<ProviderId, ProviderStats | null>;
  openMap: Record<ProviderId, boolean>;

  // ─── Summary ───
  summaryStatus: 'idle' | 'running' | 'completed' | 'error';
  summaryStage: 'thinking' | 'responding';
  summaryResponse: string;
  summaryThinkResponse: string;
  summaryOperationStatus: string;
  summaryStats: ProviderStats | null;

  // ─── UI Panels ───
  isHistoryPanelOpen: boolean;
  activeProviderSettings: ProviderId | '';
  showNoChannelTip: boolean;
  isSummarySettingsOpen: boolean;
  testingApiKey: Record<string, boolean>;
  apiKeyTestResult: Record<string, { success: boolean; message: string }>;
  showApiKey: Record<string, boolean>;

  // ─── History ───
  historyList: ChatHistoryItem[];
}

interface AppActions {
  // ─── Settings ───
  toggleDeepThinking: () => void;
  toggleDebug: () => void;
  toggleSummary: () => void;
  setSummaryProviderId: (v: string) => void;
  setSummaryModel: (v: string) => void;

  // ─── Provider Config ───
  toggleProvider: (id: string) => Promise<void>;
  setProviderMode: (id: ProviderId, mode: ProviderMode) => void;
  setProviderApiKey: (id: ProviderId, value: string) => void;
  setProviderModel: (id: ProviderId, value: string) => void;
  testApiKey: (providerId: string, apiKey: string) => Promise<void>;

  // ─── Session ───
  setInputStr: (v: string) => void;
  submit: () => void;
  createNewChat: () => void;
  restoreHistorySession: (item: ChatHistoryItem) => void;

  // ─── UI ───
  setIsHistoryPanelOpen: (v: boolean) => void;
  openProviderSettings: (id: ProviderId) => void;
  closeProviderSettings: () => void;
  setShowNoChannelTip: (v: boolean) => void;
  setIsSummarySettingsOpen: (v: boolean) => void;
  toggleShowApiKey: (id: string) => void;

  // ─── History ───
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;

  // ─── Internal ───
  resetTaskState: () => void;
  tickStreamDisplay: () => void;
  schedulePersist: (delay?: number, rawUrlOverrides?: Partial<Record<ProviderId, string>>) => void;
  triggerSummary: () => void;
  goToProvider: (id: string, activate?: boolean) => Promise<any>;
  init: () => (() => void);

  // ─── Derived getters ───
  getEnabledProviderIds: () => ProviderId[];
  isSummaryConfigValid: () => boolean;
  summaryBlockReason: () => string | null;
  getSummaryProviderOptions: () => Array<{ value: string; label: string }>;
  getSummaryModelOptions: () => Array<{ value: string; label: string }>;
}

// ════════════════════════════════════════════════════════════════════
// Store
// ════════════════════════════════════════════════════════════════════

export const useStore = create<AppState & AppActions>()((set, get) => {

  // ─── Chrome storage helpers ───

  const saveSettings = () => {
    const s = get();
    chrome.storage?.local.set({
      [SETTINGS_KEY]: {
        isDeepThinkingEnabled: s.isDeepThinkingEnabled,
        isSummaryEnabled: s.isSummaryEnabled,
        isDebugEnabled: s.isDebugEnabled,
      },
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
      stats: null,
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
    isDebugEnabled: false,
    isSummaryEnabled: false,
    summaryProviderId: '',
    summaryModel: '',

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
    stageMap: createDefaultRecord<StageType>('connecting'),
    responses: createDefaultRecord(''),
    thinkResponses: createDefaultRecord(''),
    operationStatus: createDefaultRecord(''),
    rawUrlMap: createDefaultRecord(''),
    statsMap: createDefaultRecord<ProviderStats | null>(null),
    openMap: createDefaultRecord(true),

    summaryStatus: 'idle',
    summaryStage: 'responding',
    summaryResponse: '',
    summaryThinkResponse: '',
    summaryOperationStatus: '',
    summaryStats: null,

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

    // ─── Provider Config Actions ───

    toggleProvider: async (providerId) => {
      const id = providerId as ProviderId;
      const s = get();
      if (s.enabledMap[id]) {
        set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: false } }));
        return;
      }
      if (s.modeMap[id] === 'api') {
        set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: true } }));
        return;
      }
      try {
        const result = await get().goToProvider(id, false);
        if (result?.success) {
          set(prev => ({ enabledMap: { ...prev.enabledMap, [id]: true } }));
        } else {
          window.alert(`开启${id}失败：${result?.error || '无法创建页面'}`);
        }
      } catch (err) {
        window.alert(`开启${id}失败：${String(err)}`);
      }
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
        const message = r?.message || r?.error || '请求失败';
        set(prev => ({ apiKeyTestResult: { ...prev.apiKeyTestResult, [providerId]: { success, message } } }));
        if (success) {
          message.success(message);
        } else {
          message.error(message);
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

    submit: () => {
      const s = get();
      const prompt = s.inputStr.trim();
      if (!prompt) return;
      const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
      if (!enabledIds.length) { set({ showNoChannelTip: true }); return; }

      buffers.userHasScrolled = false;
      const isSingleChannel = enabledIds.length === 1;
      const isMultiTurnContinuation = s.isMultiTurnSession && isSingleChannel && s.hasAsked && !s.isCurrentSessionFromHistory;

      let newTurns = s.conversationTurns;
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

      const newOpenMap = { ...s.openMap };
      for (const id of PROVIDER_IDS) newOpenMap[id] = s.enabledMap[id];

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
        openMap: newOpenMap,
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

      for (const id of enabledIds) {
        chrome.runtime?.sendMessage({
          type: MSG_TYPES.DISPATCH_TASK,
          payload: {
            provider: id, prompt,
            mode: s.modeMap[id] === 'web' && id === 'yuanbao' ? 'web' : s.modeMap[id],
            settings: { isDeepThinkingEnabled: s.isDeepThinkingEnabled, conversationHistory, isNewConversation },
          },
        });
      }
    },

    createNewChat: () => {
      get().resetTaskState();
      const s = get();
      const newOpenMap = { ...s.openMap };
      for (const id of PROVIDER_IDS) newOpenMap[id] = s.enabledMap[id];
      set({
        currentQuestion: '', hasAsked: false, activeSessionId: '',
        isCurrentSessionFromHistory: false, isHistoryPanelOpen: false,
        activeProviderSettings: '', conversationTurns: [],
        isMultiTurnSession: false, openMap: newOpenMap, inputStr: '',
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
          openMap: { ...prev.openMap, [providerId]: true },
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
        const newOpen = createDefaultRecord(false);

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
          rawUrlMap: newRaw, statsMap: newStats, openMap: newOpen,
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

    // ─── History Actions ───

    deleteHistoryItem: (id) => {
      set(prev => {
        const next = prev.historyList.filter(h => h.id !== id);
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
        stageMap: createDefaultRecord('connecting'),
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
      if (Object.keys(newResp).length) set(prev => ({ responses: { ...prev.responses, ...newResp } }));
      if (Object.keys(newThink).length) set(prev => ({ thinkResponses: { ...prev.thinkResponses, ...newThink } }));

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

    triggerSummary: () => {
      if (buffers.summaryTriggered) return;
      const s = get();
      if (!s.isSummaryEnabled || !s.isSummaryConfigValid()) return;
      const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
      const completed = enabledIds
        .filter(id => (s.statusMap[id] === 'completed' || s.statusMap[id] === 'error') && buffers.fullText[id]?.trim())
        .map(id => ({ providerId: id, name: PROVIDER_NAME_MAP[id], text: buffers.fullText[id] }));
      if (completed.length < 2) return;

      buffers.summaryTriggered = true;
      buffers.summaryTiming.startTime = Date.now();
      set({ summaryStatus: 'running', summaryOperationStatus: '' });

      chrome.runtime?.sendMessage({
        type: MSG_TYPES.DISPATCH_SUMMARY,
        payload: {
          question: s.currentQuestion, responses: completed,
          summaryConfig: { providerId: s.summaryProviderId, model: s.summaryModel },
        },
      });
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
      const pid = s.summaryProviderId as ProviderId;
      if (!pid || !(PROVIDER_IDS as readonly string[]).includes(pid)) return false;
      return supportsApi(pid) && !!s.apiKeyMap[pid]?.trim();
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
        .filter((p: any) => p.supportsApi && s.apiKeyMap[p.id as ProviderId]?.trim())
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
        [SETTINGS_KEY, API_CONFIG_KEY, SUMMARY_CONFIG_KEY, HISTORY_STORAGE_KEY, HISTORY_STORAGE_KEY_SINGLE],
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

          const validResults = await Promise.all(PROVIDER_IDS.map(id => checkProviderTabValid(id)));
          const newEnabled = createDefaultRecord(false);
          PROVIDER_IDS.forEach((id, i) => { newEnabled[id] = validResults[i]; });

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
            isSummaryEnabled: saved.isSummaryEnabled ?? false,
            isDebugEnabled: debugVal,
            modeMap: newModes, apiKeyMap: newKeys, modelMap: newModels,
            summaryProviderId: sc.providerId || '', summaryModel: sc.model || '',
            enabledMap: newEnabled,
            historyList: allHistory,
          });
        },
      );

      // Chrome message listener
      const listener = (request: any) => {
        const { provider } = request.payload || {};
        const store = get();

        if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
          const p = request.payload;
          if (provider === '_summary') {
            if (p.isStatus) { set({ summaryOperationStatus: p.text }); return; }
            if (p.stage) set({ summaryStage: p.stage });
            if (!p.isThink && p.text && !buffers.summaryTiming.firstContentTime) buffers.summaryTiming.firstContentTime = Date.now();
            setTimeout(() => {
              if (p.isThink) buffers.summaryThink += p.text;
              else buffers.summaryFull += p.text;
              if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
            }, 0);
            return;
          }
          const prov = provider as ProviderId;
          if (!prov) return;
          if (p.isStatus) { set(prev => ({ operationStatus: { ...prev.operationStatus, [prov]: p.text } })); get().schedulePersist(); return; }
          if (!p.isThink && p.text && !buffers.timing[prov].firstContentTime) buffers.timing[prov].firstContentTime = Date.now();
          if (p.stage) set(prev => ({ stageMap: { ...prev.stageMap, [prov]: p.stage } }));
          else if (p.text?.length > 0) set(prev => ({ stageMap: { ...prev.stageMap, [prov]: 'responding' } }));
          setTimeout(() => {
            if (p.isThink) {
              if (!get().isDeepThinkingEnabled) return;
              buffers.thinkText[prov] = (buffers.thinkText[prov] || '') + p.text;
            } else {
              buffers.fullText[prov] = (buffers.fullText[prov] || '') + p.text;
            }
            if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
            get().schedulePersist();
          }, 0);

        } else if (request.type === MSG_TYPES.TASK_STATUS_UPDATE) {
          if (provider === '_summary') { set({ summaryStatus: 'running', summaryOperationStatus: request.payload.text || '' }); return; }
          const prov = provider as ProviderId;
          if (!prov) return;
          set(prev => ({ statusMap: { ...prev.statusMap, [prov]: 'running' }, operationStatus: { ...prev.operationStatus, [prov]: request.payload.text || '' } }));
          get().schedulePersist();

        } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
          if (provider === '_summary') {
            set({ summaryStatus: 'completed', summaryOperationStatus: '' });
            if (buffers.summaryTiming.startTime > 0 && buffers.summaryTiming.firstContentTime > 0) {
              const now = Date.now();
              const charCount = buffers.summaryFull?.length || 0;
              const ttff = buffers.summaryTiming.firstContentTime - buffers.summaryTiming.startTime;
              const totalTime = now - buffers.summaryTiming.startTime;
              const outputSecs = (now - buffers.summaryTiming.firstContentTime) / 1000;
              set({ summaryStats: { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 } });
            }
            get().schedulePersist();
            return;
          }
          const prov = provider as ProviderId;
          if (!prov) return;
          set(prev => ({ statusMap: { ...prev.statusMap, [prov]: 'completed' }, operationStatus: { ...prev.operationStatus, [prov]: '' } }));
          const timing = buffers.timing[prov];
          if (timing.startTime > 0 && timing.firstContentTime > 0) {
            const now = Date.now();
            const charCount = buffers.fullText[prov]?.length || 0;
            const ttff = timing.firstContentTime - timing.startTime;
            const totalTime = now - timing.startTime;
            const outputSecs = (now - timing.firstContentTime) / 1000;
            set(prev => ({ statsMap: { ...prev.statsMap, [prov]: { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 } } }));
          }
          syncProviderRawUrls([prov]);
          get().schedulePersist();

          setTimeout(() => {
            const s = get();
            const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
            if (!stillRunning) {
              setTimeout(() => set({ openMap: createDefaultRecord(false) }), 1500);
              if (s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) get().triggerSummary();
            }
          }, 50);

        } else if (request.type === MSG_TYPES.ERROR) {
          if (provider === '_summary') {
            const errMsg = request.payload.message || request.payload.error || '未知错误';
            buffers.summaryFull = `[归纳总结出错] ${errMsg}`;
            buffers.summaryDisplayedLen = buffers.summaryFull.length;
            set({ summaryStatus: 'error', summaryOperationStatus: '', summaryResponse: buffers.summaryFull });
            return;
          }
          const prov = provider as ProviderId;
          if (!prov) return;
          const errText = `[系统报错] ${request.payload.message || request.payload.error || '未知错误'}`;
          buffers.fullText[prov] = errText;
          buffers.displayedLen[prov] = errText.length;
          set(prev => ({
            statusMap: { ...prev.statusMap, [prov]: 'error' },
            operationStatus: { ...prev.operationStatus, [prov]: '' },
            responses: { ...prev.responses, [prov]: errText },
          }));
          syncProviderRawUrls([prov]);
          get().schedulePersist();

          setTimeout(() => {
            const s = get();
            const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
            if (!stillRunning && s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) get().triggerSummary();
          }, 50);
        }
      };

      chrome.runtime?.onMessage.addListener(listener);
      return () => { chrome.runtime?.onMessage.removeListener(listener); };
    },
  };
});
