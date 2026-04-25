-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a simpler trigger function that handles the error
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with error handling
  BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'employee'::role_enum);
  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, do nothing
      RETURN NEW;
    WHEN OTHERS THEN
      -- Log the error but don't fail the signup
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
      RETURN NEW;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
