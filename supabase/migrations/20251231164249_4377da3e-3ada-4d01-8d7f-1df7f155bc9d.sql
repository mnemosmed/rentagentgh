-- Fix the security definer view issue by setting it to SECURITY INVOKER
ALTER VIEW public.agents_public SET (security_invoker = on);