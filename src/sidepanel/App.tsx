import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, History, MessageSquare, Layers } from 'lucide-react';
import { ActionIcon, Tag, Modal, Button, Tooltip } from '@lobehub/ui';
import { MSG_TYPES } from '../shared/messages.js';
import logger, { setDebugEnabled } from '../shared/logger.js';
import { PROVIDER_META, getModelOptions } from '../shared/config.js';
import ProviderCollapse from './components/ProviderCollapse';
import ChatMessage from './components/ChatMessage';
import ChannelList from './components/ChannelList';
import ChannelSettingsModal from './components/ChannelSettingsModal';
import SummaryPanel from './components/SummaryPanel';
import HistoryPanel from './components/HistoryPanel';
import FooterArea from './components/FooterArea';
import {
  PROVIDER_IDS, PROVIDER_THEME_MAP, PROVIDER_NAME_MAP,
  type ProviderId, type ProviderMode, type ProviderStatus, type StageType,
  type ProviderStats, type ProviderHistoryEntry, type SummaryHistoryEntry,
  type CompletedTurn, type ChatHistoryItem, type MultiChannelHistoryItem,
  type SingleChannelHistoryItem,
} from './types';

type SidepanelSettings = { isDeepThinkingEnabled?: boolean; isSummaryEnabled?: boolean; isDebugEnabled?: boolean };
type SummaryConfig = { providerId?: string; model?: string };
type ApiConfig = { mode?: ProviderMode; apiKey?: string; model?: string; enabled?: boolean };

const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
const HISTORY_STORAGE_KEY_SINGLE = 'aiclash.chat.history.single';
const MAX_HISTORY_COUNT = 30;
const CHARS_PER_FRAME = 8;

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultRecord<T>(defaultValue: T): Record<ProviderId, T> {
  return Object.fromEntries(PROVIDER_IDS.map(id => [id, defaultValue])) as Record<ProviderId, T>;
}

