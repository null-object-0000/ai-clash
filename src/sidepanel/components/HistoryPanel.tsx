import { X } from 'lucide-react';
import type { ChatHistoryItem } from '../types';

function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getHistoryEnabledCount(item: ChatHistoryItem): number {
  if (item.type === 'single') return 1;
  return Object.values(item.providers).filter((p) => p?.enabled).length;
}

export interface HistoryPanelProps {
  historyList: ChatHistoryItem[];
  activeSessionId: string;
  hasAsked: boolean;
  isRunning: boolean;
  onCreateNewChat: () => void;
  onRestoreSession: (item: ChatHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export default function HistoryPanel({
  historyList,
  activeSessionId,
  onCreateNewChat,
  onRestoreSession,
  onDeleteItem,
  onClearAll,
  onClose,
}: HistoryPanelProps) {
  return (
    <div className="absolute left-4 right-4 top-[calc(100%+8px)] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 space-y-1">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <div className="text-[12px] font-semibold text-slate-700">历史对话</div>
        <div className="flex items-center gap-2">
          {historyList.length > 0 && (
            <button
              type="button"
              className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
              onClick={onClearAll}
            >
              清除全部
            </button>
          )}
          <button
            type="button"
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>

      {historyList.length === 0 ? (
        <div className="px-3 py-6 text-center text-[12px] text-slate-400">暂无历史对话</div>
      ) : (
        historyList.map((item) => (
          <div
            key={item.id}
            className={`group relative rounded-xl border transition-colors ${
              item.id === activeSessionId
                ? 'border-indigo-200 bg-indigo-50/80'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 pr-8"
              onClick={() => onRestoreSession(item)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-slate-700 truncate">
                    {item.type === 'single'
                      ? `[${item.providerName}] ${item.turns[0]?.question || '新对话'}`
                      : item.question}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {formatHistoryTime(item.type === 'single' ? item.updatedAt : item.createdAt)}
                    {item.type === 'single' ? ` · ${item.turns.length} 轮` : ''}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap">
                  {item.type === 'single' ? '单通道' : `${getHistoryEnabledCount(item)} 通道`}
                </div>
              </div>
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(item.id);
              }}
              aria-label="删除此记录"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
