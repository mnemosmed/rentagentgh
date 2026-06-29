import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum message content length
const MAX_MESSAGE_LENGTH = 5000;
// Maximum replies per minute per token
const MAX_REPLIES_PER_MINUTE = 10;

interface ReplyRequest {
  token: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
}

interface GetConversationRequest {
  token: string;
}

// Validate media URL - must be from our storage bucket
function isValidMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'akjenvsitwnrnqcyqvou.supabase.co' &&
           parsed.pathname.startsWith('/storage/');
  } catch {
    return false;
  }
}

// Generate signed URLs for media
async function getSignedMediaUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  publicUrl: string
): Promise<string> {
  // Extract the path from the public URL
  const urlPattern = /\/storage\/v1\/object\/public\/chat-media\/(.+)/;
  const match = publicUrl.match(urlPattern);
  
  if (!match) {
    return publicUrl; // Return original if not matching expected pattern
  }
  
  const filePath = match[1];
  
  const { data, error } = await supabaseClient.storage
    .from('chat-media')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (error || !data) {
    console.error('Failed to create signed URL:', error);
    return publicUrl; // Fall back to public URL
  }
  
  return data.signedUrl;
}

// Send SMS notification to renter when agent replies
async function sendRenterSmsNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  renterId: string,
  agentName: string
): Promise<void> {
  try {
    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    const appUrl = (Deno.env.get('APP_URL') || 'https://akjenvsitwnrnqcyqvou.lovableproject.com').replace(/\/+$/, '');

    if (!arkeselApiKey) {
      console.log('ARKESEL_API_KEY not configured, skipping renter SMS');
      return;
    }

    // Get renter's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('display_name, phone, last_sms_notified_at')
      .eq('user_id', renterId)
      .maybeSingle();

    if (profileError || !profile) {
      console.log('Renter profile not found, skipping SMS');
      return;
    }

    if (!profile.phone) {
      console.log('Renter has no phone number, skipping SMS');
      return;
    }

    // Rate limit: Check if renter was notified in last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    if (profile.last_sms_notified_at && new Date(profile.last_sms_notified_at) > new Date(fourHoursAgo)) {
      console.log('Renter was notified recently, skipping SMS');
      return;
    }

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

    const messagesUrl = `${appUrl}/messages`;
    const renterName = profile.display_name || 'Hi';
    const smsMessage = `${renterName}, ${agentName} has replied to your inquiry on RentAgentGhana. View the message: ${messagesUrl}`;

    console.log(`Sending SMS notification to renter: ${formattedPhone.slice(0, 5)}...`);

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
    console.log('Arkesel response for renter SMS:', arkeselData);

    if (arkeselResponse.ok && arkeselData.status === 'success') {
      // Update last_sms_notified_at
      await supabaseClient
        .from('profiles')
        .update({ last_sms_notified_at: new Date().toISOString() })
        .eq('user_id', renterId);
      console.log('Renter SMS sent successfully');
    }
  } catch (error) {
    console.error('Error sending renter SMS notification:', error);
    // Don't throw - this is a non-critical operation
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'get';

    if (action === 'get') {
      // GET conversation data
      const { token }: GetConversationRequest = await req.json();
      console.log('Getting conversation for token:', token?.slice(0, 10) + '...');

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from('agent_access_tokens')
        .select('*, conversations(*), agents(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error('Token validation failed:', tokenError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update last used timestamp
      await supabase
        .from('agent_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      // Get messages for the conversation
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', tokenData.conversation_id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      // Mark all unread messages from the user as read (agent is viewing them)
      const unreadMessageIds = (messages || [])
        .filter(m => !m.is_read && m.sender_id !== tokenData.agent_id && m.sender_id !== tokenData.agents.claimed_by)
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        console.log('Marking messages as read:', unreadMessageIds.length);
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessageIds);
      }

      // Get user profile for the conversation
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', tokenData.conversations.user_id)
        .maybeSingle();

      // Get user auth data as fallback for display name (from user_metadata)
      let displayName = userProfile?.display_name;
      if (!displayName) {
        const { data: authUser } = await supabase.auth.admin.getUserById(
          tokenData.conversations.user_id
        );
        displayName = authUser?.user?.user_metadata?.display_name || 
                      authUser?.user?.user_metadata?.first_name ||
                      null;
      }

      // Generate signed URLs for media in messages (since bucket is now private)
      const messagesWithSignedUrls = await Promise.all(
        (messages || []).map(async (msg) => {
          if (msg.media_url) {
            const signedUrl = await getSignedMediaUrl(supabase, msg.media_url);
            return { ...msg, media_url: signedUrl };
          }
          return msg;
        })
      );

      // SECURITY: Never expose email or phone to agents - only display name
      return new Response(JSON.stringify({
        success: true,
        conversation: tokenData.conversations,
        agent: tokenData.agents,
        messages: messagesWithSignedUrls,
        user: { display_name: displayName, email: null },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'reply') {
      // POST reply from agent
      const { token, content, mediaUrl, mediaType }: ReplyRequest = await req.json();
      console.log('Agent replying with token:', token?.slice(0, 10) + '...');

      if (!content && !mediaUrl) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Message content or media required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate content length
      if (content && content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate media URL if provided
      if (mediaUrl && !isValidMediaUrl(mediaUrl)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid media URL' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from('agent_access_tokens')
        .select('*, conversations(*), agents(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error('Token validation failed:', tokenError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limiting: check how many messages this token has sent in the last minute
      const senderId = tokenData.agents.claimed_by || tokenData.agent_id;
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const { data: recentMessages, error: rateError } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', tokenData.conversation_id)
        .eq('sender_id', senderId)
        .gte('created_at', oneMinuteAgo);

      if (!rateError && recentMessages && recentMessages.length >= MAX_REPLIES_PER_MINUTE) {
        console.log('Rate limit exceeded for token:', token?.slice(0, 10) + '...');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please wait before sending more messages.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert the message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: tokenData.conversation_id,
          sender_id: senderId,
          content: content || '',
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error inserting message:', messageError);
        throw messageError;
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', tokenData.conversation_id);

      // Update token last used
      await supabase
        .from('agent_access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      console.log('Message sent successfully:', message.id);

      // Send SMS notification to renter about agent reply
      await sendRenterSmsNotification(
        supabase,
        tokenData.conversations.user_id,
        tokenData.agents.display_name || 'An agent'
      );

      return new Response(JSON.stringify({
        success: true,
        message: message,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'send-contact') {
      // Agent sending their contact info to renter via SMS
      const { token }: GetConversationRequest = await req.json();
      console.log('Agent sending contact with token:', token?.slice(0, 10) + '...');

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from('agent_access_tokens')
        .select('*, conversations(*), agents(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error('Token validation failed:', tokenError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get agent's phone number
      const agentPhone = tokenData.agents.phone || tokenData.agents.whatsapp;
      if (!agentPhone) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No phone number configured for your profile. Please update your profile first.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get renter's profile with phone
      const { data: renterProfile, error: renterError } = await supabase
        .from('profiles')
        .select('display_name, phone')
        .eq('user_id', tokenData.conversations.user_id)
        .maybeSingle();

      if (renterError || !renterProfile) {
        console.error('Renter profile not found:', renterError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Could not find renter information' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!renterProfile.phone) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Renter does not have a phone number on file' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Format renter's phone number for Ghana
      let formattedRenterPhone = renterProfile.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      if (formattedRenterPhone.startsWith('0')) {
        formattedRenterPhone = '233' + formattedRenterPhone.slice(1);
      } else if (formattedRenterPhone.startsWith('+')) {
        formattedRenterPhone = formattedRenterPhone.slice(1);
      }
      if (!formattedRenterPhone.startsWith('233')) {
        formattedRenterPhone = '233' + formattedRenterPhone;
      }

      // Format agent's phone for display (show in readable format)
      let displayAgentPhone = agentPhone;
      if (displayAgentPhone.startsWith('233')) {
        displayAgentPhone = '0' + displayAgentPhone.slice(3);
      } else if (displayAgentPhone.startsWith('+233')) {
        displayAgentPhone = '0' + displayAgentPhone.slice(4);
      }

      const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
      if (!arkeselApiKey) {
        console.error('ARKESEL_API_KEY not configured');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'SMS service not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const agentName = tokenData.agents.display_name || 'Your agent';
      const renterName = renterProfile.display_name || 'Hi';
      
      const smsMessage = `${renterName}, ${agentName} from RentAgentGhana has shared their contact with you. You can reach them at: ${displayAgentPhone}`;

      console.log(`Sending agent contact SMS to renter: ${formattedRenterPhone.slice(0, 5)}...`);

      const arkeselResponse = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
          'api-key': arkeselApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: 'RentAgent',
          message: smsMessage,
          recipients: [formattedRenterPhone],
        }),
      });

      const arkeselData = await arkeselResponse.json();
      console.log('Arkesel response for contact sharing:', arkeselData);

      if (!arkeselResponse.ok || arkeselData.status !== 'success') {
        console.error('Arkesel error:', arkeselData);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to send SMS. Please try again.' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also add a message in the conversation for reference
      const senderId = tokenData.agents.claimed_by || tokenData.agent_id;
      await supabase
        .from('messages')
        .insert({
          conversation_id: tokenData.conversation_id,
          sender_id: senderId,
          content: `📞 I've sent my contact number to you via SMS. Feel free to call or message me directly!`,
        });

      console.log('Agent contact shared successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Your contact has been sent to the renter via SMS',
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
    console.error('Error in agent-reply:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
