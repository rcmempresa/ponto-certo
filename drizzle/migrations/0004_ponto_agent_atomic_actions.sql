CREATE OR REPLACE FUNCTION public.agent_register_punch(p_user_id uuid, p_tipo public.ponto_tipo, p_localizacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_last public.ponto_tipo; v_row public.ponto;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado' USING ERRCODE = 'P0002'; END IF;
  SELECT tipo INTO v_last FROM public.ponto WHERE user_id = p_user_id AND status <> 'rejeitado' ORDER BY timestamp DESC, id DESC LIMIT 1;
  IF v_last = p_tipo THEN RAISE EXCEPTION 'O último registo já é do mesmo tipo' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.ponto(user_id,tipo,localizacao,status) VALUES (p_user_id,p_tipo,p_localizacao,'pendente') RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END; $$;
REVOKE ALL ON FUNCTION public.agent_register_punch(uuid,public.ponto_tipo,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_register_punch(uuid,public.ponto_tipo,text) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_decide_request(p_tipo text, p_id uuid, p_status text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_old text; v_request public.ferias; v_days numeric; v_name text; v_balance numeric;
BEGIN
  IF p_status NOT IN ('aprovado','rejeitado') OR p_tipo NOT IN ('ferias','faltas','horas_extra','folgas_trabalhadas') THEN
    RAISE EXCEPTION 'Tipo ou estado inválido' USING ERRCODE = '22023';
  END IF;
  IF p_tipo = 'ferias' THEN
    PERFORM pg_advisory_xact_lock(70681001);
    SELECT * INTO v_request FROM public.ferias WHERE id = p_id FOR UPDATE;
    v_user := v_request.user_id; v_old := v_request.status::text;
  ELSIF p_tipo = 'faltas' THEN
    SELECT user_id,status::text INTO v_user,v_old FROM public.faltas WHERE id = p_id FOR UPDATE;
  ELSIF p_tipo = 'horas_extra' THEN
    SELECT user_id,status INTO v_user,v_old FROM public.horas_extra WHERE id = p_id FOR UPDATE;
  ELSE
    SELECT user_id,status INTO v_user,v_old FROM public.folgas_trabalhadas WHERE id = p_id FOR UPDATE;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado' USING ERRCODE = 'P0002'; END IF;
  SELECT nome,saldo_ferias INTO v_name,v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_old = p_status THEN RETURN jsonb_build_object('name',v_name); END IF;
  IF p_tipo = 'ferias' THEN
    v_days := (v_request.data_fim - v_request.data_inicio) + 1;
    IF v_request.data_inicio = v_request.data_fim THEN
      IF v_request.tipo_inicio <> 'manha' OR v_request.tipo_fim <> 'tarde' THEN v_days := 0.5; END IF;
    ELSE
      IF v_request.tipo_inicio = 'tarde' THEN v_days := v_days - 0.5; END IF;
      IF v_request.tipo_fim = 'manha' THEN v_days := v_days - 0.5; END IF;
    END IF;
    IF p_status = 'aprovado' THEN
      IF EXISTS (SELECT 1 FROM public.ferias WHERE id <> p_id AND status = 'aprovado' AND data_inicio <= v_request.data_fim AND data_fim >= v_request.data_inicio) THEN
        RAISE EXCEPTION 'Existem férias aprovadas sobrepostas' USING ERRCODE = 'P0001';
      END IF;
      IF v_days <= 0 OR v_balance < v_days THEN RAISE EXCEPTION 'Saldo de férias insuficiente' USING ERRCODE = 'P0001'; END IF;
      UPDATE public.profiles SET saldo_ferias = saldo_ferias - v_days WHERE id = v_user;
    ELSIF v_old = 'aprovado' THEN
      UPDATE public.profiles SET saldo_ferias = saldo_ferias + v_days WHERE id = v_user;
    END IF;
    UPDATE public.ferias SET status = p_status::public.request_status WHERE id = p_id;
  ELSIF p_tipo = 'faltas' THEN
    UPDATE public.faltas SET status = p_status::public.request_status WHERE id = p_id;
  ELSIF p_tipo = 'horas_extra' THEN
    UPDATE public.horas_extra SET status = p_status WHERE id = p_id;
  ELSE
    UPDATE public.folgas_trabalhadas SET status = p_status WHERE id = p_id;
  END IF;
  IF nullif(trim(p_motivo),'') IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,tipo,titulo,mensagem,referencia_id,referencia_tipo)
    VALUES(v_user,CASE WHEN p_status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,'Motivo da decisão',p_motivo,p_id,p_tipo);
  END IF;
  RETURN jsonb_build_object('name',v_name);
END; $$;
REVOKE ALL ON FUNCTION public.agent_decide_request(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_decide_request(text,uuid,text,text) TO service_role;