import { useRef, useEffect, useMemo } from 'react';
import { PlusOutlined, HistoryOutlined, MessageOutlined, AppstoreOutlined } from '@ant-design/icons';
import { ActionIcon, Tag, Modal, Button, Tooltip } from '@lobehub/ui';
import { ChatHeader, ChatItem, BackBottom } from '@lobehub/ui/chat';
import { PROVIDER_META } from '../shared/config.js';
import ProviderCollapse from './components/ProviderCollapse';
import ChatMessage from './components/ChatMessage';
import ChannelList from './components/ChannelList';
import ChannelSettingsModal from './components/ChannelSettingsModal';
import SummaryPanel from './components/SummaryPanel';
import HistoryPanel from './components/HistoryPanel';
import FooterArea from './components/FooterArea';
import { useStore, buffers } from './store';
import {
  PROVIDER_IDS, PROVIDER_THEME_MAP, PROVIDER_NAME_MAP,
  type ProviderId,
} from './types';

const getProviderLabel = (id: string) => PROVIDER_NAME_MAP[id as ProviderId] || id;
const getProviderThemeColor = (id: string) => PROVIDER_THEME_MAP[id as ProviderId] || 'blue';

export default function App() {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const hasAsked = useStore(s => s.hasAsked);
  const currentQuestion = useStore(s => s.currentQuestion);
  const enabledMap = useStore(s => s.enabledMap);
  const conversationTurns = useStore(s => s.conversationTurns);
  const isMultiTurnSession = useStore(s => s.isMultiTurnSession);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isCurrentSessionFromHistory = useStore(s => s.isCurrentSessionFromHistory);
  const statusMap = useStore(s => s.statusMap);
  const stageMap = useStore(s => s.stageMap);
  const responses = useStore(s => s.responses);
  const thinkResponses = useStore(s => s.thinkResponses);
  const operationStatus = useStore(s => s.operationStatus);
  const rawUrlMap = useStore(s => s.rawUrlMap);
  const statsMap = useStore(s => s.statsMap);
  const openMap = useStore(s => s.openMap);
  const showNoChannelTip = useStore(s => s.showNoChannelTip);
  const historyList = useStore(s => s.historyList);
  const isHistoryPanelOpen = useStore(s => s.isHistoryPanelOpen);

  const { createNewChat, setIsHistoryPanelOpen, setShowNoChannelTip, init } = useStore.getState();

  useEffect(() => init(), []);

  useEffect(() => {
    buffers.autoScrollFn = () => {
      if (!buffers.userHasScrolled && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };
    return () => { buffers.autoScrollFn = null; };
  }, []);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const isRunningNow = PROVIDER_IDS.some(id => useStore.getState().statusMap[id] === 'running');
      if (!isRunningNow) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 80) buffers.userHasScrolled = true;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const isRunning = useMemo(() => PROVIDER_IDS.some(id => statusMap[id] === 'running'), [statusMap]);

  const singleChannelProviderId = useMemo<ProviderId | null>(() => {
    if (!hasAsked) return null;
    const enabled = PROVIDER_IDS.filter(id => enabledMap[id]);
    return enabled.length === 1 ? enabled[0] : null;
  }, [hasAsked, enabledMap]);

  const enabledCount = useMemo(() => PROVIDER_IDS.filter(id => enabledMap[id]).length, [enabledMap]);

  const modeTag = isMultiTurnSession && hasAsked ? (
    <Tag size="small" color="green">多轮对话</Tag>
  ) : singleChannelProviderId ? (
    <Tag size="small" color="green">单通道</Tag>
  ) : (
    <Tag size="small">MoE 模式</Tag>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ChatHeader
        style={{ position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip title="新建对话">
              <ActionIcon
                icon={PlusOutlined}
                onClick={createNewChat}
                disabled={!hasAsked || isRunning}
                size="small"
              />
            </Tooltip>
            <Tooltip title="历史对话">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}>
                <ActionIcon icon={HistoryOutlined} size="small" />
                <span style={{ fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)' }}>{historyList.length}</span>
              </div>
            </Tooltip>
          </div>
        }
        right={modeTag}
      />

      <HistoryPanel />

      <main
        ref={chatContainerRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 24,
          position: 'relative',
        }}
      >
        {!hasAsked ? (
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
            <div style={{ width: '100%', maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                borderRadius: 16, border: '1px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
                background: 'var(--lobe-colorBgContainer, #fff)', padding: '14px 16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 18, lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--lobe-colorText, #1f1f1f)', margin: 0 }}>开始新对话</h2>
                    <p style={{ marginTop: 4, fontSize: 12, lineHeight: '20px', color: 'var(--lobe-colorTextSecondary, #666)' }}>
                      先选择要参与的通道。单个通道的详细参数，点对应的&ldquo;设置&rdquo;再调。
                    </p>
                  </div>
                  <div style={{
                    borderRadius: 999, border: '1px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
                    background: 'var(--lobe-colorFillQuaternary, rgba(0,0,0,0.02))',
                    padding: '2px 10px', fontSize: 11, fontWeight: 500,
                    color: 'var(--lobe-colorTextSecondary, #666)', whiteSpace: 'nowrap',
                  }}>
                    {enabledCount}/{PROVIDER_META.length}
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--lobe-colorBorderSecondary, #f0f0f0)' }}>
                  {enabledCount === 1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981' }}>
                      <MessageOutlined style={{ fontSize: 12, flexShrink: 0 }} />
                      单通道模式 · 支持多轮对话，可连续追问
                    </div>
                  ) : enabledCount >= 2 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--lobe-colorPrimary, #4f46e5)' }}>
                      <AppstoreOutlined style={{ fontSize: 12, flexShrink: 0 }} />
                      MoE 对比模式 · {enabledCount} 个通道并行回答
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--lobe-colorTextQuaternary, #bbb)' }}>请至少选择一个通道</div>
                  )}
                </div>
              </div>

              <ChannelList />
            </div>
          </div>
        ) : (
          <>
            {conversationTurns.length > 0 && (
              <>
                {conversationTurns.map((turn, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ChatItem
                      placement="right"
                      primary
                      avatar={{ title: '我' }}
                      showAvatar={false}
                      message={turn.question}
                      variant="bubble"
                      style={{ opacity: 0.85 }}
                    />
                    <ChatMessage
                      providerId={turn.providerId}
                      providerName={getProviderLabel(turn.providerId)}
                      themeColor={getProviderThemeColor(turn.providerId)}
                      status="completed"
                      stage="responding"
                      response={turn.response}
                      thinkResponse={turn.thinkResponse}
                      rawUrl={turn.rawUrl}
                      isFromHistory
                      isDeepThinkingEnabled={isDeepThinkingEnabled}
                      stats={turn.stats}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', opacity: 0.4 }}>
                  <div style={{ flex: 1, borderTop: '1px dashed var(--lobe-colorBorder, #d9d9d9)' }} />
                  <span style={{ fontSize: 10, color: 'var(--lobe-colorTextQuaternary, #bbb)', whiteSpace: 'nowrap' }}>继续对话</span>
                  <div style={{ flex: 1, borderTop: '1px dashed var(--lobe-colorBorder, #d9d9d9)' }} />
                </div>
              </>
            )}

            <ChatItem
              placement="right"
              primary
              avatar={{ title: '我' }}
              showAvatar={false}
              message={currentQuestion}
              variant="bubble"
            />

            {singleChannelProviderId ? (
              <ChatMessage
                providerId={singleChannelProviderId}
                providerName={getProviderLabel(singleChannelProviderId)}
                themeColor={getProviderThemeColor(singleChannelProviderId)}
                status={statusMap[singleChannelProviderId]}
                stage={stageMap[singleChannelProviderId]}
                response={responses[singleChannelProviderId]}
                thinkResponse={thinkResponses[singleChannelProviderId]}
                operationStatus={operationStatus[singleChannelProviderId]}
                rawUrl={rawUrlMap[singleChannelProviderId]}
                isFromHistory={isCurrentSessionFromHistory}
                isDeepThinkingEnabled={isDeepThinkingEnabled}
                stats={statsMap[singleChannelProviderId]}
              />
            ) : (
              PROVIDER_IDS.filter(id => enabledMap[id]).map(id => (
                <ProviderCollapse
                  key={id}
                  providerId={id}
                  providerName={getProviderLabel(id)}
                  themeColor={getProviderThemeColor(id)}
                  status={statusMap[id]}
                  stage={stageMap[id]}
                  response={responses[id]}
                  thinkResponse={thinkResponses[id]}
                  operationStatus={operationStatus[id]}
                  rawUrl={rawUrlMap[id]}
                  isFromHistory={isCurrentSessionFromHistory}
                  isDeepThinkingEnabled={isDeepThinkingEnabled}
                  defaultOpen={openMap[id]}
                  stats={statsMap[id]}
                />
              ))
            )}

            <SummaryPanel />
          </>
        )}

        <BackBottom target={chatContainerRef} text="回到底部" />
      </main>

      <ChannelSettingsModal />

      <Modal
        open={showNoChannelTip}
        onCancel={() => setShowNoChannelTip(false)}
        title="提示"
        width={320}
        footer={
          <Button type="primary" onClick={() => setShowNoChannelTip(false)} block>
            确定
          </Button>
        }
      >
        <p style={{ fontSize: 14, lineHeight: '24px', color: 'var(--lobe-colorText, #1f1f1f)' }}>
          请在通道列表中至少开启一个通道后再发送。
        </p>
      </Modal>

      <FooterArea />
    </div>
  );
}
