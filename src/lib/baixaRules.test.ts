import { describe, it, expect } from 'vitest';
import { baixaDays } from './baixaRules';

describe('baixaDays', () => {
  it('counts both start and end day', () => expect(baixaDays('2026-11-02', '2026-11-06')).toBe(5));
  it('single day is 1', () => expect(baixaDays('2026-11-02', '2026-11-02')).toBe(1));
  it('rejects end before start', () => expect(baixaDays('2026-11-06', '2026-11-02')).toBeNull());
  it('crosses DST boundary correctly', () => expect(baixaDays('2026-10-24', '2026-10-26')).toBe(3));
});
