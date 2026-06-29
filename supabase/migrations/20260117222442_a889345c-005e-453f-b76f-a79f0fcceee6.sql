-- Create an enum for user roles
CREATE TYPE public.user_role AS ENUM ('renter', 'agent');

-- Create the user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS user_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::user_role[])
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS Policies
-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own roles (for initial signup tagging)
CREATE POLICY "Users can add their own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-tag agents when they claim a profile
CREATE OR REPLACE FUNCTION public.auto_tag_agent_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an agent claims a profile, add agent role if not exists
  IF NEW.claimed_by IS NOT NULL AND (OLD.claimed_by IS NULL OR OLD.claimed_by != NEW.claimed_by) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.claimed_by, 'agent')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agent_claimed
AFTER UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.auto_tag_agent_role();