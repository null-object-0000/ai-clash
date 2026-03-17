import { useState, useRef, useEffect } from 'react';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import { Think } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { useStore } from '../store';

const { Text } = Typography;

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
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #c7d2fe',
        boxShadow: '0 -2px 12px rgba(99,102,241,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'linear-gradient(to right, #eef2ff, #faf5ff)',
          borderBottom: isCollapsed ? 'none' : '1px solid #c7d2fe',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'running' && (
            <span style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#6366f1',
              animation: 'pulse 1s infinite',
            }} />
          )}
          {status === 'completed' && (
            <CheckCircleOutlined style={{ fontSize: 14, color: '#6366f1' }} />
          )}
          {status === 'error' && (
            <ExclamationCircleOutlined style={{ fontSize: 14, color: '#f43f5e' }} />
          )}
          {status === 'idle' && (
            <span style={{
              display: 'inline-flex',
              borderRadius: '50%',
              height: 10,
              width: 10,
              background: '#d9d9d9',
            }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4338ca', letterSpacing: '0.02em' }}>
            最终研判结论
          </span>
          <Tag color="purple" style={{ fontSize: 12 }}>AI 智能汇总</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, color: '#818cf8' }}>
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
          </Text>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>
            {isCollapsed ? '收起' : '展开'}
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{
          padding: 16,
          background: '#fff',
          maxHeight: '50vh',
          overflowY: 'auto',
        }}>
          {status === 'idle' && (
            <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              等待各通道回答完毕后自动归纳...
            </div>
          )}

          {/* 思考过程 - 使用 Think 组件 */}
          {thinkResponse && status !== 'idle' && (
            <Think
              expanded={isThinkBlockOpen}
              onExpand={setIsThinkBlockOpen}
              title="深度思考"
              style={{ marginBottom: 12 }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{thinkResponse}</div>
            </Think>
          )}

          {/* 思考中标记 */}
          {!thinkResponse && stage === 'thinking' && status === 'running' && (
            <div style={{
              marginBottom: 12,
              fontSize: 12,
              color: '#9ca3af',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              正在思考...
              <span style={{
                display: 'inline-block',
                width: 3,
                height: 10,
                background: '#9ca3af',
                animation: 'pulse 1s infinite',
              }} />
            </div>
          )}

          {/* 回答内容 - 使用 XMarkdown */}
          {status !== 'idle' && (
            <>
              {response ? (
                <XMarkdown content={response} />
              ) : (
                status === 'running' && stage === 'responding' && (
                  <span style={{
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    background: '#6366f1',
                    animation: 'pulse 1s infinite',
                    verticalAlign: 'middle',
                    borderRadius: 2,
                  }} />
                )
              )}
              {response && status === 'running' && stage === 'responding' && (
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 14,
                  marginLeft: 4,
                  background: '#6366f1',
                  animation: 'pulse 1s infinite',
                  verticalAlign: 'middle',
                  borderRadius: 2,
                }} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
