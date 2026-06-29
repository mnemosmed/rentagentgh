import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getAuthUserPhone(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    console.error('Failed to fetch auth user phone in share-contact:', error.message);
    return null;
  }

  return data.user?.phone ?? null;
}

async function getRenterContact(supabase: any, userId: string, fallbackName: string) {
  const { data: renterProfile, error } = await supabase
    .from('profiles')
    .select('display_name, phone')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch renter profile in share-contact:', error.message);
  }

  const fallbackPhone = renterProfile?.phone ? null : await getAuthUserPhone(supabase, userId);

  return {
    displayName: renterProfile?.display_name?.trim() || fallbackName,
    phone: renterProfile?.phone || fallbackPhone || null,
  };
}

function formatPhoneForSms(phone: string): string {
  let formattedPhone = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.slice(1);
  }

  if (!formattedPhone.startsWith('233')) {
    formattedPhone = '233' + formattedPhone;
  }

  return formattedPhone;
}

function formatPhoneForDisplay(phone: string): string {
  let displayPhone = phone.trim();

  if (displayPhone.startsWith('233')) {
    displayPhone = '0' + displayPhone.slice(3);
  } else if (displayPhone.startsWith('+233')) {
    displayPhone = '0' + displayPhone.slice(4);
  }

  return displayPhone;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth validation failed in share-contact:', userError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id, agent_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isRenter = conversation.user_id === userId;

    const { data: agentData } = await supabase
      .from('agents')
      .select('id, claimed_by, phone, whatsapp, display_name')
      .eq('id', conversation.agent_id)
      .single();

    const isAgent = agentData?.claimed_by === userId;

    if (!isRenter && !isAgent) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let senderPhone: string | null = null;
    let senderName = 'Someone';
    let recipientPhone: string | null = null;
    let recipientName = 'Hi';

    if (isAgent) {
      senderPhone = agentData?.phone || agentData?.whatsapp || null;
      senderName = agentData?.display_name || 'Your agent';

      if (!senderPhone) {
        return new Response(JSON.stringify({
          error: 'No phone number on your agent profile. Please update your profile first.'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const renterContact = await getRenterContact(supabase, conversation.user_id, 'Hi');
      recipientPhone = renterContact.phone;
      recipientName = renterContact.displayName;

      if (!recipientPhone) {
        return new Response(JSON.stringify({ error: 'Renter does not have a phone number on file' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const renterContact = await getRenterContact(supabase, userId, 'A renter');
      senderPhone = renterContact.phone;
      senderName = renterContact.displayName;

      if (!senderPhone) {
        return new Response(JSON.stringify({
          error: 'No phone number on your profile. Please update your profile first.'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      recipientPhone = agentData?.phone || agentData?.whatsapp || null;
      recipientName = agentData?.display_name || 'Agent';

      if (!recipientPhone) {
        return new Response(JSON.stringify({ error: 'Agent does not have a phone number on file' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const formattedRecipientPhone = formatPhoneForSms(recipientPhone);
    const displaySenderPhone = formatPhoneForDisplay(senderPhone);

    const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
    if (!arkeselApiKey) {
      return new Response(JSON.stringify({ error: 'SMS service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roleLabel = isAgent ? 'agent' : 'renter';
    const smsMessage = `${recipientName}, ${senderName} from RentAgentGhana has shared their contact with you. You can reach them at: ${displaySenderPhone}`;

    console.log(`Sending ${roleLabel} contact SMS to: ${formattedRecipientPhone.slice(0, 5)}...`);

    const arkeselResponse = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': arkeselApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'RentAgent',
        message: smsMessage,
        recipients: [formattedRecipientPhone],
      }),
    });

    const arkeselData = await arkeselResponse.json();
    console.log('Arkesel response:', arkeselData);

    if (!arkeselResponse.ok || arkeselData.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Failed to send SMS. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert reference message in conversation
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: `📞 I've shared my contact number with you via SMS. Feel free to call or message me directly!`,
      });

    return new Response(JSON.stringify({
      success: true,
      message: `Your contact has been sent via SMS`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in share-contact:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
