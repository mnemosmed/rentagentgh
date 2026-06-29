-- Fix 1: Remove the public SELECT policy on agent_access_tokens
-- Token validation happens server-side in edge functions using service role key
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.agent_access_tokens;

-- Fix 2: Remove the overly permissive INSERT policy on messages
-- Agent message insertion should only happen through edge functions using service role key
DROP POLICY IF EXISTS "Allow message insert for agents via token" ON public.messages;