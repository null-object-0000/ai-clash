import { X, Trash2 } from 'lucide-react';
import { ActionIcon, Button, Empty, Tag } from '@lobehub/ui';
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
    <div className="absolute left-4 right-4 top-[calc(100%+8px)] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 space-y-1 z-50">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <div className="text-[12px] font-semibold text-slate-700">历史对话</div>
        <div className="flex items-center gap-2">
          {historyList.length > 0 && (
            <Button type="text" size="small" danger onClick={onClearAll} style={{ fontSize: 11, padding: '0 4px' }}>
              清除全部
            </Button>
          )}
          <ActionIcon icon={X} size="small" onClick={onClose} title="关闭" />
        </div>
      </div>

      {historyList.length === 0 ? (
        <Empty description="暂无历史对话" style={{ padding: '24px 0' }} />
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
                <Tag size="small">
                  {item.type === 'single' ? '单通道' : `${getHistoryEnabledCount(item)} 通道`}
                </Tag>
              </div>
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionIcon
                icon={X}
                size={{ blockSize: 20 }}
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item.id);
                }}
                title="删除此记录"
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
