import {
  BulbOutlined,
  CarOutlined,
  CommentOutlined,
  CopyOutlined,
  GlobalOutlined,
  HeartOutlined,
  LeftOutlined,
  LoginOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  RedoOutlined,
  RightOutlined,
  SettingOutlined,
  TrophyOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { BubbleListProps, PromptsProps } from '@ant-design/x';
import {
  Bubble,
  Sender,
  Think,
  ThoughtChain,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown from '@ant-design/x-markdown';
import { Button, Dropdown, Flex, message, Modal, Popconfirm, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, buffers, PROVIDER_META } from './store';
import {
  PROVIDER_IDS, PROVIDER_NAME_MAP,
  type ProviderId, type StageType,
} from './types';
import { MSG_TYPES } from './store';
import ChannelList from './components/ChannelList';
import ChannelSettingsDrawer from './components/ChannelSettingsDrawer';
import GlobalSettingsModal from './components/GlobalSettingsModal';
import HistoryDrawer from './components/HistoryDrawer';
import { getProviderIcon } from './config/providerIcons';

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
  emptyStateContainer: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
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
  transparentBubble: css`
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    > .ant-bubble-body {
      padding: 0 !important;
      background: transparent !important;
    }
  `,
}));

// ════════════════════════════════════════════════════════════════════
// Shared sub-components
// ════════════════════════════════════════════════════════════════════

function renderMarkdown(content: any) {
  if (React.isValidElement(content)) {
    return content;
  }
  const contentStr = typeof content === 'string' ? content : '';
  return <XMarkdown className="x-markdown-light" content={contentStr} />;
}

type ThinkTitles = {
  loading: string;
  done: string;
};

const DEFAULT_THINK_TITLES: ThinkTitles = {
  loading: '深度思考中...',
  done: '深度思考完成',
};

type SummaryAnalysisSection = {
  key: string;
  title: string;
  content: string;
};

const SUMMARY_ANALYSIS_SECTION_TITLES = ['核心共识', '观点对撞', '裁判取舍'];
const SUMMARY_FINAL_TITLE_RE = /^\s{0,3}#{1,6}\s*(终极建议|最终建议|最终结论|建议)\s*\n+/;
const SUMMARY_ANALYSIS_TITLE_ALIASES: Record<string, string> = {
  综合解析: '裁判取舍',
  综合分析: '裁判取舍',
};

function splitSummaryAnalysisSections(markdown: string): SummaryAnalysisSection[] {
  const headingRe = /^#{1,6}\s*(核心共识|观点对撞|裁判取舍|综合解析|综合分析)\s*$/gm;
  const matches = Array.from(markdown.matchAll(headingRe));
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const title = SUMMARY_ANALYSIS_TITLE_ALIASES[match[1]] ?? match[1];
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? markdown.length;
      return {
        key: title,
        title,
        content: markdown.slice(start, end).trim(),
      };
    })
    .filter(section => SUMMARY_ANALYSIS_SECTION_TITLES.includes(section.title));
}

function stripSummaryFinalTitle(markdown: string) {
  return markdown.replace(SUMMARY_FINAL_TITLE_RE, '').trimStart();
}

function SummaryAnalysisThink({
  title,
  loading,
  content,
}: {
  title: string;
  loading: boolean;
  content: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Think
      title={title}
      loading={loading}
      expanded={expanded}
      onExpand={setExpanded}
    >
      <XMarkdown className="x-markdown-light" content={content} />
    </Think>
  );
}

function renderThinkAndMarkdown(
  thinkContent: any,
  content: any,
  isStreaming: boolean,
  expanded: boolean,
  onToggle?: (expanded: boolean) => void,
  titles: ThinkTitles = DEFAULT_THINK_TITLES,
) {
  const thinkStr = typeof thinkContent === 'string' ? thinkContent : '';
  const contentIsString = typeof content === 'string';
  const contentStr = contentIsString ? content : '';
  const thinkDone = !isStreaming || !!contentStr;
  return (
    <>
      <Think
        title={thinkDone ? titles.done : titles.loading}
        loading={!thinkDone}
        expanded={expanded}
        onExpand={onToggle}
      >
        <XMarkdown className="x-markdown-light" content={thinkStr} />
      </Think>
      {React.isValidElement(content) ? content : (contentStr ? <XMarkdown className="x-markdown-light" content={contentStr} /> : null)}
    </>
  );
}

