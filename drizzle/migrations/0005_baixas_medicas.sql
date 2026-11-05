CREATE TABLE public.baixas_medicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacoes text,
  comprovativo_url text,
  status public.request_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT baixas_periodo_valido CHECK (data_fim >= data_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baixas_medicas TO authenticated;
GRANT ALL ON public.baixas_medicas TO service_role;
ALTER TABLE public.baixas_medicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own baixas or admin" ON public.baixas_medicas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Create own baixas" ON public.baixas_medicas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pendente');
CREATE POLICY "Admins update baixas" ON public.baixas_medicas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Delete own pending baixas or admin" ON public.baixas_medicas FOR DELETE TO authenticated USING (public.is_admin() OR (auth.uid() = user_id AND status = 'pendente'));

CREATE TRIGGER update_baixas_updated_at BEFORE UPDATE ON public.baixas_medicas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_admin_new_baixa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a RECORD; n text;
BEGIN
  SELECT nome INTO n FROM public.profiles WHERE id = NEW.user_id;
  FOR a IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (a.user_id, 'pedido_baixa', 'Nova Baixa Médica',
      COALESCE(n, 'Colaborador') || ' submeteu uma baixa médica de ' || to_char(NEW.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(NEW.data_fim,'DD/MM/YYYY'),
      NEW.id, 'baixas_medicas');
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_new_baixa_notify_admin AFTER INSERT ON public.baixas_medicas FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_baixa();

CREATE OR REPLACE FUNCTION public.notify_user_baixa_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status <> 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Baixa Médica Aprovada' ELSE 'Baixa Médica Rejeitada' END,
      'A sua baixa médica de ' || to_char(NEW.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(NEW.data_fim,'DD/MM/YYYY') || ' foi ' || NEW.status,
      NEW.id, 'baixas_medicas');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_baixa_status_change AFTER UPDATE ON public.baixas_medicas FOR EACH ROW EXECUTE FUNCTION public.notify_user_baixa_status();