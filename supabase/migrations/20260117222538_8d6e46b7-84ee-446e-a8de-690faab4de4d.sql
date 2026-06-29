-- Backfill existing claimed agents with agent role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT claimed_by, 'agent'::user_role
FROM public.agents
WHERE claimed_by IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;