import { useRef, useState, useEffect } from 'react';
import { BulbOutlined, UnorderedListOutlined, SettingOutlined, MessageOutlined, SlidersOutlined, StarOutlined, ArrowUpOutlined } from '@ant-design/icons';
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
    <div style={{ width: 260, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'rgba(248, 250, 252, 0.8)',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155' }}>
          <SlidersOutlined style={{ fontSize: 16, color: '#94a3b8' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>调试模式</span>
        </div>
        <Switch checked={isDebugEnabled} onChange={toggleDebug} size="small" />
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          归纳总结配置
        </div>

        {summaryProviderOptions.length === 0 ? (
          <div style={{
            background: '#fffbeb', border: '1px solid #fef3c7', color: '#d97706',
            fontSize: 12, borderRadius: 8, padding: 12, lineHeight: 1.6
          }}>
            请先配置 API Key，才能使用归纳总结功能。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>汇总通道</label>
              <Select
                value={summaryProviderId || undefined}
                options={[{ label: '请选择通道', value: '' }, ...summaryProviderOptions]}
                onChange={(value) => setSummaryProviderId(value)}
                style={{ width: '100%' }}
                size="middle"
              />
            </div>

            {summaryProviderId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeIn 0.3s ease' }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>汇总模型</label>
                <Select
                  value={summaryModel || undefined}
                  options={summaryModelOptions}
                  onChange={(value) => setSummaryModel(value)}
                  style={{ width: '100%' }}
                  size="middle"
                />
              </div>
            )}
            <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginTop: 4 }}>
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
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', flexShrink: 0,
      background: '#fff', borderTop: '1px solid #f1f5f9',
      boxShadow: '0 -10px 40px -15px rgba(0,0,0,0.03)', zIndex: 10,
      padding: '16px 16px'
    }}>

      {/* 🚀 核心组件：一体化拟物卡片 */}
      <div
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column',
          transition: 'all 0.3s ease-out', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 20, overflow: 'hidden'
        }}
      >

        {/* 多轮对话指示器 (只在激活时优雅地滑出) */}
        {isMultiTurnSession && hasAsked && !isSummarySettingsOpen && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '12px 16px 4px 16px', color: '#10b981',
            fontSize: 11, fontWeight: 500, letterSpacing: '0.02em'
          }}>
            <MessageOutlined style={{ fontSize: 14 }} />
            <span>单通道续聊模式</span>
          </div>
        )}

        {/* 文本输入区 (剥离默认边框，完全融进卡片) */}
        <div style={{ padding: '8px 12px 4px 12px' }}>
          <ChatInputArea.Inner
            value={inputStr}
            onInput={(val) => setInputStr(val)}
            onSend={submit}
            loading={isRunning}
            placeholder="输入问题，按 Enter 发送..."
            autoSize={{ minRows: 2, maxRows: 8 }}
            style={{
              border: 'none !important', boxShadow: 'none !important',
              background: 'transparent !important', padding: '0 8px !important',
              fontSize: 14, lineHeight: 1.6
            }}
          />
        </div>

        {/* 卡片底栏：各种开关与发送按钮 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px 8px 8px'
        }}>
          
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
                <BulbOutlined className={`w-4 h-4 ${isDeepThinkingEnabled ? 'animate-pulse' : ''}`} />
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
                    <StarOutlined className="w-4 h-4 text-purple-500" />
                  ) : (
                    <UnorderedListOutlined className="w-4 h-4" />
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
                  <SettingOutlined className="w-4 h-4" />
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
              <ArrowUpOutlined className="w-4 h-4" />
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