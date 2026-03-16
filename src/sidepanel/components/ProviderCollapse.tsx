import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Markdown, Tooltip, Tag, Collapse, Skeleton } from '@lobehub/ui';
import { LoadingDots } from '@lobehub/ui/chat';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import type { ProviderStats, ProviderStatus, StageType, ThemeColor } from '../types';

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
    <LoadingDots variant="pulse" size={14} color={color} />
  ) : status === 'completed' ? (
    <CheckCircle style={{ width: 14, height: 14, color: '#10b981', flexShrink: 0 }} />
  ) : status === 'error' ? (
    <AlertCircle style={{ width: 14, height: 14, color: '#f43f5e', flexShrink: 0 }} />
  ) : (
    <span style={{ display: 'inline-flex', borderRadius: '50%', height: 12, width: 12, background: 'var(--lobe-colorBorder, #d9d9d9)', flexShrink: 0 }} />
  );

  const headerLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {statusIcon}
      {Icon?.Color && <Icon.Color size={14} />}
      <span style={{ fontSize: 12, fontWeight: 500, color, flexShrink: 0 }}>
        {providerName} {statusText}
      </span>
      {operationStatus && (
        <span style={{ fontSize: 10, fontWeight: 400, color: '#f59e0b', animation: 'pulse 1s infinite', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{operationStatus}</span>
      )}
      {!operationStatus && status === 'running' && (
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageLabel}</span>
      )}
      {!operationStatus && stats && status === 'completed' && (
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--lobe-colorTextQuaternary, #bbb)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(stats.totalTime / 1000).toFixed(1)}s ·{' '}
          {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
        </span>
      )}
    </div>
  );

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      {rawUrl && rawUrl !== 'api' && (
        <Tooltip title={isFromHistory ? '在新标签页打开对话页' : '激活已有标签或打开对话页'}>
          <a
            href={rawUrl}
            target={isFromHistory ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={handleOriginalClick}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              borderRadius: 999, border: '1px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
              background: 'var(--lobe-colorFillQuaternary, rgba(0,0,0,0.02))',
              padding: '2px 8px', fontSize: 11, fontWeight: 500,
              color: 'var(--lobe-colorTextSecondary, #666)', textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <ExternalLink style={{ width: 12, height: 12, opacity: 0.8 }} />
            <span>原文</span>
          </a>
        </Tooltip>
      )}
      {rawUrl === 'api' && (
        <Tag size="small">API</Tag>
      )}
    </div>
  );

  const bodyContent = (
    <div>
      {isDeepThinkingEnabled && (
        <>
          {thinkResponse ? (
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setIsThinkBlockOpen(!isThinkBlockOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                <ChevronRight
                  style={{
                    width: 12, height: 12,
                    transition: 'transform 0.2s',
                    transform: isThinkBlockOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
                <span>思考过程</span>
                {stage === 'thinking' && status === 'running' && (
                  <span style={{ display: 'inline-block', width: 3, height: 10, marginLeft: 2, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
                )}
              </button>
              {isThinkBlockOpen && (
                <div style={{
                  paddingLeft: 12, borderLeft: '2px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
                  color: 'var(--lobe-colorTextSecondary, #666)', lineHeight: 1.8,
                  whiteSpace: 'pre-wrap', fontSize: 12, wordBreak: 'break-word',
                }}>
                  {thinkResponse}
                </div>
              )}
            </div>
          ) : (
            stage === 'thinking' && status === 'running' && (
              <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                正在思考...
                <span style={{ display: 'inline-block', width: 3, height: 10, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
              </div>
            )
          )}
        </>
      )}

      {response ? (
        <Markdown variant="chat" fontSize={13.5}>
          {response}
        </Markdown>
      ) : status === 'running' && stage !== 'responding' ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <div style={{ fontSize: 13.5, color: 'var(--lobe-colorTextTertiary, #999)', lineHeight: 1.8 }}>
          {status === 'running' ? ''
            : status === 'error' ? '执行失败，请查看上面的错误信息。'
            : status === 'completed' ? '本轮未收到可展示内容。'
            : '等待开始...'}
        </div>
      )}
      {response && status === 'running' && stage === 'responding' && (
        <span style={{
          display: 'inline-block', width: 6, height: 14, marginLeft: 2,
          backgroundColor: color, animation: 'pulse 1s infinite',
          verticalAlign: 'middle', borderRadius: 1,
        }} />
      )}
    </div>
  );

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={(keys) => setActiveKeys(keys as string[])}
      variant="outlined"
      items={[{
        key: providerId,
        label: headerLabel,
        extra: headerExtra,
        children: bodyContent,
      }]}
    />
  );
}
