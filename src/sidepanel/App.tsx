import {
  BulbOutlined,
  CarOutlined,
  CommentOutlined,
  GlobalOutlined,
  HeartOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  SettingOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { BubbleListProps, PromptsProps } from '@ant-design/x';
import {
  Bubble,
  Prompts,
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
import { useStore, buffers } from './store';
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

import '@ant-design/x-markdown/themes/light.css';

const useStyles = createStyles(({ token, css }) => ({
  copilotChat: css`
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: ${token.colorBgContainer};
    color: ${token.colorText};

    .x-markdown,
    .x-markdown-light {
      ul,
      ol,
      p,
      li {
        margin: 0;
      }

      hr {
        margin: 16px 0;
      }

      h1, h2, h3, h4, h5, h6 {
        margin-top: 16px;
    }
  `,
  promptTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
    padding: 16px;
    opacity: 0.75;
  `,
  promptRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    margin-inline: ${token.margin}px;
    transition: background 0.2s;
    &:not(:last-child) {
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }
    &:hover {
      background: ${token.colorBgTextHover};
    }
    cursor: pointer;
  `,
  promptIcon: css`
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  promptDesc: css`
    flex: 1;
    font-size: 13px;
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

    .full-text {
      display: inline;
    }
    .short-text {
      display: none;
    }

    // 宽度小于 500px 时自动切换为简写
    @media (max-width: 500px) {
      .full-text {
        display: none;
      }
      .short-text {
        display: inline;
      }
    }
  `,
  providerHeader: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    margin: -8px -12px 8px -12px;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: background 0.15s ease;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      background: ${token.colorBgTextHover};
    }

    .provider-header-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }

    .provider-header-content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .provider-header-name {
      white-space: nowrap;
    }

    .provider-header-status {
      font-size: 11px;
      color: ${token.colorTextTertiary};
      white-space: nowrap;
    }

    // 宽度小于 500px 时隐藏通道名称，只显示 icon
    @media (max-width: 500px) {
      .provider-header-name {
        display: none;
      }
    }
  `,
  bubbleContentHidden: css`
    > .ant-bubble-body {
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
    .ant-bubble-content {
      display: none !important;
    }
  `,
  providerContent: css`
    padding-top: 4px;
  `,
}));

// ════════════════════════════════════════════════════════════════════
// Shared sub-components
// ════════════════════════════════════════════════════════════════════

function renderMarkdown(content: string) {
  return <XMarkdown className="x-markdown-light" content={content} />;
}

function renderThinkAndMarkdown(thinkContent: string, content: string, isStreaming: boolean, expanded: boolean, onToggle?: (expanded: boolean) => void) {
  const thinkDone = !isStreaming || !!content;
  return (
    <>
      <Think
        title={thinkDone ? '深度思考完成' : '深度思考中...'}
        loading={!thinkDone}
        expanded={expanded}
        onExpand={onToggle}
      >
        <XMarkdown className="x-markdown-light" content={thinkContent} />
      </Think>
      {content && <XMarkdown className="x-markdown-light" content={content} />}
    </>
  );
}

function makeContentRender(thinkContent: string, isStreaming: boolean, expanded: boolean, onToggle?: (expanded: boolean) => void) {
  return (content: string) => renderThinkAndMarkdown(thinkContent, content, isStreaming, expanded, onToggle);
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

function ProviderHeader({ providerId, label, stats, status, stage, opStatus, isCollapsed, onClick, styles }: {
  providerId?: string;
  label: string;
  stats?: import('./types').ProviderStats | null;
  status?: string;
  stage?: string;
  opStatus?: string;
  isCollapsed: boolean;
  onClick: () => void;
  styles: ReturnType<typeof useStyles>['styles'];
}) {
  const Icon = providerId ? getProviderIcon(providerId as ProviderId) : null;
  const stageLabel = stage === 'thinking' ? '思考中...'
    : stage === 'connecting' ? '连接中...'
      : stage === 'sending' ? '发送中...'
        : '输出中...';
  return (
    <div className={styles.providerHeader} onClick={onClick}>
      <span className="provider-header-icon" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s ease' }}>
        <RightOutlined size={12} style={{ opacity: 0.6 }} />
      </span>
      <div className="provider-header-content">
        {Icon && <Icon size={14} />}
        <span className="provider-header-name" style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{label}</span>
        {opStatus && (
          <span className="provider-header-status" style={{ animation: 'pulse 1s infinite' }}>{opStatus}</span>
        )}
        {!opStatus && status === 'running' && (
          <span className="provider-header-status" style={{ animation: 'pulse 1s infinite' }}>{stageLabel}</span>
        )}
        {!opStatus && status === 'completed' && stats && (
          <span className="provider-header-status">{formatStats(stats)}</span>
        )}
      </div>
    </div>
  );
}

// ─── ThoughtChain helpers ───

const STAGE_ORDER: StageType[] = ['waiting', 'opening', 'loading', 'connecting', 'sending', 'thinking', 'responding'];
const STAGE_LABELS: Record<string, string> = {
  waiting: '等待启动',
  opening: '启动浏览器',
  loading: '加载页面',
  connecting: '连接通道',
  sending: '发送消息',
  thinking: '深度思考',
  responding: '生成回答',
};

function buildThoughtChainItems(stage: StageType, opStatus?: string, visitedStages?: Set<string>) {
  const visited = new Set(visitedStages);
  visited.add(stage);

  return STAGE_ORDER
    .filter(s => visited.has(s))
    .map((s) => {
      const isCurrent = s === stage;
      return {
        key: s,
        title: STAGE_LABELS[s],
        status: (isCurrent ? 'loading' : 'success') as 'loading' | 'success',
        description: isCurrent && opStatus ? opStatus : undefined,
      };
    });
}

function StageThoughtChain({ stage, opStatus, providerId }: { stage: StageType; opStatus?: string; providerId?: string }) {
  const visited = providerId ? buffers.visitedStages[providerId as ProviderId] : undefined;
  const Icon = providerId ? getProviderIcon(providerId as ProviderId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Icon && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={16} />
          <span className="provider-header-name" style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>
            {PROVIDER_NAME_MAP[providerId as ProviderId] || providerId}
          </span>
        </div>
      )}
      <ThoughtChain
        items={buildThoughtChainItems(stage, opStatus, visited)}
        style={{ padding: '4px 0' }}
      />
    </div>
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

  // 预设提示词
  const presetPrompts: PromptsProps['items'] = useMemo(() => [
    {
      key: 'world-cup',
      icon: <TrophyOutlined style={{ color: '#FAAD14' }} />,
      description: '2026 美加墨世界杯从热度和实力两个角度盘点，TOP 10 是哪些？',
      disabled: false,
    },
    {
      key: 'car-wash',
      icon: <CarOutlined style={{ color: '#1890FF' }} />,
      description: '我想去洗车，汽车店距离我家 50 米，你说我应该开车去还是走过去？',
      disabled: false,
    },
    {
      key: 'baby-name',
      icon: <HeartOutlined style={{ color: '#FF4D4F' }} />,
      description: '我姓王，我老婆姓牛，给我儿子起个名字，最好是两个字的。',
      disabled: false,
    },
  ], []);

  // ==================== Store ====================
  const hasAsked = useStore(s => s.hasAsked);
  const isCurrentSessionFromHistory = useStore(s => s.isCurrentSessionFromHistory);
  const currentQuestion = useStore(s => s.currentQuestion);
  const conversationTurns = useStore(s => s.conversationTurns);
  const statusMap = useStore(s => s.statusMap);
  const responses = useStore(s => s.responses);
  const thinkResponses = useStore(s => s.thinkResponses);
  const enabledMap = useStore(s => s.enabledMap);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isWebSearchEnabled = useStore(s => s.isWebSearchEnabled);
  const summaryStatus = useStore(s => s.summaryStatus);
  const summaryResponse = useStore(s => s.summaryResponse);
  const summaryThinkResponse = useStore(s => s.summaryThinkResponse);
  const statsMap = useStore(s => s.statsMap);
  const summaryStats = useStore(s => s.summaryStats);
  const operationStatus = useStore(s => s.operationStatus);
  const summaryOperationStatus = useStore(s => s.summaryOperationStatus);
  const stageMap = useStore(s => s.stageMap);
  const collapseMap = useStore(s => s.collapseMap);
  const thinkExpandedMap = useStore(s => s.thinkExpandedMap);
  const { toggleCollapse, setThinkExpanded } = useStore();

  const {
    setInputStr, submit, createNewChat,
    toggleDeepThinking, toggleWebSearch, toggleSummary,
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
      const isCollapsed = collapseMap[turn.providerId];
      const thinkExpanded = thinkExpandedMap[turn.providerId];
      items.push({
        key: `ai-${turn.providerId}-${idx}`,
        role: 'assistant',
        content: turn.response || '等待中...',
        ...(isCollapsed ? {
          className: styles.bubbleContentHidden,
          contentRender: () => null,
          style: { paddingTop: 0, paddingBottom: 0 },
        } : (turn.thinkResponse ? {
          contentRender: makeContentRender(turn.thinkResponse, false, thinkExpanded, (expanded) => {
            setThinkExpanded(turn.providerId, expanded);
          }),
        } : {})),
        header: (
          <ProviderHeader
            providerId={turn.providerId}
            label={PROVIDER_NAME_MAP[turn.providerId] || turn.providerId}
            stats={turn.stats}
            status="completed"
            isCollapsed={isCollapsed}
            onClick={() => toggleCollapse(turn.providerId)}
            styles={styles}
          />
        ),
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
        const isCollapsed = collapseMap[id];
        const thinkExpanded = thinkExpandedMap[id];

        // 构建 contentRender：折叠时返回 null，否则根据是否有 think 来决定渲染方式
        let contentRenderFn = undefined;
        if (isCollapsed) {
          contentRenderFn = () => null;
        } else if (think) {
          contentRenderFn = makeContentRender(think, isRunning, thinkExpanded, (expanded) => {
            setThinkExpanded(id, expanded);
          });
        }

        items.push({
          key: `ai-current-${id}`,
          role: 'assistant',
          content: resp || '',
          ...(contentRenderFn ? { contentRender: contentRenderFn } : {}),
          ...(isCollapsed ? {
            className: styles.bubbleContentHidden,
            style: { paddingTop: 0, paddingBottom: 0 },
          } : {}),
          loading: isRunning && !hasContent,
          streaming: isRunning && hasContent,
          status: statusMap[id] === 'error' ? 'error' : undefined,
          header: (
            <ProviderHeader
              providerId={id}
              label={PROVIDER_NAME_MAP[id]}
              stats={statsMap[id]}
              status={statusMap[id]}
              stage={stageMap[id]}
              opStatus={operationStatus[id]}
              isCollapsed={isCollapsed}
              onClick={() => toggleCollapse(id)}
              styles={styles}
            />
          ),
          ...(isRunning && !hasContent && !isCollapsed ? {
            loadingRender: () => (
              <StageThoughtChain stage={stageMap[id]} opStatus={operationStatus[id]} providerId={id} />
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
            contentRender: makeContentRender(summaryThinkResponse, summaryStatus === 'running', true),
          } : {}),
          status: summaryStatus === 'error' ? 'error' : undefined,
          header: (
            <ProviderHeader
              label="归纳总结"
              stats={summaryStats}
              status={summaryStatus}
              opStatus={summaryOperationStatus}
              isCollapsed={false}
              onClick={() => {}}
              styles={styles}
            />
          ),
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
    conversationTurns, currentQuestion, enabledMap, statusMap, stageMap, collapseMap, thinkExpandedMap,
    responses, thinkResponses, isSummaryEnabled, summaryStatus,
    summaryResponse, summaryThinkResponse, statsMap, summaryStats,
    operationStatus, summaryOperationStatus,
  ]);

  const isAnyRunning = PROVIDER_IDS.some(id => statusMap[id] === 'running');

  // ==================== Event ====================
  const handleUserSubmit = async (val: string) => {
    if (!val.trim()) return;
    setInputStr(val);
    setInputValue(''); // 立即清空输入框，提升用户体验
    await submit();
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
            {inputValue.trim() ? null : (
              <>
                <div className={styles.promptTitle}>💡 你可以问我：</div>
                {presetPrompts.map((prompt, index, arr) => (
                  <div
                    key={prompt.key}
                    className={styles.promptRow}
                    style={{ borderBottom: index !== arr.length - 1 ? undefined : 'none' }}
                    onClick={() => {
                      setInputValue(prompt.description as string);
                    }}
                  >
                    <div className={styles.promptIcon}>
                      {prompt.icon}
                    </div>
                    <div className={styles.promptDesc}>
                      {prompt.description}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Sender ─── */}
      {!isCurrentSessionFromHistory && (
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
                    <Tooltip title="深度思考">
                      <Sender.Switch
                        icon={<BulbOutlined />}
                        value={isDeepThinkingEnabled}
                        onChange={toggleDeepThinking}
                        style={{ fontSize: '13px' }}
                      >
                        <span className="full-text">深度思考</span>
                        <span className="short-text">思考</span>
                      </Sender.Switch>
                    </Tooltip>
                    <Tooltip title="联网搜索">
                      <Sender.Switch
                        icon={<GlobalOutlined />}
                        value={isWebSearchEnabled}
                        onChange={toggleWebSearch}
                        style={{ fontSize: '13px' }}
                      >
                        <span className="full-text">联网搜索</span>
                        <span className="short-text">联网</span>
                      </Sender.Switch>
                    </Tooltip>
                    <Tooltip title={summaryBlockReason || '归纳总结'}>
                      <span>
                        <Sender.Switch
                          icon={<MergeCellsOutlined />}
                          value={enabledCount >= 2 && isSummaryEnabled}
                          disabled={enabledCount < 2}
                          onChange={toggleSummary}
                          style={{ fontSize: '13px' }}
                        >
                          <span className="full-text">归纳总结</span>
                          <span className="short-text">总结</span>
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
      )}

      {/* ─── Modals & Drawers ─── */}
      <ChannelSettingsDrawer />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <GlobalSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default App;
