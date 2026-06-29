import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const apiKey = Deno.env.get('ARKESEL_API_KEY');
    const appUrl = (Deno.env.get('APP_URL') || 'https://rentagentghana.com').replace(/\/$/, '');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SMS not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find renters who started a conversation ≥7 days ago and haven't been sent feedback yet
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: convos, error: convError } = await supabase
      .from('conversations')
      .select('user_id, created_at')
      .lte('created_at', sevenDaysAgo);

    if (convError) throw convError;

    // Unique user IDs
    const userIds = Array.from(new Set((convos || []).map((c: any) => c.user_id)));

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No eligible users' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find users who already received feedback request
    const { data: existing } = await supabase
      .from('user_feedback')
      .select('user_id')
      .in('user_id', userIds);

    const alreadySent = new Set((existing || []).map((e: any) => e.user_id));
    const eligibleUserIds = userIds.filter(id => !alreadySent.has(id));

    if (eligibleUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'All already contacted' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, phone')
      .in('user_id', eligibleUserIds);

    let sent = 0;
    const errors: string[] = [];

    for (const profile of profiles || []) {
      let phone = profile.phone;
      // Fallback to auth.users phone
      if (!phone) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
        phone = authUser.user?.phone ? `+${authUser.user.phone}` : null;
      }
      if (!phone) continue;

      const token = crypto.randomUUID().replace(/-/g, '');
      const name = profile.display_name || 'there';

      // Insert feedback row
      const { error: insertError } = await supabase.from('user_feedback').insert({
        token,
        user_id: profile.user_id,
        phone,
        display_name: profile.display_name,
      });

      if (insertError) {
        errors.push(`${profile.user_id}: ${insertError.message}`);
        continue;
      }

      const link = `${appUrl}/feedback/${token}`;
      const smsBody = `Hi ${name}, how is your house hunt going? Share quick feedback (1 min) to help RentAgent improve: ${link}`;

      try {
        const smsRes = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify({
            sender: 'RentAgent',
            message: smsBody,
            recipients: [phone],
          }),
        });
        const smsData = await smsRes.json();
        if (smsRes.ok) {
          sent++;
        } else {
          errors.push(`SMS to ${phone}: ${JSON.stringify(smsData)}`);
        }
      } catch (e) {
        errors.push(`SMS to ${phone}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return new Response(JSON.stringify({ sent, eligible: eligibleUserIds.length, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('request-feedback-cron error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
