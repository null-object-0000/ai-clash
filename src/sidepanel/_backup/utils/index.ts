import { PROVIDER_NAME_MAP, type ProviderId } from '../types';
import { getProviderIconSet, getProviderIcon } from './providerIcons';

/**
 * 获取提供者的显示名称
 */
export function getProviderLabel(providerId: ProviderId): string {
  return PROVIDER_NAME_MAP[providerId] || providerId;
}

/**
 * 获取提供者的主题色
 */
export function getProviderThemeColor(providerId: ProviderId): string {
  const colorMap: Record<ProviderId, string> = {
    deepseek: '#2563eb',
    doubao: '#722ed1',
    qianwen: '#1890ff',
    longcat: '#52c41a',
    yuanbao: '#faad14',
  };
  return colorMap[providerId] || '#6b7280';
}

/**
 * 获取提供者的图标组件
 */
export { getProviderIcon, getProviderIconSet } from './providerIcons';

/**
 * 激活或打开指定的标签页
 */
export async function activateOrOpenTab(url: string): Promise<number | undefined> {
  try {
    // 查询现有标签页
    const tabs = await chrome.tabs.query({ url: url });
    if (tabs.length > 0 && tabs[0].id) {
      // 激活现有标签页
      await chrome.tabs.update(tabs[0].id, { active: true });
      return tabs[0].id;
    } else {
      // 打开新标签页
      const newTab = await chrome.tabs.create({ url: url });
      return newTab.id;
    }
  } catch (error) {
    console.error('Failed to activate or open tab:', error);
    return undefined;
  }
}

/**
 * 格式化时间戳为可读格式
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化持续时间（毫秒）为可读格式
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
