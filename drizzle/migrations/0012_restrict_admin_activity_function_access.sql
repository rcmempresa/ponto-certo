REVOKE EXECUTE ON FUNCTION public.track_admin_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) TO service_role;