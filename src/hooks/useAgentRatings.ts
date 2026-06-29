import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentRating {
  id: string;
  agent_id: string;
  user_id: string;
  responsiveness: number;
  trustworthiness: number;
  helpfulness: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRatingStats {
  agent_id: string;
  total_ratings: number;
  avg_responsiveness: number;
  avg_trustworthiness: number;
  avg_helpfulness: number;
  overall_rating: number;
}

export interface RatingInput {
  responsiveness: number;
  trustworthiness: number;
  helpfulness: number;
  comment?: string;
}

// Fetch aggregated rating stats for an agent
export function useAgentRatingStats(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-rating-stats', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('agent_rating_stats')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AgentRatingStats | null;
    },
    enabled: !!agentId,
  });
}

// Fetch all ratings for an agent (with pagination support)
export function useAgentRatings(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-ratings', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('agent_ratings')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AgentRating[];
    },
    enabled: !!agentId,
  });
}

// Check if current user has rated this agent
export function useUserAgentRating(agentId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-agent-rating', agentId, user?.id],
    queryFn: async () => {
      if (!agentId || !user?.id) return null;
      
      const { data, error } = await supabase
        .from('agent_ratings')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as AgentRating | null;
    },
    enabled: !!agentId && !!user?.id,
  });
}

// Submit or update a rating
export function useSubmitRating(agentId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: RatingInput) => {
      if (!user?.id) throw new Error('Must be logged in to rate');
      
      const { data, error } = await supabase
        .from('agent_ratings')
        .upsert({
          agent_id: agentId,
          user_id: user.id,
          responsiveness: input.responsiveness,
          trustworthiness: input.trustworthiness,
          helpfulness: input.helpfulness,
          comment: input.comment?.trim() || null,
        }, {
          onConflict: 'agent_id,user_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Calculate overall rating for SMS notification
      const overallRating = (input.responsiveness + input.trustworthiness + input.helpfulness) / 3;
      
      // Send SMS notification to agent (fire and forget - don't block on this)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-agent-rating`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            agentId,
            overallRating,
          }),
        }).catch(err => {
          console.error('Failed to send rating notification:', err);
        });
      }
      
      return data as AgentRating;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-rating-stats', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent-ratings', agentId] });
      queryClient.invalidateQueries({ queryKey: ['user-agent-rating', agentId, user?.id] });
    },
  });
}

// Delete user's rating
export function useDeleteRating(agentId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { error } = await supabase
        .from('agent_ratings')
        .delete()
        .eq('agent_id', agentId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-rating-stats', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent-ratings', agentId] });
      queryClient.invalidateQueries({ queryKey: ['user-agent-rating', agentId, user?.id] });
    },
  });
}
