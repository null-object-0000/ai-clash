import {
  BulbOutlined,
  CommentOutlined,
  DeleteOutlined,
  EditOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BubbleListProps, ConversationsProps } from '@ant-design/x';
import {
  Bubble,
  Conversations,
  Sender,
  Think,
  ThoughtChain,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import { Button, Drawer, Flex, Input, message, Modal, Select, Switch, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, buffers } from './store';
import {
  PROVIDER_IDS, PROVIDER_NAME_MAP, PROVIDER_THEME_MAP,
  type ProviderId, type StageType,
} from './types';
import ChannelList from './components/ChannelList';
import ChannelSettingsDrawer from './components/ChannelSettingsDrawer';
import { getProviderIcon } from './utils/providerIcons';

const useStyles = createStyles(({ token, css }) => {
  return {
    copilotChat: css`
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: ${token.colorBgContainer};
      color: ${token.colorText};
    `,
    floatingToolbar: css`
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 6px;
    `,
    floatingBtn: css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${token.colorTextSecondary};
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      font-size: 15px;

      &:hover {
        color: ${token.colorPrimary};
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }
    `,
    floatingBtnWithText: css`
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 12px;
      height: 32px;
      width: auto;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${token.colorTextSecondary};
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;

      &:hover {
        color: ${token.colorPrimary};
        background: rgba(255, 255, 255, 0.95);
        border-color: ${token.colorPrimaryBorder};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      .anticon {
        font-size: 14px;
      }
    `,
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
    chatList: css`
      padding-block-start: 48px;
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      flex-direction: column;
    `,
    chatWelcome: css`
      margin-inline: ${token.margin}px;
      padding: 12px 16px;
      border-radius: 2px 12px 12px 12px;
      background: ${token.colorBgTextHover};
      margin-bottom: ${token.margin}px;
    `,
    chatSend: css`
      flex-shrink: 0;
      padding: ${token.padding}px;
    `,
  };
});

const ThinkComponent = React.memo((props: ComponentProps) => {
  const [title, setTitle] = React.useState('深度思考中...');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (props.streamStatus === 'done') {
      setTitle('深度思考完成');
      setLoading(false);
    }
  }, [props.streamStatus]);

  return (
    <Think title={title} loading={loading}>
      {props.children}
    </Think>
  );
});

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    contentRender(content: string) {
      return (
        <XMarkdown
          content={content}
          components={{
            think: ThinkComponent,
          }}
        />
      );
    },
  },
  user: { placement: 'end' },
};

function formatStats(stats: import('./types').ProviderStats) {
  return `首字 ${(stats.ttff / 1000).toFixed(1)}s · 总耗时 ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('zh-CN')}字 · ${stats.charsPerSec}字/s`;
}

function ProviderHeader({ providerId, label, stats, status, stage, opStatus }: {
  providerId?: string;
  label: string;
  stats?: import('./types').ProviderStats | null;
  status?: string;
  stage?: string;
  opStatus?: string;
}) {
  const Icon = providerId ? getProviderIcon(providerId as ProviderId) : null;
  const stageLabel = stage === 'thinking' ? '思考中...' : stage === 'connecting' ? '连接中...' : '输出中...';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {Icon && <Icon size={16} />}
      <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>{label}</span>
      {opStatus && (
        <span style={{ fontSize: 11, color: '#9ca3af', animation: 'pulse 1s infinite' }}>{opStatus}</span>
      )}
      {!opStatus && status === 'running' && (
        <span style={{ fontSize: 11, color: '#9ca3af', animation: 'pulse 1s infinite' }}>{stageLabel}</span>
      )}
      {!opStatus && status === 'completed' && stats && (
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatStats(stats)}</span>
      )}
    </div>
  );
}

const STAGE_ORDER: StageType[] = ['connecting', 'thinking', 'responding'];
const STAGE_LABELS: Record<string, string> = {
  connecting: '连接通道',
  thinking: '深度思考',
  responding: '生成回答',
};

function buildThoughtChainItems(stage: StageType, opStatus?: string) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER
    .filter((_, i) => i <= Math.max(currentIdx, 0))
    .map((s, i) => {
      const isCurrent = s === stage;
      let status: 'success' | 'loading' = isCurrent ? 'loading' : 'success';
      return {
        key: s,
        title: STAGE_LABELS[s],
        status,
        description: isCurrent && opStatus ? opStatus : undefined,
      };
    });
}

function StageThoughtChain({ stage, opStatus }: { stage: StageType; opStatus?: string }) {
  return (
    <ThoughtChain
      items={buildThoughtChainItems(stage, opStatus)}
      style={{ padding: '4px 0' }}
    />
  );
}

const App = () => {
  const { styles } = useStyles();
  const listRef = useRef<BubbleListRef>(null);
  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);

  // ==================== Store ====================
  const hasAsked = useStore(s => s.hasAsked);
  const currentQuestion = useStore(s => s.currentQuestion);
  const conversationTurns = useStore(s => s.conversationTurns);
  const statusMap = useStore(s => s.statusMap);
  const responses = useStore(s => s.responses);
  const thinkResponses = useStore(s => s.thinkResponses);
  const enabledMap = useStore(s => s.enabledMap);
  const historyList = useStore(s => s.historyList);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);
  const summaryStatus = useStore(s => s.summaryStatus);
  const summaryResponse = useStore(s => s.summaryResponse);
  const summaryThinkResponse = useStore(s => s.summaryThinkResponse);
  const statsMap = useStore(s => s.statsMap);
  const summaryStats = useStore(s => s.summaryStats);
  const operationStatus = useStore(s => s.operationStatus);
  const summaryOperationStatus = useStore(s => s.summaryOperationStatus);
  const stageMap = useStore(s => s.stageMap);

  const {
    setInputStr, submit, createNewChat,
    restoreHistorySession, toggleDeepThinking, toggleSummary,
    toggleDebug, setSummaryProviderId, setSummaryModel,
    deleteHistoryItem, renameHistoryItem,
  } = useStore.getState();

  // ==================== Init ====================
  useEffect(() => {
    const cleanup = useStore.getState().init();
    return cleanup;
  }, []);

  // ==================== Messages ====================
  const messages = useMemo(() => {
    const items: any[] = [];

    conversationTurns.forEach((turn, idx) => {
      items.push({
        key: `user-${idx}`,
        role: 'user',
        content: turn.question,
      });
      const turnContent = (turn.thinkResponse ? `<think>\n${turn.thinkResponse}\n</think>\n\n` : '') + (turn.response || '等待中...');
      items.push({
        key: `ai-${turn.providerId}-${idx}`,
        role: 'assistant',
        content: turnContent,
        header: <ProviderHeader
          providerId={turn.providerId}
          label={PROVIDER_NAME_MAP[turn.providerId] || turn.providerId}
          stats={turn.stats}
          status="completed"
        />,
      });
    });

    if (currentQuestion) {
      items.push({
        key: 'user-current',
        role: 'user',
        content: currentQuestion,
      });

      const enabledProviderIds = PROVIDER_IDS.filter(id => enabledMap[id]);
      enabledProviderIds.forEach(id => {
        const isRunning = statusMap[id] === 'running';
        const think = thinkResponses[id];
        const resp = responses[id];
        const hasContent = !!(think || resp);
        const content = (think ? `<think>\n${think}\n</think>\n\n` : '') + (resp || '');
        items.push({
          key: `ai-current-${id}`,
          role: 'assistant',
          content,
          loading: isRunning && !hasContent,
          streaming: isRunning && hasContent,
          status: statusMap[id] === 'error' ? 'error' : undefined,
          header: <ProviderHeader
            providerId={id}
            label={PROVIDER_NAME_MAP[id]}
            stats={statsMap[id]}
            status={statusMap[id]}
            stage={stageMap[id]}
            opStatus={operationStatus[id]}
          />,
          ...(isRunning && !hasContent ? {
            loadingRender: () => (
              <StageThoughtChain stage={stageMap[id]} opStatus={operationStatus[id]} />
            ),
          } : {}),
        });
      });

      if (isSummaryEnabled && (summaryStatus === 'running' || summaryResponse || summaryThinkResponse)) {
        const hasSummaryContent = !!(summaryThinkResponse || summaryResponse);
        const summaryContent = (summaryThinkResponse ? `<think>\n${summaryThinkResponse}\n</think>\n\n` : '') + (summaryResponse || '');
        const summaryStage = useStore.getState().summaryStage;
        items.push({
          key: 'summary',
          role: 'assistant',
          content: summaryContent,
          loading: summaryStatus === 'running' && !hasSummaryContent,
          streaming: summaryStatus === 'running' && hasSummaryContent,
          status: summaryStatus === 'error' ? 'error' : undefined,
          header: <ProviderHeader
            label="归纳总结"
            stats={summaryStats}
            status={summaryStatus}
            opStatus={summaryOperationStatus}
          />,
          ...(summaryStatus === 'running' && !hasSummaryContent ? {
            loadingRender: () => (
              <StageThoughtChain stage={summaryStage as StageType} opStatus={summaryOperationStatus} />
            ),
          } : {}),
        });
      }
    }

    return items;
  }, [
    conversationTurns, currentQuestion, enabledMap, statusMap, stageMap,
    responses, thinkResponses, isSummaryEnabled, summaryStatus,
    summaryResponse, summaryThinkResponse, statsMap, summaryStats,
    operationStatus, summaryOperationStatus,
  ]);

  const isAnyRunning = PROVIDER_IDS.some(id => statusMap[id] === 'running');

  // ==================== Event ====================
  const handleUserSubmit = (val: string) => {
    if (!val.trim()) return;
    setInputStr(val);
    submit();
    setInputValue('');
    listRef.current?.scrollTo({ top: 'bottom' });
  };

  // ==================== Conversation Items ====================
  const getDefaultLabel = (item: import('./types').ChatHistoryItem) =>
    item.type === 'single'
      ? `${PROVIDER_NAME_MAP[item.providerId as ProviderId] || '对话'} · ${item.turns?.[0]?.question?.slice(0, 15) || '...'}`
      : `多通道 · ${item.question?.slice(0, 15) || '...'}`;

  const conversationItems = useMemo(() => {
    return historyList.slice(0, 20).map(item => ({
      key: item.id,
      label: item.customLabel || getDefaultLabel(item),
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

  // ==================== Nodes ====================
  const chatHeader = (
    <>
      <div className={styles.floatingToolbar}>
        <button
          className={styles.floatingBtnWithText}
          title="新对话"
          onClick={() => {
            if (hasAsked) {
              createNewChat();
            } else {
              message.info('当前已经是新会话');
            }
          }}
        >
          <PlusOutlined />
        </button>
        <button
          className={styles.floatingBtn}
          title="历史记录"
          onClick={() => setHistoryOpen(true)}
        >
          <CommentOutlined />
        </button>
        <button
          className={styles.floatingBtn}
          title="全局设置"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingOutlined />
        </button>
      </div>
      <Drawer
        placement="right"
        width="clamp(200px, 75%, 320px)"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
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
            setHistoryOpen(false);
          }}
          styles={{ item: { padding: '0 8px' } }}
          className={styles.conversations}
        />
      </Drawer>
    </>
  );

  const chatList = (
    <div className={styles.chatList}>
      {messages.length > 0 ? (
        <Bubble.List
          ref={listRef}
          style={{ paddingInline: 16 }}
          items={messages}
          role={role}
        />
      ) : (
        <div style={{ overflow: 'auto', flex: 1 }}>
          <Welcome
            variant="borderless"
            title="👋 你好，我是 AI 对撞机"
            description="一个问题问多个 AI，获取最全面的答案"
            className={styles.chatWelcome}
          />
          <ChannelList />
        </div>
      )}
    </div>
  );

  const summaryBlockReason = useStore.getState().summaryBlockReason();
  const enabledCount = PROVIDER_IDS.filter(id => enabledMap[id]).length;

  const chatSender = (
    <Flex vertical className={styles.chatSend}>
      <Sender
        loading={isAnyRunning}
        value={inputValue}
        onChange={setInputValue}
        autoSize
        placeholder="输入你的问题，按 Enter 发送"
        onSubmit={() => {
          handleUserSubmit(inputValue);
        }}
        onCancel={() => {
          message.info('取消功能待实现');
        }}
        suffix={false}
        footer={(_, { components }) => {
          const { SendButton, LoadingButton } = components;
          return (
            <Flex justify="space-between" align="center">
              <Flex gap="small" align="center">
                <Sender.Switch
                  icon={<BulbOutlined />}
                  value={isDeepThinkingEnabled}
                  onChange={toggleDeepThinking}
                >
                  深度思考
                </Sender.Switch>
                <Tooltip title={summaryBlockReason || undefined}>
                  <span>
                    <Sender.Switch
                      icon={<MergeCellsOutlined />}
                      value={enabledCount >= 2 && isSummaryEnabled}
                      disabled={enabledCount < 2}
                      onChange={toggleSummary}
                    >
                      归纳总结
                    </Sender.Switch>
                  </span>
                </Tooltip>
              </Flex>
              <Flex align="center">
                {isAnyRunning ? (
                  <LoadingButton type="default" />
                ) : (
                  <SendButton type="primary" disabled={false} />
                )}
              </Flex>
            </Flex>
          );
        }}
      />
    </Flex>
  );

  const summaryProviderOptions = useStore.getState().getSummaryProviderOptions();
  const summaryModelOptions = useStore.getState().getSummaryModelOptions();

  return (
    <div className={styles.copilotChat}>
      {chatHeader}
      {chatList}
      {chatSender}
      <ChannelSettingsDrawer />
      <Modal
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        title="全局设置"
        footer={null}
        width={400}
        centered
      >
        <Flex vertical gap={20} style={{ paddingTop: 8 }}>
          <Flex vertical gap={10}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>归纳总结配置</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              选择用于归纳总结的 AI 通道和模型，需先在对应通道中配置 API Key。
            </div>
            <Flex vertical gap={8}>
              <Select
                value={summaryProviderId || undefined}
                options={summaryProviderOptions}
                onChange={setSummaryProviderId}
                placeholder="选择总结通道"
                style={{ width: '100%' }}
                notFoundContent="请先在通道设置中配置 API Key"
              />
              <Select
                value={summaryModel || undefined}
                options={summaryModelOptions}
                onChange={setSummaryModel}
                placeholder="选择模型"
                style={{ width: '100%' }}
                disabled={!summaryProviderId}
              />
            </Flex>
          </Flex>
          <Flex justify="space-between" align="center">
            <Flex vertical gap={2}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>调试模式</span>
              <span style={{ fontSize: 12, color: '#999' }}>开启后在控制台输出详细日志</span>
            </Flex>
            <Switch checked={isDebugEnabled} onChange={toggleDebug} size="small" />
          </Flex>
        </Flex>
      </Modal>
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
        destroyOnClose
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
    </div>
  );
};

export default App;
