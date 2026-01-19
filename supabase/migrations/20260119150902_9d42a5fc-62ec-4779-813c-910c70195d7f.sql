-- Add status and manual flag to ponto table
ALTER TABLE public.ponto 
ADD COLUMN status text NOT NULL DEFAULT 'aprovado',
ADD COLUMN manual boolean NOT NULL DEFAULT false,
ADD COLUMN observacoes text;

-- Add constraint for status values
ALTER TABLE public.ponto 
ADD CONSTRAINT ponto_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado'));

-- Update existing records to be approved (they were automatic entries)
UPDATE public.ponto SET status = 'aprovado', manual = false WHERE status = 'aprovado';

-- Allow admins to update ponto status
CREATE POLICY "Admins can update ponto status" 
ON public.ponto 
FOR UPDATE 
USING (is_admin());

-- Create trigger function to notify admins of new manual ponto entries
CREATE OR REPLACE FUNCTION public.notify_admin_new_ponto_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user RECORD;
  requester_name text;
BEGIN
  -- Only notify for manual entries that are pending
  IF NEW.manual = true AND NEW.status = 'pendente' THEN
    -- Get requester name
    SELECT nome INTO requester_name FROM public.profiles WHERE id = NEW.user_id;
    
    -- Notify all admins
    FOR admin_user IN 
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
      VALUES (
        admin_user.user_id,
        'pedido_ponto',
        'Novo Registo Manual de Ponto',
        COALESCE(requester_name, 'Colaborador') || ' registou manualmente ' || NEW.tipo || ' às ' || to_char(NEW.timestamp, 'HH24:MI') || ' do dia ' || to_char(NEW.timestamp, 'DD/MM/YYYY'),
        NEW.id,
        'ponto'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new manual ponto entries
CREATE TRIGGER on_manual_ponto_created
AFTER INSERT ON public.ponto
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_ponto_manual();

-- Create trigger function to notify user of ponto status change
CREATE OR REPLACE FUNCTION public.notify_user_ponto_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify if status changed from pendente
  IF OLD.status = 'pendente' AND NEW.status != 'pendente' THEN
    INSERT INTO public.notifications (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'aprovado' THEN 'aprovacao' ELSE 'rejeicao' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Registo de Ponto Aprovado' ELSE 'Registo de Ponto Rejeitado' END,
      'O seu registo de ' || NEW.tipo || ' às ' || to_char(NEW.timestamp, 'HH24:MI') || ' do dia ' || to_char(NEW.timestamp, 'DD/MM/YYYY') || ' foi ' || NEW.status,
      NEW.id,
      'ponto'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for ponto status changes
CREATE TRIGGER on_ponto_status_change
AFTER UPDATE ON public.ponto
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_ponto_status();