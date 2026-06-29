-- Create a public-facing view that excludes phone and whatsapp
CREATE OR REPLACE VIEW public.agents_public AS
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

-- Grant access to the view for authenticated users
GRANT SELECT ON public.agents_public TO authenticated;

-- Drop the existing policy that exposes all agent data
DROP POLICY IF EXISTS "Authenticated users can view agents" ON public.agents;

-- Create a new restrictive policy - only allow users to view their own claimed agent profile
CREATE POLICY "Users can only view their claimed agent profile"
ON public.agents
FOR SELECT
USING (auth.uid() = claimed_by);