-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  referencia_id uuid,
  referencia_tipo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via triggers with security definer)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify admins when a new ferias request is created
CREATE OR REPLACE FUNCTION public.notify_admin_new_ferias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
  requester_name text;
BEGIN
  -- Get requester name
  SELECT nome INTO requester_name FROM public.profiles WHERE id = NEW.user_id;
  
  -- Notify all admins
  FOR admin_user IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      admin_user.user_id,
      'pedido_ferias',
      'Novo Pedido de Férias',
      COALESCE(requester_name, 'Colaborador') || ' submeteu um pedido de férias de ' || NEW.data_inicio || ' a ' || NEW.data_fim,
      NEW.id,
      'ferias'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to notify admins when a new falta request is created
CREATE OR REPLACE FUNCTION public.notify_admin_new_falta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
  requester_name text;
BEGIN
  -- Get requester name
  SELECT nome INTO requester_name FROM public.profiles WHERE id = NEW.user_id;
  
  -- Notify all admins
  FOR admin_user IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      admin_user.user_id,
      'pedido_falta',
      'Novo Pedido de Justificação de Falta',
      COALESCE(requester_name, 'Colaborador') || ' submeteu uma justificação de falta para ' || NEW.data,
      NEW.id,
      'faltas'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to notify user when their request status changes
CREATE OR REPLACE FUNCTION public.notify_user_ferias_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if status changed and is not 'pendente'
  IF OLD.status = 'pendente' AND NEW.status != 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Férias Aprovadas' ELSE 'Férias Rejeitadas' END,
      'O seu pedido de férias de ' || NEW.data_inicio || ' a ' || NEW.data_fim || ' foi ' || NEW.status,
      NEW.id,
      'ferias'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to notify user when their falta status changes
CREATE OR REPLACE FUNCTION public.notify_user_falta_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if status changed and is not 'pendente'
  IF OLD.status = 'pendente' AND NEW.status != 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Falta Justificada Aprovada' ELSE 'Falta Justificada Rejeitada' END,
      'A sua justificação de falta para ' || NEW.data || ' foi ' || NEW.status,
      NEW.id,
      'faltas'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_new_ferias_notify_admin
  AFTER INSERT ON public.ferias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_ferias();

CREATE TRIGGER on_new_falta_notify_admin
  AFTER INSERT ON public.faltas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_falta();

CREATE TRIGGER on_ferias_status_change
  AFTER UPDATE ON public.ferias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_ferias_status();

CREATE TRIGGER on_falta_status_change
  AFTER UPDATE ON public.faltas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_falta_status();