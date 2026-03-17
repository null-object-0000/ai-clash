import { useState } from 'react';
import { ExportOutlined } from '@ant-design/icons';
import { Avatar, Tag, Skeleton, Typography } from 'antd';
import { Bubble, Think } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import type { ProviderStats, ProviderStatus, StageType, ProviderId, ThemeColor } from '../types';
import MessageHeaderAddon from './MessageHeaderAddon';
import { getProviderIconSet, getProviderIcon, getProviderThemeColor, activateOrOpenTab } from '../utils';

const { Text } = Typography;

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
  const IconSet = getProviderIconSet(providerId);
  const Icon = getProviderIcon(providerId);

  const isLoading = status === 'running' && !response && stage !== 'responding';

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  const headerContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {status === 'running' && (
        <span style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: themeColor,
          animation: 'pulse 1s infinite',
        }} />
      )}

      {operationStatus && (
        <Text style={{ fontSize: 12, color: '#f59e0b', animation: 'pulse 1s infinite' }}>{operationStatus}</Text>
      )}
      {!operationStatus && status === 'running' && (
        <Text style={{ fontSize: 12, color: '#9ca3af', animation: 'pulse 1s infinite' }}>{stageLabel}</Text>
      )}

      <MessageHeaderAddon
        status={status}
        stats={stats}
        hasError={status === 'error'}
      />

      {rawUrl && rawUrl !== 'api' && (
        <a
          href={rawUrl}
          target={isFromHistory ? '_blank' : undefined}
          rel="noopener noreferrer"
          onClick={handleOriginalClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 'auto',
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: 11,
            fontWeight: 500,
            color: '#6b7280',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <ExportOutlined style={{ fontSize: 12, opacity: 0.8 }} />
          <span>原文</span>
        </a>
      )}
      {rawUrl === 'api' && (
        <Tag style={{ marginLeft: 'auto', fontSize: 12 }}>API</Tag>
      )}
    </div>
  );

  const fallbackText = status === 'running'
    ? (stage === 'responding' ? '' : stageLabel)
    : status === 'error'
      ? '执行失败，请查看上面的错误信息。'
      : status === 'completed'
        ? '本轮未收到可展示内容。'
        : '等待开始...';

  const messageContent = response ? (
    <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
      <XMarkdown content={response} />
      {status === 'running' && stage === 'responding' && (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 14,
            marginLeft: 4,
            verticalAlign: 'middle',
            borderRadius: 2,
            backgroundColor: themeColor,
            animation: 'pulse 1s infinite',
          }}
        />
      )}
    </div>
  ) : isLoading ? (
    <Skeleton active paragraph={{ rows: 2 }} title={false} />
  ) : (
    <div style={{ fontSize: 13.5, color: '#9ca3af', lineHeight: 1.8 }}>
      {fallbackText}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 思考过程 - 使用 Think 组件 */}
      {isDeepThinkingEnabled && thinkResponse && (
        <Think
          expanded={isThinkBlockOpen}
          onExpand={setIsThinkBlockOpen}
          title="深度思考"
          style={{ marginBottom: 8 }}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{thinkResponse}</div>
        </Think>
      )}

      <Bubble
        content={messageContent}
        avatar={
          <Avatar
            style={{ backgroundColor: themeColor }}
            icon={IconSet?.Color ? <IconSet.Color size={20} /> : undefined}
          />
        }
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1f1f1f' }}>{providerName}</span>
            {headerContent}
          </div>
        }
        placement="start"
        variant="shadow"
        styles={{
          body: {
            padding: '12px 16px',
            fontSize: 13.5,
            lineHeight: 1.8,
          },
          header: {
            marginBottom: 8,
          },
        }}
      />
    </div>
  );
}
