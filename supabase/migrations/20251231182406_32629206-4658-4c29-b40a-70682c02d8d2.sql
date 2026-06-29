-- Drop the restrictive SELECT policy that only allows claimed agents
DROP POLICY IF EXISTS "Users can only view their claimed agent profile" ON public.agents;

-- Create a new policy that allows everyone to SELECT from agents
-- The agents_public view already filters out sensitive fields (phone, whatsapp)
CREATE POLICY "Anyone can view agents" 
ON public.agents 
FOR SELECT 
USING (true);

-- Keep the restrictive UPDATE policy (only claimed agents can update)
-- The DELETE denial policy remains in place