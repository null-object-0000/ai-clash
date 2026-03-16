import { useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Markdown, Avatar, ActionIcon, Tooltip, Tag } from '@lobehub/ui';
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

  const fallbackText = status === 'running'
    ? (stage === 'responding' ? '' : stageLabel)
    : status === 'error'
      ? '执行失败，请查看上面的错误信息。'
      : status === 'completed'
        ? '本轮未收到可展示内容。'
        : '等待开始...';

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      <Avatar
        avatar={Icon?.Color ? <Icon.Color size={18} /> : undefined}
        size={28}
        shape="circle"
        background={color}
        style={{ flexShrink: 0, marginTop: 2 }}
      />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-[12px] font-semibold flex-shrink-0" style={{ color }}>{providerName}</span>

          {status === 'running' && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
            </span>
          )}
          {status === 'completed' && <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
          {status === 'error' && <AlertCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />}

          {operationStatus && (
            <span className="text-[10px] text-amber-500 animate-pulse truncate">{operationStatus}</span>
          )}
          {!operationStatus && status === 'running' && (
            <span className="text-[10px] text-slate-400 animate-pulse truncate">{stageLabel}</span>
          )}
          {!operationStatus && stats && status === 'completed' && (
            <span className="text-[10px] text-slate-400 truncate">
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
                className="ml-auto flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-600"
                onClick={handleOriginalClick}
              >
                <ExternalLink className="w-3 h-3 opacity-80" />
                <span>原文</span>
              </a>
            </Tooltip>
          )}
          {rawUrl === 'api' && (
            <Tag className="ml-auto flex-shrink-0" size="small">API</Tag>
          )}
        </div>

        <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200/60 shadow-sm px-4 py-3">
          {isDeepThinkingEnabled && (
            <>
              {thinkResponse ? (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setIsThinkBlockOpen(!isThinkBlockOpen)}
                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors mb-1"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform duration-200 ${isThinkBlockOpen ? 'rotate-90' : ''}`}
                    />
                    <span>思考过程</span>
                    {stage === 'thinking' && status === 'running' && (
                      <span className="inline-block w-1 h-2.5 ml-0.5 bg-slate-400 animate-pulse align-middle" />
                    )}
                  </button>
                  {isThinkBlockOpen && (
                    <div className="pl-3 border-l border-slate-200 text-slate-500 leading-6 whitespace-pre-wrap text-[12px] break-words max-h-[200px] overflow-y-auto">
                      {thinkResponse}
                    </div>
                  )}
                </div>
              ) : (
                stage === 'thinking' && status === 'running' && (
                  <div className="mb-2 text-[11px] text-slate-400 italic flex items-center gap-1">
                    正在思考...
                    <span className="inline-block w-1 h-2.5 bg-slate-400 animate-pulse align-middle" />
                  </div>
                )
              )}
            </>
          )}

          {response ? (
            <Markdown variant="chat" fontSize={13.5}>
              {response}
            </Markdown>
          ) : (
            <div className="text-[13.5px] text-slate-500 leading-7">
              {fallbackText}
            </div>
          )}
          {response && status === 'running' && stage === 'responding' && (
            <span className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle" style={{ backgroundColor: color }} />
          )}
        </div>
      </div>
    </div>
  );
}
