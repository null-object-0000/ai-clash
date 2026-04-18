/**
 * Provider 图标统一配置
 *
 * 所有 Provider 图标定义集中管理，避免多处维护
 */

import { MergeCellsOutlined } from '@ant-design/icons';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons';
import type { ProviderId } from '../types';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number | string; className?: string; style?: React.CSSProperties }>;

/**
 * Provider 图标映射表
 *
 * 注意：此处的 provider ID 必须与 background/providers.js 中的一致
 */
const PROVIDER_ICON_MAP: Record<string, IconComponent | { Color: IconComponent }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  yuanbao: Yuanbao,
  wenxin: Wenxin,
  longcat: LongCat,
  xiaomi: { Color: XiaomiMiMo },
  // 内置总结服务
  summarizer: { Color: MergeCellsOutlined as unknown as IconComponent },
  summary: { Color: MergeCellsOutlined as unknown as IconComponent },
};

/**
 * 获取 Provider 图标集合
 */
export function getProviderIconSet(providerId: ProviderId | 'summary' | 'summarizer') {
  return PROVIDER_ICON_MAP[providerId];
}

/**
 * 获取 Provider 图标（返回单个图标组件）
 */
export function getProviderIcon(providerId: ProviderId | 'summary' | 'summarizer'): IconComponent | undefined {
  const iconSet = PROVIDER_ICON_MAP[providerId];
  if (!iconSet) return undefined;
  // 如果是 { Color: Icon } 类型，返回 Color
  if ('Color' in iconSet) {
    return iconSet.Color;
  }
  return iconSet;
}

/**
 * 获取 Provider 彩色图标（用于设置面板等）
 */
export function getProviderColorIcon(providerId: ProviderId | 'summary' | 'summarizer') {
  const iconSet = PROVIDER_ICON_MAP[providerId];
  if (!iconSet) return undefined;
  // 如果是 { Color: Icon } 类型，返回 Color
  if ('Color' in iconSet) {
    return iconSet.Color;
  }
  return iconSet;
}
