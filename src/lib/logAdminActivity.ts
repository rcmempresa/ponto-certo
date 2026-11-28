import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type ManualActivity = {
  acao: 'exportou' | 'visualizou';
  entidade: 'relatorios' | 'painel_colaborador';
  descricao: string;
  registo_id?: string;
  detalhes?: { [key: string]: Json | undefined };
};

export async function logAdminActivity(activity: ManualActivity) {
  try {
    const { error } = await supabase.rpc('registar_atividade_admin', {
      p_acao: activity.acao,
      p_entidade: activity.entidade,
      p_descricao: activity.descricao,
      p_registo_id: activity.registo_id ?? null,
      p_detalhes: activity.detalhes ?? {},
    });
    if (error) console.warn('Não foi possível registar a atividade administrativa.', error.message);
  } catch {
    // O histórico nunca deve impedir a ação principal do gerente.
  }
}
