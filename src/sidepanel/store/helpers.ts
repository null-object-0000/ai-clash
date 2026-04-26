import { PROVIDER_IDS, type ProviderId, type ProviderStats } from '../types';

// ════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════

export const SETTINGS_KEY = 'aiclash.sidepanel.settings';
export const API_CONFIG_KEY = 'aiclash.api.config';
export const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
export const SUMMARY_PROMPT_KEY = 'aiclash.summary.prompt';  // 自定义总结提示词
export const ENABLED_PROVIDERS_KEY = 'aiclash.enabled.providers';  // 记住用户开启的通道
export const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
export const HISTORY_STORAGE_KEY_SINGLE = 'aiclash.chat.history.single';
export const MAX_HISTORY_COUNT = 30;
export const CHARS_PER_FRAME = 8;

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

export function createSessionId() {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  if (globalCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalCrypto.getRandomValues(bytes);

    // UUID v4 formatting from CSPRNG bytes
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('Secure random generator is unavailable for session id creation.');
}

export function createDefaultRecord<T>(defaultValue: T): Record<ProviderId, T> {
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
  summaryAnalysis: '',
  summaryDisplayedLen: 0,
  summaryThinkDisplayedLen: 0,
  summaryAnalysisDisplayedLen: 0,
  summaryTriggered: false,
  summaryTiming: { startTime: 0, firstContentTime: 0 },

  animationId: null as number | null,
  persistTimer: null as number | null,
  pendingRawUrlOverrides: {} as Partial<Record<ProviderId, string>>,
  userHasScrolled: false,

  autoScrollFn: null as (() => void) | null,

  visitedStages: Object.fromEntries(
    PROVIDER_IDS.map(id => [id, new Set<string>()]),
  ) as Record<ProviderId, Set<string>>,
};

export function resetBuffers() {
  for (const id of PROVIDER_IDS) {
    buffers.fullText[id] = '';
    buffers.thinkText[id] = '';
    buffers.displayedLen[id] = 0;
    buffers.thinkDisplayedLen[id] = 0;
    buffers.timing[id] = { startTime: 0, firstContentTime: 0 };
    buffers.visitedStages[id] = new Set();
  }
  buffers.summaryFull = '';
  buffers.summaryThink = '';
  buffers.summaryAnalysis = '';
  buffers.summaryDisplayedLen = 0;
  buffers.summaryThinkDisplayedLen = 0;
  buffers.summaryAnalysisDisplayedLen = 0;
  buffers.summaryTriggered = false;
  buffers.summaryTiming = { startTime: 0, firstContentTime: 0 };
  if (buffers.animationId != null) {
    cancelAnimationFrame(buffers.animationId);
    buffers.animationId = null;
  }
}
