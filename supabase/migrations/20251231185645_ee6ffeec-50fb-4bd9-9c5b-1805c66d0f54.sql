-- Update handle_new_user function to extract display_name from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, phone, display_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'first_name',
      NULL
    )
  );
  RETURN NEW;
END;
$$;