import { PROVIDER_IDS, type ProviderId, type ProviderStats } from '../types';

// ════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════

export const SETTINGS_KEY = 'aiclash.sidepanel.settings';
export const API_CONFIG_KEY = 'aiclash.api.config';
export const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
export const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
export const HISTORY_STORAGE_KEY_SINGLE = 'aiclash.chat.history.single';
export const MAX_HISTORY_COUNT = 30;
export const CHARS_PER_FRAME = 8;

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

export function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export function resetBuffers() {
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
