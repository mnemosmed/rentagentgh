import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RatingNotificationRequest {
  agentId: string;
  overallRating: number;
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
    const { agentId, overallRating }: RatingNotificationRequest = await req.json();

    console.log('Received rating notification request:', { agentId, overallRating });

    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    if (!arkeselApiKey) {
      console.error('ARKESEL_API_KEY not configured');
      throw new Error('SMS service not configured');
    }
    
    // Use service role for database operations (to access phone numbers)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('phone, whatsapp, display_name, claimed_by')
      .eq('id', agentId)
      .maybeSingle();

    if (agentError) {
      console.error('Error fetching agent:', agentError);
      throw new Error('Failed to fetch agent details');
    }

    if (!agent) {
      console.log('Agent not found');
      return new Response(JSON.stringify({ success: false, message: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentPhone = agent.phone || agent.whatsapp;

    if (!agentPhone) {
      console.log('No phone number for agent, skipping SMS');
      return new Response(JSON.stringify({ success: false, message: 'No phone number' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    console.log('Sending rating notification SMS to:', formattedPhone.slice(0, 5) + '...');

    const appUrl = (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com').replace(/\/+$/, '');
    
    // Format the overall rating (round to 1 decimal)
    const formattedRating = overallRating.toFixed(1);
    
    // Construct SMS message
    let smsMessage: string;
    const agentDisplayName = agent.display_name || 'Agent';
    
    if (agent.claimed_by) {
      // Claimed agent - direct to dashboard
      const profileUrl = `${appUrl}/agent-dashboard`;
      smsMessage = `Hi ${agentDisplayName}, a renter just rated you ${formattedRating}/5 stars on RentAgentGhana! View your profile: ${profileUrl}`;
    } else {
      // Unclaimed agent - direct to claim page
      const claimUrl = `${appUrl}/agent-auth`;
      smsMessage = `Hi ${agentDisplayName}, a renter just rated you ${formattedRating}/5 stars on RentAgentGhana! Claim your profile to see all reviews: ${claimUrl}`;
    }

    console.log('SMS message:', smsMessage);

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
      message: 'Rating notification SMS sent successfully',
      arkeselResponse: arkeselData 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notify-agent-rating:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
