import { describe, it, expect } from 'vitest';
import { formatHours } from './formatHours';
describe('formatHours', () => {
  it('half hour', () => expect(formatHours(152.5)).toBe('152h 30m'));
  it('whole', () => expect(formatHours(8)).toBe('8h'));
  it('zero', () => expect(formatHours(0)).toBe('0h'));
  it('repeating decimal', () => expect(formatHours(5.833333333)).toBe('5h 50m'));
});
