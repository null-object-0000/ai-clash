import { useState, useEffect } from 'react';
import { ExportOutlined, CheckCircleOutlined, ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Tag, Collapse, Skeleton, Typography } from 'antd';
import { Think } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import type { ProviderStats, ProviderStatus, StageType, ThemeColor } from '../types';

const { Text } = Typography;

const iconMap: Record<string, { Color?: React.ComponentType<{ size?: number | string; className?: string }> }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  longcat: LongCat,
  yuanbao: Yuanbao,
};

const STAGE_LABELS: Record<string, string> = {
  connecting: '等待连接网页端...',
  thinking: '已连接 · 正在思考...',
  responding: '正在输出...',
};

const THEME_COLOR_MAP: Record<ThemeColor, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  violet: '#8b5cf6',
  teal: '#14b8a6',
};

export interface ProviderCollapseProps {
  providerId: string;
  providerName: string;
  themeColor: ThemeColor;
  status: ProviderStatus;
  stage: StageType;
  response: string;
  thinkResponse?: string;
  operationStatus?: string;
  rawUrl?: string;
  isFromHistory?: boolean;
  isDeepThinkingEnabled?: boolean;
  defaultOpen?: boolean;
  stats?: ProviderStats | null;
}

function activateOrOpenTab(url: string) {
  try {
    const u = new URL(url);
    const pattern = u.origin + '/*';
    chrome.tabs.query({ url: pattern }, (tabs) => {
      const tab = tabs.find((t) => t.url === url);
      if (tab?.id != null) {
        chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId != null) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url });
      }
    });
  } catch {
    chrome.tabs.create({ url });
  }
}

export default function ProviderCollapse({
  providerId,
  providerName,
  themeColor,
  status,
  stage,
  response,
  thinkResponse,
  operationStatus,
  rawUrl,
  isFromHistory = false,
  isDeepThinkingEnabled = false,
  defaultOpen = true,
  stats,
}: ProviderCollapseProps) {
  const [activeKeys, setActiveKeys] = useState<string[]>(defaultOpen ? [providerId] : []);
  const [isThinkBlockOpen, setIsThinkBlockOpen] = useState(true);

  useEffect(() => {
    setActiveKeys(defaultOpen ? [providerId] : []);
  }, [defaultOpen, providerId]);

  const color = THEME_COLOR_MAP[themeColor] ?? THEME_COLOR_MAP.blue;
  const stageLabel = STAGE_LABELS[stage] ?? STAGE_LABELS.connecting;
  const Icon = iconMap[providerId];

  const statusText = status === 'running' ? '正在输出...'
    : status === 'completed' ? '(已完成)'
    : status === 'error' ? '(出错)'
    : '(待开始)';

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    e.stopPropagation();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  const statusIcon = status === 'running' ? (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: color,
      animation: 'pulse 1s infinite',
    }} />
  ) : status === 'completed' ? (
    <CheckCircleOutlined style={{ fontSize: 14, color: '#10b981', flexShrink: 0 }} />
  ) : status === 'error' ? (
    <ExclamationCircleOutlined style={{ fontSize: 14, color: '#f43f5e', flexShrink: 0 }} />
  ) : (
    <span style={{ display: 'inline-flex', borderRadius: '50%', height: 8, width: 8, background: '#d9d9d9', flexShrink: 0 }} />
  );

  const headerLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {statusIcon}
      {Icon?.Color && <Icon.Color size={14} />}
      <span style={{ fontSize: 13, fontWeight: 500, color, flexShrink: 0 }}>
        {providerName} {statusText}
      </span>
      {operationStatus && (
        <Text style={{ fontSize: 11, color: '#f59e0b', animation: 'pulse 1s infinite' }}>{operationStatus}</Text>
      )}
      {!operationStatus && status === 'running' && (
        <Text style={{ fontSize: 11, color: '#9ca3af', animation: 'pulse 1s infinite' }}>{stageLabel}</Text>
      )}
      {!operationStatus && stats && status === 'completed' && (
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>
          首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(stats.totalTime / 1000).toFixed(1)}s ·{' '}
          {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
        </Text>
      )}
    </div>
  );

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      {rawUrl && rawUrl !== 'api' && (
        <Tag
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
              activateOrOpenTab(rawUrl);
            }
          }}
        >
          <ExportOutlined style={{ marginRight: 4 }} />
          原文
        </Tag>
      )}
      {rawUrl === 'api' && (
        <Tag style={{ fontSize: 12 }}>API</Tag>
      )}
    </div>
  );

  const bodyContent = (
    <div>
      {/* 思考过程 - 使用 Think 组件 */}
      {isDeepThinkingEnabled && thinkResponse && (
        <Think
          expanded={isThinkBlockOpen}
          onExpand={setIsThinkBlockOpen}
          title="深度思考"
          style={{ marginBottom: 12 }}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{thinkResponse}</div>
        </Think>
      )}

      {/* 思考中标记 */}
      {!thinkResponse && isDeepThinkingEnabled && stage === 'thinking' && status === 'running' && (
        <div style={{
          marginBottom: 12,
          fontSize: 12,
          color: '#9ca3af',
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          正在思考...
          <span style={{
            display: 'inline-block',
            width: 3,
            height: 10,
            background: '#9ca3af',
            animation: 'pulse 1s infinite',
          }} />
        </div>
      )}

      {/* 回答内容 - 使用 XMarkdown */}
      {response ? (
        <XMarkdown content={response} />
      ) : status === 'running' && stage !== 'responding' ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <div style={{ fontSize: 13.5, color: '#9ca3af', lineHeight: 1.8 }}>
          {status === 'running' ? ''
            : status === 'error' ? '执行失败，请查看上面的错误信息。'
            : status === 'completed' ? '本轮未收到可展示内容。'
            : '等待开始...'}
        </div>
      )}
      {response && status === 'running' && stage === 'responding' && (
        <span style={{
          display: 'inline-block',
          width: 6,
          height: 14,
          marginLeft: 4,
          backgroundColor: color,
          animation: 'pulse 1s infinite',
          verticalAlign: 'middle',
          borderRadius: 2,
        }} />
      )}
    </div>
  );

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={(keys) => setActiveKeys(keys as string[])}
      bordered={false}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
      }}
      items={[{
        key: providerId,
        label: headerLabel,
        extra: headerExtra,
        children: bodyContent,
      }]}
    />
  );
}
