export const PROVIDER_IDS = ['deepseek', 'doubao', 'qianwen', 'longcat', 'yuanbao'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderMode = 'web' | 'api';
export type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
export type StageType = 'connecting' | 'thinking' | 'responding';
export type ThemeColor = 'blue' | 'amber' | 'emerald' | 'violet' | 'teal';

export interface ProviderStats {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
}

export interface ProviderHistoryEntry {
  enabled: boolean;
  mode: ProviderMode;
  status: ProviderStatus;
  stage: StageType;
  response: string;
  thinkResponse: string;
  operationStatus: string;
  rawUrl: string;
  stats: ProviderStats | null;
}

export interface SummaryHistoryEntry {
  status: 'idle' | 'running' | 'completed' | 'error';
  response: string;
  thinkResponse: string;
  stats: ProviderStats | null;
}

export interface CompletedTurn {
  question: string;
  providerId: ProviderId;
  response: string;
  thinkResponse: string;
  rawUrl: string;
  stats: ProviderStats | null;
}

export interface MultiChannelHistoryItem {
  id: string;
  type: 'multi';
  question: string;
  createdAt: number;
  providers: Record<ProviderId, ProviderHistoryEntry>;
  summary: SummaryHistoryEntry | null;
  conversationTurns?: CompletedTurn[];
}

export interface SingleChannelHistoryItem {
  id: string;
  type: 'single';
  providerId: ProviderId;
  providerName: string;
  createdAt: number;
  updatedAt: number;
  turns: Array<{
    question: string;
    response: string;
    thinkResponse: string;
    createdAt: number;
    stats?: ProviderStats;
    rawUrl?: string;
  }>;
  summary?: SummaryHistoryEntry;
}

export type ChatHistoryItem = MultiChannelHistoryItem | SingleChannelHistoryItem;

export const PROVIDER_THEME_MAP: Record<ProviderId, ThemeColor> = {
  deepseek: 'blue',
  doubao: 'amber',
  qianwen: 'emerald',
  longcat: 'violet',
  yuanbao: 'teal',
};

export const PROVIDER_NAME_MAP: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  doubao: '豆包',
  qianwen: '千问',
  longcat: 'LongCat',
  yuanbao: '元宝',
};
