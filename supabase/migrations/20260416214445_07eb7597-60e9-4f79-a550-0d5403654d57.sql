CREATE TABLE public.user_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID,
  phone TEXT NOT NULL,
  display_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  going_well TEXT,
  platform_helpful BOOLEAN,
  improvement TEXT,
  sms_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_published ON public.user_feedback(is_published) WHERE is_published = true;
CREATE INDEX idx_user_feedback_token ON public.user_feedback(token);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Public can view only published testimonials
CREATE POLICY "Anyone can view published testimonials"
ON public.user_feedback
FOR SELECT
USING (is_published = true);

-- Block all direct writes — only edge functions (service role) can write
CREATE POLICY "No direct inserts"
ON public.user_feedback
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct updates"
ON public.user_feedback
FOR UPDATE
USING (false);

CREATE POLICY "No direct deletes"
ON public.user_feedback
FOR DELETE
USING (false);

CREATE TRIGGER update_user_feedback_updated_at
BEFORE UPDATE ON public.user_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();