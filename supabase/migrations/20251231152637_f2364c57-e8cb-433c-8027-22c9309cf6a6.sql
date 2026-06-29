-- Fix 2: Restrict agent data access to authenticated users only
-- This prevents anonymous scraping of agent contact information (phone, whatsapp)

-- Drop the public read policy
DROP POLICY IF EXISTS "Agents are viewable by everyone" ON public.agents;

-- Create new policy requiring authentication to view agents
CREATE POLICY "Authenticated users can view agents" 
ON public.agents 
FOR SELECT 
USING (auth.uid() IS NOT NULL);