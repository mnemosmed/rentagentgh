import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

export function useContactedAgents() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['contacted-agents', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('conversations')
        .select('agent_id')
        .eq('user_id', user.id);

      if (error) throw error;

      // Return array of agent IDs that the user has contacted
      return data?.map(c => c.agent_id) || [];
    },
    enabled: isAuthenticated && !!user,
    staleTime: 0, // Always refetch when needed
  });

  // Function to optimistically add an agent to contacted list
  const markAgentAsContacted = useCallback((agentId: string) => {
    queryClient.setQueryData<string[]>(['contacted-agents', user?.id], (old) => {
      if (!old) return [agentId];
      if (old.includes(agentId)) return old;
      return [...old, agentId];
    });
  }, [queryClient, user?.id]);

  // Function to invalidate and refetch the contacted agents
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contacted-agents', user?.id] });
  }, [queryClient, user?.id]);

  return {
    ...query,
    markAgentAsContacted,
    invalidate,
  };
}
