-- Webhooks em tempo real para o agente do Nuno Robinson
-- Notifica via Telegram quando: ponto, férias, faltas, horas extra, folgas trabalhadas

-- Habilitar extensão pg_net (HTTP requests dentro do PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── Função de notificação ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_agent_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _nome       TEXT;
  _record     JSONB;
  _old_record JSONB;
  _payload    JSONB;
BEGIN
  -- Buscar nome do funcionário na tabela profiles
  SELECT COALESCE(p.nome, 'Funcionário')
    INTO _nome
    FROM public.profiles p
   WHERE p.id = NEW.user_id;

  _record     := to_jsonb(NEW) || jsonb_build_object('nome', _nome);
  _old_record := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;

  _payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'record',     _record,
    'old_record', _old_record
  );

  PERFORM extensions.http_post(
    url     := 'https://agent-production-29c8.up.railway.app/webhook/ponto',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer NR-Ponto-2026-xK9p'
    ),
    body    := _payload::text
  );

  RETURN NEW;
END;
$$;

-- ─── Trigger: ponta (clock in / clock out) ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_agent_ponto ON public.ponto;
CREATE TRIGGER trg_agent_ponto
  AFTER INSERT ON public.ponto
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_ponto();

-- ─── Trigger: férias ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_agent_ferias ON public.ferias;
CREATE TRIGGER trg_agent_ferias
  AFTER INSERT OR UPDATE ON public.ferias
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_ponto();

-- ─── Trigger: faltas ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_agent_faltas ON public.faltas;
CREATE TRIGGER trg_agent_faltas
  AFTER INSERT OR UPDATE ON public.faltas
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_ponto();

-- ─── Trigger: horas extra ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_agent_horas_extra ON public.horas_extra;
CREATE TRIGGER trg_agent_horas_extra
  AFTER INSERT OR UPDATE ON public.horas_extra
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_ponto();

-- ─── Trigger: folgas trabalhadas ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_agent_folgas ON public.folgas_trabalhadas;
CREATE TRIGGER trg_agent_folgas
  AFTER INSERT OR UPDATE ON public.folgas_trabalhadas
  FOR EACH ROW EXECUTE FUNCTION public.notify_agent_ponto();
