import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, rating, going_well, platform_helpful, improvement } = body;

    // Validation
    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 64) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Rating must be 1-5' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof platform_helpful !== 'boolean') {
      return new Response(JSON.stringify({ error: 'platform_helpful must be boolean' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const goingWellClean = (going_well || '').toString().trim().slice(0, 1000);
    const improvementClean = (improvement || '').toString().trim().slice(0, 1000);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing, error: fetchError } = await supabase
      .from('user_feedback')
      .select('id, submitted_at')
      .eq('token', token)
      .maybeSingle();

    if (fetchError || !existing) {
      return new Response(JSON.stringify({ error: 'Invalid feedback link' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existing.submitted_at) {
      return new Response(JSON.stringify({ error: 'Feedback already submitted' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('user_feedback')
      .update({
        rating,
        going_well: goingWellClean || null,
        platform_helpful,
        improvement: improvementClean || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-feedback error:', err);
    return new Response(JSON.stringify({ error: 'Failed to submit' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
