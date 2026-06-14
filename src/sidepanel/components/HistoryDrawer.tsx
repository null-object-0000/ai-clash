import React, { useMemo, useState } from 'react';
import CommentOutlined from '@ant-design/icons/CommentOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import Conversations, { type ConversationsProps } from '@ant-design/x/es/conversations';
import { Drawer, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { useStore } from '../store';
import {
  getProviderDisplayName,
  type ProviderId, type ChatHistoryItem,
} from '../types';
import { getSidepanelText, type SidepanelText } from '../i18n';

const useStyles = createStyles(({ css, token }) => ({
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
  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: ${token.colorTextTertiary};
  `,
  emptyIcon: css`
    font-size: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  `,
  emptyText: css`
    font-size: 14px;
    color: ${token.colorTextSecondary};
  `,
  emptyDesc: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-top: 8px;
    opacity: 0.7;
  `,
}));

// ─── Time grouping ───

function getTimeGroup(timestamp: number, text: SidepanelText): string {
  const now = new Date();
  const date = new Date(timestamp);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  if (timestamp >= todayStart) return text.history.today;
  if (timestamp >= yesterdayStart) return text.history.yesterday;
  if (timestamp >= weekStart) return text.history.last7Days;
  return text.history.earlier;
}

function getItemTimestamp(item: ChatHistoryItem): number {
  return item.type === 'single' ? item.updatedAt : item.createdAt;
}

function getDefaultLabel(item: ChatHistoryItem, text: SidepanelText, locale: string) {
  return item.type === 'single'
    ? `${getProviderDisplayName(item.providerId as ProviderId, locale) || text.history.chat} · ${item.turns?.[0]?.question?.slice(0, 15) || '...'}`
    : `${text.history.multi} · ${item.question?.slice(0, 15) || '...'}`;
}

// ─── Component ───

interface Props {
  open: boolean;
  onClose: () => void;
}

const HistoryDrawer: React.FC<Props> = ({ open, onClose }) => {
  const { styles } = useStyles();
  const historyList = useStore(s => s.historyList);
  const locale = useStore(s => s.locale);
  const text = getSidepanelText(locale);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);

  const {
    restoreHistorySession, deleteHistoryItem, renameHistoryItem,
  } = useStore.getState();

  const conversationItems = useMemo(() => {
    return historyList.slice(0, 20).map(item => ({
      key: item.id,
      label: item.customLabel || getDefaultLabel(item, text, locale),
      group: getTimeGroup(getItemTimestamp(item), text),
    }));
  }, [historyList, text]);

  const conversationMenu: ConversationsProps['menu'] = (conversation) => ({
    items: [
      { label: text.history.rename, key: 'rename', icon: <EditOutlined /> },
      { type: 'divider' as const },
      { label: text.history.delete, key: 'delete', icon: <DeleteOutlined />, danger: true },
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
          title: text.history.deleteTitle,
          content: text.history.deleteContent,
          okText: text.history.delete,
          okButtonProps: { danger: true },
          cancelText: text.dialog.cancel,
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
        size="clamp(200px, 75%, 320px)"
        open={open}
        onClose={onClose}
        closable={false}
        styles={{ body: { padding: '0 8px 0 0', overflow: 'hidden auto' } }}
      >
        {historyList.length === 0 ? (
          <div className={styles.emptyState}>
            <CommentOutlined className={styles.emptyIcon} />
            <div className={styles.emptyText}>{text.history.empty}</div>
            <div className={styles.emptyDesc}>{text.history.emptyDesc}</div>
          </div>
        ) : (
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
        )}
      </Drawer>
      <Modal
        open={!!renameTarget}
        title={text.history.renameTitle}
        okText={text.history.save}
        cancelText={text.dialog.cancel}
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
          placeholder={text.history.renamePlaceholder}
          maxLength={50}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
};

export default HistoryDrawer;
