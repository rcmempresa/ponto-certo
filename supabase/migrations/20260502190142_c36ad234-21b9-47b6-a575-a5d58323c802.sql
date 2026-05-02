CREATE TABLE public.folgas_trabalhadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  tipo_dia text NOT NULL DEFAULT 'feriado',
  tipo_periodo text NOT NULL DEFAULT 'dia_inteiro',
  horas numeric NOT NULL DEFAULT 8,
  motivo text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.folgas_trabalhadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folgas or admin can view all"
ON public.folgas_trabalhadas FOR SELECT
USING ((auth.uid() = user_id) OR is_admin());

CREATE POLICY "Users can create own folgas"
ON public.folgas_trabalhadas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending folgas"
ON public.folgas_trabalhadas FOR DELETE
USING ((auth.uid() = user_id) AND (status = 'pendente'));

CREATE POLICY "Admins can delete folgas"
ON public.folgas_trabalhadas FOR DELETE
USING (is_admin());

CREATE POLICY "Only admins can update folgas"
ON public.folgas_trabalhadas FOR UPDATE
USING (is_admin());

CREATE TRIGGER update_folgas_trabalhadas_updated_at
BEFORE UPDATE ON public.folgas_trabalhadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_admin_new_folga_trabalhada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user RECORD;
  requester_name text;
BEGIN
  SELECT nome INTO requester_name FROM public.profiles WHERE id = NEW.user_id;
  FOR admin_user IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      admin_user.user_id,
      'pedido_folga_trabalhada',
      'Nova Folga Trabalhada',
      COALESCE(requester_name, 'Colaborador') || ' registou ' || NEW.horas || 'h de folga trabalhada no dia ' || to_char(NEW.data, 'DD/MM/YYYY'),
      NEW.id,
      'folgas_trabalhadas'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_folga_trabalhada_insert
AFTER INSERT ON public.folgas_trabalhadas
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_folga_trabalhada();

CREATE OR REPLACE FUNCTION public.notify_user_folga_trabalhada_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status != 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Folga Trabalhada Aprovada' ELSE 'Folga Trabalhada Rejeitada' END,
      'O seu registo de folga trabalhada do dia ' || to_char(NEW.data, 'DD/MM/YYYY') || ' foi ' || NEW.status,
      NEW.id,
      'folgas_trabalhadas'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_folga_trabalhada_status
AFTER UPDATE ON public.folgas_trabalhadas
FOR EACH ROW EXECUTE FUNCTION public.notify_user_folga_trabalhada_status();