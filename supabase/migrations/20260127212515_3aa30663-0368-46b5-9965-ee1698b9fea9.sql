-- Create horas_extra table for overtime tracking
CREATE TABLE public.horas_extra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  minutos_extra INTEGER NOT NULL DEFAULT 0,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  tipo_periodo TEXT NOT NULL DEFAULT 'noturno' CHECK (tipo_periodo IN ('noturno', 'fim_de_semana')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.horas_extra ENABLE ROW LEVEL SECURITY;

-- Users can view their own overtime or admin can view all
CREATE POLICY "Users can view own horas_extra or admin can view all"
ON public.horas_extra
FOR SELECT
USING ((auth.uid() = user_id) OR is_admin());

-- Users can create their own overtime requests
CREATE POLICY "Users can create own horas_extra"
ON public.horas_extra
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can update overtime status
CREATE POLICY "Only admins can update horas_extra"
ON public.horas_extra
FOR UPDATE
USING (is_admin());

-- Users can delete their own pending overtime
CREATE POLICY "Users can delete own pending horas_extra"
ON public.horas_extra
FOR DELETE
USING ((auth.uid() = user_id) AND (status = 'pendente'));

-- Create trigger for updated_at
CREATE TRIGGER update_horas_extra_updated_at
BEFORE UPDATE ON public.horas_extra
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create notification function for new overtime requests
CREATE OR REPLACE FUNCTION public.notify_admin_new_horas_extra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      'pedido_horas_extra',
      'Novo Pedido de Horas Extra',
      COALESCE(requester_name, 'Colaborador') || ' registou ' || (NEW.minutos_extra / 60) || 'h ' || (NEW.minutos_extra % 60) || 'min de horas extra no dia ' || to_char(NEW.data, 'DD/MM/YYYY'),
      NEW.id,
      'horas_extra'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for admin notifications
CREATE TRIGGER on_horas_extra_created
AFTER INSERT ON public.horas_extra
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_horas_extra();

-- Create notification function for status updates
CREATE OR REPLACE FUNCTION public.notify_user_horas_extra_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify if status changed from pendente
  IF OLD.status = 'pendente' AND NEW.status != 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Horas Extra Aprovadas' ELSE 'Horas Extra Rejeitadas' END,
      'O seu pedido de horas extra do dia ' || to_char(NEW.data, 'DD/MM/YYYY') || ' foi ' || NEW.status,
      NEW.id,
      'horas_extra'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for user notifications on status change
CREATE TRIGGER on_horas_extra_status_changed
AFTER UPDATE ON public.horas_extra
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_horas_extra_status();