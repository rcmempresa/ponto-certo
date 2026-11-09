import { baixaDays } from './baixaRules';
interface Leave { user_id: string; data_inicio: string; data_fim: string; status: string }
/** Union of approved calendar days, clipped to the selected month. */
export function sickLeaveMonthDays(records: Leave[], userId: string, month: string): number {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const start = `${month}-01`, end = `${month}-${last}`;
  const days = new Set<string>();
  for (const leave of records) {
    if (leave.user_id !== userId || leave.status !== 'aprovado') continue;
    const a = leave.data_inicio > start ? leave.data_inicio : start;
    const b = leave.data_fim < end ? leave.data_fim : end;
    const count = baixaDays(a, b);
    if (!count) continue;
    const day = new Date(`${a}T12:00:00Z`);
    for (let i = 0; i < count; i++) { days.add(day.toISOString().slice(0, 10)); day.setUTCDate(day.getUTCDate() + 1); }
  }
  return days.size;
}
