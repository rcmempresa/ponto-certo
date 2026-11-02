import { describe, expect, it } from 'vitest';
import { dailySummary, dayBoundary, getAgentSecret, pairedHours, presence, teamPresence, validSecret } from '../../supabase/functions/ponto-empregado/rules';
import { requestSchema } from '../../supabase/functions/ponto-empregado/schema';

const punch = (tipo: 'entrada' | 'saida', timestamp: string) => ({ tipo, timestamp });
describe('ponto-empregado contract', () => {
  it('authenticates against AGENT_SECRET without falling back to PONTO_SECRET', async () => {
    const env: Record<string, string> = { AGENT_SECRET: 'new-test-only-value', PONTO_SECRET: 'old-test-only-value' };
    const secret = getAgentSecret(name => env[name]);
    expect(await validSecret('new-test-only-value', secret ?? '')).toBe(true);
    expect(await validSecret('old-test-only-value', secret ?? '')).toBe(false);
    expect(getAgentSecret(name => name === 'PONTO_SECRET' ? 'old-test-only-value' : undefined)).toBeUndefined();
  });
  it('returns every team member with user_id, name and their own daily presence', () => {
    const team = [{ id: 'employee-one', nome: 'Ana' }, { id: 'employee-two', nome: 'Rui' }];
    expect(teamPresence(team, [{ user_id: 'employee-one', tipo: 'entrada', timestamp: '2026-11-01T08:00:00Z' }])).toEqual([
      { user_id: 'employee-one', name: 'Ana', estado: 'dentro', ultima_entrada: '2026-11-01T08:00:00Z' },
      { user_id: 'employee-two', name: 'Rui', estado: 'sem_registo' },
    ]);
  });
  it('sums completed pairs as elapsed hours without payroll deductions', () => {
    expect(pairedHours([punch('entrada', '2026-11-01T08:00:00Z'), punch('saida', '2026-11-01T12:00:00Z'), punch('entrada', '2026-11-01T13:00:00Z'), punch('saida', '2026-11-01T18:30:00Z')])).toBe(9.5);
  });
  it('does not count an unmatched entry', () => {
    expect(pairedHours([punch('entrada', '2026-11-01T08:00:00Z')])).toBe(0);
  });
  it('groups pairs per day and returns total_horas', () => {
    const rows = [punch('entrada', '2026-11-01T08:00:00Z'), punch('saida', '2026-11-01T10:30:00Z'), punch('entrada', '2026-11-02T08:00:00Z'), punch('saida', '2026-11-02T09:00:00Z')];
    expect(dailySummary(rows, '2026-11-01', '2026-11-02')).toEqual({ por_dia: [{ data: '2026-11-01', horas: 2.5 }, { data: '2026-11-02', horas: 1 }], total_horas: 3.5 });
  });
  it('maps the last punch to the three presence states', () => {
    expect(presence([]).estado).toBe('sem_registo');
    expect(presence([punch('entrada', '2026-11-01T08:00:00Z')]).estado).toBe('dentro');
    expect(presence([punch('entrada', '2026-11-01T08:00:00Z'), punch('saida', '2026-11-01T09:00:00Z')]).estado).toBe('fora');
  });
  it('accepts only approved or rejected decision status', () => {
    const params = { tipo: 'ferias', id: 'd40a054e-113c-4f57-b5bd-8bb74f6d198f' };
    expect(requestSchema.safeParse({ action: 'aprovar_pedido', params: { ...params, status: 'pendente' } }).success).toBe(false);
    expect(requestSchema.safeParse({ action: 'aprovar_pedido', params: { ...params, status: 'aprovado' } }).success).toBe(true);
  });
  it('rejects invalid calendar dates and reversed ranges', () => {
    const user_id = 'd40a054e-113c-4f57-b5bd-8bb74f6d198f';
    expect(requestSchema.safeParse({ action: 'ver_ponto', params: { user_id, date: '2026-02-30' } }).success).toBe(false);
    expect(requestSchema.safeParse({ action: 'resumo_semana', params: { user_id, date_from: '2026-11-02', date_to: '2026-11-01' } }).success).toBe(false);
  });
  it('rejects unrecognised actions and table names', () => {
    expect(requestSchema.safeParse({ action: 'delete_all' }).success).toBe(false);
    expect(requestSchema.safeParse({ action: 'aprovar_pedido', params: { tipo: 'profiles', id: 'd40a054e-113c-4f57-b5bd-8bb74f6d198f', status: 'aprovado' } }).success).toBe(false);
  });
  it('uses Madeira midnight in summer and winter', () => {
    expect(dayBoundary('2026-07-01')).toBe('2026-06-30T23:00:00.000Z');
    expect(dayBoundary('2026-11-01')).toBe('2026-11-01T00:00:00.000Z');
  });
  it('requires a matching nonempty shared secret', async () => {
    expect(await validSecret(null, 'test-only-value')).toBe(false);
    expect(await validSecret('wrong-test-value', 'test-only-value')).toBe(false);
    expect(await validSecret('test-only-value', 'test-only-value')).toBe(true);
  });
});