import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format phone number to standard format (233XXXXXXXXX without +)
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (formatted.startsWith('+233')) {
    formatted = formatted.slice(1); // Remove +, keep 233...
  } else if (formatted.startsWith('+')) {
    formatted = formatted.slice(1);
  } else if (formatted.startsWith('0')) {
    formatted = '233' + formatted.slice(1);
  } else if (!formatted.startsWith('233')) {
    formatted = '233' + formatted;
  }
  return formatted;
}

// Get all possible phone formats for matching
function getPhoneVariants(phone: string): string[] {
  const base = formatPhoneNumber(phone);
  const localNumber = base.startsWith('233') ? base.slice(3) : base;
  return [
    base,                    // 233XXXXXXXXX
    '+' + base,              // +233XXXXXXXXX
    '0' + localNumber,       // 0XXXXXXXXX (local format)
    localNumber,             // XXXXXXXXX (just digits)
  ];
}

// Generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via Arkesel SMS
async function sendOtpSms(phone: string, otpCode: string, message: string, arkeselApiKey: string) {
  const smsResponse = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'api-key': arkeselApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: 'RentAgent',
      message,
      recipients: [phone],
    }),
  });

  const smsData = await smsResponse.json();
  console.log('Arkesel response:', smsData);

  if (!smsResponse.ok || smsData.status !== 'success') {
    console.error('Arkesel error:', smsData);
    throw new Error('Failed to send SMS');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { action, agentId, phone, otp, updates, displayName, email, primaryArea, coveredAreas, tiktokHandle } = body;

    console.log(`Claim profile action: ${action}`);

    // ========== AGENT SIGN-IN (for already claimed profiles) ==========
    if (action === 'agent-signin') {
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: 'Phone number required' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);
      const phoneVariants = getPhoneVariants(phone);
      
      console.log('Looking for agent with phone variants:', phoneVariants);

      // Find agent by phone (try multiple formats)
      const { data: agentByPhone, error: agentError } = await supabase
        .from('agents')
        .select('id, display_name, phone, claimed_by')
        .in('phone', phoneVariants)
        .maybeSingle();

      if (agentError) {
        console.error('Error finding agent:', agentError);
        throw agentError;
      }

      // Fallback: some older/seeded agent records may have phone = NULL.
      // If a user profile exists for this phone, locate the claimed agent via claimed_by.
      let agent = agentByPhone;
      if (!agent) {
        const { data: profileByPhone, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, phone')
          .in('phone', phoneVariants)
          .maybeSingle();

        if (profileError) {
          console.error('Error finding profile by phone:', profileError);
          throw profileError;
        }

        if (profileByPhone?.user_id) {
          const { data: agentByClaim, error: agentByClaimError } = await supabase
            .from('agents')
            .select('id, display_name, phone, claimed_by')
            .eq('claimed_by', profileByPhone.user_id)
            .maybeSingle();

          if (agentByClaimError) {
            console.error('Error finding agent by claimed_by:', agentByClaimError);
            throw agentByClaimError;
          }

          agent = agentByClaim;

          // Heal data: if we found a claimed agent with no phone, set it now.
          if (agent?.id && !agent.phone) {
            const phoneToStore = '+' + formattedPhone;
            const { error: healError } = await supabase
              .from('agents')
              .update({ phone: phoneToStore })
              .eq('id', agent.id);

            if (healError) {
              console.error('Error healing agent phone:', healError);
            } else {
              agent = { ...agent, phone: phoneToStore };
            }
          }
        }
      }

      if (!agent) {
        return new Response(JSON.stringify({ success: false, error: 'No agent profile found with this phone number' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!agent.claimed_by) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'This profile has not been claimed yet. Please use the "Create Profile" tab to register, or claim your existing profile through your agent chat link.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limiting
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentAttempts } = await supabase
        .from('phone_otp')
        .select('created_at')
        .eq('phone', formattedPhone)
        .gte('created_at', fiveMinutesAgo);

      if (recentAttempts && recentAttempts.length >= 3) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Too many attempts. Please wait 5 minutes before trying again.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!arkeselApiKey) {
        throw new Error('SMS service not configured');
      }

      // Generate and store OTP
      const otpCode = generateOtp();
      
      await supabase.from('phone_otp').delete().eq('phone', formattedPhone);
      
      const { error: insertError } = await supabase
        .from('phone_otp')
        .insert({ phone: formattedPhone, otp_code: otpCode });

      if (insertError) throw insertError;

      await sendOtpSms(formattedPhone, otpCode, `Your RentAgentGhana sign-in code is: ${otpCode}. Valid for 5 minutes.`, arkeselApiKey);

      return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== VERIFY AGENT SIGN-IN ==========
    if (action === 'agent-verify-signin') {
      if (!phone || !otp) {
        return new Response(JSON.stringify({ success: false, error: 'Phone and OTP required' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);
      const phoneVariants = getPhoneVariants(phone);

      // Find agent by phone (try multiple formats)
      const { data: agent } = await supabase
        .from('agents')
        .select('id, display_name, claimed_by')
        .in('phone', phoneVariants)
        .maybeSingle();

      if (!agent?.claimed_by) {
        return new Response(JSON.stringify({ success: false, error: 'Agent not found or not claimed' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify OTP
      const { data: otpData } = await supabase
        .from('phone_otp')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('otp_code', otp)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!otpData) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired code' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark OTP as used and delete
      await supabase.from('phone_otp').delete().eq('id', otpData.id);

      // Get user by claimed_by
      const { data: userData } = await supabase.auth.admin.getUserById(agent.claimed_by);
      
      if (!userData?.user?.email) {
        throw new Error('User not found');
      }

      // Generate magic link
      const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
        options: {
          redirectTo: (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com') + '/agent-dashboard',
        },
      });

      if (tokenError) {
        console.error('Error generating token:', tokenError);
        throw tokenError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        token: tokenData?.properties?.hashed_token,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== CREATE AGENT PROFILE (send OTP) ==========
    if (action === 'create-agent-profile') {
      if (!displayName || !phone || !primaryArea) {
        return new Response(JSON.stringify({ success: false, error: 'Display name, phone, and primary area are required' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);
      const phoneVariants = getPhoneVariants(phone);

      // Check if phone already exists (handle multiple formats)
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .in('phone', phoneVariants)
        .maybeSingle();

      if (existingAgent) {
        return new Response(JSON.stringify({ success: false, error: 'An agent with this phone number already exists. Please sign in instead.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also block “create” if an account already exists for this phone (even if the agent record is missing phone).
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .in('phone', phoneVariants)
        .maybeSingle();

      if (existingProfile?.user_id) {
        return new Response(JSON.stringify({ success: false, error: 'An account with this phone already exists. Please sign in instead.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Rate limiting
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentAttempts } = await supabase
        .from('phone_otp')
        .select('created_at')
        .eq('phone', formattedPhone)
        .gte('created_at', fiveMinutesAgo);

      if (recentAttempts && recentAttempts.length >= 3) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Too many attempts. Please wait 5 minutes before trying again.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!arkeselApiKey) {
        throw new Error('SMS service not configured');
      }

      // Generate and store OTP
      const otpCode = generateOtp();
      
      await supabase.from('phone_otp').delete().eq('phone', formattedPhone);
      
      const { error: insertError } = await supabase
        .from('phone_otp')
        .insert({ phone: formattedPhone, otp_code: otpCode });

      if (insertError) throw insertError;

      await sendOtpSms(formattedPhone, otpCode, `Your RentAgentGhana verification code is: ${otpCode}. Valid for 5 minutes.`, arkeselApiKey);

      return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== VERIFY AND CREATE PROFILE ==========
    if (action === 'verify-create-profile') {
      if (!displayName || !phone || !primaryArea || !otp) {
        return new Response(JSON.stringify({ success: false, error: 'All required fields and OTP must be provided' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);

      // Verify OTP
      const { data: otpData } = await supabase
        .from('phone_otp')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('otp_code', otp)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!otpData) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired code' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check again if phone already exists (handle multiple formats)
      const phoneVariants = getPhoneVariants(phone);
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .in('phone', phoneVariants)
        .maybeSingle();

      if (existingAgent) {
        return new Response(JSON.stringify({ success: false, error: 'An agent with this phone number already exists' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create user
      const phoneEmail = `${formattedPhone}@phone.rentagentghana.com`;
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: phoneEmail,
        phone: '+' + formattedPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          display_name: displayName,
          is_agent: true,
        },
      });

      if (createUserError) {
        // User might already exist
        console.error('Error creating user:', createUserError);
        if (createUserError.message.includes('already')) {
          return new Response(JSON.stringify({ success: false, error: 'An account with this phone already exists. Please sign in.' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw createUserError;
      }

      const user = newUser.user;

      // Create agent profile
      const { data: newAgent, error: agentError } = await supabase
        .from('agents')
        .insert({
          display_name: displayName.trim(),
          phone: '+' + formattedPhone,
          primary_area: primaryArea.trim(),
          covered_areas: coveredAreas || [],
          tiktok_handle: tiktokHandle || '',
          tiktok_profile_url: tiktokHandle ? `https://tiktok.com/@${tiktokHandle.replace('@', '')}` : '',
          claimed_by: user.id,
          is_verified: false,
        })
        .select()
        .single();

      if (agentError) {
        console.error('Error creating agent:', agentError);
        // Clean up user if agent creation fails
        await supabase.auth.admin.deleteUser(user.id);
        throw agentError;
      }

      // Update profile with email if provided
      if (email) {
        await supabase
          .from('profiles')
          .update({ email })
          .eq('user_id', user.id);
      }

      // Delete used OTP
      await supabase.from('phone_otp').delete().eq('id', otpData.id);

      // Generate magic link
      const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: phoneEmail,
        options: {
          redirectTo: (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com') + '/agent-dashboard',
        },
      });

      if (tokenError) {
        console.error('Error generating token:', tokenError);
      }

      console.log(`New agent profile created: ${newAgent.id} for user ${user.id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        agentId: newAgent.id,
        token: tokenData?.properties?.hashed_token,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== EXISTING: SEND OTP FOR CLAIMING (requires agentId) ==========
    if (!agentId) {
      return new Response(JSON.stringify({ error: 'Agent ID required for this action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the agent record (using service key to access phone)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, display_name, phone, claimed_by')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('Agent not found:', agentError);
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: send-otp - Send OTP to agent's registered phone (no input needed)
    if (action === 'send-otp') {
      if (agent.claimed_by) {
        return new Response(JSON.stringify({ error: 'This profile has already been claimed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!agent.phone) {
        return new Response(JSON.stringify({ error: 'No phone number associated with this profile. Please contact support.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(agent.phone);

      // Rate limiting
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentAttempts } = await supabase
        .from('phone_otp')
        .select('created_at')
        .eq('phone', formattedPhone)
        .gte('created_at', fiveMinutesAgo);

      if (recentAttempts && recentAttempts.length >= 3) {
        return new Response(JSON.stringify({ 
          error: 'Too many attempts. Please wait 5 minutes before trying again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!arkeselApiKey) {
        throw new Error('SMS service not configured');
      }

      // Generate and store OTP
      const otpCode = generateOtp();
      
      await supabase.from('phone_otp').delete().eq('phone', formattedPhone);

      const { error: insertError } = await supabase
        .from('phone_otp')
        .insert({ phone: formattedPhone, otp_code: otpCode });

      if (insertError) throw insertError;

      await sendOtpSms(formattedPhone, otpCode, `Your RentAgentGhana verification code to claim your profile is: ${otpCode}. Valid for 5 minutes.`, arkeselApiKey);

      return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: verify-otp - Verify OTP and claim profile
    if (action === 'verify-otp') {
      if (agent.claimed_by) {
        return new Response(JSON.stringify({ error: 'This profile has already been claimed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!agent.phone) {
        return new Response(JSON.stringify({ error: 'No phone number associated with this profile' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!otp) {
        return new Response(JSON.stringify({ error: 'OTP required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(agent.phone);

      if (!/^\d{6}$/.test(otp)) {
        return new Response(JSON.stringify({ error: 'Invalid code format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: otpData, error: otpError } = await supabase
        .from('phone_otp')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('otp_code', otp)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError) throw otpError;

      if (!otpData) {
        return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('phone_otp').update({ verified: true }).eq('id', otpData.id);

      const phoneEmail = `${formattedPhone}@phone.rentagentghana.com`;
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      let user = existingUsers?.users?.find(
        u => u.phone === '+' + formattedPhone || u.email === phoneEmail
      );

      if (!user) {
        console.log('Creating new user for agent:', agent.display_name);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: phoneEmail,
          phone: '+' + formattedPhone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            display_name: agent.display_name,
            is_agent: true,
          },
        });

        if (createError) throw createError;
        user = newUser.user;
      }

      if (!user) throw new Error('Failed to create or find user');

      const { error: updateError } = await supabase
        .from('agents')
        .update({ claimed_by: user.id })
        .eq('id', agentId);

      if (updateError) throw updateError;

      await supabase.from('phone_otp').delete().eq('id', otpData.id);

      const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: phoneEmail,
        options: {
          redirectTo: (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com') + '/agent-dashboard',
        },
      });

      if (tokenError) console.error('Error generating token:', tokenError);

      console.log(`Profile ${agentId} claimed by user ${user.id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Profile claimed successfully',
        token: tokenData?.properties?.hashed_token,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: update-profile - Update agent profile (only for claimed agents)
    if (action === 'update-profile') {
      if (!agent.claimed_by) {
        return new Response(JSON.stringify({ error: 'Profile must be claimed before editing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the requester is the owner
      // Check Authorization header for logged-in users
      const authHeader = req.headers.get('Authorization');
      let callerUserId: string | null = null;
      
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (!userError && user) {
          callerUserId = user.id;
        }
      }

      // If we have a caller user ID, verify they own this profile
      if (callerUserId && callerUserId !== agent.claimed_by) {
        return new Response(JSON.stringify({ error: 'You can only edit your own profile' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!updates) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, any> = {};
      
      if (updates.display_name && typeof updates.display_name === 'string') {
        updateData.display_name = updates.display_name.trim();
      }
      
      if (updates.phone !== undefined) {
        updateData.phone = updates.phone ? '+' + formatPhoneNumber(updates.phone) : null;
      }
      
      if (Array.isArray(updates.covered_areas)) {
        updateData.covered_areas = updates.covered_areas.filter((a: any) => typeof a === 'string' && a.trim());
      }
      
      if (updates.primary_area && typeof updates.primary_area === 'string') {
        updateData.primary_area = updates.primary_area.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ error: 'No valid updates provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', agentId)
        .eq('claimed_by', agent.claimed_by);

      if (updateError) throw updateError;

      console.log(`Profile ${agentId} updated:`, updateData);

      return new Response(JSON.stringify({ success: true, message: 'Profile updated successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in claim-profile:', error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
