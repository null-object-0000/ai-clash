import { CloseOutlined } from '@ant-design/icons';
import { Drawer, Button, Empty, List, Tag, Avatar, Space } from 'antd';
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
    id: item.id,
    title: (
      <span style={{ fontSize: 13 }}>{getHistoryTitle(item)}</span>
    ),
    description: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatHistoryTime(getHistoryDate(item))}</span>
        {item.type === 'single' && <span style={{ fontSize: 12, color: '#9ca3af' }}>· {item.turns.length} 轮</span>}
        <Tag style={{ fontSize: 12 }}>
          {item.type === 'single' ? '单通道' : `${getHistoryEnabledCount(item)} 通道`}
        </Tag>
      </div>
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
          <Button
            type="text"
            size="small"
            danger
            onClick={clearHistory}
            style={{ fontSize: 12 }}
          >
            清除全部
          </Button>
        ) : null
      }
      styles={{
        body: { padding: 0 },
      }}
    >
      {historyList.length === 0 ? (
        <Empty description="暂无历史对话" style={{ padding: '48px 0' }} />
      ) : (
        <List
          dataSource={historyList}
          renderItem={(item) => (
            <List.Item
              onClick={() => restoreHistorySession(item)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: item.id === activeSessionId ? '#f5f5f5' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (item.id !== activeSessionId) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (item.id !== activeSessionId) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              actions={[
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHistoryItem(item.id);
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                title={listItems.find(i => i.id === item.id)?.title}
                description={listItems.find(i => i.id === item.id)?.description}
              />
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
