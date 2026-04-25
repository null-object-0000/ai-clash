// 从 providers.js 动态导入提供者配置，确保 UI 与 manifest 同步
import { PROVIDERS } from '../background/providers.js';

// 仅包含已启用的提供者 ID 列表（排除 summarizer，因为它是内置总结服务，不是回答通道）
export const PROVIDER_IDS = Object.freeze(
  PROVIDERS.filter(p => p.enabled !== false && p.id !== 'summarizer').map(p => p.id)
) as readonly string[];

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderMode = 'web' | 'api';
export type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
export type StageType = 'idle' | 'waiting' | 'opening' | 'loading' | 'connecting' | 'sending' | 'thinking' | 'responding' | 'summarizing' | 'completed';
export type ThemeColor = 'blue' | 'amber' | 'emerald' | 'violet' | 'teal';
export type ErrorType = 'none' | 'system_error' | 'auth_required'; // 错误类型

export interface ApiConfig {
  mode?: ProviderMode;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}

export interface ProviderStats {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
}

export interface ProviderResult {
  providerId: ProviderId;
  content: string;
  reasoningContent: string;
  success: boolean;
  stats: ProviderStats;
}

export interface SidepanelSettings {
  isDeepThinkingEnabled?: boolean;
  isSummaryEnabled?: boolean;
  isDebugEnabled?: boolean;
  isFocusFollowEnabled?: boolean;
}

export interface SummaryConfig {
  providerId?: string;
  model?: string;
  customPrompt?: string;  // 用户自定义提示词
}


export interface ProviderHistoryEntry {
  enabled: boolean;
  mode: ProviderMode;
  status: ProviderStatus;
  stage: StageType;
  response: string;
  thinkResponse: string;
  operationStatus: string;
  errorType: ErrorType;
  rawUrl: string;
  stats: ProviderStats | null;
}

// 总结的单个版本
export interface SummaryVersionEntry {
  response: string;
  thinkResponse: string;
  analysisResponse?: string;
  stats: ProviderStats | null;
  createdAt: number;  // 版本生成时间戳
}

// 总结历史记录（支持多版本）
export interface SummaryHistoryEntry {
  status: 'idle' | 'running' | 'completed' | 'error';
  versions: SummaryVersionEntry[];  // 历史版本数组
  currentVersionIndex: number;  // 当前查看的版本索引
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
  summary?: SummaryHistoryEntry | null;  // 可选，支持多版本
  conversationTurns?: CompletedTurn[];
  customLabel?: string;
}

export interface SingleChannelHistoryItem {
  id: string;
  type: 'single';
  providerId: ProviderId;
  providerName: string;
  createdAt: number;
  updatedAt: number;
  customLabel?: string;
  turns: Array<{
    question: string;
    response: string;
    thinkResponse: string;
    createdAt: number;
    stats?: ProviderStats;
    rawUrl?: string;
  }>;
  summary?: SummaryHistoryEntry;  // 可选，支持多版本
}

export type ChatHistoryItem = MultiChannelHistoryItem | SingleChannelHistoryItem;

// 动态生成提供者主题映射
export const PROVIDER_THEME_MAP: Record<ProviderId, ThemeColor> = Object.fromEntries(
  PROVIDERS
    .filter(p => p.enabled !== false && p.id !== 'summarizer')
    .map(p => {
      // 根据 id 分配主题色
      const themeMap: Record<string, ThemeColor> = {
        deepseek: 'blue',
        doubao: 'amber',
        qianwen: 'emerald',
        longcat: 'violet',
        yuanbao: 'teal',
        wenxin: 'blue',
        xiaomi: 'teal',
      };
      return [p.id, themeMap[p.id] || 'blue'];
    })
) as Record<ProviderId, ThemeColor>;

// 动态生成提供者名称映射
export const PROVIDER_NAME_MAP: Record<ProviderId, string> = Object.fromEntries(
  PROVIDERS
    .filter(p => p.enabled !== false && p.id !== 'summarizer')
    .map(p => [p.id, p.name])
) as Record<ProviderId, string>;
