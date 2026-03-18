import { useState } from 'react';
import { DownOutlined, RightOutlined, BulbOutlined } from '@ant-design/icons';

interface ThinkingBlockProps {
  content: string;
  className?: string;
}

export default function ThinkingBlock({ content, className = '' }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  const hasContent = content.trim().length > 0;
  if (!hasContent) return null;

  return (
    <div className={className}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          fontSize: 13,
          color: '#6b7280',
          marginBottom: 8,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <BulbOutlined style={{ color: '#eab308' }} />
        <span>深度思考中</span>
        {expanded ? (
          <DownOutlined style={{ fontSize: 12 }} />
        ) : (
          <RightOutlined style={{ fontSize: 12 }} />
        )}
      </div>
      {expanded && (
        <div style={{
          background: '#fefce8',
          border: '1px solid #fef08a',
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          color: '#4b5563',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
        }}>
          {content}
        </div>
      )}
    </div>
  );
}
