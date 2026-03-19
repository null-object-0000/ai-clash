import React, { useMemo, useState } from 'react';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ConversationsProps } from '@ant-design/x';
import { Conversations } from '@ant-design/x';
import { Drawer, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { useStore } from '../store';
import {
  PROVIDER_NAME_MAP,
  type ProviderId, type ChatHistoryItem,
} from '../types';

const useStyles = createStyles(({ css }) => ({
  conversations: css`
    width: 100%;
    .ant-conversations-list {
      padding-inline-start: 0;
    }
    .ant-conversations-item {
      font-size: 12px;
      .ant-conversations-item-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `,
}));

// ─── Time grouping ───

function getTimeGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  if (timestamp >= todayStart) return '今天';
  if (timestamp >= yesterdayStart) return '昨天';
  if (timestamp >= weekStart) return '近 7 天';
  return '更早';
}

function getItemTimestamp(item: ChatHistoryItem): number {
  return item.type === 'single' ? item.updatedAt : item.createdAt;
}

function getDefaultLabel(item: ChatHistoryItem) {
  return item.type === 'single'
    ? `${PROVIDER_NAME_MAP[item.providerId as ProviderId] || '对话'} · ${item.turns?.[0]?.question?.slice(0, 15) || '...'}`
    : `多通道 · ${item.question?.slice(0, 15) || '...'}`;
}

// ─── Component ───

interface Props {
  open: boolean;
  onClose: () => void;
}

const HistoryDrawer: React.FC<Props> = ({ open, onClose }) => {
  const { styles } = useStyles();
  const historyList = useStore(s => s.historyList);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);

  const {
    restoreHistorySession, deleteHistoryItem, renameHistoryItem,
  } = useStore.getState();

  const conversationItems = useMemo(() => {
    return historyList.slice(0, 20).map(item => ({
      key: item.id,
      label: item.customLabel || getDefaultLabel(item),
      group: getTimeGroup(getItemTimestamp(item)),
    }));
  }, [historyList]);

  const conversationMenu: ConversationsProps['menu'] = (conversation) => ({
    items: [
      { label: '重命名', key: 'rename', icon: <EditOutlined /> },
      { type: 'divider' as const },
      { label: '删除', key: 'delete', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: (info) => {
      info.domEvent.stopPropagation();
      if (info.key === 'rename') {
        setRenameTarget({
          id: conversation.key as string,
          label: (conversation.label as string) || '',
        });
      } else if (info.key === 'delete') {
        Modal.confirm({
          title: '删除对话',
          content: '确定要删除这条对话记录吗？删除后无法恢复。',
          okText: '删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          centered: true,
          onOk: () => deleteHistoryItem(conversation.key as string),
        });
      }
    },
  });

  return (
    <>
      <Drawer
        placement="right"
        width="clamp(200px, 75%, 320px)"
        open={open}
        onClose={onClose}
        closable={false}
        styles={{ body: { padding: '0 8px 0 0', overflow: 'hidden auto' } }}
      >
        <Conversations
          items={conversationItems}
          menu={conversationMenu}
          groupable
          onActiveChange={(key) => {
            const item = historyList.find(h => h.id === key);
            if (item) {
              restoreHistorySession(item);
            }
            onClose();
          }}
          styles={{ item: { padding: '0 8px' } }}
          className={styles.conversations}
        />
      </Drawer>
      <Modal
        open={!!renameTarget}
        title="重命名对话"
        okText="保存"
        cancelText="取消"
        centered
        width={360}
        onOk={() => {
          if (renameTarget && renameTarget.label.trim()) {
            renameHistoryItem(renameTarget.id, renameTarget.label.trim());
          }
          setRenameTarget(null);
        }}
        onCancel={() => setRenameTarget(null)}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={renameTarget?.label ?? ''}
          onChange={e => setRenameTarget(prev => prev ? { ...prev, label: e.target.value } : prev)}
          onPressEnter={() => {
            if (renameTarget && renameTarget.label.trim()) {
              renameHistoryItem(renameTarget.id, renameTarget.label.trim());
            }
            setRenameTarget(null);
          }}
          placeholder="输入新名称"
          maxLength={50}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
};

export default HistoryDrawer;
