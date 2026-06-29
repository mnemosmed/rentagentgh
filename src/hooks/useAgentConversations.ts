import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface AgentMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: string | null;
}

export interface AgentConversation {
  id: string;
  user_id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  renter: {
    display_name: string | null;
  };
  last_message?: AgentMessage;
  unread_count: number;
}

// Get the current user's agent profile
export function useAgentProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agent-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('claimed_by', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// Get all conversations for the agent
export function useAgentConversations() {
  const { user } = useAuth();
  const { data: agentProfile } = useAgentProfile();

  return useQuery({
    queryKey: ['agent-conversations', agentProfile?.id],
    queryFn: async (): Promise<AgentConversation[]> => {
      if (!agentProfile) return [];

      // Get all conversations for this agent
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentProfile.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!conversations?.length) return [];

      // Get renter profiles
      const userIds = [...new Set(conversations.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get last message and unread count for each conversation
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          // Last message
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Unread count (messages not sent by agent and not read)
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', agentProfile.id)
            .neq('sender_id', user?.id || '');

          const profile = profileMap.get(conv.user_id);
          
          // Get display name from profile with fallback
          const renterDisplayName = profile?.display_name || 'A renter';

          return {
            ...conv,
            renter: {
              display_name: renterDisplayName,
            },
            last_message: messages?.[0] || undefined,
            unread_count: count || 0,
          };
        })
      );

      return conversationsWithDetails;
    },
    enabled: !!agentProfile?.id,
  });
}

// Get messages for a specific conversation (agent view)
export function useAgentMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: agentProfile } = useAgentProfile();

  const query = useQuery({
    queryKey: ['agent-messages', conversationId],
    queryFn: async (): Promise<AgentMessage[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId && !!agentProfile,
  });

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`agent-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<AgentMessage[]>(['agent-messages', conversationId], (old) => {
            if (!old) return [payload.new as AgentMessage];
            if (old.some(m => m.id === (payload.new as AgentMessage).id)) return old;
            return [...old, payload.new as AgentMessage];
          });
          queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<AgentMessage[]>(['agent-messages', conversationId], (old) => {
            if (!old) return old;
            return old.map(m => m.id === (payload.new as AgentMessage).id ? payload.new as AgentMessage : m);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

// Send message as agent
export function useAgentSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      mediaFile 
    }: { 
      conversationId: string; 
      content: string; 
      mediaFile?: File;
    }): Promise<AgentMessage> => {
      if (!user) throw new Error('Not authenticated');

      let media_url: string | null = null;
      let media_type: string | null = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `agent-uploads/${user.id}/${conversationId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);
        
        media_url = urlData.publicUrl;
        media_type = mediaFile.type.startsWith('image/') ? 'image' : 
                     mediaFile.type.startsWith('video/') ? 'video' : 'file';
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content || '',
          media_url,
          media_type,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    },
    onSuccess: (newMessage, { conversationId }) => {
      queryClient.setQueryData<AgentMessage[]>(['agent-messages', conversationId], (old) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });
}

// Mark messages as read (agent side)
export function useAgentMarkAsRead(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!conversationId || !user) return;

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<AgentMessage[]>(['agent-messages', conversationId], (old) => {
        if (!old) return old;
        return old.map(m => ({ ...m, is_read: true }));
      });
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });
}
