import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  userName?: string;
  className?: string;
}

export function TypingIndicator({ userName, className }: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-3 max-w-[75%]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {userName ? `${userName} is typing` : 'Typing'}
          </span>
          <div className="flex gap-1">
            <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
