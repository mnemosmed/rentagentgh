import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRoleType = 'renter' | 'agent';

export function useUserRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async (): Promise<UserRoleType[]> => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_user_roles', {
        _user_id: user.id,
      });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return (data as UserRoleType[]) || [];
    },
    enabled: !!user,
  });
}

export function useHasRole(role: UserRoleType) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['has-role', user?.id, role],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: role,
      });

      if (error) {
        console.error('Error checking role:', error);
        return false;
      }

      return data || false;
    },
    enabled: !!user,
  });
}

export function useAddRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (role: UserRoleType): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role,
        });

      // Ignore conflict errors (role already exists)
      if (error && !error.message.includes('duplicate key')) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['has-role'] });
    },
  });
}

// Helper to check if user is an agent (either by role or by claiming a profile)
export function useIsAgent() {
  const { user } = useAuth();
  const { data: hasAgentRole } = useHasRole('agent');

  return useQuery({
    queryKey: ['is-agent', user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      // Check if user has claimed any agent profile
      const { data, error } = await supabase
        .from('agents')
        .select('id')
        .eq('claimed_by', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking agent status:', error);
        return hasAgentRole || false;
      }

      return (data && data.length > 0) || hasAgentRole || false;
    },
    enabled: !!user,
  });
}
