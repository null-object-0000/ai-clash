/**
 * UI 配置导出层 - 从 providers.js 读取并格式化 UI 所需 data
 *
 * 新增通道/模型只需在 providers.js 中添加，此处自动同步
 */

import { PROVIDERS, getProvider } from '../background/providers.js';

/**
 * UI 用 Provider 元数据
 */
export const PROVIDER_META = PROVIDERS
  .filter(provider => provider.enabled !== false)
  .map(provider => ({
    id: provider.id,
    name: provider.name,
    names: provider.names || {},
    supportedLocales: provider.supportedLocales || ['zh-CN'],
    supportsApi: !!provider.apiConfig?.enabled,
    region: provider.region ?? 'cn', // 地区：cn（中国）| global（海外）
    apiKeyLink: provider.apiConfig?.apiKeyLink || undefined,
    apiNote: provider.apiConfig?.apiNote || undefined,
  }));

/**
 * 按地区过滤的 Provider 元数据
 */
export function normalizeLocale(locale = 'zh-CN') {
  let loc = locale;
  if (loc === 'system') {
    loc = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) || (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
  }
  const normalized = String(loc).toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return 'zh-CN';
}

export function isProviderSupportedLocale(provider, locale = 'zh-CN') {
  const supportedLocales = provider?.supportedLocales || ['zh-CN'];
  return supportedLocales.includes(normalizeLocale(locale));
}

export function isProviderAvailableForLocale(providerId, locale = 'zh-CN') {
  const provider = getProvider(providerId);
  if (!provider || provider.enabled === false) return false;
  return isProviderSupportedLocale(provider, locale);
}

export function getProviderIdsForLocale(locale = 'zh-CN', options = {}) {
  const { includeSummarizer = false } = options;
  return PROVIDERS
    .filter(provider => provider.enabled !== false)
    .filter(provider => includeSummarizer || provider.id !== 'summarizer')
    .filter(provider => isProviderSupportedLocale(provider, locale))
    .map(provider => provider.id);
}

export function getProvidersByRegion(region, locale) {
  return PROVIDER_META
    .filter(p => p.region === region)
    .filter(p => locale == null || isProviderSupportedLocale(p, locale));
}

/**
 * 获取所有可用的地区列表
 */
export function getAvailableRegions() {
  const regions = new Set(PROVIDER_META.map(p => p.region));
  return Array.from(regions);
}

/**
 * 获取模型选项列表 - 从 providers.js 动态生成
 */
export function getModelOptions(providerId, locale = 'zh-CN') {
  const provider = getProvider(providerId);
  const normalized = normalizeLocale(locale);
  if (!provider || !provider.apiConfig?.models) {
    const defaultLabel = normalized === 'en' ? 'Default model (Web mode only)' : '默认模型（仅支持网页模式）';
    return [{ value: '', label: defaultLabel }];
  }

  return provider.apiConfig.models.map(model => {
    let label = `${model.id}`;
    const desc = typeof model.desc === 'object'
      ? (model.desc[normalized] || model.desc['zh-CN'] || '')
      : (model.desc || '');
    if (desc) {
      if (normalized === 'en') {
        label += ` (${desc})`;
      } else {
        label += `（${desc}）`;
      }
    }
    return { value: model.id, label };
  });
}

/**
 * 获取提供者的默认模型 ID
 */
export function getDefaultModel(providerId) {
  const provider = getProvider(providerId);
  return provider?.apiConfig?.defaultModel || '';
}

/**
 * 获取提供者的显示名称
 */
export function getProviderName(providerId, locale = 'zh-CN') {
  const provider = getProvider(providerId);
  const key = normalizeLocale(locale);
  return provider?.names?.[key] || provider?.names?.['zh-CN'] || provider?.name || providerId;
}

/**
 * 获取提供者的 API 配置
 */
export function getProviderApiConfig(providerId) {
  return getProvider(providerId)?.apiConfig || null;
}

/**
 * 获取所有支持 API 模式的提供者 ID 列表
 */
export function getApiEnabledProviderIds() {
  return PROVIDERS
    .filter(p => p.apiConfig?.enabled)
    .map(p => p.id);
}

/**
 * 获取模型 ID 列表
 */
export function getModelIds(providerId) {
  const provider = getProvider(providerId);
  if (!provider?.apiConfig?.models) return [];
  return provider.apiConfig.models.map(m => m.id);
}

/**
 * 检查模型是否支持通过 extra_body 注入 thinking 参数
 */
export function modelSupportsThinking(providerId, modelId) {
  const provider = getProvider(providerId);
  if (!provider?.apiConfig?.models) return false;
  const model = provider.apiConfig.models.find(m => m.id === modelId);
  return !!model?.supportThinking;
}
