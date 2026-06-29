import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StarRating } from './StarRating';
import { useSubmitRating, RatingInput, useUserAgentRating } from '@/hooks/useAgentRatings';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Shield, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHasRole } from '@/hooks/useUserRoles';

interface RatingFormProps {
  agentId: string;
  agentName: string;
  onSuccess?: () => void;
  className?: string;
}

export function RatingForm({ agentId, agentName, onSuccess, className }: RatingFormProps) {
  const { toast } = useToast();
  const { data: existingRating, isLoading: isLoadingExisting } = useUserAgentRating(agentId);
  const { data: isAgent, isLoading: isLoadingRole } = useHasRole('agent');
  const submitRating = useSubmitRating(agentId);

  const [responsiveness, setResponsiveness] = useState(0);
  const [trustworthiness, setTrustworthiness] = useState(0);
  const [helpfulness, setHelpfulness] = useState(0);
  const [comment, setComment] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize with existing rating if available
  if (existingRating && !initialized) {
    setResponsiveness(existingRating.responsiveness);
    setTrustworthiness(existingRating.trustworthiness);
    setHelpfulness(existingRating.helpfulness);
    setComment(existingRating.comment || '');
    setInitialized(true);
  }

  const isValid = responsiveness > 0 && trustworthiness > 0 && helpfulness > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast({
        title: 'Please rate all categories',
        description: 'Select a star rating for each category before submitting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await submitRating.mutateAsync({
        responsiveness,
        trustworthiness,
        helpfulness,
        comment: comment.trim() || undefined,
      });

      toast({
        title: existingRating ? 'Rating updated!' : 'Thanks for your rating!',
        description: `Your review for ${agentName} has been ${existingRating ? 'updated' : 'submitted'}.`,
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Failed to submit rating',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (isLoadingExisting || isLoadingRole) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Agents cannot rate other agents
  if (isAgent) {
    return (
      <div className={cn('text-center p-6 text-muted-foreground', className)}>
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Agents cannot rate other agents.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <div className="space-y-4">
        {/* Responsiveness */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Responsiveness
          </Label>
          <p className="text-sm text-muted-foreground">How quickly did the agent respond to your inquiries?</p>
          <StarRating
            rating={responsiveness}
            size="lg"
            interactive
            onChange={setResponsiveness}
          />
        </div>

        {/* Trustworthiness */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Trustworthiness
          </Label>
          <p className="text-sm text-muted-foreground">Did you feel the agent was honest and reliable?</p>
          <StarRating
            rating={trustworthiness}
            size="lg"
            interactive
            onChange={setTrustworthiness}
          />
        </div>

        {/* Helpfulness */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            Helpfulness
          </Label>
          <p className="text-sm text-muted-foreground">How helpful was the agent in finding what you needed?</p>
          <StarRating
            rating={helpfulness}
            size="lg"
            interactive
            onChange={setHelpfulness}
          />
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <Label htmlFor="comment">Additional Comments (Optional)</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this agent..."
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
      </div>

      <Button
        type="submit"
        disabled={!isValid || submitRating.isPending}
        className="w-full"
      >
        {submitRating.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {existingRating ? 'Update Rating' : 'Submit Rating'}
      </Button>
    </form>
  );
}
