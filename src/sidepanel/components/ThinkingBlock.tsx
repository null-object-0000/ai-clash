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
    <div className={`mb-3 ${className}`}>
      <div
        className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-1.5"
        onClick={() => setExpanded(!expanded)}
      >
        <BulbOutlined className="text-yellow-500" />
        <span>深度思考中</span>
        {expanded ? (
          <DownOutlined className="text-xs" />
        ) : (
          <RightOutlined className="text-xs" />
        )}
      </div>
      {expanded && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}
