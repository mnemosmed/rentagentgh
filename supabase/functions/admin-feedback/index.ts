import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_PHONE = '+233542569695';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin: by phone
    const userPhone = userData.user.phone ? `+${userData.user.phone}` : null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const isAdmin = userPhone === ADMIN_PHONE || profile?.phone === ADMIN_PHONE;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      // Aggregate stats across ALL feedback rows (sent + submitted)
      const { data: allRows, error: allErr } = await supabase
        .from('user_feedback')
        .select('rating, platform_helpful, submitted_at');
      if (allErr) throw allErr;

      const totalSent = allRows?.length || 0;
      const submitted = allRows?.filter(r => r.submitted_at) || [];
      const totalSubmissions = submitted.length;
      const ratings = submitted.map(r => r.rating).filter((r): r is number => typeof r === 'number');
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const helpfulAnswers = submitted.filter(r => r.platform_helpful !== null);
      const helpfulYes = helpfulAnswers.filter(r => r.platform_helpful === true).length;
      const helpfulPct = helpfulAnswers.length ? (helpfulYes / helpfulAnswers.length) * 100 : 0;
      const responseRate = totalSent ? (totalSubmissions / totalSent) * 100 : 0;

      const stats = {
        totalSent,
        totalSubmissions,
        avgRating: Number(avgRating.toFixed(2)),
        responseRate: Number(responseRate.toFixed(1)),
        helpfulPct: Number(helpfulPct.toFixed(1)),
      };

      return new Response(JSON.stringify({ feedback: data, stats }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const { id, action } = await req.json();
      if (!id || !['publish', 'hide', 'approve'].includes(action)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updates: Record<string, any> =
        action === 'publish' ? { is_approved: true, is_published: true }
        : action === 'hide' ? { is_published: false }
        : { is_approved: true };

      const { error } = await supabase.from('user_feedback').update(updates).eq('id', id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-feedback error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
