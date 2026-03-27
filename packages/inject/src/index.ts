/**
 * AI Clash Inject
 *
 * A standalone injection library for controlling AI chat interfaces.
 * Supports multiple usage scenarios:
 * - Chrome Extension integration
 * - F12 / Bookmarklet direct usage
 * - Puppeteer/Playwright automation
 * - WebSocket remote control
 */

// Core
export { createInjector } from './core/injector.js';
export { IncrementalHelper, extractIncrement } from './core/incremental-utils.js';
export type {
  Injector,
  InjectorOptions,
  Capabilities,
  ChatCapability,
  ThinkingCapability,
  SearchCapability,
  ModelCapability,
  ModelInfo,
  ProviderConfig,
  ProviderId,
  AdapterType,
  SendCallbacks,
  ConversationInfo,
} from './core/types.js';
export type {
  StreamState,
  IncrementalResult,
} from './core/incremental-utils.js';

// Providers
export {
  PROVIDERS,
  getProviderConfig,
  getProviderIds,
} from './providers/index.js';

export { deepseekProvider } from './providers/deepseek.js';
export { doubaoProvider } from './providers/doubao.js';
export { qianwenProvider } from './providers/qianwen.js';
export { longcatProvider } from './providers/longcat.js';
export { yuanbaoProvider } from './providers/yuanbao.js';
