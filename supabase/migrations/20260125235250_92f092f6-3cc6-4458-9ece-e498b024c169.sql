-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create their own ratings" ON public.agent_ratings;

-- Create new INSERT policy that excludes agents
CREATE POLICY "Non-agent users can create ratings"
ON public.agent_ratings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND NOT public.has_role(auth.uid(), 'agent')
);

-- Also update the UPDATE policy to prevent agents from updating ratings
DROP POLICY IF EXISTS "Users can update their own ratings" ON public.agent_ratings;

CREATE POLICY "Non-agent users can update their ratings"
ON public.agent_ratings
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND NOT public.has_role(auth.uid(), 'agent')
);