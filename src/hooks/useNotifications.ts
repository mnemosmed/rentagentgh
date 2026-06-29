import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useNotifications() {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>('default');
  const isTabVisibleRef = useRef(true);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      permissionRef.current = permission;
      return permission === 'granted';
    }

    return false;
  }, []);

  // Show notification
  const showNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (permissionRef.current !== 'granted' || isTabVisibleRef.current) {
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'rag-message',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }, []);

  // Subscribe to new messages for the user
  useEffect(() => {
    if (!user) return;

    // Request permission on mount
    requestPermission();

    const channel = supabase
      .channel('notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as {
            sender_id: string;
            content: string;
            conversation_id: string;
          };

          // Don't notify for own messages
          if (newMessage.sender_id === user.id) return;

          // Check if this message is in one of the user's conversations
          const { data: conversation } = await supabase
            .from('conversations')
            .select('agent_id')
            .eq('id', newMessage.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!conversation) return;

          // Get agent name
          const { data: agent } = await supabase
            .from('agents_public' as 'agents')
            .select('display_name')
            .eq('id', conversation.agent_id)
            .maybeSingle();

          const agentName = (agent as { display_name: string } | null)?.display_name || 'An agent';
          const messagePreview = newMessage.content.length > 50
            ? newMessage.content.substring(0, 50) + '...'
            : newMessage.content;

          showNotification(
            `New message from ${agentName}`,
            messagePreview,
            () => {
              window.location.href = `/messages?conversation=${newMessage.conversation_id}`;
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, requestPermission, showNotification]);

  return { requestPermission };
}
