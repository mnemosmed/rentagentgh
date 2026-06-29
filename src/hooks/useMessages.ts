import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithAgent extends Conversation {
  agent: {
    id: string;
    display_name: string;
    primary_area: string;
    claimed_by?: string | null;
  };
  last_message?: Message;
  unread_count: number;
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async (): Promise<ConversationWithAgent[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!conversations || conversations.length === 0) return [];

      // Fetch agent details for each conversation (using public view for RLS access)
      const agentIds = [...new Set(conversations.map(c => c.agent_id))];
      const { data: agents, error: agentsError } = await supabase
        .from('agents_public')
        .select('id, display_name, primary_area, claimed_by')
        .in('id', agentIds);

      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
      }

      // Create a map for faster lookup
      const agentMap = new Map(agents?.map(a => [a.id, a]) || []);

      // Fetch last message and unread count for each conversation
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Count unread messages not sent by the current user
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          const agent = agentMap.get(conv.agent_id);
          
          return {
            ...conv,
            agent: agent 
              ? { id: agent.id, display_name: agent.display_name || 'Agent', primary_area: agent.primary_area || '', claimed_by: agent.claimed_by }
              : { id: conv.agent_id, display_name: 'Agent', primary_area: '', claimed_by: null },
            last_message: messages?.[0] || undefined,
            unread_count: unreadCount || 0,
          };
        })
      );

      // Sort by last message time (most recent first), with unread conversations prioritized
      return conversationsWithDetails.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.updated_at;
        const bTime = b.last_message?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async (): Promise<ConversationWithAgent | null> => {
      if (!conversationId) return null;

      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;
      if (!conversation) return null;

      // Use agents_public view for RLS access
      const { data: agent, error: agentError } = await supabase
        .from('agents_public')
        .select('id, display_name, primary_area, claimed_by')
        .eq('id', conversation.agent_id)
        .maybeSingle();

      if (agentError) {
        console.error('Error fetching agent:', agentError);
      }

      return {
        ...conversation,
        agent: agent 
          ? { id: agent.id, display_name: agent.display_name || 'Agent', primary_area: agent.primary_area || '', claimed_by: agent.claimed_by }
          : { id: conversation.agent_id, display_name: 'Agent', primary_area: '', claimed_by: null },
        unread_count: 0,
      };
    },
    enabled: !!conversationId,
  });
}

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
  });

  // Real-time subscription for INSERT and UPDATE events
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
            if (!old) return [payload.new as Message];
            // Avoid duplicates
            if (old.some(m => m.id === (payload.new as Message).id)) return old;
            return [...old, payload.new as Message];
          });
          // Also update conversations list for last message
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
          // Update message (e.g., read status)
          queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
            if (!old) return old;
            return old.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m);
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

export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agentId: string): Promise<Conversation> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) return existing;

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          agent_id: agentId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkMessagesAsRead(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!conversationId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Mark all unread messages NOT sent by the user as read
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      // Update local cache to reflect read status
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
        if (!old) return old;
        return old.map(m => ({ ...m, is_read: true }));
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Maximum message content length (must match server-side validation)
const MAX_MESSAGE_LENGTH = 5000;

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      mediaFile 
    }: { 
      conversationId: string; 
      content: string; 
      mediaFile?: File;
    }): Promise<Message> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Client-side validation for message length
      if (content && content.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      }

      let media_url: string | null = null;
      let media_type: string | null = null;

      // Upload media if provided
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${conversationId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        // Use signed URL since bucket is now private
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('chat-media')
          .createSignedUrl(fileName, 3600); // 1 hour expiry

        if (signedUrlError || !signedUrlData) {
          throw new Error('Failed to generate media URL');
        }

        // Store the base path URL (without signature) in the database
        // The signature is ephemeral - we need to store the canonical URL
        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);
        
        media_url = urlData.publicUrl;
        
        // Determine media type
        if (mediaFile.type.startsWith('image/')) {
          media_type = 'image';
        } else if (mediaFile.type.startsWith('video/')) {
          media_type = 'video';
        } else {
          media_type = 'file';
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content || (mediaFile ? '' : ''),
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
      // Add message to cache immediately (realtime will dedupe if it arrives)
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
