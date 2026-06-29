-- Create table to store phone OTP codes
CREATE TABLE public.phone_otp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_otp ENABLE ROW LEVEL SECURITY;

-- Policy to allow the edge function to manage OTPs (using service role)
-- No public access needed as edge function uses service role key

-- Create index for faster lookups
CREATE INDEX idx_phone_otp_phone_code ON public.phone_otp(phone, otp_code);

-- Auto-delete expired OTPs (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.phone_otp WHERE expires_at < now();
  RETURN NEW;
END;
$$;

-- Trigger to clean up on each insert
CREATE TRIGGER cleanup_otp_trigger
AFTER INSERT ON public.phone_otp
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_otp();