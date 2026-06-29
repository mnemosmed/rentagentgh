-- Create agent conversation access tokens table
CREATE TABLE public.agent_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.agent_access_tokens ENABLE ROW LEVEL SECURITY;

-- Public read policy for token validation (anyone with token can access)
CREATE POLICY "Anyone can validate tokens"
ON public.agent_access_tokens FOR SELECT
USING (true);

-- Add media_url column to messages for image/video attachments
ALTER TABLE public.messages ADD COLUMN media_url TEXT;
ALTER TABLE public.messages ADD COLUMN media_type TEXT;

-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

-- Storage policies for chat media
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow agents with token to insert messages (we'll handle auth in edge function)
CREATE POLICY "Allow message insert for agents via token"
ON public.messages FOR INSERT
WITH CHECK (true);

-- Create index on token for fast lookup
CREATE INDEX idx_agent_access_tokens_token ON public.agent_access_tokens(token);