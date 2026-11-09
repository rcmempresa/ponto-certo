import { it, expect } from 'vitest';
import { sickLeaveMonthDays } from './sickLeaveReport';
const leave = { user_id:'u', data_inicio:'2026-10-30', data_fim:'2026-11-03', status:'aprovado' };
it('includes medical leave dates inclusively within the selected month', () => expect(sickLeaveMonthDays([leave], 'u','2026-11')).toBe(3));
it('counts only approved leave for the employee', () => expect(sickLeaveMonthDays([leave,{...leave,user_id:'v'},{...leave,status:'pendente',data_fim:'2026-11-20'}], 'u','2026-11')).toBe(3));
it('does not double-count overlapping medical leave', () => expect(sickLeaveMonthDays([leave,{...leave,data_inicio:'2026-11-02',data_fim:'2026-11-05'}], 'u','2026-11')).toBe(5));
it('excludes leave outside the month', () => expect(sickLeaveMonthDays([leave], 'u','2026-12')).toBe(0));
