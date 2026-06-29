-- Add last_sms_notified_at column to profiles table for renter notification tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_sms_notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;