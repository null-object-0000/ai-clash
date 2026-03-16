import { useState } from 'react';
import { CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Markdown, Tag } from '@lobehub/ui';
import type { ProviderStats } from '../types';

export interface SummaryPanelProps {
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: 'thinking' | 'responding';
  response: string;
  thinkResponse?: string;
  operationStatus?: string;
  stats?: ProviderStats | null;
}

export default function SummaryPanel({
  status,
  stage,
  response,
  thinkResponse,
  operationStatus,
  stats,
}: SummaryPanelProps) {
  const [isThinkBlockOpen, setIsThinkBlockOpen] = useState(true);

  return (
    <div className="relative bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden ring-1 ring-indigo-50">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-b border-indigo-100/80">
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
            </span>
          )}
          {status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />}
          {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
          {status === 'idle' && <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-200" />}

          <span className="text-[12px] font-semibold text-indigo-700 tracking-wide">最终研判结论</span>
          <Tag size="small" color="purple">AI 智能汇总</Tag>
        </div>
        <div className="text-[11px] text-indigo-400">
          {operationStatus && <span className="animate-pulse">{operationStatus}</span>}
          {!operationStatus && status === 'running' && stage === 'thinking' && <span>正在思考...</span>}
          {!operationStatus && status === 'running' && stage !== 'thinking' && <span>正在输出...</span>}
          {!operationStatus && stats && status === 'completed' && (
            <span>
              首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(stats.totalTime / 1000).toFixed(1)}s ·{' '}
              {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
            </span>
          )}
          {!operationStatus && !stats && status === 'completed' && <span>已完成</span>}
        </div>
      </div>

      <div className="p-4">
        {status === 'idle' && (
          <div className="text-[13px] text-slate-400 italic">等待各通道回答完毕后自动归纳...</div>
        )}

        {thinkResponse && status !== 'idle' && (
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
              <div className="pl-3 border-l border-slate-200 text-slate-500 leading-6 whitespace-pre-wrap text-[12px] break-words">
                {thinkResponse}
              </div>
            )}
          </div>
        )}
        {!thinkResponse && stage === 'thinking' && status === 'running' && (
          <div className="mb-3 text-[11px] text-slate-400 italic flex items-center gap-1">
            正在思考...
            <span className="inline-block w-1 h-2.5 bg-slate-400 animate-pulse align-middle" />
          </div>
        )}

        {status !== 'idle' && (
          <>
            {response ? (
              <Markdown variant="chat" fontSize={13.5}>
                {response}
              </Markdown>
            ) : (
              status === 'running' && stage === 'responding' && (
                <span className="inline-block w-1.5 h-3.5 bg-indigo-500 animate-pulse align-middle" />
              )
            )}
            {response && status === 'running' && stage === 'responding' && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
