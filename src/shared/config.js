/**
 * UI 配置导出层 - 从 providers.js 读取并格式化 UI 所需数据
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
    supportsApi: !!provider.apiConfig?.enabled,
    region: provider.region ?? 'cn', // 地区：cn（中国）| global（海外）
    apiKeyLink: provider.apiConfig?.apiKeyLink || undefined,
    apiNote: provider.apiConfig?.apiNote || undefined,
  }));

/**
 * 按地区过滤的 Provider 元数据
 */
export function getProvidersByRegion(region) {
  return PROVIDER_META.filter(p => p.region === region);
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
export function getModelOptions(providerId) {
  const provider = getProvider(providerId);
  if (!provider || !provider.apiConfig?.models) {
    return [{ value: '', label: '默认模型（仅支持网页模式）' }];
  }

  return provider.apiConfig.models.map(model => {
    let label = `${model.id}`;
    if (model.desc) label += `（${model.desc}）`;
    if (model.maxTokens) {
      const tokensLabel = model.maxTokens >= 1024
        ? `${(model.maxTokens / 1024).toFixed(0)}K`
        : `${model.maxTokens}`;
      label += `，输出最大 ${tokensLabel}`;
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
export function getProviderName(providerId) {
  return getProvider(providerId)?.name || providerId;
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
 * 获取模型的 maxTokens 配置
 */
export function getModelMaxTokens(providerId, modelId) {
  const provider = getProvider(providerId);
  if (!provider?.apiConfig?.models) return undefined;
  const model = provider.apiConfig.models.find(m => m.id === modelId);
  return model?.maxTokens;
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
