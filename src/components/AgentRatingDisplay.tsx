import { Star, MessageSquare, ThumbsUp, Clock, Shield } from 'lucide-react';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';

interface AgentRatingDisplayProps {
  overallRating: number | null;
  totalRatings: number;
  avgResponsiveness?: number | null;
  avgTrustworthiness?: number | null;
  avgHelpfulness?: number | null;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function AgentRatingDisplay({
  overallRating,
  totalRatings,
  avgResponsiveness,
  avgTrustworthiness,
  avgHelpfulness,
  variant = 'compact',
  className,
}: AgentRatingDisplayProps) {
  if (totalRatings === 0 || overallRating === null) {
    return (
      <div className={cn('flex items-center gap-1 text-muted-foreground', className)}>
        <Star className="h-4 w-4" />
        <span className="text-sm">No ratings yet</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <StarRating rating={overallRating} size="sm" />
        <span className="text-sm font-medium text-foreground">{overallRating.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">
          ({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall rating */}
      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold text-foreground">{overallRating.toFixed(1)}</div>
        <div>
          <StarRating rating={overallRating} size="md" />
          <p className="text-sm text-muted-foreground mt-0.5">
            Based on {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      {/* Individual ratings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Responsiveness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${((avgResponsiveness || 0) / 5) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8 text-right">{avgResponsiveness?.toFixed(1) || '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Trustworthiness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${((avgTrustworthiness || 0) / 5) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8 text-right">{avgTrustworthiness?.toFixed(1) || '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ThumbsUp className="h-4 w-4" />
            <span>Helpfulness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${((avgHelpfulness || 0) / 5) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8 text-right">{avgHelpfulness?.toFixed(1) || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
