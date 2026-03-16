import { useState, useMemo } from 'react';
import { CheckCircle, AlertCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { renderMarkdown } from '../utils/renderMarkdown';
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

const THEME_CLASS_MAP: Record<
  ThemeColor,
  { ping: string; dot: string; text: string; prose: string; avatar: string }
> = {
  blue: { ping: 'bg-blue-400', dot: 'bg-blue-500', text: 'text-blue-600', prose: 'prose-blue', avatar: 'bg-blue-500' },
  amber: {
    ping: 'bg-amber-400',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
    prose: 'prose-amber',
    avatar: 'bg-amber-500',
  },
  emerald: {
    ping: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
    prose: 'prose-emerald',
    avatar: 'bg-emerald-500',
  },
  violet: {
    ping: 'bg-violet-400',
    dot: 'bg-violet-500',
    text: 'text-violet-600',
    prose: 'prose-violet',
    avatar: 'bg-violet-500',
  },
  teal: { ping: 'bg-teal-400', dot: 'bg-teal-500', text: 'text-teal-600', prose: 'prose-teal', avatar: 'bg-teal-500' },
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

  const themeClasses = THEME_CLASS_MAP[themeColor] ?? THEME_CLASS_MAP.blue;
  const stageLabel = STAGE_LABELS[stage] ?? STAGE_LABELS.connecting;
  const Icon = iconMap[providerId];

  const renderedContent = useMemo(() => {
    if (response) return renderMarkdown(response);
    if (status === 'running') return stage === 'responding' ? '' : stageLabel;
    if (status === 'error') return '执行失败，请查看上面的错误信息。';
    if (status === 'completed') return '本轮未收到可展示内容。';
    return '等待开始...';
  }, [response, status, stage, stageLabel]);

  const handleOriginalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isFromHistory) return;
    e.preventDefault();
    if (rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
      activateOrOpenTab(rawUrl);
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      {/* 提供者头像 - 使用 @lobehub/icons .Color 图标 */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white select-none mt-0.5 ${themeClasses.avatar}`}
      >
        {Icon?.Color ? (
          <Icon.Color size={14} className="text-white" />
        ) : (
          <span className="text-[11px] font-bold">{providerName.slice(0, 2)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* 头部：名称 + 状态 + 原文链接 */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className={`text-[12px] font-semibold flex-shrink-0 ${themeClasses.text}`}>{providerName}</span>

          {status === 'running' && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${themeClasses.ping}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${themeClasses.dot}`} />
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
            <a
              href={rawUrl}
              target={isFromHistory ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="ml-auto flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-600"
              onClick={handleOriginalClick}
              title={isFromHistory ? '在新标签页打开对话页' : '激活已有标签或打开对话页'}
            >
              <ExternalLink className="w-3 h-3 opacity-80" />
              <span>原文</span>
            </a>
          )}
          {rawUrl === 'api' && (
            <span className="ml-auto flex-shrink-0 rounded-full border border-slate-100 bg-slate-50/80 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              API
            </span>
          )}
        </div>

        {/* 消息气泡 */}
        <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200/60 shadow-sm px-4 py-3 text-[13.5px]">
          {/* 思考内容块 */}
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
                    <div className="response-scroll pl-3 border-l border-slate-200 text-slate-500 leading-6 whitespace-pre-wrap text-[12px] break-words max-h-[200px] overflow-y-auto">
                      {thinkResponse}
                    </div>
                  )}
                </div>
              ) : (
                stage === 'thinking' &&
                status === 'running' && (
                  <div className="mb-2 text-[11px] text-slate-400 italic flex items-center gap-1">
                    正在思考...
                    <span className="inline-block w-1 h-2.5 bg-slate-400 animate-pulse align-middle" />
                  </div>
                )
              )}
            </>
          )}

          {/* 正式回复 */}
          <div
            className={`response-content text-slate-700 prose prose-sm max-w-none leading-7 break-words ${themeClasses.prose}`}
          >
            <span dangerouslySetInnerHTML={{ __html: renderedContent }} />
            {status === 'running' && stage === 'responding' && (
              <span className={`inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle ${themeClasses.dot}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
