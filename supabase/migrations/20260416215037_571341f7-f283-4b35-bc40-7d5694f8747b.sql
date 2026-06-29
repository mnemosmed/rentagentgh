CREATE UNIQUE INDEX IF NOT EXISTS uq_user_feedback_user_id_unsubmitted
ON public.user_feedback(user_id)
WHERE submitted_at IS NULL AND user_id IS NOT NULL;