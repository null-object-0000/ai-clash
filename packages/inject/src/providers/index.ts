/**
 * Provider Registry - 所有 AI 提供者配置
 */

export { deepseekProvider } from './deepseek.js';
export { doubaoProvider } from './doubao.js';
export { qianwenProvider } from './qianwen.js';
export { longcatProvider } from './longcat.js';
export { yuanbaoProvider } from './yuanbao.js';
export { wenxinProvider } from './wenxin.js';
export { xiaomiProvider } from './mimo.js';
export { kimiProvider } from './kimi.js';

import type { ProviderConfig, ProviderId } from '../core/types.js';
import { deepseekProvider } from './deepseek.js';
import { doubaoProvider } from './doubao.js';
import { qianwenProvider } from './qianwen.js';
import { longcatProvider } from './longcat.js';
import { yuanbaoProvider } from './yuanbao.js';
import { wenxinProvider } from './wenxin.js';
import { xiaomiProvider } from './mimo.js';
import { kimiProvider } from './kimi.js';

/**
 * Provider 注册表
 */
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  deepseek: deepseekProvider,
  doubao: doubaoProvider,
  qianwen: qianwenProvider,
  longcat: longcatProvider,
  yuanbao: yuanbaoProvider,
  wenxin: wenxinProvider,
  xiaomi: xiaomiProvider,
  kimi: kimiProvider,
};

/**
 * 获取 Provider 配置
 */
export function getProviderConfig(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS[id];
}

/**
 * 获取所有可用的 Provider IDs
 */
export function getProviderIds(): ProviderId[] {
  return Object.keys(PROVIDERS) as ProviderId[];
}

export type { ProviderId };
