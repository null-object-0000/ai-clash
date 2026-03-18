import {
  BulbOutlined,
  CommentOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BubbleListProps } from '@ant-design/x';
import {
  Bubble,
  Sender,
  Think,
  ThoughtChain,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown from '@ant-design/x-markdown';
import { Flex, message, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import {
  PROVIDER_IDS, PROVIDER_NAME_MAP,
  type ProviderId, type StageType,
} from './types';
import ChannelList from './components/ChannelList';
import ChannelSettingsDrawer from './components/ChannelSettingsDrawer';
import GlobalSettingsModal from './components/GlobalSettingsModal';
import HistoryDrawer from './components/HistoryDrawer';
import { getProviderIcon } from './utils/providerIcons';

// ════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════

const useStyles = createStyles(({ token, css }) => ({
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
}));

// ════════════════════════════════════════════════════════════════════
// Shared sub-components
// ════════════════════════════════════════════════════════════════════

function renderMarkdown(content: string) {
  return <XMarkdown content={content} />;
}

function renderThinkAndMarkdown(thinkContent: string, content: string, isStreaming: boolean) {
  const thinkDone = !isStreaming || !!content;
  return (
    <>
      <Think title={thinkDone ? '深度思考完成' : '深度思考中...'} loading={!thinkDone}>
        {thinkContent}
      </Think>
      {content && <XMarkdown content={content} />}
    </>
  );
}

function makeContentRender(thinkContent: string, isStreaming: boolean) {
  return (content: string) => renderThinkAndMarkdown(thinkContent, content, isStreaming);
}

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    contentRender: renderMarkdown,
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

// ─── ThoughtChain helpers ───

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
    .map((s) => {
      const isCurrent = s === stage;
      const status: 'success' | 'loading' = isCurrent ? 'loading' : 'success';
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

// ════════════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════════════

const App = () => {
  const { styles } = useStyles();
  const listRef = useRef<BubbleListRef>(null);
  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ==================== Store ====================
  const hasAsked = useStore(s => s.hasAsked);
  const currentQuestion = useStore(s => s.currentQuestion);
  const conversationTurns = useStore(s => s.conversationTurns);
  const statusMap = useStore(s => s.statusMap);
  const responses = useStore(s => s.responses);
  const thinkResponses = useStore(s => s.thinkResponses);
  const enabledMap = useStore(s => s.enabledMap);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
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
    toggleDeepThinking, toggleSummary,
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
      items.push({
        key: `ai-${turn.providerId}-${idx}`,
        role: 'assistant',
        content: turn.response || '等待中...',
        ...(turn.thinkResponse ? {
          contentRender: makeContentRender(turn.thinkResponse, false),
        } : {}),
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
        items.push({
          key: `ai-current-${id}`,
          role: 'assistant',
          content: resp || '',
          loading: isRunning && !hasContent,
          streaming: isRunning && hasContent,
          ...(think ? {
            contentRender: makeContentRender(think, isRunning),
          } : {}),
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
        const summaryStage = useStore.getState().summaryStage;
        items.push({
          key: 'summary',
          role: 'assistant',
          content: summaryResponse || '',
          loading: summaryStatus === 'running' && !hasSummaryContent,
          streaming: summaryStatus === 'running' && hasSummaryContent,
          ...(summaryThinkResponse ? {
            contentRender: makeContentRender(summaryThinkResponse, summaryStatus === 'running'),
          } : {}),
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

  // ==================== Render ====================
  const summaryBlockReason = useStore.getState().summaryBlockReason();
  const enabledCount = PROVIDER_IDS.filter(id => enabledMap[id]).length;

  return (
    <div className={styles.copilotChat}>
      {/* ─── Floating Toolbar ─── */}
      <div className={styles.floatingToolbar}>
        <button
          className={styles.floatingBtnWithText}
          title="新对话"
          onClick={() => {
            if (hasAsked) createNewChat();
            else message.info('当前已经是新会话');
          }}
        >
          <PlusOutlined />
        </button>
        <button className={styles.floatingBtn} title="历史记录" onClick={() => setHistoryOpen(true)}>
          <CommentOutlined />
        </button>
        <button className={styles.floatingBtn} title="全局设置" onClick={() => setSettingsOpen(true)}>
          <SettingOutlined />
        </button>
      </div>

      {/* ─── Chat List ─── */}
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

      {/* ─── Sender ─── */}
      <Flex vertical className={styles.chatSend}>
        <Sender
          loading={isAnyRunning}
          value={inputValue}
          onChange={setInputValue}
          autoSize
          placeholder="输入你的问题，按 Enter 发送"
          onSubmit={() => handleUserSubmit(inputValue)}
          onCancel={() => message.info('取消功能待实现')}
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

      {/* ─── Modals & Drawers ─── */}
      <ChannelSettingsDrawer />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <GlobalSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default App;
