-- Drop the foreign key constraint on messages.sender_id
-- This allows agents (who are not in auth.users) to send messages
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;