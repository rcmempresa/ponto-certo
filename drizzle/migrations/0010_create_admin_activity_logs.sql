CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_nome text NOT NULL DEFAULT 'Administrador',
  actor_email text,
  acao text NOT NULL,
  entidade text NOT NULL,
  registo_id text,
  descricao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_activity_logs TO authenticated;
GRANT ALL ON public.admin_activity_logs TO service_role;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view activity logs"
ON public.admin_activity_logs FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX admin_activity_logs_created_at_idx ON public.admin_activity_logs (created_at DESC);
CREATE INDEX admin_activity_logs_actor_idx ON public.admin_activity_logs (actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.track_admin_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_data jsonb;
  v_old jsonb;
  v_record_id text;
  v_target_user uuid;
  v_target_name text;
  v_action text;
  v_entity text;
  v_entity_label text;
  v_description text;
  v_details jsonb := '{}'::jsonb;
  v_changed jsonb;
  v_old_status text;
  v_new_status text;
BEGIN
  IF v_actor IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT public.is_admin(v_actor)
     AND NOT (TG_TABLE_NAME = 'user_roles' AND TG_OP = 'DELETE' AND OLD.user_id = v_actor AND OLD.role = 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nome, email INTO v_actor_nome, v_actor_email FROM public.profiles WHERE id = v_actor;
  v_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_record_id := COALESCE(v_data->>'id', v_data->>'nome');

  v_entity := TG_TABLE_NAME;
  v_entity_label := CASE TG_TABLE_NAME
    WHEN 'ponto' THEN 'ponto'
    WHEN 'ferias' THEN 'férias'
    WHEN 'faltas' THEN 'falta'
    WHEN 'baixas_medicas' THEN 'baixa médica'
    WHEN 'horas_extra' THEN 'horas extra'
    WHEN 'folgas_trabalhadas' THEN 'folga trabalhada'
    WHEN 'profiles' THEN 'colaborador'
    WHEN 'user_roles' THEN 'permissão'
    WHEN 'documentos' THEN 'documento'
    WHEN 'documento_categorias' THEN 'categoria'
    WHEN 'documento_subcategorias' THEN 'subcategoria'
    WHEN 'documento_permissoes' THEN 'acesso a documento'
    ELSE TG_TABLE_NAME
  END;

  IF v_data ? 'user_id' AND (v_data->>'user_id') ~* '^[0-9a-f-]{36}$' THEN
    v_target_user := (v_data->>'user_id')::uuid;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_target_user := (v_data->>'id')::uuid;
  END IF;
  IF v_target_user IS NOT NULL THEN
    SELECT NULLIF(nome, ''), email INTO v_target_name, v_target_name FROM public.profiles WHERE id = v_target_user;
  END IF;
  v_target_name := COALESCE(v_target_name, NULLIF(v_data->>'titulo', ''), NULLIF(v_data->>'nome', ''));

  IF TG_OP = 'INSERT' THEN
    v_action := 'criou';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'eliminou';
  ELSE
    v_old_status := v_old->>'status';
    v_new_status := v_data->>'status';
    IF v_old_status IS DISTINCT FROM v_new_status AND v_new_status IN ('aprovado', 'rejeitado') THEN
      v_action := CASE v_new_status WHEN 'aprovado' THEN 'aprovou' ELSE 'rejeitou' END;
    ELSE
      v_action := 'editou';
    END IF;
  END IF;

  v_description := v_action || ' ' || v_entity_label || COALESCE(' de ' || v_target_name, '') || '.';

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_agg(key ORDER BY key) INTO v_changed
    FROM jsonb_object_keys(v_data) AS key
    WHERE v_data->key IS DISTINCT FROM v_old->key
      AND key NOT IN ('updated_at', 'aviso_enviado_em', 'lembretes_processados', 'conclusao_email_estado');
    v_details := jsonb_build_object('campos_alterados', COALESCE(v_changed, '[]'::jsonb));
  END IF;
  v_details := v_details || jsonb_strip_nulls(jsonb_build_object(
    'estado', v_data->>'status',
    'data', v_data->>'data',
    'data_inicio', v_data->>'data_inicio',
    'data_fim', v_data->>'data_fim',
    'categoria', v_data->>'categoria',
    'tipo', v_data->>'tipo'
  ));

  INSERT INTO public.admin_activity_logs (
    actor_id, actor_nome, actor_email, acao, entidade, registo_id, descricao, detalhes
  ) VALUES (
    v_actor, COALESCE(NULLIF(v_actor_nome, ''), v_actor_email, 'Administrador'), v_actor_email,
    v_action, v_entity, v_record_id, left(v_description, 500), v_details
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.track_admin_activity() FROM PUBLIC;

DO $do$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ponto', 'ferias', 'faltas', 'baixas_medicas', 'horas_extra', 'folgas_trabalhadas',
    'profiles', 'user_roles', 'documentos', 'documento_categorias',
    'documento_subcategorias', 'documento_permissoes'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER admin_activity_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.track_admin_activity()',
      table_name
    );
  END LOOP;
END;
$do$;

CREATE OR REPLACE FUNCTION public.registar_atividade_admin(
  p_acao text,
  p_entidade text,
  p_descricao text,
  p_registo_id text DEFAULT NULL,
  p_detalhes jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_id);
  v_nome text;
  v_email text;
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas administradores podem registar atividade' USING ERRCODE = '42501';
  END IF;
  IF p_acao NOT IN ('criou', 'concluiu', 'eliminou', 'exportou', 'visualizou') THEN
    RAISE EXCEPTION 'Ação de atividade inválida' USING ERRCODE = '22023';
  END IF;
  IF p_entidade IS NULL OR length(btrim(p_entidade)) NOT BETWEEN 1 AND 80
     OR p_descricao IS NULL OR length(btrim(p_descricao)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Dados de atividade inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT nome, email INTO v_nome, v_email FROM public.profiles WHERE id = v_actor;
  INSERT INTO public.admin_activity_logs (
    actor_id, actor_nome, actor_email, acao, entidade, registo_id, descricao, detalhes
  ) VALUES (
    v_actor, COALESCE(NULLIF(v_nome, ''), v_email, 'Administrador'), v_email,
    p_acao, btrim(p_entidade), left(p_registo_id, 100), btrim(p_descricao),
    CASE WHEN pg_column_size(COALESCE(p_detalhes, '{}'::jsonb)) <= 16384 THEN COALESCE(p_detalhes, '{}'::jsonb) ELSE '{}'::jsonb END
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registar_atividade_admin(text, text, text, text, jsonb, uuid) TO service_role;
