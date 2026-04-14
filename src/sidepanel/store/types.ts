import type {
  ProviderId, ProviderMode, ProviderStatus, StageType,
  ProviderStats, CompletedTurn, ChatHistoryItem,
} from '../types';

export type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
  isWebSearchEnabled?: boolean;
  isSummaryEnabled?: boolean;
  isDebugEnabled?: boolean;
};
export type SummaryConfig = { providerId?: string; model?: string };
export type ApiConfig = { mode?: ProviderMode; apiKey?: string; model?: string; enabled?: boolean };

export interface AppState {
  // ─── Settings (persisted) ───
  isDeepThinkingEnabled: boolean;
  isWebSearchEnabled: boolean;
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
  collapseMap: Record<ProviderId, boolean>; // false = 展开，true = 折叠
  thinkExpandedMap: Record<ProviderId, boolean>; // true = 展开思考，false = 折叠思考

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

export interface AppActions {
  // ─── Settings ───
  toggleDeepThinking: () => void;
  toggleWebSearch: () => void;
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

  // ─── Collapse ───
  toggleCollapse: (providerId: ProviderId) => void;
  collapseAll: () => void;
  expandAll: () => void;
  setThinkExpanded: (providerId: ProviderId, expanded: boolean) => void;

  // ─── History ───
  deleteHistoryItem: (id: string) => void;
  renameHistoryItem: (id: string, label: string) => void;
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

export type AppStore = AppState & AppActions;