function makeContentRender(
  thinkContent: any,
  isStreaming: boolean,
  expanded: boolean,
  onToggle?: (expanded: boolean) => void,
  titles?: ThinkTitles,
) {
  const thinkStr = typeof thinkContent === 'string' ? thinkContent : '';
  return (content: any) => {
    return renderThinkAndMarkdown(thinkStr, content, isStreaming, expanded, onToggle, titles);
  };
}

function renderSummaryThinkAndMarkdown({
  thinkContent,
  analysisContent,
  content,
  isStreaming,
  thinkExpanded,
  analysisExpanded,
  onThinkToggle,
  onAnalysisToggle,
}: {
  thinkContent: any;
  analysisContent: any;
  content: any;
  isStreaming: boolean;
  thinkExpanded: boolean;
  analysisExpanded: boolean;
  onThinkToggle?: (expanded: boolean) => void;
  onAnalysisToggle?: (expanded: boolean) => void;
}) {
  const thinkStr = typeof thinkContent === 'string' ? thinkContent : '';
  const analysisStr = typeof analysisContent === 'string' ? analysisContent : '';
  const rawContentStr = typeof content === 'string' ? content : '';
  const contentStr = stripSummaryFinalTitle(rawContentStr);
  const analysisSections = splitSummaryAnalysisSections(analysisStr);
  const thinkDone = !isStreaming || !!analysisStr || !!contentStr;
  const analysisDone = !isStreaming || !!contentStr;

  return (
    <>
      {thinkStr ? (
        <Think
          title={thinkDone ? '深度思考完成' : '深度思考中...'}
          loading={!thinkDone}
          expanded={thinkExpanded}
          onExpand={onThinkToggle}
        >
          <XMarkdown className="x-markdown-light" content={thinkStr} />
        </Think>
      ) : null}
      {analysisSections.length ? (
        analysisSections.map((section, index) => {
          const sectionDone = !isStreaming || !!contentStr || index < analysisSections.length - 1;
          return (
            <SummaryAnalysisThink
              key={section.key}
              title={sectionDone ? section.title : `${section.title}生成中...`}
              loading={!sectionDone}
              content={section.content}
            />
          );
        })
      ) : analysisStr ? (
        <Think
          title={analysisDone ? '归纳总结过程完成' : '归纳总结过程中...'}
          loading={!analysisDone}
          expanded={analysisExpanded}
          onExpand={onAnalysisToggle}
        >
          <XMarkdown className="x-markdown-light" content={analysisStr} />
        </Think>
      ) : null}
      {React.isValidElement(content) ? content : (contentStr ? <XMarkdown className="x-markdown-light" content={contentStr} /> : null)}
    </>
  );
}

