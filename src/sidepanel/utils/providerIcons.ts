import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons';
import { MergeCellsOutlined } from '@ant-design/icons';
import type { ProviderId } from '../types';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number | string; className?: string; style?: React.CSSProperties }>;

const PROVIDER_ICON_MAP: Record<string, { Color?: IconComponent; Mono?: IconComponent }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  yuanbao: Yuanbao,
  wenxin: Wenxin,
  longcat: LongCat,
  xiaomi: { Color: XiaomiMiMo },
  summarizer: { Color: MergeCellsOutlined as unknown as IconComponent },
  summary: { Color: MergeCellsOutlined as unknown as IconComponent },
};

export function getProviderIconSet(providerId: ProviderId | 'summary') {
  return PROVIDER_ICON_MAP[providerId];
}

export function getProviderIcon(providerId: ProviderId | 'summary') {
  const iconSet = getProviderIconSet(providerId);
  return iconSet?.Color || iconSet?.Mono;
}
