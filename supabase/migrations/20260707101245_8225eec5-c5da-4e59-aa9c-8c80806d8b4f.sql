
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_inventory_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_cocktail_margin() FROM public, anon, authenticated;
