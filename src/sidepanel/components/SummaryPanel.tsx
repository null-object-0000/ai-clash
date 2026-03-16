import { useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Markdown, Tag } from '@lobehub/ui';
import { LoadingDots } from '@lobehub/ui/chat';
import { useStore } from '../store';

export default function SummaryPanel() {
  const status = useStore(s => s.summaryStatus);
  const stage = useStore(s => s.summaryStage);
  const response = useStore(s => s.summaryResponse);
  const thinkResponse = useStore(s => s.summaryThinkResponse);
  const operationStatus = useStore(s => s.summaryOperationStatus);
  const stats = useStore(s => s.summaryStats);
  const hasAsked = useStore(s => s.hasAsked);
  const isSummaryEnabled = useStore(s => s.isSummaryEnabled);

  const { summaryBlockReason } = useStore.getState();

  const [isThinkBlockOpen, setIsThinkBlockOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'running' && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [status]);

  if (!hasAsked || !isSummaryEnabled || summaryBlockReason()) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'sticky', bottom: 0, zIndex: 5,
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--lobe-colorPrimaryBorder, #c7d2fe)',
        boxShadow: '0 -2px 12px rgba(99,102,241,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
          background: 'linear-gradient(to right, var(--lobe-colorPrimaryBg, #eef2ff), #faf5ff)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--lobe-colorPrimaryBorder, #c7d2fe)',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'running' && <LoadingDots variant="pulse" size={14} color="var(--lobe-colorPrimary, #6366f1)" />}
          {status === 'completed' && <CheckCircle style={{ width: 14, height: 14, color: 'var(--lobe-colorPrimary, #6366f1)' }} />}
          {status === 'error' && <AlertCircle style={{ width: 14, height: 14, color: '#f43f5e' }} />}
          {status === 'idle' && <span style={{ display: 'inline-flex', borderRadius: '50%', height: 10, width: 10, background: 'var(--lobe-colorBorder, #d9d9d9)' }} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lobe-colorPrimary, #4338ca)', letterSpacing: '0.02em' }}>最终研判结论</span>
          <Tag size="small" color="purple">AI 智能汇总</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--lobe-colorPrimaryText, #818cf8)' }}>
            {operationStatus && <span style={{ animation: 'pulse 1s infinite' }}>{operationStatus}</span>}
            {!operationStatus && status === 'running' && stage === 'thinking' && <span>正在思考...</span>}
            {!operationStatus && status === 'running' && stage !== 'thinking' && <span>正在输出...</span>}
            {!operationStatus && stats && status === 'completed' && (
              <span>
                首字 {(stats.ttff / 1000).toFixed(1)}s · 总耗时 {(stats.totalTime / 1000).toFixed(1)}s ·{' '}
                {stats.charCount.toLocaleString('zh-CN')}字 · {stats.charsPerSec}字/s
              </span>
            )}
            {!operationStatus && !stats && status === 'completed' && <span>已完成</span>}
          </div>
          {isCollapsed
            ? <ChevronUp style={{ width: 14, height: 14, color: 'var(--lobe-colorTextTertiary, #999)' }} />
            : <ChevronDown style={{ width: 14, height: 14, color: 'var(--lobe-colorTextTertiary, #999)' }} />
          }
        </div>
      </div>

      {!isCollapsed && (
        <div style={{
          padding: 16, background: 'var(--lobe-colorBgContainer, #fff)',
          maxHeight: '50vh', overflowY: 'auto',
        }}>
          {status === 'idle' && (
            <div style={{ fontSize: 13, color: 'var(--lobe-colorTextQuaternary, #bbb)', fontStyle: 'italic' }}>等待各通道回答完毕后自动归纳...</div>
          )}

          {thinkResponse && status !== 'idle' && (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setIsThinkBlockOpen(!isThinkBlockOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                <ChevronRight
                  style={{
                    width: 12, height: 12,
                    transition: 'transform 0.2s',
                    transform: isThinkBlockOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
                <span>思考过程</span>
                {stage === 'thinking' && status === 'running' && (
                  <span style={{ display: 'inline-block', width: 3, height: 10, marginLeft: 2, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
                )}
              </button>
              {isThinkBlockOpen && (
                <div style={{
                  paddingLeft: 12, borderLeft: '2px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
                  color: 'var(--lobe-colorTextSecondary, #666)', lineHeight: 1.8,
                  whiteSpace: 'pre-wrap', fontSize: 12, wordBreak: 'break-word',
                }}>
                  {thinkResponse}
                </div>
              )}
            </div>
          )}
          {!thinkResponse && stage === 'thinking' && status === 'running' && (
            <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--lobe-colorTextTertiary, #999)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
              正在思考...
              <span style={{ display: 'inline-block', width: 3, height: 10, background: 'var(--lobe-colorTextQuaternary, #bbb)', animation: 'pulse 1s infinite' }} />
            </div>
          )}

          {status !== 'idle' && (
            <>
              {response ? (
                <Markdown variant="chat" fontSize={13.5}>
                  {response}
                </Markdown>
              ) : (
                status === 'running' && stage === 'responding' && (
                  <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--lobe-colorPrimary, #6366f1)', animation: 'pulse 1s infinite', verticalAlign: 'middle', borderRadius: 1 }} />
                )
              )}
              {response && status === 'running' && stage === 'responding' && (
                <span style={{ display: 'inline-block', width: 6, height: 14, marginLeft: 2, background: 'var(--lobe-colorPrimary, #6366f1)', animation: 'pulse 1s infinite', verticalAlign: 'middle', borderRadius: 1 }} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
