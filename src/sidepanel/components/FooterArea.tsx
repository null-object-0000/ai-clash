import { Brain, ClipboardList, Settings, MessageSquare, X, SlidersHorizontal, Send } from 'lucide-react';
import { ActionIcon, Button, Select, Tag, Tooltip, TextArea } from '@lobehub/ui';
import { useStore } from '../store';
import { PROVIDER_IDS, type ProviderId } from '../types';

export default function FooterArea() {
  const inputStr = useStore(s => s.inputStr);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);
  const isSummarySettingsOpen = useStore(s => s.isSummarySettingsOpen);
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);
  const isMultiTurnSession = useStore(s => s.isMultiTurnSession);
  const hasAsked = useStore(s => s.hasAsked);
  const isRunning = useStore(s => PROVIDER_IDS.some(id => s.statusMap[id] === 'running'));

  const {
    setInputStr, submit, toggleDeepThinking, toggleSummary,
    setIsSummarySettingsOpen, setSummaryProviderId, setSummaryModel,
    toggleDebug, summaryBlockReason, getSummaryProviderOptions, getSummaryModelOptions,
  } = useStore.getState();

  const blockReason = summaryBlockReason();
  const summaryProviderOptions = getSummaryProviderOptions();
  const summaryModelOptions = getSummaryModelOptions();

  return (
    <div className="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Tooltip title="开启后 AI 会先进行深度思考再输出回答">
          <button
            type="button"
            onClick={toggleDeepThinking}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              isDeepThinkingEnabled
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>深度思考</span>
          </button>
        </Tooltip>

        <div className="relative flex items-center gap-0.5">
          <Tooltip title={blockReason ?? '多通道完成后自动汇总各通道回答'}>
            <button
              type="button"
              onClick={toggleSummary}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                isSummaryEnabled && !blockReason
                  ? 'bg-purple-50 border-purple-200 text-purple-600'
                  : !blockReason
                    ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                    : 'bg-white border-slate-200 text-slate-300 cursor-default'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>归纳总结</span>
            </button>
          </Tooltip>

          <ActionIcon
            icon={Settings}
            size={{ blockSize: 24 }}
            onClick={() => setIsSummarySettingsOpen(!isSummarySettingsOpen)}
            active={isSummarySettingsOpen}
            title="总结设置"
          />

          {isMultiTurnSession && hasAsked && !isSummarySettingsOpen && (
            <Tag
              size="small"
              color="green"
              className="ml-1"
              title="当前为单通道模式，发送下一条消息即可自动续聊"
            >
              <MessageSquare className="w-2.5 h-2.5 flex-shrink-0 mr-1" strokeWidth={2.5} />
              多轮对话中
            </Tag>
          )}

          {isSummarySettingsOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-[260px] rounded-2xl border border-slate-200 bg-white shadow-xl p-3 space-y-3 z-20">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-slate-800">设置</div>
                <ActionIcon icon={X} size="small" onClick={() => setIsSummarySettingsOpen(false)} title="关闭" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[12px] text-slate-700">调试模式</span>
                </div>
                <button
                  type="button"
                  onClick={toggleDebug}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    isDebugEnabled ? 'bg-slate-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={isDebugEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      isDebugEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-slate-100" />

              <div className="text-[11px] font-medium text-slate-500 -mb-1">归纳总结</div>

              {summaryProviderOptions.length === 0 ? (
                <div className="text-[11px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 leading-5">
                  请先在通道设置中为 DeepSeek 或 LongCat 配置 API Key，才能使用归纳总结功能。
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-600">汇总通道</label>
                    <Select
                      value={summaryProviderId || undefined}
                      options={[{ label: '请选择通道', value: '' }, ...summaryProviderOptions]}
                      onChange={(value) => setSummaryProviderId(value)}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </div>

                  {summaryProviderId && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-600">汇总模型</label>
                      <Select
                        value={summaryModel || undefined}
                        options={summaryModelOptions}
                        onChange={(value) => setSummaryModel(value)}
                        style={{ width: '100%' }}
                        size="small"
                      />
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 leading-4">
                    将复用已配置的 API Key，等所有通道回答完毕后自动发起汇总请求。
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex items-end gap-2">
        <TextArea
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="输入问题，按 Enter 发送..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1 }}
        />
        <Tooltip title="发送">
          <Button
            type="primary"
            onClick={submit}
            disabled={isRunning || !inputStr.trim()}
            icon={Send}
            style={{ height: 36, width: 36, flexShrink: 0 }}
          />
        </Tooltip>
      </div>

      <div className="text-center mt-2">
        {isMultiTurnSession && hasAsked ? (
          <span className="text-[10px] text-emerald-500">
            单通道多轮对话模式 · 直接输入下一条消息即可继续
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">
            目前支持：DeepSeek · 豆包 · 千问 · LongCat（网页模式/API模式双接入）
          </span>
        )}
      </div>
    </div>
  );
}
