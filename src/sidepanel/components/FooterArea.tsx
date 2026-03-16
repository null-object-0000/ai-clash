import { useRef, useState, useEffect } from 'react';
import { Brain, ClipboardList, Settings, MessageSquare, SlidersHorizontal, Sparkles, ArrowUp } from 'lucide-react';
import { ActionIcon, Select, Tooltip } from '@lobehub/ui';
import { ChatInputArea } from '@lobehub/ui/chat';
import { Switch, Popover, ConfigProvider } from 'antd';
import { useStore } from '../store';
import { PROVIDER_IDS } from '../types';

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

  // ==========================================
  // 🎨 总结设置弹窗内容 (保持紧凑优雅)
  // ==========================================
  const summarySettingsContent = (
    <div className="w-[260px] flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-[13px] font-medium">调试模式</span>
        </div>
        <Switch checked={isDebugEnabled} onChange={toggleDebug} size="small" />
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
          归纳总结配置
        </div>

        {summaryProviderOptions.length === 0 ? (
          <div className="bg-amber-50 border border-amber-100 text-amber-600 text-[12px] rounded-lg p-3 leading-relaxed">
            请先配置 API Key，才能使用归纳总结功能。
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-slate-600">汇总通道</label>
              <Select
                value={summaryProviderId || undefined}
                options={[{ label: '请选择通道', value: '' }, ...summaryProviderOptions]}
                onChange={(value) => setSummaryProviderId(value)}
                className="w-full"
                size="middle"
              />
            </div>

            {summaryProviderId && (
              <div className="flex flex-col gap-1.5 animate-fadeIn">
                <label className="text-[12px] font-medium text-slate-600">汇总模型</label>
                <Select
                  value={summaryModel || undefined}
                  options={summaryModelOptions}
                  onChange={(value) => setSummaryModel(value)}
                  className="w-full"
                  size="middle"
                />
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
              等所有通道回答完毕后自动发起汇总请求。
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================
  // 💻 渲染区：一体化现代输入框
  // ==========================================
  return (
    <div className="relative flex flex-col shrink-0 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.03)] z-10 px-4 py-4">
      
      {/* 🚀 核心组件：一体化拟物卡片 */}
      <div 
        className={`
          relative flex flex-col transition-all duration-300 ease-out
          bg-slate-50 border border-slate-200 rounded-[1.25rem] overflow-hidden
          focus-within:bg-white focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.08)]
        `}
      >
        
        {/* 多轮对话指示器 (只在激活时优雅地滑出) */}
        {isMultiTurnSession && hasAsked && !isSummarySettingsOpen && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-emerald-500 text-[11px] font-medium tracking-wide">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>单通道续聊模式</span>
          </div>
        )}

        {/* 文本输入区 (剥离默认边框，完全融进卡片) */}
        <div className="px-3 pt-2 pb-1">
          <ChatInputArea.Inner
            value={inputStr}
            onInput={(val) => setInputStr(val)}
            onSend={submit}
            loading={isRunning}
            placeholder="输入问题，按 Enter 发送..."
            autoSize={{ minRows: 2, maxRows: 8 }}
            className="!border-none !shadow-none !bg-transparent !px-2 text-[14px] leading-relaxed placeholder:text-slate-400 focus-within:ring-0"
          />
        </div>

        {/* 卡片底栏：各种开关与发送按钮 */}
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          
          {/* 左侧：功能开关组 */}
          <div className="flex items-center gap-1">
            <Tooltip title="深度思考">
              <button
                type="button"
                onClick={toggleDeepThinking}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-medium transition-colors border border-transparent
                  ${isDeepThinkingEnabled 
                    ? 'bg-white border-indigo-100 text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                `}
              >
                <Brain className={`w-4 h-4 ${isDeepThinkingEnabled ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">深度思考</span>
              </button>
            </Tooltip>

            <div className="flex items-center bg-transparent rounded-xl">
              <Tooltip title={blockReason ?? '多通道完成后自动汇总'}>
                <button
                  type="button"
                  onClick={toggleSummary}
                  disabled={!!blockReason}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-medium transition-colors border border-transparent
                    ${isSummaryEnabled && !blockReason
                      ? 'bg-white border-purple-100 text-purple-600 shadow-sm' 
                      : blockReason
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                  `}
                >
                  {isSummaryEnabled && !blockReason ? (
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  ) : (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">归纳总结</span>
                </button>
              </Tooltip>

              <Popover
                open={isSummarySettingsOpen}
                onOpenChange={setIsSummarySettingsOpen}
                trigger="click"
                placement="topLeft"
                arrow={false}
                overlayInnerStyle={{ padding: 0, borderRadius: '12px', overflow: 'hidden' }}
                content={summarySettingsContent}
              >
                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors ml-0.5">
                  <Settings className="w-4 h-4" />
                </button>
              </Popover>
            </div>
          </div>

          {/* 右侧：发送按钮 (克制、高级的小圆角方块) */}
          <Tooltip title="发送指令 (Enter)">
            <button
              onClick={submit}
              disabled={isRunning || !inputStr.trim()}
              className={`
                flex items-center justify-center w-8 h-8 rounded-[10px] transition-all duration-200
                ${isRunning || !inputStr.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'}
              `}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 底部版权/状态声明 */}
      <div className="text-center mt-3 text-[10px] text-slate-300 font-medium tracking-wider">
        DEEPSEEK · DOUBAO · QIANWEN · LONGCAT
      </div>
    </div>
  );
}