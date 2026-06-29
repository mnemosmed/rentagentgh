import { useAgentRatings, AgentRating } from '@/hooks/useAgentRatings';
import { StarRating } from './StarRating';
import { Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AgentReviewsListProps {
  agentId: string;
  className?: string;
}

export function AgentReviewsList({ agentId, className }: AgentReviewsListProps) {
  const { data: ratings, isLoading } = useAgentRatings(agentId);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!ratings || ratings.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No reviews yet. Be the first to rate this agent!</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {ratings.map((rating) => (
        <ReviewCard key={rating.id} rating={rating} />
      ))}
    </div>
  );
}

function ReviewCard({ rating }: { rating: AgentRating }) {
  const overallRating = (rating.responsiveness + rating.trustworthiness + rating.helpfulness) / 3;

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Verified Renter</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(rating.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <StarRating rating={overallRating} size="sm" showValue />
      </div>

      {rating.comment && (
        <p className="text-sm text-foreground leading-relaxed">{rating.comment}</p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Responsiveness: {rating.responsiveness}/5</span>
        <span>Trustworthiness: {rating.trustworthiness}/5</span>
        <span>Helpfulness: {rating.helpfulness}/5</span>
      </div>
    </div>
  );
}
