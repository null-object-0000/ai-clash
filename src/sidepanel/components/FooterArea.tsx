import { useState } from 'react';
import { BulbOutlined, UnorderedListOutlined, SettingOutlined, MessageOutlined, StarOutlined } from '@ant-design/icons';
import { Switch, Select, Popover, Button, Tooltip } from 'antd';
import { Sender } from '@ant-design/x';
import type { SelectProps } from 'antd';
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
          <SettingOutlined style={{ fontSize: 16, color: '#94a3b8' }} />
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
  // 💻 渲染区：使用 Ant Design X Sender
  // ==========================================
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', flexShrink: 0,
      background: '#fff', borderTop: '1px solid #f1f5f9',
      boxShadow: '0 -10px 40px -15px rgba(0,0,0,0.03)', zIndex: 10,
    }}>
      {/* 多轮对话指示器 */}
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

      <div style={{ padding: '12px 16px 16px 16px' }}>
        <Sender
          value={inputStr}
          onChange={(value) => setInputStr(value)}
          onSubmit={(value) => {
            submit();
          }}
          placeholder="输入问题，按 Enter 发送..."
          loading={isRunning}
          disabled={isRunning}
          prefix={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title="深度思考">
                <Button
                  type={isDeepThinkingEnabled ? 'primary' : 'text'}
                  size="small"
                  icon={<BulbOutlined />}
                  onClick={toggleDeepThinking}
                  style={{
                    background: isDeepThinkingEnabled ? '#6366f1' : 'transparent',
                    borderColor: isDeepThinkingEnabled ? '#6366f1' : '#d9d9d9',
                    color: isDeepThinkingEnabled ? '#fff' : '#64748b',
                  }}
                >
                  深度思考
                </Button>
              </Tooltip>

              <Tooltip title={blockReason ?? '多通道完成后自动汇总'}>
                <Button
                  type={isSummaryEnabled && !blockReason ? 'primary' : 'text'}
                  size="small"
                  icon={isSummaryEnabled && !blockReason ? <StarOutlined /> : <UnorderedListOutlined />}
                  onClick={toggleSummary}
                  disabled={!!blockReason}
                  style={{
                    background: isSummaryEnabled && !blockReason ? '#9333ea' : 'transparent',
                    borderColor: isSummaryEnabled && !blockReason ? '#9333ea' : '#d9d9d9',
                    color: isSummaryEnabled && !blockReason ? '#fff' : blockReason ? '#cbd5e1' : '#64748b',
                    opacity: blockReason ? 0.6 : 1,
                    cursor: blockReason ? 'not-allowed' : 'pointer',
                  }}
                >
                  归纳总结
                </Button>
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
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  style={{ color: '#94a3b8' }}
                />
              </Popover>
            </div>
          }
          style={{
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        />
      </div>

      {/* 底部版权/状态声明 */}
      <div style={{
        textAlign: 'center',
        paddingBottom: 12,
        fontSize: 10,
        color: '#cbd5e1',
        fontWeight: 500,
        letterSpacing: '0.05em',
      }}>
        DEEPSEEK · DOUBAO · QIANWEN · LONGCAT
      </div>
    </div>
  );
}
