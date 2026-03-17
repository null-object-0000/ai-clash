import TagBadge from './common/TagBadge';
import { formatDuration } from '../utils';

import type { ProviderStats } from '../types';

interface MessageHeaderAddonProps {
  status: 'idle' | 'running' | 'completed' | 'error';
  stats?: ProviderStats | null;
  hasError?: boolean;
}

export default function MessageHeaderAddon({
  status,
  stats,
  hasError,
}: MessageHeaderAddonProps) {
  if (hasError) {
    return <TagBadge tagVariant="error">响应失败</TagBadge>;
  }

  if (status === 'running') {
    return <TagBadge tagVariant="processing">正在响应</TagBadge>;
  }

  if (status === 'completed' && stats) {
    const duration = stats.totalTime;
    return (
      <div className="flex items-center gap-1.5">
        <TagBadge tagVariant="success">已完成</TagBadge>
        <span className="text-xs text-gray-500">
          首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(duration / 1000).toFixed(1)}s · {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
        </span>
      </div>
    );
  }

  return null;
}
