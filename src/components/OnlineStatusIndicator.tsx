import { cn } from '@/lib/utils';

interface OnlineStatusIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function OnlineStatusIndicator({ 
  isOnline, 
  size = 'md',
  showLabel = false,
  className 
}: OnlineStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          sizeClasses[size],
          isOnline 
            ? 'bg-green-500 animate-pulse' 
            : 'bg-muted-foreground/40'
        )}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}
