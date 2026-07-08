import { Spin } from 'antd';

interface Props {
  className?: string;
  minHeightClassName?: string;
}

export default function LoadingState({
  className = '',
  minHeightClassName = 'min-h-[220px]',
}: Props) {
  return (
    <div
      data-testid="loading-state"
      className={`flex min-w-0 items-center justify-center ${minHeightClassName} ${className}`.trim()}
    >
      <Spin size="large" />
    </div>
  );
}
