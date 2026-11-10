// Pure helpers for the task actions of the ponto-empregado agent endpoint.

export const allowedReminderDays = [2, 7, 15, 30] as const;

// Reminder days are stored sorted and without duplicates so the cron sends each reminder once.
export function normalizeLembretes(dias: number[]): number[] {
  return [...new Set(dias)].sort((a, b) => a - b);
}

export const taskListSelect = 'id,titulo,descricao,data_inicio,responsavel_id,concluida_em,created_at';

export interface TaskRow {
  id: string;
  titulo: string;
  descricao: string;
  data_inicio: string;
  responsavel_id: string | null;
  concluida_em: string | null;
  created_at: string;
}

export function withResponsavelNome(row: TaskRow, names: Map<string, string>) {
  return { ...row, responsavel_nome: row.responsavel_id ? names.get(row.responsavel_id) ?? '' : '' };
}
