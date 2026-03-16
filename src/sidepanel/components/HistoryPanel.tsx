import { X } from 'lucide-react';
import { ActionIcon, Button, Drawer, Empty, List, Tag } from '@lobehub/ui';
import { useStore } from '../store';
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

function getHistoryTitle(item: ChatHistoryItem): string {
  if (item.type === 'single') {
    return `[${item.providerName}] ${item.turns[0]?.question || '新对话'}`;
  }
  return item.question;
}

function getHistoryDate(item: ChatHistoryItem): number {
  return item.type === 'single' ? item.updatedAt : item.createdAt;
}

export default function HistoryPanel() {
  const historyList = useStore(s => s.historyList);
  const activeSessionId = useStore(s => s.activeSessionId);
  const isHistoryPanelOpen = useStore(s => s.isHistoryPanelOpen);

  const {
    restoreHistorySession, deleteHistoryItem, clearHistory,
    setIsHistoryPanelOpen,
  } = useStore.getState();

  const listItems = historyList.map((item) => ({
    key: item.id,
    title: (
      <span style={{ fontSize: 12 }}>{getHistoryTitle(item)}</span>
    ),
    description: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <span>{formatHistoryTime(getHistoryDate(item))}</span>
        {item.type === 'single' && <span>· {item.turns.length} 轮</span>}
        <Tag size="small">
          {item.type === 'single' ? '单通道' : `${getHistoryEnabledCount(item)} 通道`}
        </Tag>
      </div>
    ),
    active: item.id === activeSessionId,
    actions: (
      <ActionIcon
        icon={X}
        size={{ blockSize: 20 }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          deleteHistoryItem(item.id);
        }}
        title="删除此记录"
      />
    ),
  }));

  return (
    <Drawer
      open={isHistoryPanelOpen}
      onClose={() => setIsHistoryPanelOpen(false)}
      title="历史对话"
      placement="right"
      width={340}
      extra={
        historyList.length > 0 ? (
          <Button type="text" size="small" danger onClick={clearHistory} style={{ fontSize: 11 }}>
            清除全部
          </Button>
        ) : null
      }
    >
      {historyList.length === 0 ? (
        <Empty description="暂无历史对话" style={{ padding: '48px 0' }} />
      ) : (
        <List
          activeKey={activeSessionId}
          items={listItems}
          onClick={({ key }: { key: string }) => {
            const item = historyList.find(h => h.id === key);
            if (item) restoreHistorySession(item);
          }}
        />
      )}
    </Drawer>
  );
}
