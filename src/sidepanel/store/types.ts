import type {
  ProviderId, ProviderMode, ProviderStatus, StageType,
  ProviderStats, CompletedTurn, ChatHistoryItem, ErrorType,
} from '../types';

export type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
  isWebSearchEnabled?: boolean;
  isSummaryEnabled?: boolean;
  isDebugEnabled?: boolean;
  isFocusFollowEnabled?: boolean;
};
export type SummaryConfig = { providerId?: string; model?: string };
export type ApiConfig = { mode?: ProviderMode; apiKey?: string; model?: string; enabled?: boolean };

export interface AppState {
  // ─── Settings (persisted) ───
  isDeepThinkingEnabled: boolean;
  isWebSearchEnabled: boolean;
  isDebugEnabled: boolean;
  isSummaryEnabled: boolean;
  isFocusFollowEnabled: boolean;
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
  errorTypeMap: Record<ProviderId, ErrorType>; // 错误类型映射
  rawUrlMap: Record<ProviderId, string>;
  statsMap: Record<ProviderId, ProviderStats | null>;
  collapseMap: Record<ProviderId | 'summary', boolean>; // false = 展开，true = 折叠
  thinkExpandedMap: Record<ProviderId | 'summary', boolean>; // true = 展开思考，false = 折叠思考

  // ─── Summary ───
  summaryStatus: 'idle' | 'running' | 'completed' | 'error';
  summaryStage: 'thinking' | 'responding';
  summaryResponse: string;
  summaryThinkResponse: string;
  summaryOperationStatus: string;
  summaryStats: ProviderStats | null;
  summaryCustomPrompt: string;  // 自定义总结提示词
  // 总结历史版本（运行时状态，非持久化）
  summaryVersions: Array<{ response: string; thinkResponse: string; stats: ProviderStats | null; createdAt: number }>;
  summaryCurrentVersion: number;  // 当前查看的版本索引

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

export interface AppActions {
  // ─── Settings ───
  toggleDeepThinking: () => void;
  toggleWebSearch: () => void;
  toggleDebug: () => void;
  toggleSummary: () => void;
  toggleFocusFollow: () => void;
  setSummaryProviderId: (v: string) => void;
  setSummaryModel: (v: string) => void;
  setSummaryCustomPrompt: (v: string) => void;
  resetSummaryPrompt: () => void;

  // ─── Provider Config ───
  toggleProvider: (id: string) => Promise<void>;
  selectAllProviders: () => Promise<void>;
  invertProviderSelection: () => Promise<void>;
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

  // ─── Collapse ───
  toggleCollapse: (providerId: ProviderId | 'summary') => void;
  collapseAll: () => void;
  expandAll: () => void;
  setThinkExpanded: (providerId: ProviderId | 'summary', expanded: boolean) => void;

  // ─── History ───
  deleteHistoryItem: (id: string) => void;
  renameHistoryItem: (id: string, label: string) => void;
  clearHistory: () => void;

  // ─── Internal ───
  resetTaskState: () => void;
  tickStreamDisplay: () => void;
  schedulePersist: (delay?: number, rawUrlOverrides?: Partial<Record<ProviderId, string>>) => void;
  triggerSummary: (forceTrigger?: boolean) => void;
  regenerateSummary: () => void;
  goToProvider: (id: string, activate?: boolean) => Promise<any>;
  init: () => (() => void);

  // ─── Summary Versions ───
  switchSummaryVersion: (index: number) => void;  // 切换查看的总结版本

  // ─── Derived getters ───
  getEnabledProviderIds: () => ProviderId[];
  isSummaryConfigValid: () => boolean;
  summaryBlockReason: () => string | null;
  getSummaryProviderOptions: () => Array<{ value: string; label: string }>;
  getSummaryModelOptions: () => Array<{ value: string; label: string }>;
}

export type AppStore = AppState & AppActions;
