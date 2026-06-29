-- Create agent_ratings table
CREATE TABLE public.agent_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  responsiveness INTEGER NOT NULL CHECK (responsiveness >= 1 AND responsiveness <= 5),
  trustworthiness INTEGER NOT NULL CHECK (trustworthiness >= 1 AND trustworthiness <= 5),
  helpfulness INTEGER NOT NULL CHECK (helpfulness >= 1 AND helpfulness <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Each user can only rate an agent once
  UNIQUE (agent_id, user_id)
);

-- Add foreign key constraints
ALTER TABLE public.agent_ratings
  ADD CONSTRAINT agent_ratings_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.agent_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view ratings (for display on profiles)
CREATE POLICY "Anyone can view agent ratings"
ON public.agent_ratings
FOR SELECT
USING (true);

-- Users can create their own ratings
CREATE POLICY "Users can create their own ratings"
ON public.agent_ratings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
ON public.agent_ratings
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings"
ON public.agent_ratings
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_ratings_updated_at
BEFORE UPDATE ON public.agent_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for aggregated ratings per agent
CREATE OR REPLACE VIEW public.agent_rating_stats AS
SELECT 
  agent_id,
  COUNT(*)::INTEGER as total_ratings,
  ROUND(AVG(responsiveness)::NUMERIC, 1) as avg_responsiveness,
  ROUND(AVG(trustworthiness)::NUMERIC, 1) as avg_trustworthiness,
  ROUND(AVG(helpfulness)::NUMERIC, 1) as avg_helpfulness,
  ROUND(((AVG(responsiveness) + AVG(trustworthiness) + AVG(helpfulness)) / 3)::NUMERIC, 1) as overall_rating
FROM public.agent_ratings
GROUP BY agent_id;