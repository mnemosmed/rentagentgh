import { format, isToday, isYesterday } from 'date-fns';

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  return (
    <div className="flex items-center justify-center py-2">
      <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
        {getDateLabel(date)}
      </div>
    </div>
  );
}

// Helper to check if two dates are on different days
export function isDifferentDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() !== date2.getFullYear() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getDate() !== date2.getDate()
  );
}
