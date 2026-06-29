import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Agent {
  id: string;
  display_name: string;
  tiktok_handle: string;
  tiktok_profile_url: string;
  covered_areas: string[];
  primary_area: string;
  short_bio: string | null;
  is_verified: boolean;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentWithRating extends Agent {
  overall_rating: number | null;
  total_ratings: number | null;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents-with-ratings'],
    queryFn: async (): Promise<AgentWithRating[]> => {
      // Fetch agents
      const { data: agents, error: agentsError } = await supabase
        .from('agents_public' as 'agents')
        .select('*');
      
      if (agentsError) throw agentsError;
      
      // Fetch rating stats
      const { data: ratingStats, error: ratingsError } = await supabase
        .from('agent_rating_stats')
        .select('agent_id, overall_rating, total_ratings');
      
      if (ratingsError) throw ratingsError;
      
      // Create a map for quick rating lookup
      const ratingsMap = new Map(
        ratingStats?.map(stat => [stat.agent_id, stat]) || []
      );
      
      // Merge agents with their ratings
      const agentsWithRatings: AgentWithRating[] = ((agents as unknown as Agent[]) || []).map(agent => ({
        ...agent,
        overall_rating: ratingsMap.get(agent.id)?.overall_rating ?? null,
        total_ratings: ratingsMap.get(agent.id)?.total_ratings ?? null,
      }));
      
      // Sort by rating (highest first), agents without ratings go to the end
      agentsWithRatings.sort((a, b) => {
        const ratingA = a.overall_rating ?? -1;
        const ratingB = b.overall_rating ?? -1;
        
        if (ratingB !== ratingA) {
          return ratingB - ratingA; // Higher ratings first
        }
        
        // If same rating, sort by number of ratings (more ratings = more trusted)
        const countA = a.total_ratings ?? 0;
        const countB = b.total_ratings ?? 0;
        
        if (countB !== countA) {
          return countB - countA;
        }
        
        // Finally, sort alphabetically
        return a.display_name.localeCompare(b.display_name);
      });
      
      return agentsWithRatings;
    },
  });
}

export function useAgentsByArea(area: string | null) {
  return useQuery({
    queryKey: ['agents', 'by-area', area],
    queryFn: async (): Promise<Agent[]> => {
      if (!area) return [];
      
      const { data, error } = await supabase
        .from('agents_public' as 'agents')
        .select('*')
        .contains('covered_areas', [area])
        .order('display_name');
      
      if (error) throw error;
      return (data as unknown as Agent[]) || [];
    },
    enabled: !!area,
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: async (): Promise<Agent | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('agents_public' as 'agents')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as Agent | null;
    },
    enabled: !!id,
  });
}

export function useAllAreas() {
  return useQuery({
    queryKey: ['areas'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('agents_public' as 'agents')
        .select('covered_areas');
      
      if (error) throw error;
      
      // Flatten and deduplicate all areas
      const typedData = data as unknown as { covered_areas: string[] }[];
      const allAreas = typedData?.flatMap(agent => agent.covered_areas) || [];
      const uniqueAreas = [...new Set(allAreas)].sort();
      return uniqueAreas;
    },
  });
}
