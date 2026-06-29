import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingState {
  [key: string]: {
    userId: string;
    userName?: string;
    isTyping: boolean;
    lastTyped: number;
  };
}

export function useTypingIndicator(conversationId: string, userId: string, userName?: string) {
  const [othersTyping, setOthersTyping] = useState<TypingState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  // Subscribe to presence channel
  useEffect(() => {
    if (!conversationId || !userId) return;

    const channelName = `typing:${conversationId}`;
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
        const typingUsers: TypingState = {};
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId && Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as unknown as { userId: string; userName?: string; isTyping: boolean; lastTyped: number };
            if (presence.isTyping) {
              typingUsers[key] = presence;
            }
          }
        });
        
        setOthersTyping(typingUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track initial presence (not typing)
          await channel.track({
            userId,
            userName,
            isTyping: false,
            lastTyped: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, userId, userName]);

  // Broadcast typing state
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!channelRef.current) return;

    // Throttle broadcasts to prevent flooding (max once per 500ms)
    const now = Date.now();
    if (isTyping && now - lastBroadcastRef.current < 500) return;
    lastBroadcastRef.current = now;

    try {
      await channelRef.current.track({
        userId,
        userName,
        isTyping,
        lastTyped: now,
      });
    } catch (error) {
      console.error('Error broadcasting typing state:', error);
    }

    // Clear typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await channelRef.current?.track({
            userId,
            userName,
            isTyping: false,
            lastTyped: Date.now(),
          });
        } catch (error) {
          console.error('Error clearing typing state:', error);
        }
      }, 3000);
    }
  }, [userId, userName]);

  // Get list of users currently typing
  const typingUsers = Object.values(othersTyping).filter(u => u.isTyping);
  const isOtherTyping = typingUsers.length > 0;
  const typingUserName = typingUsers[0]?.userName;

  return {
    isOtherTyping,
    typingUserName,
    setTyping,
  };
}
