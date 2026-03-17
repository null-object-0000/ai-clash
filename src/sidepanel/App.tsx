import {
  CloseOutlined,
  CommentOutlined,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { BubbleListProps, ConversationItemType } from '@ant-design/x';
import {
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Think,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown from '@ant-design/x-markdown';
import { Button, Popover, Space, Tag, Dropdown, MenuProps, message } from 'antd';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useStore, buffers } from './store';
import ChannelSettingsModal from './components/ChannelSettingsModal';
import HistoryPanel from './components/HistoryPanel';
import {
  PROVIDER_IDS, PROVIDER_THEME_MAP, PROVIDER_NAME_MAP,
  type ProviderId,
} from './types';
import { getProviderIconSet, getProviderThemeColor } from './utils';

// ════════════════════════════════════════════════════════════════════
// Constants & Helpers
// ════════════════════════════════════════════════════════════════════

const DEFAULT_CONVERSATIONS_ITEMS: ConversationItemType[] = [
  { key: 'new', label: '新会话', group: '当前' },
];

const ThinkComponent = React.memo((props: any) => {
  const [title, setTitle] = useState('深度思考...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (props.streamStatus === 'done' || !props.loading) {
      setTitle('深度思考完成');
      setLoading(false);
    }
  }, [props.streamStatus, props.loading]);

  return (
    <Think title={title} loading={loading}>
      {props.children}
    </Think>
  );
});

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    footer: (content, info) => (
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Button type="text" size="small" icon={<ReloadOutlined />}>重试</Button>
        <Button type="text" size="small" icon={<CopyOutlined />}>复制</Button>
        <Button type="text" size="small" icon={<LikeOutlined />} />
        <Button type="text" size="small" icon={<DislikeOutlined />} />
      </div>
    ),
    contentRender: (content: string) => (
      <XMarkdown
        content={content}
        components={{
          think: ThinkComponent,
        }}
      />
    ),
  },
  user: { placement: 'end' },
};

// ════════════════════════════════════════════════════════════════════
// Main App Component
// ════════════════════════════════════════════════════════════════════

