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
    
    console.log('Starting agent notification cron job...');

    // Find all claimed agents who have unread messages
    // and haven't been notified in the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Get all claimed agents with their phone numbers
    const { data: claimedAgents, error: agentsError } = await supabase
      .from('agents')
      .select('id, display_name, phone, whatsapp, claimed_by, last_sms_notified_at')
      .not('claimed_by', 'is', null);

    if (agentsError) {
      console.error('Error fetching claimed agents:', agentsError);
      throw agentsError;
    }

    console.log(`Found ${claimedAgents?.length || 0} claimed agents`);

    const notificationsSent: string[] = [];
    const skipped: string[] = [];

    for (const agent of claimedAgents || []) {
      // Check if agent was notified in last 4 hours
      if (agent.last_sms_notified_at && new Date(agent.last_sms_notified_at) > new Date(fourHoursAgo)) {
        console.log(`Skipping ${agent.display_name}: notified recently`);
        skipped.push(agent.display_name);
        continue;
      }

      // Get the agent's phone number
      const agentPhone = agent.phone || agent.whatsapp;
      if (!agentPhone) {
        console.log(`Skipping ${agent.display_name}: no phone number`);
        skipped.push(agent.display_name);
        continue;
      }

      // Check if agent has unread messages in their conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('agent_id', agent.id);

      if (convError || !conversations?.length) {
        console.log(`Skipping ${agent.display_name}: no conversations`);
        skipped.push(agent.display_name);
        continue;
      }

      const conversationIds = conversations.map(c => c.id);

      // Count unread messages not sent by the agent (i.e., from renters)
      const { count: unreadCount, error: msgError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', agent.claimed_by!);

      if (msgError) {
        console.error(`Error checking messages for ${agent.display_name}:`, msgError);
        continue;
      }

      if (!unreadCount || unreadCount === 0) {
        console.log(`Skipping ${agent.display_name}: no unread messages`);
        skipped.push(agent.display_name);
        continue;
      }

      console.log(`Agent ${agent.display_name} has ${unreadCount} unread message(s)`);

      // Format phone number for Ghana
      let formattedPhone = agentPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '233' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.slice(1);
      }
      if (!formattedPhone.startsWith('233')) {
        formattedPhone = '233' + formattedPhone;
      }

      // Send SMS reminder
      const dashboardUrl = `${appUrl}/agent-auth`;
      const smsMessage = `Hi ${agent.display_name}, renters are trying to contact you on RentAgentGhana. You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}. Log in to respond: ${dashboardUrl}`;

      console.log(`Sending reminder SMS to ${agent.display_name}...`);

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
        console.error(`Failed to send SMS to ${agent.display_name}:`, arkeselData);
        continue;
      }

      console.log(`SMS sent successfully to ${agent.display_name}`);

      // Update last_sms_notified_at
      await supabase
        .from('agents')
        .update({ last_sms_notified_at: new Date().toISOString() })
        .eq('id', agent.id);

      notificationsSent.push(agent.display_name);
    }

    console.log('Cron job complete:', {
      notificationsSent: notificationsSent.length,
      skipped: skipped.length,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Agent notification cron completed',
      notificationsSent,
      skipped,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in agent-notification-cron:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
