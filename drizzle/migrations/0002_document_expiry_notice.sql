ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS aviso_dias integer NOT NULL DEFAULT 15;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS aviso_enviado_em timestamptz;
ALTER TABLE public.documentos ADD CONSTRAINT documentos_aviso_dias_range CHECK (aviso_dias BETWEEN 0 AND 365);

CREATE OR REPLACE FUNCTION public.reset_document_expiry_notice()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.validade IS DISTINCT FROM OLD.validade OR NEW.aviso_dias IS DISTINCT FROM OLD.aviso_dias THEN
    NEW.aviso_enviado_em := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER documentos_reset_expiry_notice
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.reset_document_expiry_notice();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;