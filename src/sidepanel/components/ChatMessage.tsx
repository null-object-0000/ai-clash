import { useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Markdown, Tooltip, Tag, Skeleton } from '@lobehub/ui';
import { ChatItem, LoadingDots } from '@lobehub/ui/chat';
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

export interface ChatMessageProps {
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

function ThinkingBlock({
  thinkResponse,
  stage,
  status,
  isOpen,
  onToggle,
}: {
  thinkResponse?: string;
  stage: StageType;
  status: ProviderStatus;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (thinkResponse) {
    return (
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={onToggle}
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
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
          <span>思考过程</span>
          {stage === 'thinking' && status === 'running' && (
            <span style={{ display: 'inline-block', width: 3, height: 10, marginLeft: 2, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
          )}
        </button>
        {isOpen && (
          <div style={{
            paddingLeft: 12, borderLeft: '2px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
            color: 'var(--lobe-colorTextSecondary, #666)', lineHeight: 1.8,
            whiteSpace: 'pre-wrap', fontSize: 12, wordBreak: 'break-word',
            maxHeight: 200, overflowY: 'auto',
          }}>
            {thinkResponse}
          </div>
        )}
      </div>
    );
  }

  if (stage === 'thinking' && status === 'running') {
    return (
      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
        正在思考...
        <span style={{ display: 'inline-block', width: 3, height: 10, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
      </div>
    );
  }

  return null;
}

export default function ChatMessage({
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
  stats,
}: ChatMessageProps) {
  const [isThinkBlockOpen, setIsThinkBlockOpen] = useState(true);

  const color = THEME_COLOR_MAP[themeColor] ?? THEME_COLOR_MAP.blue;
  const stageLabel = STAGE_LABELS[stage] ?? STAGE_LABELS.connecting;
  const Icon = iconMap[providerId];

  const isLoading = status === 'running' && !response && stage !== 'responding';

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  const titleAddon = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {status === 'running' && (
        <LoadingDots variant="pulse" size={12} color={color} />
      )}
      {status === 'completed' && <CheckCircle style={{ width: 12, height: 12, color: '#10b981' }} />}
      {status === 'error' && <AlertCircle style={{ width: 12, height: 12, color: '#f43f5e' }} />}

      {operationStatus && (
        <span style={{ fontSize: 10, color: '#f59e0b', animation: 'pulse 1s infinite' }}>{operationStatus}</span>
      )}
      {!operationStatus && status === 'running' && (
        <span style={{ fontSize: 10, color: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }}>{stageLabel}</span>
      )}
      {!operationStatus && stats && status === 'completed' && (
        <span style={{ fontSize: 10, color: 'var(--lobe-colorTextQuaternary, #bbb)' }}>
          首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(stats.totalTime / 1000).toFixed(1)}s ·{' '}
          {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
        </span>
      )}

      {rawUrl && rawUrl !== 'api' && (
        <Tooltip title={isFromHistory ? '在新标签页打开对话页' : '激活已有标签或打开对话页'}>
          <a
            href={rawUrl}
            target={isFromHistory ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={handleOriginalClick}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
              borderRadius: 999, border: '1px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
              background: 'var(--lobe-colorFillQuaternary, rgba(0,0,0,0.02))',
              padding: '1px 8px', fontSize: 11, fontWeight: 500,
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
        <Tag size="small" style={{ marginLeft: 'auto' }}>API</Tag>
      )}
    </div>
  );

  const aboveMessage = isDeepThinkingEnabled ? (
    <ThinkingBlock
      thinkResponse={thinkResponse}
      stage={stage}
      status={status}
      isOpen={isThinkBlockOpen}
      onToggle={() => setIsThinkBlockOpen(!isThinkBlockOpen)}
    />
  ) : null;

  const fallbackText = status === 'running'
    ? (stage === 'responding' ? '' : stageLabel)
    : status === 'error'
      ? '执行失败，请查看上面的错误信息。'
      : status === 'completed'
        ? '本轮未收到可展示内容。'
        : '等待开始...';

  const messageContent = response ? (
    <>
      <Markdown variant="chat" fontSize={13.5}>
        {response}
      </Markdown>
      {status === 'running' && stage === 'responding' && (
        <span style={{
          display: 'inline-block', width: 6, height: 14, marginLeft: 2,
          backgroundColor: color, animation: 'pulse 1s infinite',
          verticalAlign: 'middle', borderRadius: 1,
        }} />
      )}
    </>
  ) : isLoading ? (
    <Skeleton active paragraph={{ rows: 2 }} title={false} />
  ) : (
    <div style={{ fontSize: 13.5, color: 'var(--lobe-colorTextTertiary, #999)', lineHeight: 1.8 }}>
      {fallbackText}
    </div>
  );

  return (
    <ChatItem
      placement="left"
      avatar={{
        avatar: Icon?.Color ? <Icon.Color size={20} /> : undefined,
        backgroundColor: color,
        title: providerName,
      }}
      showTitle
      titleAddon={titleAddon}
      aboveMessage={aboveMessage}
      renderMessage={() => messageContent}
      message=" "
      variant="bubble"
      markdownProps={{ variant: 'chat', fontSize: 13.5 }}
    />
  );
}
