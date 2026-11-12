import type { AgentRequest } from './schema.ts';

export const requestTables = ['ferias', 'faltas', 'horas_extra', 'folgas_trabalhadas'] as const;
export const recentDays = 30;
export function recentRequestCutoff(now = new Date()): string {
  return new Date(now.getTime() - recentDays * 86400000).toISOString();
}

// Duration-only submissions never invent clock times or observations.
export function requestInsert(input: AgentRequest) {
  switch (input.action) {
    case 'submeter_baixa':
      return { table: 'baixas_medicas', values: { ...input.params, status: 'pendente' }, select: 'id,data_inicio,data_fim' } as const;
    case 'criar_ferias':
      return { table: 'ferias', values: { ...input.params, status: 'pendente' }, select: 'id,data_inicio,data_fim' } as const;
    case 'criar_falta':
      return { table: 'faltas', values: { ...input.params, status: 'pendente' }, select: 'id,data,motivo' } as const;
    case 'criar_horas_extra': {
      const day = new Date(`${input.params.data}T12:00:00Z`).getUTCDay();
      return { table: 'horas_extra', values: { ...input.params, status: 'pendente', hora_inicio: null, hora_fim: null, tipo_periodo: day === 0 || day === 6 ? 'fim_de_semana' : 'noturno' }, select: 'id,data,minutos_extra' } as const;
    }
    case 'criar_folga_trabalhada':
      return { table: 'folgas_trabalhadas', values: { ...input.params, status: 'pendente' }, select: 'id,data,horas' } as const;
    default:
      return undefined;
  }
}