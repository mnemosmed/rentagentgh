import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validate Ghana phone number format
function isValidGhanaPhone(phone: string): boolean {
  const formatted = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  
  if (formatted.startsWith('+233')) {
    return formatted.length === 13; // +233 + 9 digits
  } else if (formatted.startsWith('233')) {
    return formatted.length === 12; // 233 + 9 digits
  } else if (formatted.startsWith('0')) {
    return formatted.length === 10; // 0 + 9 digits
  } else if (/^[2-9]\d{8}$/.test(formatted)) {
    // Accept raw 9-digit numbers starting with 2-9 (e.g., 542569695)
    return true;
  }
  return false;
}

// Format phone number for Ghana
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (formatted.startsWith('+233')) {
    formatted = formatted.slice(1); // Remove + for Arkesel
  } else if (formatted.startsWith('0')) {
    formatted = '233' + formatted.slice(1);
  } else if (!formatted.startsWith('233')) {
    formatted = '233' + formatted;
  }
  return formatted;
}

// Validate OTP format (6 digits only)
function isValidOtpFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
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
    
    // Parse request body
    const body = await req.json();
    const action = body.action || 'send';

    if (action === 'send') {
      const phone = body.phone;
      const firstName = body.firstName?.trim() || '';
      const isSignUp = body.isSignUp === true;
      
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Phone number required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate phone number format
      if (!isValidGhanaPhone(phone)) {
        console.log('Invalid phone number format:', phone);
        return new Response(JSON.stringify({ 
          error: 'Invalid Ghana phone number format. Use format: 0XX XXX XXXX or +233 XX XXX XXXX' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For signup, firstName is required
      if (isSignUp && !firstName) {
        return new Response(JSON.stringify({ 
          error: 'First name is required for signup' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);
      console.log('Processing phone auth for:', formattedPhone, 'isSignUp:', isSignUp);

      // Rate limiting: Check recent OTP attempts (max 3 per 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentAttempts, error: rateError } = await supabase
        .from('phone_otp')
        .select('created_at')
        .eq('phone', formattedPhone)
        .gte('created_at', fiveMinutesAgo);

      if (rateError) {
        console.error('Error checking rate limit:', rateError);
      }

      if (recentAttempts && recentAttempts.length >= 3) {
        console.log('Rate limit exceeded for:', formattedPhone);
        return new Response(JSON.stringify({ 
          error: 'Too many attempts. Please wait 5 minutes before trying again.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user exists with this phone
      const phoneEmail = `${formattedPhone}@phone.rentagentghana.com`;
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        u => u.phone === '+' + formattedPhone || u.email === phoneEmail
      );

      if (isSignUp) {
        // For signup, user should NOT exist
        if (existingUser) {
          console.log('User already exists with this phone number');
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'An account already exists with this phone number. Please sign in instead.',
            userExists: true
          }), {
            status: 200, // Return 200 so client can handle gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // For sign-in, user should exist
        if (!existingUser) {
          console.log('No user found with this phone number');
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'No account found with this phone number. Please sign up first.',
            userNotFound: true
          }), {
            status: 200, // Return 200 so client can handle gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      console.log('Sending OTP to:', formattedPhone);

      // Generate OTP
      const otpCode = generateOtp();
      
      // Delete any existing OTPs for this phone
      await supabase
        .from('phone_otp')
        .delete()
        .eq('phone', formattedPhone);

      // Store OTP in database (include firstName for signup verification)
      const { error: insertError } = await supabase
        .from('phone_otp')
        .insert({
          phone: formattedPhone,
          otp_code: otpCode,
        });

      if (insertError) {
        console.error('Error storing OTP:', insertError);
        throw insertError;
      }

      // Send SMS via Arkesel
      if (!arkeselApiKey) {
        console.error('ARKESEL_API_KEY not configured');
        throw new Error('SMS service not configured');
      }

      const smsMessage = `Your RentAgentGhana verification code is: ${otpCode}. Valid for 5 minutes.`;

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

      if (!arkeselResponse.ok || arkeselData.status !== 'success') {
        console.error('Arkesel error:', arkeselData);
        throw new Error('Failed to send SMS');
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'verify') {
      const phone = body.phone;
      const otp = body.otp;
      const firstName = body.firstName?.trim() || '';
      const isSignUp = body.isSignUp === true;
      
      if (!phone || !otp) {
        return new Response(JSON.stringify({ error: 'Phone and OTP required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate phone format
      if (!isValidGhanaPhone(phone)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid phone number format' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate OTP format (6 digits)
      if (!isValidOtpFormat(otp)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid code format. Please enter 6 digits.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formattedPhone = formatPhoneNumber(phone);
      console.log('Verifying OTP for:', formattedPhone, 'isSignUp:', isSignUp);

      // Check OTP
      const { data: otpData, error: otpError } = await supabase
        .from('phone_otp')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('otp_code', otp)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError) {
        console.error('Error checking OTP:', otpError);
        throw otpError;
      }

      if (!otpData) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired code' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark OTP as verified
      await supabase
        .from('phone_otp')
        .update({ verified: true })
        .eq('id', otpData.id);

      const phoneEmail = `${formattedPhone}@phone.rentagentghana.com`;
      let user;

      if (isSignUp) {
        // Create new user
        console.log('Creating new user with phone:', formattedPhone);
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: phoneEmail,
          phone: '+' + formattedPhone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            display_name: firstName,
            first_name: firstName,
          },
        });

        if (createError) {
          console.error('Error creating user:', createError);
          
          // Check if user was created by race condition
          if (createError.message.includes('already') || createError.message.includes('exists')) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'An account with this phone already exists. Please sign in instead.' 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          throw createError;
        }

        user = newUser.user;
        console.log('User created:', user.id);
      } else {
        // Get existing user
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        user = existingUsers?.users?.find(
          u => u.phone === '+' + formattedPhone || u.email === phoneEmail
        );

        if (!user) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'User not found. Please sign up first.' 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const profilePhone = user.phone || `+${formattedPhone}`;
      const profileDisplayName = firstName || user.user_metadata?.display_name || user.user_metadata?.first_name || null;
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id, phone, display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileLookupError) {
        console.error('Error looking up profile during phone auth sync:', profileLookupError);
      } else if (existingProfile) {
        const profileUpdates: Record<string, string> = {};

        if (!existingProfile.phone && profilePhone) {
          profileUpdates.phone = profilePhone;
        }

        if (!existingProfile.display_name && profileDisplayName) {
          profileUpdates.display_name = profileDisplayName;
        }

        if (Object.keys(profileUpdates).length > 0) {
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('user_id', user.id);

          if (profileUpdateError) {
            console.error('Error updating profile during phone auth sync:', profileUpdateError);
          }
        }
      } else {
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            phone: profilePhone,
            display_name: profileDisplayName,
          });

        if (profileInsertError) {
          console.error('Error creating profile during phone auth sync:', profileInsertError);
        }
      }

      // Delete used OTP
      await supabase
        .from('phone_otp')
        .delete()
        .eq('id', otpData.id);

      // Generate magic link for sign in
      const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: phoneEmail,
        options: {
          redirectTo: Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com',
        },
      });

      if (tokenError) {
        console.error('Error generating token:', tokenError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: isSignUp ? 'Account created successfully' : 'Phone verified successfully',
        email: phoneEmail,
        token: tokenData?.properties?.hashed_token,
        actionLink: tokenData?.properties?.action_link,
      }), {
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
    console.error('Error in phone-auth:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
