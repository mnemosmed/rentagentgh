import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  oderId: string;
  onlineSince: number;
}

interface OnlineState {
  [key: string]: OnlineUser;
}

export function useOnlineStatus(conversationId: string, userId: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channelName = `presence:${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: OnlineState = {};
        
        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as unknown as OnlineUser;
            users[key] = presence;
          }
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            oderId: userId,
            onlineSince: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    // Handle visibility change - track/untrack when tab is hidden/visible
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        await channel.untrack();
      } else {
        await channel.track({
          oderId: userId,
          onlineSince: Date.now(),
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  // Check if a specific user is online
  const isUserOnline = (checkUserId: string) => {
    return checkUserId in onlineUsers;
  };

  // Check if other party (not current user) is online
  const isOtherPartyOnline = Object.keys(onlineUsers).some(key => key !== userId);

  return {
    onlineUsers,
    isUserOnline,
    isOtherPartyOnline,
  };
}
