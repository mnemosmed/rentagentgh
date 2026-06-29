import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, category, userEmail } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 1000 chars)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ARKESEL_API_KEY');
    if (!apiKey) {
      console.error('ARKESEL_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'SMS service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ownerPhone = '+233542569695';
    const categoryLabel = category || 'General';
    const from = userEmail || 'Anonymous';
    const smsBody = `RentAgent Feedback [${categoryLabel}] from ${from}: ${message.substring(0, 300)}`;

    console.log('Sending feedback SMS to owner:', ownerPhone);

    const smsResponse = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: 'RentAgent',
        message: smsBody,
        recipients: [ownerPhone],
      }),
    });

    const smsData = await smsResponse.json();
    console.log('Arkesel response:', JSON.stringify(smsData));

    if (!smsResponse.ok) {
      throw new Error(`SMS send failed: ${JSON.stringify(smsData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending feedback:', error);
    return new Response(JSON.stringify({ error: 'Failed to send feedback' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
