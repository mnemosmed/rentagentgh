-- Add column to track when last SMS notification was sent to claimed agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_sms_notified_at TIMESTAMP WITH TIME ZONE;

-- Create an index for efficient querying of agents with unread messages
CREATE INDEX IF NOT EXISTS idx_agents_claimed_by ON public.agents(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_last_sms_notified ON public.agents(last_sms_notified_at);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;