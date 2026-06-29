import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  conversationId: string;
  agentId: string;
  agentName: string;
  senderName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwtToken = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Validate the user's JWT token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwtToken);

    if (authError || !user) {
      console.log('Invalid token or user not found:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { conversationId, agentId, agentName, senderName }: SMSRequest = await req.json();

    console.log('Received SMS notification request:', { conversationId, agentId, agentName, senderName });

    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    if (!arkeselApiKey) {
      console.error('ARKESEL_API_KEY not configured');
      throw new Error('SMS service not configured');
    }
    
    // Use service role for database operations (to access phone numbers)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (convError || !conversation) {
      console.log('User does not own conversation or conversation not found');
      return new Response(JSON.stringify({ error: 'Unauthorized - conversation access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch agent details including claimed_by status
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('phone, whatsapp, claimed_by, last_sms_notified_at, display_name')
      .eq('id', agentId)
      .maybeSingle();

    if (agentError) {
      console.error('Error fetching agent:', agentError);
      throw new Error('Failed to fetch agent details');
    }

    const agentPhone = agent?.phone || agent?.whatsapp;

    if (!agentPhone) {
      console.log('No phone number for agent, skipping SMS');
      return new Response(JSON.stringify({ success: false, message: 'No phone number' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if agent is claimed
    const isClaimed = !!agent?.claimed_by;
    console.log('Agent is claimed:', isClaimed);

    // For CLAIMED agents: Check if SMS was sent in last 4 hours
    if (isClaimed) {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      if (agent.last_sms_notified_at && new Date(agent.last_sms_notified_at) > new Date(fourHoursAgo)) {
        console.log('Rate limit: Claimed agent was notified recently, skipping SMS');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Claimed agent already notified recently. Will be reminded in next cycle.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // For UNCLAIMED agents: Use existing rate limiting (1 minute per conversation)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentToken } = await supabase
        .from('agent_access_tokens')
        .select('last_used_at, created_at')
        .eq('conversation_id', conversationId)
        .eq('agent_id', agentId)
        .maybeSingle();

      if (recentToken) {
        const lastActivity = recentToken.last_used_at || recentToken.created_at;
        if (lastActivity && new Date(lastActivity) > new Date(oneMinuteAgo)) {
          console.log('Rate limit: SMS was recently sent for this conversation');
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'SMS notification already sent recently. Please wait before trying again.' 
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

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

    console.log('Sending SMS to:', formattedPhone.slice(0, 5) + '...');

    const appUrl = (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com').replace(/\/+$/, '');
    
    let smsMessage: string;

    if (isClaimed) {
      // For claimed agents: Generic message with dashboard login link
      const dashboardUrl = `${appUrl}/agent-auth`;
      smsMessage = `Hi ${agent.display_name || agentName}, renters are trying to contact you on RentAgentGhana. Log in to manage your conversations: ${dashboardUrl}`;
      
      // Update last_sms_notified_at for claimed agent
      await supabase
        .from('agents')
        .update({ last_sms_notified_at: new Date().toISOString() })
        .eq('id', agentId);
    } else {
      // For unclaimed agents: Specific message with token link
      // Generate/get access token
      const agentToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      
      const { data: existingToken } = await supabase
        .from('agent_access_tokens')
        .select('token')
        .eq('conversation_id', conversationId)
        .eq('agent_id', agentId)
        .maybeSingle();

      let accessToken = existingToken?.token;

      if (!accessToken) {
        const { data: newToken, error: tokenError } = await supabase
          .from('agent_access_tokens')
          .insert({
            conversation_id: conversationId,
            agent_id: agentId,
            token: agentToken,
          })
          .select('token')
          .single();

        if (tokenError) {
          console.error('Error creating access token:', tokenError);
          throw tokenError;
        }
        accessToken = newToken.token;
      } else {
        await supabase
          .from('agent_access_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('agent_id', agentId);
      }

      const conversationUrl = `${appUrl}/agent-chat?token=${accessToken}`;
      console.log('Generated conversation URL for unclaimed agent:', conversationUrl);
      console.log('Full SMS message for unclaimed agent:', `Hi ${agentName}, you have a new rental inquiry from ${senderName} on RentAgentGhana. Click to view and reply: ${conversationUrl}`);
      smsMessage = `Hi ${agentName}, you have a new rental inquiry from ${senderName} on RentAgentGhana. Click to view and reply: ${conversationUrl}`;
    }

    // Send SMS via Arkesel
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
    console.log('Arkesel response:', arkeselData);

    if (!arkeselResponse.ok) {
      console.error('Arkesel error:', arkeselData);
      throw new Error(`SMS send failed: ${JSON.stringify(arkeselData)}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'SMS sent successfully',
      arkeselResponse: arkeselData 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-sms-notification:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
