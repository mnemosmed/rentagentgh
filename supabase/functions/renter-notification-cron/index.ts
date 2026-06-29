import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    const appUrl = (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com').replace(/\/+$/, '');

    if (!arkeselApiKey) {
      console.error('ARKESEL_API_KEY not configured');
      throw new Error('SMS service not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Starting renter notification cron job...');

    // Find all renters who have unread messages from agents
    // and haven't been notified in the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Get all conversations with their user_ids
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id, agent_id');

    if (convError) {
      console.error('Error fetching conversations:', convError);
      throw convError;
    }

    console.log(`Found ${conversations?.length || 0} conversations`);

    // Group conversations by user_id
    const userConversations = new Map<string, string[]>();
    const conversationAgents = new Map<string, string>();
    
    for (const conv of conversations || []) {
      if (!userConversations.has(conv.user_id)) {
        userConversations.set(conv.user_id, []);
      }
      userConversations.get(conv.user_id)!.push(conv.id);
      conversationAgents.set(conv.id, conv.agent_id);
    }

    const notificationsSent: string[] = [];
    const skipped: string[] = [];

    for (const [userId, convIds] of userConversations) {
      // Get user profile with phone number and last notification time
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, phone, last_sms_notified_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        console.log(`Skipping user ${userId}: profile not found`);
        skipped.push(userId);
        continue;
      }

      // Check if user was notified in last 4 hours
      if (profile.last_sms_notified_at && new Date(profile.last_sms_notified_at) > new Date(fourHoursAgo)) {
        console.log(`Skipping ${profile.display_name || userId}: notified recently`);
        skipped.push(profile.display_name || userId);
        continue;
      }

      // Check if user has a phone number
      if (!profile.phone) {
        console.log(`Skipping ${profile.display_name || userId}: no phone number`);
        skipped.push(profile.display_name || userId);
        continue;
      }

      // Get agent IDs for this user's conversations
      const agentIds = convIds.map(convId => conversationAgents.get(convId)).filter(Boolean) as string[];

      // Count unread messages from agents (messages where sender_id is an agent's claimed_by or the agent_id itself)
      // First get the claimed_by values for these agents
      const { data: agents } = await supabase
        .from('agents')
        .select('id, claimed_by')
        .in('id', agentIds);

      const agentSenderIds = new Set<string>();
      for (const agent of agents || []) {
        agentSenderIds.add(agent.id);
        if (agent.claimed_by) {
          agentSenderIds.add(agent.claimed_by);
        }
      }

      // Count unread messages from agents in user's conversations
      const { count: unreadCount, error: msgError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('is_read', false)
        .in('sender_id', Array.from(agentSenderIds));

      if (msgError) {
        console.error(`Error checking messages for ${profile.display_name || userId}:`, msgError);
        continue;
      }

      if (!unreadCount || unreadCount === 0) {
        console.log(`Skipping ${profile.display_name || userId}: no unread messages from agents`);
        skipped.push(profile.display_name || userId);
        continue;
      }

      console.log(`Renter ${profile.display_name || userId} has ${unreadCount} unread message(s) from agents`);

      // Format phone number for Ghana
      let formattedPhone = profile.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '233' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.slice(1);
      }
      if (!formattedPhone.startsWith('233')) {
        formattedPhone = '233' + formattedPhone;
      }

      // Send SMS reminder
      const messagesUrl = `${appUrl}/messages`;
      const renterName = profile.display_name || 'Hi';
      const smsMessage = `${renterName}, agents have responded to your rental inquiries on RentAgentGhana. You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}. View now: ${messagesUrl}`;

      console.log(`Sending reminder SMS to ${profile.display_name || userId}...`);

      const arkeselResponse = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
          'api-key': arkeselApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: 'RentAgent',
          message: smsMessage,
          recipients: [formattedPhone],
        }),
      });

      const arkeselData = await arkeselResponse.json();

      if (!arkeselResponse.ok || arkeselData.status !== 'success') {
        console.error(`Failed to send SMS to ${profile.display_name || userId}:`, arkeselData);
        continue;
      }

      console.log(`SMS sent successfully to ${profile.display_name || userId}`);

      // Update last_sms_notified_at
      await supabase
        .from('profiles')
        .update({ last_sms_notified_at: new Date().toISOString() })
        .eq('user_id', userId);

      notificationsSent.push(profile.display_name || userId);
    }

    console.log('Renter notification cron job complete:', {
      notificationsSent: notificationsSent.length,
      skipped: skipped.length,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Renter notification cron completed',
      notificationsSent,
      skipped,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in renter-notification-cron:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});