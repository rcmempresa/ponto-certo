import { describe, it, expect } from 'vitest';
import { REMINDER_DAYS, reminderDate, dueReminder, madeiraToday } from '../../supabase/functions/_shared/task-rules/index';
describe('task reminders', () => {
  it('uses the calendar date in Madeira', () => expect(madeiraToday(new Date('2026-11-09T18:00:00Z'))).toBe('2026-11-09'));
  it.each([[2,'2026-11-09'],[7,'2026-11-14'],[15,'2026-11-22'],[30,'2026-12-07']])('reminds after %i days', (days, date) => {
    expect(reminderDate('2026-11-07', Number(days))).toBe(date);
  });
  it('offers exactly the requested intervals', () => expect(REMINDER_DAYS).toEqual([2,7,15,30]));
  it('does not remind before the milestone', () => expect(dueReminder('2026-11-07',[2],[],'2026-11-08')).toBeNull());
  it('does not resend a processed milestone', () => expect(dueReminder('2026-11-07',[2],[2],'2026-11-09')).toBeNull());
  it('only sends the latest missed milestone', () => expect(dueReminder('2026-11-07',[2,7,15,30],[],'2026-11-23')).toBe(15));
});
