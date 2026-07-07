INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users WHERE email = 'joaofcgs@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;