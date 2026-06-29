-- Fix STORAGE_EXPOSURE: Make chat-media bucket private with proper policies

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

-- Drop the public SELECT policy if it exists
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;

-- Create policy for authenticated users to view their own conversation media
CREATE POLICY "Users can view their conversation media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Files uploaded by the user (path starts with user's ID)
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Or user is part of the conversation (check via conversation ownership)
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.user_id = auth.uid()
      AND (storage.foldername(name))[2] = c.id::text
    )
  )
);

-- Fix DEFINER_OR_RPC_BYPASS: Add limits to cleanup function to prevent expensive operations
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only delete a limited number of expired OTPs to prevent expensive operations
  -- Also only delete OTPs that are at least 1 hour expired to avoid race conditions
  DELETE FROM public.phone_otp 
  WHERE id IN (
    SELECT id FROM public.phone_otp 
    WHERE expires_at < now() - interval '1 hour'
    LIMIT 50
  );
  RETURN NEW;
END;
$$;

-- Fix INPUT_VALIDATION: Add message content length constraint using a trigger
-- (Using trigger instead of CHECK constraint for better flexibility)
CREATE OR REPLACE FUNCTION public.validate_message_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Validate content length (max 5000 characters)
  IF NEW.content IS NOT NULL AND length(NEW.content) > 5000 THEN
    RAISE EXCEPTION 'Message content too long (max 5000 characters)';
  END IF;
  
  -- Validate media_url if present - must be from our storage bucket
  IF NEW.media_url IS NOT NULL THEN
    IF NEW.media_url NOT LIKE 'https://akjenvsitwnrnqcyqvou.supabase.co/storage/%' THEN
      RAISE EXCEPTION 'Invalid media URL';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for message validation
DROP TRIGGER IF EXISTS validate_message_content_trigger ON public.messages;
CREATE TRIGGER validate_message_content_trigger
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_content();