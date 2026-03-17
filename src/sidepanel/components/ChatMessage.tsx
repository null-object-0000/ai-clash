import { useState } from 'react';
import { ExportOutlined } from '@ant-design/icons';
import { Markdown, Tooltip, Tag, Skeleton } from '@lobehub/ui';
import { ChatItem, LoadingDots } from '@lobehub/ui/chat';
import type { ProviderStats, ProviderStatus, StageType, ProviderId, ThemeColor } from '../types';
import ThinkingBlock from './ThinkingBlock';
import MessageHeaderAddon from './MessageHeaderAddon';
import { getProviderIcon, getProviderThemeColor, activateOrOpenTab } from '../utils';

const STAGE_LABELS: Record<string, string> = {
  connecting: '等待连接网页端...',
  thinking: '已连接 · 正在思考...',
  responding: '正在输出...',
};

export interface ChatMessageProps {
  providerId: ProviderId;
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

  const stageLabel = STAGE_LABELS[stage] ?? STAGE_LABELS.connecting;
  const Icon = getProviderIcon(providerId);

  const isLoading = status === 'running' && !response && stage !== 'responding';

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  const titleAddon = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status === 'running' && (
        <LoadingDots variant="pulse" size={12} color={themeColor} />
      )}

      {operationStatus && (
        <span className="text-xs text-orange-500 animate-pulse">{operationStatus}</span>
      )}
      {!operationStatus && status === 'running' && (
        <span className="text-xs text-gray-500 animate-pulse">{stageLabel}</span>
      )}

      <MessageHeaderAddon
        status={status}
        stats={stats}
        hasError={status === 'error'}
      />

      {rawUrl && rawUrl !== 'api' && (
        <Tooltip title={isFromHistory ? '在新标签页打开对话页' : '激活已有标签或打开对话页'}>
          <a
            href={rawUrl}
            target={isFromHistory ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={handleOriginalClick}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 no-underline hover:bg-gray-100 transition-smooth"
          >
            <ExportOutlined className="text-xs opacity-80" />
            <span>原文</span>
          </a>
        </Tooltip>
      )}
      {rawUrl === 'api' && (
        <Tag size="small" className="ml-auto">API</Tag>
      )}
    </div>
  );

  const aboveMessage = isDeepThinkingEnabled && thinkResponse ? (
    <ThinkingBlock
      content={thinkResponse}
      className="mb-2"
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
      <Markdown
        variant="chat"
        fontSize={13.5}
        rehypePlugins={[]}
        remarkPlugins={[]}
        enableLatex={false}
        enableMermaid={false}
      >
        {response}
      </Markdown>
      {status === 'running' && stage === 'responding' && (
        <span
          className="inline-block w-1.5 h-3.5 ml-0.5 align-middle rounded-sm animate-pulse"
          style={{ backgroundColor: themeColor }}
        />
      )}
    </>
  ) : isLoading ? (
    <Skeleton active paragraph={{ rows: 2 }} title={false} />
  ) : (
    <div className="text-sm text-gray-500 leading-relaxed">
      {fallbackText}
    </div>
  );

  return (
    <ChatItem
      placement="left"
      avatar={{
        avatar: Icon ? <Icon size={20} /> : undefined,
        backgroundColor: themeColor,
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
