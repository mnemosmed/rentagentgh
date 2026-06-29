-- 1. Block all direct access to phone_otp (server-side only via service role)
CREATE POLICY "No direct access to OTP" 
ON public.phone_otp 
FOR ALL 
USING (false);

-- 2. Block all direct access to agent_access_tokens (server-side only via service role)
CREATE POLICY "No direct access to tokens" 
ON public.agent_access_tokens 
FOR ALL 
USING (false);

-- 3. Create helper function to check if user is a claimed agent
CREATE OR REPLACE FUNCTION public.is_claimed_agent(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agents
    WHERE id = p_agent_id
      AND claimed_by = auth.uid()
  )
$$;

-- 4. Allow agents to view conversations directed to them
CREATE POLICY "Agents can view conversations directed to them"
ON public.conversations
FOR SELECT
USING (public.is_claimed_agent(agent_id));

-- 5. Allow agents to view messages in their conversations
CREATE POLICY "Agents can view messages in their conversations"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND public.is_claimed_agent(c.agent_id)
  )
);

-- 6. Allow agents to send messages in their conversations
CREATE POLICY "Agents can send messages in their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND public.is_claimed_agent(c.agent_id)
  )
);

-- 7. Allow agents to mark messages as read in their conversations
CREATE POLICY "Agents can mark messages as read"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND public.is_claimed_agent(c.agent_id)
  )
);

-- 8. Prevent deletion of agents (no one can delete)
CREATE POLICY "No one can delete agents"
ON public.agents
FOR DELETE
USING (false);