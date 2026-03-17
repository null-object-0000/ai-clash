import { Tag } from 'antd';
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
    return <Tag color="red">响应失败</Tag>;
  }

  if (status === 'running') {
    return <Tag color="blue">正在响应</Tag>;
  }

  if (status === 'completed' && stats) {
    const duration = stats.totalTime;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Tag color="green">已完成</Tag>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(duration / 1000).toFixed(1)}s · {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
        </span>
      </div>
    );
  }

  return null;
}
