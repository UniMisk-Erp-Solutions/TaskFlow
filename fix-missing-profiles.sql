-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, email, full_name, role, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Unknown'),
  COALESCE(au.raw_user_meta_data->>'role', 'employee')::role_enum,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Show the result
SELECT * FROM public.profiles ORDER BY created_at DESC;
