import { Brain, ClipboardList, Settings, MessageSquare, X, SlidersHorizontal, Send } from 'lucide-react';

export interface FooterAreaProps {
  inputValue: string;
  isRunning: boolean;
  isDeepThinkingEnabled: boolean;
  isSummaryEnabled: boolean;
  isSummarySettingsOpen: boolean;
  isDebugEnabled: boolean;
  summaryProviderId: string;
  summaryModel: string;
  summaryBlockReason: string | null;
  getSummaryProviderOptions: () => Array<{ value: string; label: string }>;
  getSummaryModelOptions: () => Array<{ value: string; label: string }>;
  isMultiTurnSession: boolean;
  hasAsked: boolean;
  onUpdateInputValue: (value: string) => void;
  onSubmit: () => void;
  onToggleDeepThinking: () => void;
  onToggleSummaryEnabled: () => void;
  onToggleSummarySettings: () => void;
  onUpdateSummaryProviderId: (value: string) => void;
  onUpdateSummaryModel: (value: string) => void;
  onToggleDebugEnabled: () => void;
}

export default function FooterArea({
  inputValue,
  isRunning,
  isDeepThinkingEnabled,
  isSummaryEnabled,
  isSummarySettingsOpen,
  isDebugEnabled,
  summaryProviderId,
  summaryModel,
  summaryBlockReason,
  getSummaryProviderOptions,
  getSummaryModelOptions,
  isMultiTurnSession,
  hasAsked,
  onUpdateInputValue,
  onSubmit,
  onToggleDeepThinking,
  onToggleSummaryEnabled,
  onToggleSummarySettings,
  onUpdateSummaryProviderId,
  onUpdateSummaryModel,
  onToggleDebugEnabled,
}: FooterAreaProps) {
  const summaryProviderOptions = getSummaryProviderOptions();
  const summaryModelOptions = getSummaryModelOptions();

  return (
    <div className="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          onClick={onToggleDeepThinking}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
            isDeepThinkingEnabled
              ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>深度思考</span>
        </button>

        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleSummaryEnabled}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              isSummaryEnabled && !summaryBlockReason
                ? 'bg-purple-50 border-purple-200 text-purple-600'
                : !summaryBlockReason
                  ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                  : 'bg-white border-slate-200 text-slate-300 cursor-default'
            }`}
            title={summaryBlockReason ?? ''}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>归纳总结</span>
          </button>

          <button
            type="button"
            onClick={onToggleSummarySettings}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 ${
              isSummarySettingsOpen ? 'border-purple-200 bg-purple-50 text-purple-500' : 'border-slate-200'
            }`}
            aria-label="设置"
          >
            <Settings className="w-3 h-3" />
          </button>

          {isMultiTurnSession && hasAsked && !isSummarySettingsOpen && (
            <div
              className="flex items-center gap-1 ml-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 select-none"
              title="当前为单通道模式，发送下一条消息即可自动续聊"
            >
              <MessageSquare className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={2.5} />
              <span>多轮对话中</span>
            </div>
          )}

          {isSummarySettingsOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-[260px] rounded-2xl border border-slate-200 bg-white shadow-xl p-3 space-y-3 z-20">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-slate-800">设置</div>
                <button type="button" onClick={onToggleSummarySettings} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[12px] text-slate-700">调试模式</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleDebugEnabled}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
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
                    <select
                      value={summaryProviderId}
                      onChange={(e) => onUpdateSummaryProviderId(e.target.value)}
                      className="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15"
                    >
                      <option value="">请选择通道</option>
                      {summaryProviderOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {summaryProviderId && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-600">汇总模型</label>
                      <select
                        value={summaryModel}
                        onChange={(e) => onUpdateSummaryModel(e.target.value)}
                        className="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15"
                      >
                        {summaryModelOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
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

      <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
        <textarea
          value={inputValue}
          onChange={(e) => onUpdateInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="输入问题，按 Enter 发送..."
          className="w-full bg-transparent p-3 pr-2 text-[15px] leading-7 text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[48px]"
          rows={1}
        />

        <div className="p-1.5 mb-0.5 pr-2 flex-shrink-0">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isRunning || !inputValue.trim()}
            className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center shadow-sm disabled:shadow-none"
          >
            <Send className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
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
