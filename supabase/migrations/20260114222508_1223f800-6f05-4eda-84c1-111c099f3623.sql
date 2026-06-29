-- Drop the security definer view and recreate with security_invoker
DROP VIEW IF EXISTS public.agent_rating_stats;

CREATE OR REPLACE VIEW public.agent_rating_stats 
WITH (security_invoker = true) AS
SELECT 
  agent_id,
  COUNT(*)::INTEGER as total_ratings,
  ROUND(AVG(responsiveness)::NUMERIC, 1) as avg_responsiveness,
  ROUND(AVG(trustworthiness)::NUMERIC, 1) as avg_trustworthiness,
  ROUND(AVG(helpfulness)::NUMERIC, 1) as avg_helpfulness,
  ROUND(((AVG(responsiveness) + AVG(trustworthiness) + AVG(helpfulness)) / 3)::NUMERIC, 1) as overall_rating
FROM public.agent_ratings
GROUP BY agent_id;