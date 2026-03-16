import { useRef, useEffect, useMemo } from 'react';
import { Plus, History, MessageSquare, Layers } from 'lucide-react';
import { ActionIcon, Tag, Modal, Button, Tooltip } from '@lobehub/ui';
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

  // ─── Store: only state needed for App's own rendering ───
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

  // ─── Init ───
  useEffect(() => init(), []);

  // ─── Auto-scroll registration ───
  useEffect(() => {
    buffers.autoScrollFn = () => {
      if (!buffers.userHasScrolled && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };
    return () => { buffers.autoScrollFn = null; };
  }, []);

  // ─── Scroll detection ───
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

  // ─── Derived state ───
  const isRunning = useMemo(() => PROVIDER_IDS.some(id => statusMap[id] === 'running'), [statusMap]);

  const singleChannelProviderId = useMemo<ProviderId | null>(() => {
    if (!hasAsked) return null;
    const enabled = PROVIDER_IDS.filter(id => enabledMap[id]);
    return enabled.length === 1 ? enabled[0] : null;
  }, [hasAsked, enabledMap]);

  const enabledCount = useMemo(() => PROVIDER_IDS.filter(id => enabledMap[id]).length, [enabledMap]);

  // ─── Render ───
  return (
    <div className="app-shell flex flex-col h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/75 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Tooltip title="新建对话">
            <ActionIcon
              icon={Plus}
              onClick={createNewChat}
              disabled={!hasAsked || isRunning}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="历史对话">
            <div className="inline-flex items-center gap-1.5 cursor-pointer" onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}>
              <ActionIcon icon={History} size="small" variant="outlined" />
              <span className="text-[11px] text-slate-500">{historyList.length}</span>
            </div>
          </Tooltip>
        </div>
        <div className="relative flex items-center gap-2">
          {isMultiTurnSession && hasAsked ? (
            <Tag size="small" color="green">多轮对话</Tag>
          ) : singleChannelProviderId ? (
            <Tag size="small" color="green">单通道</Tag>
          ) : (
            <Tag size="small">MoE 模式</Tag>
          )}
        </div>

        <HistoryPanel />
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scroll-smooth" ref={chatContainerRef}>
        {!hasAsked ? (
          <div className="min-h-full flex items-start justify-center pt-2">
            <div className="w-full max-w-[360px] mx-auto space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[18px] leading-7 font-semibold tracking-[-0.02em] text-slate-900">开始新对话</h2>
                    <p className="mt-1 text-[12px] leading-6 text-slate-500">
                      先选择要参与的通道。单个通道的详细参数，点对应的&ldquo;设置&rdquo;再调。
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {enabledCount}/{PROVIDER_META.length}
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  {enabledCount === 1 ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
                      单通道模式 · 支持多轮对话，可连续追问
                    </div>
                  ) : enabledCount >= 2 ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-500">
                      <Layers className="w-3 h-3 flex-shrink-0" />
                      MoE 对比模式 · {enabledCount} 个通道并行回答
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">请至少选择一个通道</div>
                  )}
                </div>
              </div>

              <ChannelList />
            </div>
          </div>
        ) : (
          <>
            {/* 多轮历史轮次 */}
            {conversationTurns.length > 0 && (
              <>
                {conversationTurns.map((turn, idx) => (
                  <div key={idx}>
                    <div className="flex justify-end">
                      <div className="bg-slate-700 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-sm leading-7 break-words tracking-[0.01em] opacity-80">
                        {turn.question}
                      </div>
                    </div>
                    <div className="mt-6">
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
                  </div>
                ))}
                <div className="flex items-center gap-2 my-1 opacity-40">
                  <div className="flex-1 border-t border-dashed border-slate-300" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">继续对话</span>
                  <div className="flex-1 border-t border-dashed border-slate-300" />
                </div>
              </>
            )}

            {/* 当前问题 */}
            <div className="flex justify-end">
              <div className="bg-slate-900 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-md leading-7 break-words tracking-[0.01em]">
                {currentQuestion}
              </div>
            </div>

            {/* 单通道模式 */}
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
      </main>

      <ChannelSettingsModal />

      {/* 未选通道提示 */}
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
        <p className="text-[14px] leading-6 text-slate-700">请在通道列表中至少开启一个通道后再发送。</p>
      </Modal>

      <FooterArea />
    </div>
  );
}
