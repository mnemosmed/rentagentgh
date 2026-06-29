-- Drop the overly permissive SELECT policy that exposes phone/whatsapp
DROP POLICY IF EXISTS "Anyone can view agents" ON public.agents;

-- Recreate the agents_public view WITHOUT security_invoker so it bypasses RLS
-- This allows the view to be queried while the base table remains protected
DROP VIEW IF EXISTS public.agents_public;

CREATE VIEW public.agents_public AS
SELECT 
  id,
  display_name,
  tiktok_handle,
  tiktok_profile_url,
  covered_areas,
  primary_area,
  short_bio,
  is_verified,
  claimed_by,
  created_at,
  updated_at
FROM public.agents;

-- Note: phone and whatsapp columns are intentionally excluded

-- Add a SELECT policy for claimed agents to view their own full profile (including phone)
CREATE POLICY "Users can view their claimed agent profile" 
ON public.agents 
FOR SELECT 
USING (auth.uid() = claimed_by);