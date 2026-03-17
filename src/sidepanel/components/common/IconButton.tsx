import { Button } from 'antd';
import type { ButtonProps } from 'antd';

interface IconButtonProps extends Omit<ButtonProps, 'type' | 'shape'> {
  buttonVariant?: 'default' | 'ghost' | 'text';
  size?: 'small' | 'middle' | 'large';
}

export default function IconButton({
  children,
  buttonVariant = 'ghost',
  size = 'small',
  className = '',
  ...props
}: IconButtonProps) {
  const sizePx = {
    small: 28,
    middle: 32,
    large: 36,
  }[size];

  return (
    <Button
      type={buttonVariant === 'text' ? 'text' : 'default'}
      shape="circle"
      size={size}
      className={`flex items-center justify-center border-0 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      style={{ width: sizePx, height: sizePx }}
      {...props}
    >
      {children}
    </Button>
  );
}
