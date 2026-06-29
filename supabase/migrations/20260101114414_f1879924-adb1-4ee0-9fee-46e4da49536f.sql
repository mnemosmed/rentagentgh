-- Allow authenticated users to read display_name from profiles for messaging purposes
-- This is needed so agents can see renter names in their inbox
CREATE POLICY "Authenticated users can view display_name for messaging" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);