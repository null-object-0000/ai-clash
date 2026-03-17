import { Tag } from 'antd';
import type { TagProps } from 'antd';

interface TagBadgeProps extends TagProps {
  tagVariant?: 'success' | 'warning' | 'error' | 'processing' | 'default';
  size?: 'small' | 'default';
}

export default function TagBadge({
  children,
  tagVariant = 'default',
  size = 'small',
  ...props
}: TagBadgeProps) {
  const colorMap = {
    success: 'green',
    warning: 'orange',
    error: 'red',
    processing: 'blue',
    default: 'gray',
  };

  const sizeClass = size === 'small' ? 'text-xs px-1.5 py-0' : 'text-sm px-2 py-0.5';

  return (
    <Tag
      color={colorMap[tagVariant]}
      className={`inline-flex items-center justify-center font-medium rounded ${sizeClass}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