export default function App() {
  // ─── UI 状态 ───
  const [inputStr, setInputStr] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [hasAsked, setHasAsked] = useState(false);
  const [isDeepThinkingEnabled, setIsDeepThinkingEnabled] = useState(true);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [enabledMap, setEnabledMap] = useState<Record<ProviderId, boolean>>(createDefaultRecord(false));
  const [openMap, setOpenMap] = useState<Record<ProviderId, boolean>>(createDefaultRecord(true));
  const [modeMap, setModeMap] = useState<Record<ProviderId, ProviderMode>>(createDefaultRecord('web'));
  const [apiKeyMap, setApiKeyMap] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [modelMap, setModelMap] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [testingApiKey, setTestingApiKey] = useState<Record<string, boolean>>({});
  const [apiKeyTestResult, setApiKeyTestResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [historyList, setHistoryList] = useState<ChatHistoryItem[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activeProviderSettings, setActiveProviderSettings] = useState<ProviderId | ''>('');
  const [showNoChannelTip, setShowNoChannelTip] = useState(false);
  const [isCurrentSessionFromHistory, setIsCurrentSessionFromHistory] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<CompletedTurn[]>([]);
  const [isMultiTurnSession, setIsMultiTurnSession] = useState(false);

  // ─── Provider 响应状态 ───
  const [statusMap, setStatusMap] = useState<Record<ProviderId, ProviderStatus>>(createDefaultRecord('idle'));
  const [stageMap, setStageMap] = useState<Record<ProviderId, StageType>>(createDefaultRecord('connecting'));
  const [responses, setResponses] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [thinkResponses, setThinkResponses] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [operationStatus, setOperationStatus] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [rawUrlMap, setRawUrlMap] = useState<Record<ProviderId, string>>(createDefaultRecord(''));
  const [statsMap, setStatsMap] = useState<Record<ProviderId, ProviderStats | null>>(createDefaultRecord(null));

  // ─── 归纳总结状态 ───
  const [isSummaryEnabled, setIsSummaryEnabled] = useState(false);
  const [summaryProviderId, setSummaryProviderId] = useState('');
  const [summaryModel, setSummaryModel] = useState('');
  const [isSummarySettingsOpen, setIsSummarySettingsOpen] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [summaryStage, setSummaryStage] = useState<'thinking' | 'responding'>('responding');
  const [summaryResponse, setSummaryResponse] = useState('');
  const [summaryThinkResponse, setSummaryThinkResponse] = useState('');
  const [summaryOperationStatus, setSummaryOperationStatus] = useState('');
  const [summaryStats, setSummaryStats] = useState<ProviderStats | null>(null);

  // ─── Refs (非渲染数据) ───
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const streamAnimationIdRef = useRef<number | null>(null);
  const historyPersistTimerRef = useRef<number | null>(null);
  const pendingRawUrlOverridesRef = useRef<Partial<Record<ProviderId, string>>>({});
  const fullTextBufferRef = useRef<Record<ProviderId, string>>(createDefaultRecord(''));
  const thinkTextBufferRef = useRef<Record<ProviderId, string>>(createDefaultRecord(''));
  const displayedLengthRef = useRef<Record<ProviderId, number>>(createDefaultRecord(0));
  const thinkDisplayedLengthRef = useRef<Record<ProviderId, number>>(createDefaultRecord(0));
  const timingDataRef = useRef<Record<ProviderId, { startTime: number; firstContentTime: number }>>(
    Object.fromEntries(PROVIDER_IDS.map(id => [id, { startTime: 0, firstContentTime: 0 }])) as any
  );
  const summaryFullBufferRef = useRef('');
  const summaryThinkBufferRef = useRef('');
  const summaryDisplayedLengthRef = useRef(0);
  const summaryThinkDisplayedLengthRef = useRef(0);
  const summaryTriggeredRef = useRef(false);
  const summaryTimingDataRef = useRef({ startTime: 0, firstContentTime: 0 });

  // 稳定引用，供回调使用
  const stateRef = useRef({
    hasAsked, currentQuestion, enabledMap, modeMap, apiKeyMap, modelMap,
    statusMap, responses, thinkResponses, operationStatus, rawUrlMap, statsMap,
    isSummaryEnabled, summaryProviderId, summaryModel, summaryStatus,
    isCurrentSessionFromHistory, conversationTurns, isMultiTurnSession,
    activeSessionId, historyList, isDeepThinkingEnabled,
  });
  useEffect(() => {
    stateRef.current = {
      hasAsked, currentQuestion, enabledMap, modeMap, apiKeyMap, modelMap,
      statusMap, responses, thinkResponses, operationStatus, rawUrlMap, statsMap,
      isSummaryEnabled, summaryProviderId, summaryModel, summaryStatus,
      isCurrentSessionFromHistory, conversationTurns, isMultiTurnSession,
      activeSessionId, historyList, isDeepThinkingEnabled,
    };
  });

  // ─── 工具函数 ───
  const getEnabledProviderIds = useCallback((): ProviderId[] => {
    return PROVIDER_IDS.filter(id => stateRef.current.enabledMap[id]);
  }, []);

  const getProviderLabel = (id: string) => PROVIDER_NAME_MAP[id as ProviderId] || id;
  const getProviderThemeColor = (id: string) => PROVIDER_THEME_MAP[id as ProviderId] || 'blue';

  const getProviderMeta = (id: ProviderId) => PROVIDER_META.find((p: any) => p.id === id);
  const supportsApi = (id: ProviderId) => getProviderMeta(id)?.supportsApi ?? false;

  const getProviderModeText = (id: ProviderId) => stateRef.current.modeMap[id] === 'api' ? 'API' : '网页';
  const getModeValue = (id: ProviderId) => stateRef.current.modeMap[id];
  const getApiKeyValue = (id: ProviderId) => stateRef.current.apiKeyMap[id] || '';
  const getModelValue = (id: ProviderId) => stateRef.current.modelMap[id] || '';

  // ─── 存储 ───
  const saveSettings = useCallback(() => {
    chrome.storage?.local.set({
      [SETTINGS_KEY]: {
        isDeepThinkingEnabled: stateRef.current.isDeepThinkingEnabled,
        isSummaryEnabled: stateRef.current.isSummaryEnabled,
        isDebugEnabled,
      },
    });
  }, [isDebugEnabled]);

  const saveApiConfig = useCallback((providerId: string, config: ApiConfig) => {
    chrome.storage?.local.get([API_CONFIG_KEY], (result) => {
      const existing = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
      chrome.storage?.local.set({
        [API_CONFIG_KEY]: { ...existing, [providerId]: { ...existing[providerId], ...config } },
      });
    });
  }, []);

  const saveSummaryConfig = useCallback(() => {
    chrome.storage?.local.set({
      [SUMMARY_CONFIG_KEY]: { providerId: stateRef.current.summaryProviderId, model: stateRef.current.summaryModel },
    });
  }, []);

  const saveHistory = useCallback((list: ChatHistoryItem[]) => {
    const multi = list.filter(item => item.type === 'multi') as MultiChannelHistoryItem[];
    const single = list.filter(item => item.type === 'single') as SingleChannelHistoryItem[];
    chrome.storage?.local.set({
      [HISTORY_STORAGE_KEY]: multi.slice(0, MAX_HISTORY_COUNT),
      [HISTORY_STORAGE_KEY_SINGLE]: single.slice(0, MAX_HISTORY_COUNT),
    });
  }, []);

  // ─── 总结 ───
  const isSummaryConfigValid = useCallback(() => {
    const pid = stateRef.current.summaryProviderId as ProviderId;
    if (!pid || !(PROVIDER_IDS as readonly string[]).includes(pid)) return false;
    return supportsApi(pid) && !!stateRef.current.apiKeyMap[pid]?.trim();
  }, []);

  const summaryBlockReason = useCallback((): string | null => {
    if (!isSummaryConfigValid()) return '请先配置归纳总结通道';
    const enabled = PROVIDER_IDS.filter(id => stateRef.current.enabledMap[id]);
    if (enabled.length < 2) return '请选择 2 个或以上通道';
    return null;
  }, [isSummaryConfigValid]);

  const getSummaryProviderOptions = useCallback(() => {
    return PROVIDER_META
      .filter((p: any) => p.supportsApi && stateRef.current.apiKeyMap[p.id as ProviderId]?.trim())
      .map((p: any) => ({ value: p.id, label: p.name }));
  }, []);

  const getSummaryModelOptions = useCallback(() => {
    if (!stateRef.current.summaryProviderId) return [];
    return getModelOptions(stateRef.current.summaryProviderId);
  }, []);

  // ─── 历史持久化 ───
  const buildHistoryProviders = useCallback((rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) => {
    const s = stateRef.current;
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
  }, []);

  const buildSummaryHistoryEntry = useCallback((): SummaryHistoryEntry | null => {
    if (stateRef.current.summaryStatus === 'idle') return null;
    return {
      status: stateRef.current.summaryStatus,
      response: summaryFullBufferRef.current || '',
      thinkResponse: summaryThinkBufferRef.current || '',
      stats: null, // summaryStats is not on stateRef for simplicity
    };
  }, []);

  const persistCurrentSession = useCallback((rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) => {
    const s = stateRef.current;
    if (!s.activeSessionId || !s.hasAsked || !s.currentQuestion.trim()) return;
    const merged = { ...pendingRawUrlOverridesRef.current, ...rawUrlOverrides };
    pendingRawUrlOverridesRef.current = {};

    const enabledProviders = PROVIDER_IDS.filter(id => s.enabledMap[id]);

    if (enabledProviders.length === 1) {
      const providerId = enabledProviders[0];
      const providerState = buildHistoryProviders(merged)[providerId];
      upsertSingleChannelSession(
        providerId, s.currentQuestion, providerState.response,
        providerState.thinkResponse, providerState.stats ?? undefined, providerState.rawUrl,
      );
    } else {
      upsertHistoryItem({
        id: s.activeSessionId,
        type: 'multi',
        question: s.currentQuestion,
        createdAt: Date.now(),
        providers: buildHistoryProviders(merged),
        summary: buildSummaryHistoryEntry(),
        conversationTurns: s.conversationTurns.length > 0 ? [...s.conversationTurns] : undefined,
      });
    }
  }, [buildHistoryProviders, buildSummaryHistoryEntry]);

  const schedulePersist = useCallback((delay = 120, rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) => {
    pendingRawUrlOverridesRef.current = { ...pendingRawUrlOverridesRef.current, ...rawUrlOverrides };
    if (historyPersistTimerRef.current != null) window.clearTimeout(historyPersistTimerRef.current);
    historyPersistTimerRef.current = window.setTimeout(() => {
      historyPersistTimerRef.current = null;
      persistCurrentSession();
    }, delay);
  }, [persistCurrentSession]);

  const upsertHistoryItem = useCallback((item: ChatHistoryItem) => {
    setHistoryList(prev => {
      const next = [item, ...prev.filter(h => h.id !== item.id)].slice(0, MAX_HISTORY_COUNT * 2);
      saveHistory(next);
      return next;
    });
  }, [saveHistory]);

  const upsertSingleChannelSession = useCallback((
    providerId: ProviderId, question: string, response: string,
    thinkResponse: string, stats?: ProviderStats, rawUrl?: string,
  ) => {
    const s = stateRef.current;
    const isMultiTurn = s.isMultiTurnSession && s.conversationTurns.length > 0;
    const now = Date.now();

    setHistoryList(prev => {
      let session = prev.find(item => item.id === s.activeSessionId && item.type === 'single') as SingleChannelHistoryItem | undefined;

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

      const next = [session, ...prev.filter(h => h.id !== session!.id)].slice(0, MAX_HISTORY_COUNT * 2);
      saveHistory(next);
      return next;
    });
  }, [saveHistory, buildSummaryHistoryEntry]);

  // ─── 流式输出动画 ───
  const tickStreamDisplay = useCallback(() => {
    let anyPending = false;

    const newResponses: Partial<Record<ProviderId, string>> = {};
    const newThinkResponses: Partial<Record<ProviderId, string>> = {};

    for (const id of PROVIDER_IDS) {
      const thinkFull = thinkTextBufferRef.current[id] || '';
      let thinkLen = thinkDisplayedLengthRef.current[id] || 0;
      if (thinkLen < thinkFull.length) {
        thinkLen = Math.min(thinkLen + CHARS_PER_FRAME, thinkFull.length);
        thinkDisplayedLengthRef.current[id] = thinkLen;
        newThinkResponses[id] = thinkFull.slice(0, thinkLen);
        anyPending = true;
      }

      const full = fullTextBufferRef.current[id] || '';
      let respLen = displayedLengthRef.current[id] || 0;
      if (respLen < full.length) {
        respLen = Math.min(respLen + CHARS_PER_FRAME, full.length);
        displayedLengthRef.current[id] = respLen;
        newResponses[id] = full.slice(0, respLen);
        anyPending = true;
      }
    }

    if (Object.keys(newResponses).length) {
      setResponses(prev => ({ ...prev, ...newResponses }));
    }
    if (Object.keys(newThinkResponses).length) {
      setThinkResponses(prev => ({ ...prev, ...newThinkResponses }));
    }

    // 归纳总结动画
    let summaryUpdated = false;
    const sThinkFull = summaryThinkBufferRef.current;
    let sThinkLen = summaryThinkDisplayedLengthRef.current;
    if (sThinkLen < sThinkFull.length) {
      sThinkLen = Math.min(sThinkLen + CHARS_PER_FRAME, sThinkFull.length);
      summaryThinkDisplayedLengthRef.current = sThinkLen;
      setSummaryThinkResponse(sThinkFull.slice(0, sThinkLen));
      anyPending = true;
      summaryUpdated = true;
    }
    const sFull = summaryFullBufferRef.current;
    let sLen = summaryDisplayedLengthRef.current;
    if (sLen < sFull.length) {
      sLen = Math.min(sLen + CHARS_PER_FRAME, sFull.length);
      summaryDisplayedLengthRef.current = sLen;
      setSummaryResponse(sFull.slice(0, sLen));
      anyPending = true;
    }

    // auto scroll
    if (!userHasScrolledRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }

    if (anyPending) {
      streamAnimationIdRef.current = requestAnimationFrame(tickStreamDisplay);
    } else {
      streamAnimationIdRef.current = null;
    }
  }, []);

  // ─── 任务状态重置 ───
  const resetTaskState = useCallback(() => {
    setStatusMap(createDefaultRecord('idle'));
    setStageMap(createDefaultRecord('connecting'));
    setResponses(createDefaultRecord(''));
    setThinkResponses(createDefaultRecord(''));
    setOperationStatus(createDefaultRecord(''));
    setRawUrlMap(createDefaultRecord(''));
    setStatsMap(createDefaultRecord(null));

    for (const id of PROVIDER_IDS) {
      fullTextBufferRef.current[id] = '';
      thinkTextBufferRef.current[id] = '';
      displayedLengthRef.current[id] = 0;
      thinkDisplayedLengthRef.current[id] = 0;
      timingDataRef.current[id] = { startTime: 0, firstContentTime: 0 };
    }

    setSummaryStatus('idle');
    setSummaryStage('responding');
    setSummaryResponse('');
    setSummaryThinkResponse('');
    setSummaryOperationStatus('');
    setSummaryStats(null);
    summaryFullBufferRef.current = '';
    summaryThinkBufferRef.current = '';
    summaryDisplayedLengthRef.current = 0;
    summaryThinkDisplayedLengthRef.current = 0;
    summaryTriggeredRef.current = false;
    summaryTimingDataRef.current = { startTime: 0, firstContentTime: 0 };

    if (streamAnimationIdRef.current != null) {
      cancelAnimationFrame(streamAnimationIdRef.current);
      streamAnimationIdRef.current = null;
    }
  }, []);

  // ─── Provider tab 操作 ───
  const checkProviderTabValid = async (providerId: string) => {
    try {
      const result = await chrome.runtime?.sendMessage({ type: MSG_TYPES.CHECK_PROVIDER_TAB_VALID, payload: { providerId } });
      return result?.valid ?? false;
    } catch { return false; }
  };

  const handleGoToProvider = async (providerId: string, activate = true) => {
    try {
      return await chrome.runtime?.sendMessage({ type: MSG_TYPES.OPEN_PROVIDER_TAB, payload: { providerId, activate } });
    } catch (err) {
      logger.error('打开provider tab失败:', err);
      return { success: false, error: String(err) };
    }
  };

  const fetchProviderRawUrls = async (providerIds: ProviderId[]) => {
    if (!providerIds.length) return {} as Partial<Record<ProviderId, string>>;
    try {
      const result = await chrome.runtime?.sendMessage({ type: MSG_TYPES.GET_PROVIDER_RAW_URLS, payload: { providerIds } });
      return (result?.urlMap || {}) as Partial<Record<ProviderId, string>>;
    } catch { return {} as Partial<Record<ProviderId, string>>; }
  };

  const syncProviderRawUrls = useCallback(async (providerIds: ProviderId[]) => {
    if (!providerIds.length) return;
    const s = stateRef.current;
    const apiOverrides = providerIds.reduce((acc, id) => {
      if (s.modeMap[id] === 'api') acc[id] = 'api';
      return acc;
    }, {} as Partial<Record<ProviderId, string>>);
    const webIds = providerIds.filter(id => s.modeMap[id] === 'web');
    const webUrls = await fetchProviderRawUrls(webIds);
    const merged = { ...apiOverrides, ...webUrls };
    setRawUrlMap(prev => {
      const next = { ...prev };
      for (const id of providerIds) {
        next[id] = merged[id] ?? apiOverrides[id] ?? prev[id] ?? '';
      }
      return next;
    });
    schedulePersist(0, merged);
  }, [schedulePersist]);

  // ─── 提交 ───
  const submit = useCallback(() => {
    const prompt = inputStr.trim();
    if (!prompt) return;
    const s = stateRef.current;
    const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
    if (!enabledIds.length) { setShowNoChannelTip(true); return; }

    userHasScrolledRef.current = false;
    const isSingleChannel = enabledIds.length === 1;
    const isMultiTurnContinuation = s.isMultiTurnSession && isSingleChannel && s.hasAsked && !s.isCurrentSessionFromHistory;

    let newTurns = s.conversationTurns;
    let newSessionId = s.activeSessionId;
    let newIsMultiTurn = s.isMultiTurnSession;

    if (isMultiTurnContinuation) {
      const pid = enabledIds[0];
      newTurns = [...s.conversationTurns, {
        question: s.currentQuestion, providerId: pid,
        response: fullTextBufferRef.current[pid] || s.responses[pid] || '',
        thinkResponse: thinkTextBufferRef.current[pid] || '',
        rawUrl: s.rawUrlMap[pid] || '',
        stats: s.statsMap[pid] ?? null,
      }];
    } else {
      newTurns = [];
      newSessionId = createSessionId();
      newIsMultiTurn = isSingleChannel;
    }

    setConversationTurns(newTurns);
    setActiveSessionId(newSessionId);
    setIsMultiTurnSession(newIsMultiTurn);
    setCurrentQuestion(prompt);
    setHasAsked(true);
    setIsCurrentSessionFromHistory(false);
    setIsHistoryPanelOpen(false);
    setActiveProviderSettings('');

    const newOpenMap = { ...s.enabledMap };
    setOpenMap(prev => {
      const next = { ...prev };
      for (const id of PROVIDER_IDS) next[id] = s.enabledMap[id];
      return next;
    });

    resetTaskState();

    const newRawUrlMap = createDefaultRecord('');
    for (const id of enabledIds) {
      newRawUrlMap[id] = s.modeMap[id] === 'api' ? 'api' : '';
    }
    setRawUrlMap(newRawUrlMap);

    // 更新 stateRef 立即以确保 persistCurrentSession 读到最新
    stateRef.current = {
      ...stateRef.current, hasAsked: true, currentQuestion: prompt,
      activeSessionId: newSessionId, conversationTurns: newTurns,
      isMultiTurnSession: newIsMultiTurn, isCurrentSessionFromHistory: false,
    };
    schedulePersist(0);

    syncProviderRawUrls(enabledIds);

    const conversationHistory = (isSingleChannel && newTurns.length > 0)
      ? newTurns.map(t => ({ question: t.question, response: t.response }))
      : [];
    const isNewConversation = !isMultiTurnContinuation;

    const newStatusMap = createDefaultRecord<ProviderStatus>('idle');
    for (const id of enabledIds) {
      newStatusMap[id] = 'running';
      timingDataRef.current[id].startTime = Date.now();
      chrome.runtime?.sendMessage({
        type: MSG_TYPES.DISPATCH_TASK,
        payload: {
          provider: id, prompt,
          mode: s.modeMap[id] === 'web' && id === 'yuanbao' ? 'web' : s.modeMap[id],
          settings: { isDeepThinkingEnabled: s.isDeepThinkingEnabled, conversationHistory, isNewConversation },
        },
      });
    }
    setStatusMap(newStatusMap);
    setInputStr('');
  }, [inputStr, resetTaskState, schedulePersist, syncProviderRawUrls]);

  // ─── 触发归纳总结 ───
  const triggerSummary = useCallback(() => {
    if (summaryTriggeredRef.current) return;
    const s = stateRef.current;
    if (!s.isSummaryEnabled || !isSummaryConfigValid()) return;

    const enabledIds = PROVIDER_IDS.filter(id => s.enabledMap[id]);
    const completed = enabledIds
      .filter(id => (s.statusMap[id] === 'completed' || s.statusMap[id] === 'error') && fullTextBufferRef.current[id]?.trim())
      .map(id => ({ providerId: id, name: PROVIDER_NAME_MAP[id], text: fullTextBufferRef.current[id] }));

    if (completed.length < 2) return;
    summaryTriggeredRef.current = true;
    setSummaryStatus('running');
    setSummaryOperationStatus('');
    summaryTimingDataRef.current.startTime = Date.now();

    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_SUMMARY,
      payload: {
        question: s.currentQuestion, responses: completed,
        summaryConfig: { providerId: s.summaryProviderId, model: s.summaryModel },
      },
    });
  }, [isSummaryConfigValid]);

  // ─── 新建对话 ───
  const createNewChat = useCallback(() => {
    setCurrentQuestion('');
    setHasAsked(false);
    setActiveSessionId('');
    setIsCurrentSessionFromHistory(false);
    setIsHistoryPanelOpen(false);
    setActiveProviderSettings('');
    setConversationTurns([]);
    setIsMultiTurnSession(false);
    setOpenMap(prev => {
      const next = { ...prev };
      for (const id of PROVIDER_IDS) next[id] = stateRef.current.enabledMap[id];
      return next;
    });
    resetTaskState();
    setInputStr('');
  }, [resetTaskState]);

  // ─── 恢复历史 ───
  const restoreHistorySession = useCallback((item: ChatHistoryItem) => {
    setActiveSessionId(item.id);
    setHasAsked(true);
    setIsHistoryPanelOpen(false);
    setIsCurrentSessionFromHistory(true);
    resetTaskState();

    if (item.type === 'single') {
      const { providerId, turns, summary } = item;
      const lastTurn = turns[turns.length - 1];
      setEnabledMap(prev => {
        const next = { ...prev };
        for (const id of PROVIDER_IDS) next[id] = id === providerId;
        return next;
      });
      setOpenMap(prev => ({ ...prev, [providerId]: true }));
      setCurrentQuestion(lastTurn?.question || '');
      setConversationTurns(turns.slice(0, -1).map(t => ({
        question: t.question, providerId,
        response: t.response, thinkResponse: t.thinkResponse,
        rawUrl: t.rawUrl || '', stats: t.stats || null,
      })));
      setIsMultiTurnSession(turns.length > 0);

      if (lastTurn) {
        setStatusMap(prev => ({ ...prev, [providerId]: 'completed' }));
        setStageMap(prev => ({ ...prev, [providerId]: 'responding' }));
        setResponses(prev => ({ ...prev, [providerId]: lastTurn.response }));
        setThinkResponses(prev => ({ ...prev, [providerId]: lastTurn.thinkResponse }));
        fullTextBufferRef.current[providerId] = lastTurn.response;
        thinkTextBufferRef.current[providerId] = lastTurn.thinkResponse;
        displayedLengthRef.current[providerId] = lastTurn.response.length;
        thinkDisplayedLengthRef.current[providerId] = lastTurn.thinkResponse.length;
        setRawUrlMap(prev => ({ ...prev, [providerId]: lastTurn.rawUrl || '' }));
        setStatsMap(prev => ({ ...prev, [providerId]: lastTurn.stats || null }));
      }
    } else {
      setCurrentQuestion(item.question);
      setConversationTurns(item.conversationTurns ? [...item.conversationTurns] : []);
      setIsMultiTurnSession(false);

      const newEnabled: Record<ProviderId, boolean> = createDefaultRecord(false);
      const newStatus: Record<ProviderId, ProviderStatus> = createDefaultRecord('idle');
      const newStage: Record<ProviderId, StageType> = createDefaultRecord('connecting');
      const newResp: Record<ProviderId, string> = createDefaultRecord('');
      const newThink: Record<ProviderId, string> = createDefaultRecord('');
      const newOp: Record<ProviderId, string> = createDefaultRecord('');
      const newRaw: Record<ProviderId, string> = createDefaultRecord('');
      const newStats: Record<ProviderId, ProviderStats | null> = createDefaultRecord(null);
      const newOpen: Record<ProviderId, boolean> = createDefaultRecord(false);

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
        fullTextBufferRef.current[id] = ps.response;
        thinkTextBufferRef.current[id] = ps.thinkResponse;
        displayedLengthRef.current[id] = ps.response.length;
        thinkDisplayedLengthRef.current[id] = ps.thinkResponse.length;
      }
      setEnabledMap(newEnabled);
      setStatusMap(newStatus);
      setStageMap(newStage);
      setResponses(newResp);
      setThinkResponses(newThink);
      setOperationStatus(newOp);
      setRawUrlMap(newRaw);
      setStatsMap(newStats);
      setOpenMap(newOpen);
    }

    // 恢复总结
    const se = item.type === 'single' ? item.summary : item.summary;
    if (se) {
      setSummaryStatus(se.status);
      setSummaryStage('responding');
      setSummaryResponse(se.response);
      setSummaryThinkResponse(se.thinkResponse);
      summaryFullBufferRef.current = se.response;
      summaryThinkBufferRef.current = se.thinkResponse;
      summaryDisplayedLengthRef.current = se.response.length;
      summaryThinkDisplayedLengthRef.current = se.thinkResponse.length;
      summaryTriggeredRef.current = true;
    }
  }, [resetTaskState]);

  // ─── 开关通道 ───
  const handleToggleProvider = useCallback(async (providerId: string) => {
    const id = providerId as ProviderId;
    const s = stateRef.current;
    if (s.enabledMap[id]) {
      setEnabledMap(prev => ({ ...prev, [id]: false }));
      return;
    }
    if (s.modeMap[id] === 'api') {
      setEnabledMap(prev => ({ ...prev, [id]: true }));
      return;
    }
    try {
      const result = await handleGoToProvider(id, false);
      if (result?.success) {
        setEnabledMap(prev => ({ ...prev, [id]: true }));
      } else {
        window.alert(`开启${id}失败：${result?.error || '无法创建页面'}`);
      }
    } catch (err) {
      window.alert(`开启${id}失败：${String(err)}`);
    }
  }, []);

  // ─── 设置 ───
  const openProviderSettings = useCallback((id: ProviderId) => {
    setActiveProviderSettings(id);
    setIsHistoryPanelOpen(false);
  }, []);

  const setProviderMode = useCallback((id: ProviderId, mode: ProviderMode) => {
    if (mode === 'api' && !stateRef.current.apiKeyMap[id]?.trim()) return;
    setModeMap(prev => ({ ...prev, [id]: mode }));
    saveApiConfig(id, { mode });
    if (mode === 'web' && stateRef.current.enabledMap[id]) {
      handleGoToProvider(id, false).then(result => {
        if (!result?.success) {
          setEnabledMap(prev => ({ ...prev, [id]: false }));
          window.alert(`${getProviderLabel(id)}切换到网页模式失败：${result?.error || '无法创建页面'}`);
        }
      });
    }
  }, [saveApiConfig]);

  const setProviderApiKey = useCallback((id: ProviderId, value: string) => {
    setApiKeyMap(prev => ({ ...prev, [id]: value }));
    saveApiConfig(id, { apiKey: value });
  }, [saveApiConfig]);

  const setProviderModel = useCallback((id: ProviderId, value: string) => {
    setModelMap(prev => ({ ...prev, [id]: value }));
    saveApiConfig(id, { model: value });
  }, [saveApiConfig]);

  const testApiKey = useCallback(async (providerId: string, apiKey: string) => {
    setTestingApiKey(prev => ({ ...prev, [providerId]: true }));
    try {
      const result = await chrome.runtime?.sendMessage({ type: MSG_TYPES.TEST_API_KEY, payload: { providerId, apiKey } });
      setApiKeyTestResult(prev => ({ ...prev, [providerId]: { success: !!result?.success, message: result?.message || result?.error || '请求失败' } }));
    } catch {
      setApiKeyTestResult(prev => ({ ...prev, [providerId]: { success: false, message: '请求失败' } }));
    } finally {
      setTestingApiKey(prev => ({ ...prev, [providerId]: false }));
    }
  }, []);

  // ─── 初始化 ───
  useEffect(() => {
    // 加载设置
    chrome.storage?.local.get([SETTINGS_KEY, API_CONFIG_KEY, SUMMARY_CONFIG_KEY, HISTORY_STORAGE_KEY, HISTORY_STORAGE_KEY_SINGLE], async (result) => {
      const saved = (result?.[SETTINGS_KEY] || {}) as SidepanelSettings;
      setIsDeepThinkingEnabled(saved.isDeepThinkingEnabled ?? true);
      setIsSummaryEnabled(saved.isSummaryEnabled ?? false);
      const debugVal = saved.isDebugEnabled ?? false;
      setIsDebugEnabled(debugVal);
      setDebugEnabled(debugVal);

      // API 配置
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
      setModeMap(newModes);
      setApiKeyMap(newKeys);
      setModelMap(newModels);

      // 总结配置
      const sc = (result?.[SUMMARY_CONFIG_KEY] || {}) as SummaryConfig;
      setSummaryProviderId(sc.providerId || '');
      setSummaryModel(sc.model || '');

      // 通道可用性检测
      const validResults = await Promise.all(PROVIDER_IDS.map(id => checkProviderTabValid(id)));
      const newEnabled = createDefaultRecord(false);
      PROVIDER_IDS.forEach((id, i) => { newEnabled[id] = validResults[i]; });
      setEnabledMap(newEnabled);

      // 加载历史
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
          let turns = [];
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
      setHistoryList(allHistory);
    });

    // Chrome 消息监听
    const listener = (request: any) => {
      const { provider } = request.payload || {};

      if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
        const payload = request.payload;

        if (provider === '_summary') {
          if (payload.isStatus) { setSummaryOperationStatus(payload.text); return; }
          if (payload.stage) setSummaryStage(payload.stage);
          if (!payload.isThink && payload.text && !summaryTimingDataRef.current.firstContentTime) {
            summaryTimingDataRef.current.firstContentTime = Date.now();
          }
          setTimeout(() => {
            if (payload.isThink) summaryThinkBufferRef.current += payload.text;
            else summaryFullBufferRef.current += payload.text;
            if (streamAnimationIdRef.current == null) streamAnimationIdRef.current = requestAnimationFrame(tickStreamDisplay);
          }, 0);
          return;
        }

        const prov = provider as ProviderId;
        if (!prov) return;
        if (payload.isStatus) { setOperationStatus(prev => ({ ...prev, [prov]: payload.text })); schedulePersist(); return; }
        if (!payload.isThink && payload.text && !timingDataRef.current[prov].firstContentTime) {
          timingDataRef.current[prov].firstContentTime = Date.now();
        }
        if (payload.stage) setStageMap(prev => ({ ...prev, [prov]: payload.stage }));
        else if (payload.text?.length > 0) setStageMap(prev => ({ ...prev, [prov]: 'responding' }));

        setTimeout(() => {
          if (payload.isThink) {
            if (!stateRef.current.isDeepThinkingEnabled) return;
            thinkTextBufferRef.current[prov] = (thinkTextBufferRef.current[prov] || '') + payload.text;
          } else {
            fullTextBufferRef.current[prov] = (fullTextBufferRef.current[prov] || '') + payload.text;
          }
          if (streamAnimationIdRef.current == null) streamAnimationIdRef.current = requestAnimationFrame(tickStreamDisplay);
          schedulePersist();
        }, 0);

      } else if (request.type === MSG_TYPES.TASK_STATUS_UPDATE) {
        if (provider === '_summary') { setSummaryStatus('running'); setSummaryOperationStatus(request.payload.text || ''); return; }
        const prov = provider as ProviderId;
        if (!prov) return;
        setStatusMap(prev => ({ ...prev, [prov]: 'running' }));
        setOperationStatus(prev => ({ ...prev, [prov]: request.payload.text || '' }));
        schedulePersist();

      } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
        if (provider === '_summary') {
          setSummaryStatus('completed');
          setSummaryOperationStatus('');
          if (summaryTimingDataRef.current.startTime > 0 && summaryTimingDataRef.current.firstContentTime > 0) {
            const now = Date.now();
            const charCount = summaryFullBufferRef.current?.length || 0;
            const ttff = summaryTimingDataRef.current.firstContentTime - summaryTimingDataRef.current.startTime;
            const totalTime = now - summaryTimingDataRef.current.startTime;
            const outputSecs = (now - summaryTimingDataRef.current.firstContentTime) / 1000;
            setSummaryStats({ ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 });
          }
          schedulePersist();
          return;
        }

        const prov = provider as ProviderId;
        if (!prov) return;
        setStatusMap(prev => ({ ...prev, [prov]: 'completed' }));
        setOperationStatus(prev => ({ ...prev, [prov]: '' }));

        const timing = timingDataRef.current[prov];
        if (timing.startTime > 0 && timing.firstContentTime > 0) {
          const now = Date.now();
          const charCount = fullTextBufferRef.current[prov]?.length || 0;
          const ttff = timing.firstContentTime - timing.startTime;
          const totalTime = now - timing.startTime;
          const outputSecs = (now - timing.firstContentTime) / 1000;
          setStatsMap(prev => ({ ...prev, [prov]: { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 } }));
        }

        syncProviderRawUrls([prov]);
        schedulePersist();

        // 检查所有通道是否都完成了
        setTimeout(() => {
          const s = stateRef.current;
          const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
          if (!stillRunning) {
            setTimeout(() => {
              setOpenMap(createDefaultRecord(false));
            }, 1500);
            if (s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) {
              triggerSummary();
            }
          }
        }, 50);

      } else if (request.type === MSG_TYPES.ERROR) {
        if (provider === '_summary') {
          setSummaryStatus('error');
          setSummaryOperationStatus('');
          const errMsg = request.payload.message || request.payload.error || '未知错误';
          summaryFullBufferRef.current = `[归纳总结出错] ${errMsg}`;
          summaryDisplayedLengthRef.current = summaryFullBufferRef.current.length;
          setSummaryResponse(summaryFullBufferRef.current);
          return;
        }

        const prov = provider as ProviderId;
        if (!prov) return;
        setStatusMap(prev => ({ ...prev, [prov]: 'error' }));
        setOperationStatus(prev => ({ ...prev, [prov]: '' }));
        const message = request.payload.message || request.payload.error || '未知错误';
        const errText = `[系统报错] ${message}`;
        fullTextBufferRef.current[prov] = errText;
        displayedLengthRef.current[prov] = errText.length;
        setResponses(prev => ({ ...prev, [prov]: errText }));
        syncProviderRawUrls([prov]);
        schedulePersist();

        setTimeout(() => {
          const s = stateRef.current;
          const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
          if (!stillRunning && s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) {
            triggerSummary();
          }
        }, 50);
      }
    };

    chrome.runtime?.onMessage.addListener(listener);
    return () => { chrome.runtime?.onMessage.removeListener(listener); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 设置变化持久化 ───
  useEffect(() => { saveSettings(); }, [isDeepThinkingEnabled, isSummaryEnabled, isDebugEnabled]);
  useEffect(() => { setDebugEnabled(isDebugEnabled); }, [isDebugEnabled]);
  useEffect(() => { saveSummaryConfig(); }, [summaryProviderId, summaryModel]);

  // 深度思考关闭时清空思维链
  useEffect(() => {
    if (!isDeepThinkingEnabled) {
      for (const id of PROVIDER_IDS) {
        thinkTextBufferRef.current[id] = '';
        thinkDisplayedLengthRef.current[id] = 0;
      }
      setThinkResponses(createDefaultRecord(''));
      schedulePersist();
    }
  }, [isDeepThinkingEnabled]);

  // 滚动检测
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const isRunningNow = PROVIDER_IDS.some(id => stateRef.current.statusMap[id] === 'running');
      if (!isRunningNow) return;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist > 80) userHasScrolledRef.current = true;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ─── 派生状态 ───
  const isRunning = useMemo(() => PROVIDER_IDS.some(id => statusMap[id] === 'running'), [statusMap]);

  const singleChannelProviderId = useMemo<ProviderId | null>(() => {
    if (!hasAsked) return null;
    const enabled = PROVIDER_IDS.filter(id => enabledMap[id]);
    return enabled.length === 1 ? enabled[0] : null;
  }, [hasAsked, enabledMap]);

  const enabledCount = useMemo(() => PROVIDER_IDS.filter(id => enabledMap[id]).length, [enabledMap]);

  // ─── Render ───
  return (
    <div className="app-shell flex flex-col h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/75 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Tooltip title="新建对话">
            <ActionIcon
              icon={Plus}
              onClick={createNewChat}
              disabled={!hasAsked || isRunning}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="历史对话">
            <div className="inline-flex items-center gap-1.5 cursor-pointer" onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}>
              <ActionIcon icon={History} size="small" variant="outlined" />
              <span className="text-[11px] text-slate-500">{historyList.length}</span>
            </div>
          </Tooltip>
        </div>
        <div className="relative flex items-center gap-2">
          {isMultiTurnSession && hasAsked ? (
            <Tag size="small" color="green">多轮对话</Tag>
          ) : singleChannelProviderId ? (
            <Tag size="small" color="green">单通道</Tag>
          ) : (
            <Tag size="small">MoE 模式</Tag>
          )}
        </div>

        {isHistoryPanelOpen && (
          <HistoryPanel
            historyList={historyList}
            activeSessionId={activeSessionId}
            hasAsked={hasAsked}
            isRunning={isRunning}
            onCreateNewChat={createNewChat}
            onRestoreSession={restoreHistorySession}
            onDeleteItem={(id) => setHistoryList(prev => { const next = prev.filter(h => h.id !== id); saveHistory(next); return next; })}
            onClearAll={() => { setHistoryList([]); saveHistory([]); setIsHistoryPanelOpen(false); }}
            onClose={() => setIsHistoryPanelOpen(false)}
          />
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scroll-smooth" ref={chatContainerRef}>
        {!hasAsked ? (
          <div className="min-h-full flex items-start justify-center pt-2">
            <div className="w-full max-w-[360px] mx-auto space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[18px] leading-7 font-semibold tracking-[-0.02em] text-slate-900">开始新对话</h2>
                    <p className="mt-1 text-[12px] leading-6 text-slate-500">
                      先选择要参与的通道。单个通道的详细参数，点对应的&ldquo;设置&rdquo;再调。
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {enabledCount}/{PROVIDER_META.length}
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  {enabledCount === 1 ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
                      单通道模式 · 支持多轮对话，可连续追问
                    </div>
                  ) : enabledCount >= 2 ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-500">
                      <Layers className="w-3 h-3 flex-shrink-0" />
                      MoE 对比模式 · {enabledCount} 个通道并行回答
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">请至少选择一个通道</div>
                  )}
                </div>
              </div>

              <ChannelList
                providerMeta={PROVIDER_META}
                isEnabled={(id) => enabledMap[id as ProviderId]}
                getModeText={(id) => getProviderModeText(id as ProviderId)}
                getModeValue={(id) => getModeValue(id as ProviderId)}
                onViewHistory={() => setIsHistoryPanelOpen(true)}
                onOpenSettings={(id) => openProviderSettings(id as ProviderId)}
                onToggle={handleToggleProvider}
                onGo={(id) => handleGoToProvider(id)}
              />
            </div>
          </div>
        ) : (
          <>
            {/* 多轮历史轮次 */}
            {conversationTurns.length > 0 && (
              <>
                {conversationTurns.map((turn, idx) => (
                  <div key={idx}>
                    <div className="flex justify-end">
                      <div className="bg-slate-700 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-sm leading-7 break-words tracking-[0.01em] opacity-80">
                        {turn.question}
                      </div>
                    </div>
                    <div className="mt-6">
                      <ChatMessage
                        providerId={turn.providerId}
                        providerName={getProviderLabel(turn.providerId)}
                        themeColor={getProviderThemeColor(turn.providerId)}
                        status="completed"
                        stage="responding"
                        response={turn.response}
                        thinkResponse={turn.thinkResponse}
                        rawUrl={turn.rawUrl}
                        isFromHistory
                        isDeepThinkingEnabled={isDeepThinkingEnabled}
                        stats={turn.stats}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 my-1 opacity-40">
                  <div className="flex-1 border-t border-dashed border-slate-300" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">继续对话</span>
                  <div className="flex-1 border-t border-dashed border-slate-300" />
                </div>
              </>
            )}

            {/* 当前问题 */}
            <div className="flex justify-end">
              <div className="bg-slate-900 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-md leading-7 break-words tracking-[0.01em]">
                {currentQuestion}
              </div>
            </div>

            {/* 单通道模式 */}
            {singleChannelProviderId ? (
              <ChatMessage
                providerId={singleChannelProviderId}
                providerName={getProviderLabel(singleChannelProviderId)}
                themeColor={getProviderThemeColor(singleChannelProviderId)}
                status={statusMap[singleChannelProviderId]}
                stage={stageMap[singleChannelProviderId]}
                response={responses[singleChannelProviderId]}
                thinkResponse={thinkResponses[singleChannelProviderId]}
                operationStatus={operationStatus[singleChannelProviderId]}
                rawUrl={rawUrlMap[singleChannelProviderId]}
                isFromHistory={isCurrentSessionFromHistory}
                isDeepThinkingEnabled={isDeepThinkingEnabled}
                stats={statsMap[singleChannelProviderId]}
              />
            ) : (
              /* 多通道折叠面板 */
              PROVIDER_IDS.filter(id => enabledMap[id]).map(id => (
                <ProviderCollapse
                  key={id}
                  providerId={id}
                  providerName={getProviderLabel(id)}
                  themeColor={getProviderThemeColor(id)}
                  status={statusMap[id]}
                  stage={stageMap[id]}
                  response={responses[id]}
                  thinkResponse={thinkResponses[id]}
                  operationStatus={operationStatus[id]}
                  rawUrl={rawUrlMap[id]}
                  isFromHistory={isCurrentSessionFromHistory}
                  isDeepThinkingEnabled={isDeepThinkingEnabled}
                  defaultOpen={openMap[id]}
                  stats={statsMap[id]}
                />
              ))
            )}

            {/* 归纳总结面板 */}
            {hasAsked && isSummaryEnabled && !summaryBlockReason() && (
              <SummaryPanel
                status={summaryStatus}
                stage={summaryStage}
                response={summaryResponse}
                thinkResponse={summaryThinkResponse}
                operationStatus={summaryOperationStatus}
                stats={summaryStats}
              />
            )}
          </>
        )}
      </main>

      {/* 通道设置弹窗 */}
      {activeProviderSettings && (
        <ChannelSettingsModal
          activeProviderId={activeProviderSettings}
          providerLabel={getProviderLabel(activeProviderSettings)}
          mode={getModeValue(activeProviderSettings as ProviderId)}
          supportsApi={supportsApi(activeProviderSettings as ProviderId)}
          apiKey={getApiKeyValue(activeProviderSettings as ProviderId)}
          model={getModelValue(activeProviderSettings as ProviderId)}
          modelOptions={getModelOptions(activeProviderSettings)}
          showApiKey={showApiKey[activeProviderSettings] ?? false}
          testing={testingApiKey[activeProviderSettings] ?? false}
          apiKeyTestResult={apiKeyTestResult[activeProviderSettings] ?? null}
          apiKeyLink={getProviderMeta(activeProviderSettings as ProviderId)?.apiKeyLink}
          apiNote={getProviderMeta(activeProviderSettings as ProviderId)?.apiNote}
          onClose={() => setActiveProviderSettings('')}
          onUpdateMode={(m) => setProviderMode(activeProviderSettings as ProviderId, m)}
          onUpdateApiKey={(v) => setProviderApiKey(activeProviderSettings as ProviderId, v)}
          onUpdateModel={(v) => setProviderModel(activeProviderSettings as ProviderId, v)}
          onToggleShowApiKey={() => setShowApiKey(prev => ({ ...prev, [activeProviderSettings]: !prev[activeProviderSettings] }))}
          onTestApiKey={() => testApiKey(activeProviderSettings, getApiKeyValue(activeProviderSettings as ProviderId))}
        />
      )}

      {/* 未选通道提示 */}
      <Modal
        open={showNoChannelTip}
        onCancel={() => setShowNoChannelTip(false)}
        title="提示"
        width={320}
        footer={
          <Button type="primary" onClick={() => setShowNoChannelTip(false)} block>
            确定
          </Button>
        }
      >
        <p className="text-[14px] leading-6 text-slate-700">请在通道列表中至少开启一个通道后再发送。</p>
      </Modal>

      {/* Footer */}
      <FooterArea
        inputValue={inputStr}
        isRunning={isRunning}
        isDeepThinkingEnabled={isDeepThinkingEnabled}
        isSummaryEnabled={isSummaryEnabled}
        isSummarySettingsOpen={isSummarySettingsOpen}
        isDebugEnabled={isDebugEnabled}
        summaryProviderId={summaryProviderId}
        summaryModel={summaryModel}
        summaryBlockReason={summaryBlockReason()}
        getSummaryProviderOptions={getSummaryProviderOptions}
        getSummaryModelOptions={getSummaryModelOptions}
        isMultiTurnSession={isMultiTurnSession}
        hasAsked={hasAsked}
        onUpdateInputValue={setInputStr}
        onSubmit={submit}
        onToggleDeepThinking={() => setIsDeepThinkingEnabled(prev => !prev)}
        onToggleSummaryEnabled={() => {
          if (!isSummaryConfigValid()) { setIsSummarySettingsOpen(true); return; }
          if (enabledCount < 2) return;
          setIsSummaryEnabled(prev => !prev);
        }}
        onToggleSummarySettings={() => setIsSummarySettingsOpen(prev => !prev)}
        onUpdateSummaryProviderId={setSummaryProviderId}
        onUpdateSummaryModel={setSummaryModel}
        onToggleDebugEnabled={() => setIsDebugEnabled(prev => !prev)}
      />
    </div>
  );
}
