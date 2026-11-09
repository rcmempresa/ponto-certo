export const REMINDER_DAYS = [2, 7, 15, 30] as const;
export function madeiraToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Madeira', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function reminderDate(start: string, days: number): string {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
/** Send only the latest overdue milestone, not a burst of historical reminders. */
export function dueReminder(start: string, selected: number[], processed: number[], today: string): number | null {
  const due = selected.filter(day => !processed.includes(day) && reminderDate(start, day) <= today);
  return due.length ? Math.max(...due) : null;
}
