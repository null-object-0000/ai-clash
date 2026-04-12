import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import type { ProviderId } from '../types';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

const PROVIDER_ICON_MAP: Record<string, { Color?: IconComponent; Mono?: IconComponent }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  yuanbao: Yuanbao,
  longcat: LongCat,
};

export function getProviderIconSet(providerId: ProviderId) {
  return PROVIDER_ICON_MAP[providerId];
}

export function getProviderIcon(providerId: ProviderId) {
  const iconSet = getProviderIconSet(providerId);
  return iconSet?.Color || iconSet?.Mono;
}
