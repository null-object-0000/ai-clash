import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingIndicatorProps {
  size?: 'small' | 'default' | 'large';
  className?: string;
  text?: string;
}

export default function LoadingIndicator({
  size = 'small',
  className = '',
  text,
}: LoadingIndicatorProps) {
  const icon = <LoadingOutlined spin />;

  if (text) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Spin size={size} indicator={icon} />
        <span className="text-sm text-gray-500">{text}</span>
      </div>
    );
  }

  return <Spin size={size} indicator={icon} className={className} />;
}
