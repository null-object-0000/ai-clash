export type ShareLocale = 'zh' | 'en';

export type ProviderStats = {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
};

export type ShareProvider = {
  providerId: string;
  providerName: string;
  status: 'completed' | 'error';
  response: string;
  thinkResponse?: string;
  stats?: ProviderStats | null;
};

export type ShareSummary = {
  response: string;
  thinkResponse?: string;
  analysisResponse?: string;
  stats?: ProviderStats | null;
};

export type ShareSnapshot = {
  schemaVersion: 1;
  title?: string;
  question: string;
  createdAt: number;
  locale: ShareLocale;
  providers: ShareProvider[];
  summary?: ShareSummary;
};