export default function App() {
  const listRef = useRef<BubbleListRef>(null);
  const [inputValue, setInputValue] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);

  // 从 store 读取状态
  const hasAsked = useStore(s => s.hasAsked);
  const currentQuestion = useStore(s => s.currentQuestion);
  const conversationTurns = useStore(s => s.conversationTurns);
  const isMultiTurnSession = useStore(s => s.isMultiTurnSession);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);
  const statusMap = useStore(s => s.statusMap);
  const responses = useStore(s => s.responses);
  const thinkResponses = useStore(s => s.thinkResponses);
  const enabledMap = useStore(s => s.enabledMap);
  const historyList = useStore(s => s.historyList);
  const summaryStatus = useStore(s => s.summaryStatus);
  const summaryResponse = useStore(s => s.summaryResponse);
  const summaryThinkResponse = useStore(s => s.summaryThinkResponse);

  const {
    setInputStr, submit, createNewChat, toggleDeepThinking, toggleSummary,
    restoreHistorySession, setIsHistoryPanelOpen,
  } = useStore.getState();

  // 构建消息列表
  const messages = useMemo(() => {
    const items: any[] = [];

    // 历史对话轮次
    conversationTurns.forEach((turn, idx) => {
      items.push({
        id: `user-${idx}`,
        message: { role: 'user' as const, content: turn.question },
        status: 'success' as const,
      });
      items.push({
        id: `ai-${turn.providerId}-${idx}`,
        message: {
          role: 'assistant' as const,
          content: turn.response || '等待中...',
          thinkResponse: turn.thinkResponse,
        },
        status: 'success' as const,
      });
    });

    // 当前用户消息
    if (currentQuestion) {
      items.push({
        id: 'user-current',
        message: { role: 'user' as const, content: currentQuestion },
        status: 'success' as const,
      });
    }

    // 当前 AI 回复
    const enabledProviderIds = PROVIDER_IDS.filter(id => enabledMap[id]);
    if (enabledProviderIds.length === 1) {
      const id = enabledProviderIds[0];
      items.push({
        id: `ai-current-${id}`,
        message: {
          role: 'assistant' as const,
          content: responses[id] || (statusMap[id] === 'running' ? '思考中...' : ''),
          thinkResponse: thinkResponses[id],
        },
        status: statusMap[id] === 'error' ? 'error' : 'success' as const,
        loading: statusMap[id] === 'running',
      });
    } else if (enabledProviderIds.length > 1) {
      enabledProviderIds.forEach(id => {
        items.push({
          id: `ai-current-${id}`,
          message: {
            role: 'assistant' as const,
            content: responses[id] || (statusMap[id] === 'running' ? '思考中...' : ''),
            thinkResponse: thinkResponses[id],
            providerName: PROVIDER_NAME_MAP[id],
            themeColor: PROVIDER_THEME_MAP[id],
          },
          status: statusMap[id] === 'error' ? 'error' : 'success' as const,
          loading: statusMap[id] === 'running',
        });
      });
    }

    // 总结回复
    if (isSummaryEnabled && (summaryStatus === 'running' || summaryResponse)) {
      items.push({
        id: 'summary',
        message: {
          role: 'assistant' as const,
          content: summaryResponse || '正在生成总结...',
          thinkResponse: summaryThinkResponse,
          providerName: '智能总结',
          themeColor: 'violet',
        },
        status: summaryStatus === 'error' ? 'error' : 'success' as const,
        loading: summaryStatus === 'running',
      });
    }

    return items;
  }, [
    conversationTurns, currentQuestion, enabledMap, statusMap,
    responses, thinkResponses, isSummaryEnabled, summaryStatus,
    summaryResponse, summaryThinkResponse,
  ]);

  // 处理用户提交
  const handleUserSubmit = (val: string) => {
    setInputStr(val);
    submit();
    setInputValue('');
    listRef.current?.scrollTo({ top: 'bottom' });
  };

  // 欢迎页快捷问题
  const MOCK_QUESTIONS = [
    '今天天气怎么样？',
    '如何学习 React？',
    '解释一下量子计算',
  ];

  // 历史会话菜单
  const historyMenuItems: MenuProps['items'] = historyList.slice(0, 10).map(item => ({
    key: item.id,
    label: item.type === 'multi' ? '多通道对话' : `${PROVIDER_NAME_MAP[item.providerId as ProviderId] || '对话'}`,
    onClick: () => {
      restoreHistorySession(item);
      setConversationsOpen(false);
    },
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        height: 52,
        boxSizing: 'border-box',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px 0 16px',
        background: '#fff',
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✨ AI 对撞机</span>
        </div>
        <Space size={0}>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={createNewChat}
            style={{ fontSize: 18 }}
            title="新建对话"
          />
          <Popover
            placement="bottom"
            open={conversationsOpen}
            onOpenChange={setConversationsOpen}
            overlayInnerStyle={{ padding: 0, maxHeight: 600 }}
            content={
              <div style={{ width: 280 }}>
                <Conversations
                  items={[
                    { key: 'new', label: hasAsked ? '新建对话' : '新会话' },
                    ...historyList.slice(0, 9).map((item, idx) => ({
                      key: item.id,
                      label: item.type === 'multi'
                        ? `多通道 · ${new Date(item.createdAt).toLocaleDateString()}`
                        : `${PROVIDER_NAME_MAP[item.providerId as ProviderId]} · ${new Date(item.createdAt).toLocaleDateString()}`,
                    })),
                  ]}
                  activeKey="new"
                  onActiveChange={(key) => {
                    if (key === 'new' && hasAsked) {
                      createNewChat();
                    } else if (key !== 'new') {
                      const item = historyList.find(h => h.id === key);
                      if (item) {
                        restoreHistorySession(item);
                      }
                    }
                    setConversationsOpen(false);
                  }}
                />
              </div>
            }
          >
            <Button type="text" icon={<CommentOutlined />} style={{ fontSize: 18 }} title="历史对话" />
          </Popover>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setConversationsOpen(false)}
            style={{ fontSize: 18 }}
            title="通道设置"
          />
        </Space>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {messages.length > 0 ? (
          /* 消息列表 */
          <Bubble.List
            ref={listRef}
            style={{ paddingInline: 16, paddingBlock: 16, overflowY: 'auto', flex: 1 }}
            items={messages?.map((i) => ({
              ...i.message,
              key: i.id,
              status: i.status,
              loading: i.loading,
            }))}
            role={role}
          />
        ) : (
          /* 欢迎页 */
          <>
            <Welcome
              variant="borderless"
              title="👋 你好，我是 AI 对撞机"
              description="一个问题问多个 AI，获取最全面的答案"
              style={{
                marginInline: 16,
                padding: '12px 16px',
                borderRadius: '2px 12px 12px 12px',
                background: '#f5f5f5',
                marginBottom: 16,
              }}
            />

            <Prompts
              vertical
              title="我可以帮助："
              items={MOCK_QUESTIONS.map((q) => ({ key: q, description: q }))}
              onItemClick={(info) => handleUserSubmit(info?.data?.description as string)}
              style={{ marginInline: 16 }}
              styles={{ title: { fontSize: 14 } }}
            />
          </>
        )}
      </div>

      {/* Sender Area */}
      <div style={{ padding: 16, background: '#fff', borderTop: '1px solid #f0f0f0' }}>
        <Sender
          loading={PROVIDER_IDS.some(id => statusMap[id] === 'running')}
          value={inputValue}
          onChange={(v) => setInputValue(v)}
          onSubmit={() => handleUserSubmit(inputValue)}
          onCancel={() => {
            // TODO: 添加取消请求逻辑
            message.info('取消功能待实现');
          }}
          placeholder="输入问题，按 Enter 发送..."
          allowSpeech
          header={
            <Sender.Header
              title="通道设置"
              styles={{ content: { padding: 0 } }}
              open={isHistoryOpen}
              onOpenChange={setIsHistoryOpen}
              forceRender
            >
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500 }}>快捷设置</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    type={isDeepThinkingEnabled ? 'primary' : 'default'}
                    size="small"
                    onClick={toggleDeepThinking}
                  >
                    深度思考 {isDeepThinkingEnabled ? '已开启' : '已关闭'}
                  </Button>
                  <Button
                    type={isSummaryEnabled ? 'primary' : 'default'}
                    size="small"
                    onClick={toggleSummary}
                  >
                    智能总结 {isSummaryEnabled ? '已开启' : '已关闭'}
                  </Button>
                </div>
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                  <Button block onClick={() => { setIsHistoryPanelOpen(true); setIsHistoryOpen(false); }}>
                    查看详细历史记录
                  </Button>
                </div>
              </div>
            </Sender.Header>
          }
        />
      </div>

      {/* Modals */}
      <ChannelSettingsModal />
      <HistoryPanel />
    </div>
  );
}
