import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data inválida');
const noParams = z.object({}).strict().optional();
export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('registar_ponto'), params: z.object({ user_id: uuid, tipo: z.enum(['entrada', 'saida']), localizacao: z.string().trim().max(500).optional() }).strict() }).strict(),
  z.object({ action: z.literal('ver_ponto'), params: z.object({ user_id: uuid, date }).strict() }).strict(),
  z.object({ action: z.literal('presenca_equipa'), params: noParams }).strict(),
  z.object({ action: z.literal('resumo_semana'), params: z.object({ user_id: uuid, date_from: date, date_to: date }).strict() }).strict(),
  z.object({ action: z.literal('pedidos_pendentes'), params: noParams }).strict(),
  z.object({ action: z.literal('criar_ferias'), params: z.object({ user_id: uuid, data_inicio: date, data_fim: date }).strict() }).strict(),
  z.object({ action: z.literal('criar_falta'), params: z.object({ user_id: uuid, data: date, motivo: z.string().trim().min(1).max(500) }).strict() }).strict(),
  z.object({ action: z.literal('criar_horas_extra'), params: z.object({ user_id: uuid, data: date, minutos_extra: z.number().int().min(1).max(2147483647) }).strict() }).strict(),
  z.object({ action: z.literal('criar_folga_trabalhada'), params: z.object({ user_id: uuid, data: date, horas: z.number().finite().positive(), tipo_dia: z.enum(['feriado', 'folga']) }).strict() }).strict(),
  z.object({ action: z.literal('ver_saldo_ferias'), params: z.object({ user_id: uuid }).strict() }).strict(),
  z.object({ action: z.literal('meus_pedidos'), params: z.object({ user_id: uuid }).strict() }).strict(),
  z.object({ action: z.literal('aprovar_pedido'), params: z.object({ tipo: z.enum(['ferias', 'faltas', 'horas_extra', 'folgas_trabalhadas']), id: uuid, status: z.enum(['aprovado', 'rejeitado']), motivo: z.string().trim().max(500).optional() }).strict() }).strict(),
]).superRefine((value, ctx) => {
  if (value.action === 'resumo_semana' && value.params.date_from > value.params.date_to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date_from deve ser anterior ou igual a date_to' });
  }
  if (value.action === 'criar_ferias' && value.params.data_inicio > value.params.data_fim) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'data_inicio deve ser anterior ou igual a data_fim' });
  }
});

export type AgentRequest = z.infer<typeof requestSchema>;