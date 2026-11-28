import { describe, expect, it } from 'vitest';
import { activityDetailLines, formatActivityDate, sanitizeActivitySearch } from './adminActivity';

describe('admin activity rules', () => {
  it('keeps names and email searches while removing PostgREST control characters', () => {
    expect(sanitizeActivitySearch('  Nuno,(teste)%@nrtechsolucion.pt  ')).toBe('Nuno teste @nrtechsolucion.pt');
    expect(sanitizeActivitySearch('x'.repeat(140))).toHaveLength(100);
  });

  it('shows changed fields and excludes empty details', () => {
    expect(activityDetailLines({ campos_alterados: ['status', 'motivo'], estado: 'aprovado', data: null })).toEqual([
      'Campos alterados: status, motivo',
      'Estado: aprovado',
    ]);
    expect(activityDetailLines(null)).toEqual([]);
    expect(activityDetailLines([])).toEqual([]);
  });

  it('formats activity timestamps in the Madeira timezone', () => {
    expect(formatActivityDate('2026-07-01T12:30:00.000Z')).toContain('01/07/2026');
    expect(formatActivityDate('2026-07-01T12:30:00.000Z')).toContain('13:30');
  });
});