function makeSummaryContentRender(
  thinkContent: any,
  analysisContent: any,
  isStreaming: boolean,
  thinkExpanded: boolean,
  analysisExpanded: boolean,
  onThinkToggle?: (expanded: boolean) => void,
  onAnalysisToggle?: (expanded: boolean) => void,
) {
  const thinkStr = typeof thinkContent === 'string' ? thinkContent : '';
  const analysisStr = typeof analysisContent === 'string' ? analysisContent : '';
  return (content: any) => {
    return renderSummaryThinkAndMarkdown({
      thinkContent: thinkStr,
      analysisContent: analysisStr,
      content,
      isStreaming,
      thinkExpanded,
      analysisExpanded,
      onThinkToggle,
      onAnalysisToggle,
    });
  };
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
  const Icon = providerId ? getProviderIcon(providerId as ProviderId | 'summary') : null;
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
        {Icon && <Icon style={{ fontSize: 14 }} />}
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

// 版本切换器组件
function VersionSwitcher({ totalVersions, currentVersion, onSwitch }: {
  totalVersions: number;
  currentVersion: number;
  onSwitch: (index: number) => void;
}) {
  if (totalVersions <= 1) return null;

  const canPrev = currentVersion > 0;
  const canNext = currentVersion < totalVersions - 1;

  return (
    <Flex align="center" gap={2}>
      <button
        className="version-switcher-btn"
        style={{
          width: '22px',
          height: '22px',
          fontSize: '10px',
          opacity: canPrev ? 1 : 0.4,
          cursor: canPrev ? 'pointer' : 'not-allowed',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '50%',
          background: 'transparent',
          color: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        disabled={!canPrev}
        onClick={(e) => {
          e.stopPropagation();
          if (canPrev) onSwitch(currentVersion - 1);
        }}
        title={canPrev ? '查看上一个版本' : '已经是第一个版本'}
      >
        <LeftOutlined style={{ fontSize: 8 }} />
      </button>
      <span style={{ fontSize: '10px', color: 'var(--ant-color-text-secondary)', minWidth: '50px', textAlign: 'center' }}>
        {currentVersion + 1} / {totalVersions}
      </span>
      <button
        className="version-switcher-btn"
        style={{
          width: '22px',
          height: '22px',
          fontSize: '10px',
          opacity: canNext ? 1 : 0.4,
          cursor: canNext ? 'pointer' : 'not-allowed',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '50%',
          background: 'transparent',
          color: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        disabled={!canNext}
        onClick={(e) => {
          e.stopPropagation();
          if (canNext) onSwitch(currentVersion + 1);
        }}
        title={canNext ? '查看下一个版本' : '已经是最后一个版本'}
      >
        <RightOutlined style={{ fontSize: 8 }} />
      </button>
    </Flex>
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
  const Icon = providerId ? getProviderIcon(providerId as ProviderId | 'summary') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Icon && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon style={{ fontSize: 16 }} />
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);

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
  const isFocusFollowEnabled = useStore(s => s.isFocusFollowEnabled);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isWebSearchEnabled = useStore(s => s.isWebSearchEnabled);
  const summaryStatus = useStore(s => s.summaryStatus);
  const summaryResponse = useStore(s => s.summaryResponse);
  const summaryThinkResponse = useStore(s => s.summaryThinkResponse);
  const summaryAnalysisResponse = useStore(s => s.summaryAnalysisResponse);
  const summaryAnalysisExpanded = useStore(s => s.summaryAnalysisExpanded);
  const statsMap = useStore(s => s.statsMap);
  const summaryStats = useStore(s => s.summaryStats);
  const operationStatus = useStore(s => s.operationStatus);
  const errorTypeMap = useStore(s => s.errorTypeMap);
  const summaryOperationStatus = useStore(s => s.summaryOperationStatus);
  const stageMap = useStore(s => s.stageMap);
  const collapseMap = useStore(s => s.collapseMap);
  const thinkExpandedMap = useStore(s => s.thinkExpandedMap);

  // 添加通道建议选项
  const providerSuggestions = useMemo(() => {
    return PROVIDER_META
      .filter((p: any) => p.id !== 'summarizer' && !enabledMap[p.id as ProviderId])
      .map((provider: any) => {
        const Icon = getProviderIcon(provider.id as ProviderId);
        return {
          key: provider.id,
          label: provider.name,
          icon: Icon ? <Icon /> : undefined,
        };
      });
  }, [enabledMap]);

  const handleAddChannel = ({ key }: { key: string }) => {
    const provider = PROVIDER_META.find((p: any) => p.id === key);
    if (provider) {
      const providerId = provider.id as ProviderId;
      const s = useStore.getState();

      // 如果当前有问题，将新通道加入队列等待提交
      if (currentQuestion) {
        // 检查是否有通道正在运行（responding 状态）
        const respondingChannels = PROVIDER_IDS.filter(id =>
          s.statusMap[id] === 'running' && s.stageMap[id] === 'responding'
        );

        if (respondingChannels.length === 0) {
          // 没有通道在 responding，立即提交
          toggleProvider(providerId);
          message.success(`已启用 ${provider.name} 通道`);
          submitNewChannel(providerId, currentQuestion, s);
        } else {
          // 有通道在 responding，先启用通道，等待完成后提交
          toggleProvider(providerId);

          // 设置通道为 idle 等待状态
          const newStatusMap = { ...s.statusMap, [providerId]: 'idle' as const };
          const newCollapseMap = { ...s.collapseMap, [providerId]: false };
          const newThinkExpandedMap = { ...s.thinkExpandedMap, [providerId]: true };

          useStore.setState({
            statusMap: newStatusMap,
            collapseMap: newCollapseMap,
            thinkExpandedMap: newThinkExpandedMap,
          });

          message.info(`已启用 ${provider.name} 通道，将在当前通道完成后自动提交`);
        }
      } else {
        // 没有当前问题，只是启用通道
        toggleProvider(providerId);
        message.success(`已启用 ${provider.name} 通道`);
      }
    }
  };

  // 提交新通道的辅助函数
  const submitNewChannel = (providerId: ProviderId, question: string, s: ReturnType<typeof useStore.getState>) => {
    // 更新状态，显示加载阶段
    const newStatusMap = { ...s.statusMap, [providerId]: 'running' as const };
    const newStageMap = { ...s.stageMap, [providerId]: 'opening' as StageType };
    const newCollapseMap = { ...s.collapseMap, [providerId]: false };
    const newThinkExpandedMap = { ...s.thinkExpandedMap, [providerId]: true };

    useStore.setState({
      statusMap: newStatusMap,
      stageMap: newStageMap,
      collapseMap: newCollapseMap,
      thinkExpandedMap: newThinkExpandedMap,
    });

    // 重置 timing 和 buffers
    buffers.timing[providerId].startTime = Date.now();
    buffers.timing[providerId].firstContentTime = 0;
    buffers.fullText[providerId] = '';
    buffers.thinkText[providerId] = '';
    buffers.displayedLen[providerId] = 0;
    buffers.thinkDisplayedLen[providerId] = 0;

    // 重置总结相关状态
    buffers.summaryTriggered = false;
    buffers.summaryFull = '';
    buffers.summaryThink = '';
    buffers.summaryAnalysis = '';
    buffers.summaryDisplayedLen = 0;
    buffers.summaryThinkDisplayedLen = 0;
    buffers.summaryAnalysisDisplayedLen = 0;
    useStore.setState({
      summaryVersions: [],
      summaryCurrentVersion: 0,
      summaryResponse: '',
      summaryThinkResponse: '',
      summaryAnalysisResponse: '',
      summaryAnalysisExpanded: false,
      summaryStats: null,
      summaryStatus: 'idle',
    });

    // 提交任务
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: providerId,
        prompt: question,
        mode: s.modeMap[providerId] === 'web' && (providerId === 'yuanbao' || providerId === 'wenxin') ? 'web' : s.modeMap[providerId],
        settings: {
          isDeepThinkingEnabled: s.isDeepThinkingEnabled,
          isWebSearchEnabled: s.isWebSearchEnabled,
          conversationHistory: s.conversationTurns.map(t => ({ question: t.question, response: t.response })),
          isNewConversation: false,
        },
      },
    });
  };
  const summaryVersions = useStore(s => s.summaryVersions);
  const summaryCurrentVersion = useStore(s => s.summaryCurrentVersion);
  const { toggleCollapse, setThinkExpanded, triggerSummary, regenerateSummary, switchSummaryVersion, retryProvider, goToProvider } = useStore();

  const {
    setInputStr, submit, createNewChat,
    toggleDeepThinking, toggleWebSearch, toggleSummary, toggleFocusFollow,
    toggleProvider,
  } = useStore.getState();

  // ==================== Init ====================
  useEffect(() => {
    const cleanup = useStore.getState().init();

    // 监听通道完成事件，触发队列检查
    const messageListener = (request: any) => {
      if (request.type === MSG_TYPES.TASK_COMPLETED && request.payload.provider !== '_summary') {
        // 有通道完成了，检查是否有等待的新通道需要提交
        checkAndSubmitPendingChannel(useStore.getState().currentQuestion);
      }
    };

    chrome.runtime?.onMessage.addListener(messageListener);

    return () => {
      cleanup?.();
      chrome.runtime?.onMessage.removeListener(messageListener);
    };
  }, []);

  // 检查并提交等待中的通道
  const checkAndSubmitPendingChannel = (question: string | null) => {
    if (!question) return;

    const s = useStore.getState();
    // 查找正在运行但已经开始输出的通道（responding 状态）
    // 只要有通道开始输出，就可以提交下一个新通道
    const respondingChannels = PROVIDER_IDS.filter(id =>
      s.statusMap[id] === 'running' && s.stageMap[id] === 'responding'
    );

    // 如果没有通道在 responding 状态，检查是否有刚刚启用但还没提交的通道
    if (respondingChannels.length === 0) {
      // 查找已启用但状态为 idle 的通道（可能是刚添加的）
      const idleEnabledChannels = PROVIDER_IDS.filter(id =>
        s.enabledMap[id] && s.statusMap[id] === 'idle' && !buffers.fullText[id]
      );

      // 只提交一个，串行处理
      if (idleEnabledChannels.length > 0) {
        const nextChannel = idleEnabledChannels[0];
        submitNewChannel(nextChannel, question, s);
      }
    }
  };

  // ==================== Resize Observer ====================
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // ==================== Messages ====================
  const messages = useMemo(() => {
    const items: any[] = [];

    conversationTurns.forEach((turn, idx) => {
      // 确保 response 和 thinkResponse 是字符串
      const response = typeof turn.response === 'string' ? turn.response : '';
      const thinkResponse = typeof turn.thinkResponse === 'string' ? turn.thinkResponse : '';
      const hasContent = !!(response || thinkResponse);

      // 如果没有内容，跳过不渲染，避免显示空气泡
      if (!hasContent) return;

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
        content: response || '等待中...',
        style: { paddingTop: 0, paddingBottom: 0 },
        ...(isCollapsed ? {
          className: styles.bubbleContentHidden,
          contentRender: () => null,
        } : (thinkResponse ? {
          contentRender: makeContentRender(thinkResponse, false, thinkExpanded, (expanded) => {
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
        const isCompletedOrError = statusMap[id] === 'completed' || statusMap[id] === 'error';
        const isCollapsed = collapseMap[id];
        const thinkExpanded = thinkExpandedMap[id];

        // 如果通道已完成/出错但没有内容，跳过不渲染，避免显示空气泡
        if (isCompletedOrError && !hasContent) {
          return;
        }

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
          style: { paddingTop: 0 },
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
          footer: statusMap[id] === 'error' && !isCollapsed ? (
            <Flex justify="end" gap={8} style={{ width: '100%' }}>
              {errorTypeMap[id] === 'auth_required' ? (
                <Button
                  size="small"
                  type="primary"
                  icon={<LoginOutlined />}
                  onClick={() => goToProvider(id, true)}
                  style={{ borderRadius: 999 }}
                >
                  前往登录
                </Button>
              ) : null}
              <Button
                size="small"
                type="default"
                icon={<RedoOutlined />}
                onClick={() => retryProvider(id)}
                disabled={summaryStatus === 'running'}
                style={{ borderRadius: 999 }}
              >
                重试
              </Button>
            </Flex>
          ) : undefined,
          ...(isRunning && !hasContent && !isCollapsed ? {
            loadingRender: () => (
              <StageThoughtChain stage={stageMap[id]} opStatus={operationStatus[id]} providerId={id} />
            ),
          } : {}),
        });
      });

      // 总结气泡显示条件：总结正在运行或已有内容
      // 确保 summaryResponse 和 summaryThinkResponse 是字符串，避免 object 导致的问题
      const summaryResp = typeof summaryResponse === 'string' ? summaryResponse : '';
      const summaryThink = typeof summaryThinkResponse === 'string' ? summaryThinkResponse : '';
      const summaryAnalysis = typeof summaryAnalysisResponse === 'string' ? summaryAnalysisResponse : '';
      const hasSummaryContent = !!(summaryThink.trim() || summaryAnalysis.trim() || summaryResp.trim());
      const hasSummaryRunning = summaryStatus === 'running';
      // 只有在总结完成/出错且有内容时才显示，避免空气泡
      const hasSummaryCompleted = (summaryStatus === 'completed' || summaryStatus === 'error') && hasSummaryContent;

      // 添加手动触发按钮：总结尚未生成且有足够的通道完成时显示
      // 注意：这里只检查状态，不检查内容，因为 TASK_COMPLETED 发送时内容应该已经完整
      const completedCount = enabledProviderIds.filter(id => statusMap[id] === 'completed').length;
      const isAnyLocalRunning = enabledProviderIds.some(id => statusMap[id] === 'running');

      // 手动触发按钮显示条件：
      // 1. 总结尚未运行且未完成
      // 2. 至少有 2 个通道完成
      // 3. 如果开启了自动总结，则等待所有通道完成前不显示手动触发按钮，避免造成困扰
      const shouldShowManualTrigger = !hasSummaryRunning && !hasSummaryCompleted && completedCount >= 2 && currentQuestion && !(isSummaryEnabled && isAnyLocalRunning);

      // 添加总结气泡：当总结正在运行，或总结完成/出错且有内容时显示
      // 保证在开始总结但还没收到数据时能渲染出 loading 状态
      const shouldShowSummary = currentQuestion && (
        hasSummaryRunning || hasSummaryCompleted
      );
      if (shouldShowSummary) {
        const summaryStage = useStore.getState().summaryStage;
        const isSummaryCollapsed = collapseMap['summary'];
        const summaryThinkExpanded = thinkExpandedMap['summary'];
        const setSummaryAnalysisExpanded = useStore.getState().setSummaryAnalysisExpanded;
        const isSummaryCompleted = summaryStatus === 'completed' || summaryStatus === 'error';

        // 根据侧边栏宽度决定是否只显示图标
        const showButtonText = sidebarWidth >= 500;

        // 复制按钮
        const copyButton = isSummaryCompleted && hasSummaryContent ? (
          showButtonText ? (
            <button
              className={styles.floatingBtnWithText}
              style={{
                borderRadius: '16px',
                padding: '0 12px',
                height: '32px',
                fontSize: '13px',
              }}
              onClick={() => {
                navigator.clipboard?.writeText(summaryResp);
                message.success('总结内容已复制到剪贴板');
              }}
            >
              <CopyOutlined style={{ fontSize: 14 }} />
              复制总结
            </button>
          ) : (
            <Tooltip title="复制总结" placement="top">
              <button
                className={styles.floatingBtn}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                }}
                onClick={() => {
                  navigator.clipboard?.writeText(summaryResp);
                  message.success('总结内容已复制到剪贴板');
                }}
              >
                <CopyOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>
          )
        ) : null;

        // 重新生成的 Popconfirm 按钮
        const regenerateButton = isSummaryCompleted && hasSummaryContent ? (
          showButtonText ? (
            <Popconfirm
              title="确认重新生成归纳总结吗？"
              okText="确认"
              cancelText="取消"
              onConfirm={() => {
                regenerateSummary();
              }}
              okButtonProps={{ danger: true }}
            >
              <button
                className={styles.floatingBtnWithText}
                style={{
                  borderRadius: '16px',
                  padding: '0 12px',
                  height: '32px',
                  fontSize: '13px',
                }}
              >
                <RedoOutlined style={{ fontSize: 14 }} />
                重新总结
              </button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确认重新生成归纳总结吗？"
              okText="确认"
              cancelText="取消"
              onConfirm={() => {
                regenerateSummary();
              }}
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="重新总结" placement="top">
                <button
                  className={styles.floatingBtn}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                  }}
                >
                  <RedoOutlined style={{ fontSize: 14 }} />
                </button>
              </Tooltip>
            </Popconfirm>
          )
        ) : null;

        // 版本切换器
        const versionSwitcher = summaryVersions.length > 1 ? (
          <VersionSwitcher
            totalVersions={summaryVersions.length}
            currentVersion={summaryCurrentVersion}
            onSwitch={switchSummaryVersion}
          />
        ) : null;

        // 合并 footer 内容
        const summaryFooter = copyButton || regenerateButton ? (
          <Flex gap={8} align="center" justify="space-between" style={{ width: '100%' }}>
            <Flex gap={8} align="center">
              {copyButton}
              {regenerateButton}
            </Flex>
            {versionSwitcher}
          </Flex>
        ) : null;

        items.push({
          key: 'summary',
          role: 'assistant',
          content: summaryResp || '',
          style: { paddingTop: 0, paddingBottom: 0 },
          loading: summaryStatus === 'running' && !hasSummaryContent,
          streaming: summaryStatus === 'running' && hasSummaryContent,
          ...(isSummaryCollapsed ? {
            className: styles.bubbleContentHidden,
            contentRender: () => null,
          } : (summaryThink || summaryAnalysis ? {
            contentRender: makeSummaryContentRender(summaryThink, summaryAnalysis, summaryStatus === 'running', summaryThinkExpanded, summaryAnalysisExpanded, (expanded) => {
              setThinkExpanded('summary', expanded);
            }, setSummaryAnalysisExpanded),
          } : {})),
          status: summaryStatus === 'error' ? 'error' : undefined,
          footer: summaryFooter,
          header: (
            <ProviderHeader
              providerId="summary"
              label="归纳总结"
              stats={summaryStats}
              status={summaryStatus}
              opStatus={summaryOperationStatus}
              isCollapsed={isSummaryCollapsed}
              onClick={() => toggleCollapse('summary')}
              styles={styles}
            />
          ),
          ...(summaryStatus === 'running' && !hasSummaryContent && !isSummaryCollapsed ? {
            loadingRender: () => (
              <StageThoughtChain stage={summaryStage as StageType} opStatus={summaryOperationStatus} />
            ),
          } : {}),
        });
      }

      if (shouldShowManualTrigger) {
        items.push({
          key: 'manual-summary-trigger',
          role: 'assistant',
          variant: 'borderless',
          className: styles.transparentBubble,
          content: (
            <Flex justify="center" style={{ padding: '8px 0', width: '100%' }}>
              <button
                className={styles.floatingBtnWithText}
                onClick={() => triggerSummary(true)}
                style={{
                  height: '36px',
                  padding: '0 20px',
                  fontSize: '13px',
                  color: 'var(--ant-color-primary)',
                  borderColor: 'var(--ant-color-primary-border)',
                  background: 'var(--ant-color-primary-bg)',
                }}
              >
                <MergeCellsOutlined /> 生成归纳总结
              </button>
            </Flex>
          ),
          header: null,
          messageRender: (content: any) => content,
        });
      }
    }

    return items;
  }, [
    conversationTurns, currentQuestion, enabledMap, statusMap, stageMap, collapseMap, thinkExpandedMap,
    responses, thinkResponses, isSummaryEnabled, summaryStatus, errorTypeMap,
    summaryResponse, summaryThinkResponse, summaryAnalysisResponse, summaryAnalysisExpanded, statsMap, summaryStats,
    operationStatus, summaryOperationStatus,
    triggerSummary, regenerateSummary, switchSummaryVersion,
    summaryVersions, summaryCurrentVersion,
    sidebarWidth, retryProvider, goToProvider, isCurrentSessionFromHistory,
  ]);

  const isAnyRunning = PROVIDER_IDS.some(id => statusMap[id] === 'running');

  // ==================== Event ====================
  const handleUserSubmit = async (val: string) => {
    if (!val.trim()) return;

    // 多通道模式下的追问拦截：当已有对话内容且启用通道数 >= 2 时，需要确认
    const enabledCount = PROVIDER_IDS.filter(id => enabledMap[id]).length;
    if (hasAsked && enabledCount >= 2) {
      Modal.confirm({
        title: '开启新对话？',
        content: '多通道模式暂不支持连续追问。发送新问题将清空当前界面并开启全新的会话，之前的内容会自动保存至"历史记录"中。是否继续？',
        okText: '确认',
        cancelText: '取消',
        onOk: () => {
          setInputStr(val);
          setInputValue(''); // 立即清空输入框，提升用户体验
          submit();
          listRef.current?.scrollTo({ top: 'bottom' });
        },
        onCancel: () => {
          // 用户取消，保留输入框文字，不执行任何操作
        },
      });
      return;
    }

    // 单通道模式或首次提问，直接提交
    setInputStr(val);
    setInputValue(''); // 立即清空输入框，提升用户体验
    await submit();
    listRef.current?.scrollTo({ top: 'bottom' });
  };

  // ==================== Render ====================
  const summaryBlockReason = useStore.getState().summaryBlockReason();
  const enabledCount = PROVIDER_IDS.filter(id => enabledMap[id]).length;

  return (
    <div className={styles.copilotChat} ref={containerRef}>
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
          <div className={styles.emptyStateContainer}>
            <Welcome
              variant="borderless"
              title="👋 欢迎召唤「AI 对撞机」"
              description="一次提问，多款满血 AI 同屏对撞，直接拿最优解！"
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
      <Flex vertical className={styles.chatSend}>
          {enabledCount >= 2 && (
            <Flex gap="small" style={{ marginBottom: 8 }}>
              <Tooltip title="多通道模型输出完成后自动生成归纳总结，帮助你快速抓住重点">
                <Button
                  size="small"
                  type={isSummaryEnabled ? "primary" : "default"}
                  onClick={toggleSummary}
                  icon={<MergeCellsOutlined />}
                  style={{ borderRadius: 6, fontSize: 13, height: 28 }}
                >
                  自动总结
                </Button>
              </Tooltip>
              <Tooltip title="自动追踪并切换至正在输出的模型">
                <Button
                  size="small"
                  type={isFocusFollowEnabled ? "primary" : "default"}
                  onClick={toggleFocusFollow}
                  icon={<VideoCameraOutlined />}
                  style={{ borderRadius: 6, fontSize: 13, height: 28 }}
                >
                  导播模式
                </Button>
              </Tooltip>
              {hasAsked && summaryStatus !== 'running' && (
                <>
                  {providerSuggestions.length === 0 ? (
                    <Tooltip title="已启用所有 AI 通道，无需添加">
                      <Button
                        size="small"
                        type="default"
                        icon={<PlusOutlined />}
                        style={{ borderRadius: 6, fontSize: 13, height: 28, opacity: 0.5 }}
                        disabled
                      >
                        添加通道
                      </Button>
                    </Tooltip>
                  ) : (
                    <Dropdown
                      menu={{
                        items: providerSuggestions,
                        onClick: handleAddChannel,
                      }}
                      trigger={['click']}
                    >
                      <Button
                        size="small"
                        type="default"
                        icon={<PlusOutlined />}
                        style={{ borderRadius: 6, fontSize: 13, height: 28 }}
                      >
                        添加通道
                      </Button>
                    </Dropdown>
                  )}
                </>
              )}
              {hasAsked && summaryStatus === 'running' && (
                <Tooltip title="正在归纳总结中，请稍后再添加通道">
                  <Button
                    size="small"
                    type="default"
                    icon={<PlusOutlined />}
                    style={{ borderRadius: 6, fontSize: 13, height: 28, opacity: 0.5 }}
                    disabled
                  >
                    添加通道
                  </Button>
                </Tooltip>
              )}
            </Flex>
          )}
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
                          style={{ fontSize: '13px' }}
                        >
                          深度思考
                        </Sender.Switch>
                        <Sender.Switch
                          icon={<GlobalOutlined />}
                          value={isWebSearchEnabled}
                          onChange={toggleWebSearch}
                          style={{ fontSize: '13px' }}
                        >
                          联网搜索
                        </Sender.Switch>
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
      <GlobalSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} sidebarWidth={sidebarWidth} />
    </div>
  );
};

export default App;
