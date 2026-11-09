import { it, expect } from 'vitest';
import { isTaskManager, canCompleteTask } from '../../supabase/functions/_shared/task-rules/permissions';
it('only Nuno manager can create tasks',()=>{expect(isTaskManager('geral@nrtechsolucion.pt',true)).toBe(true);expect(isTaskManager('other@example.com',true)).toBe(false);expect(isTaskManager('geral@nrtechsolucion.pt',false)).toBe(false);});
it('assigned employee can complete but another employee cannot',()=>{expect(canCompleteTask('worker',false,'worker')).toBe(true);expect(canCompleteTask('other',false,'worker')).toBe(false);});
it('manager can complete assigned tasks',()=>expect(canCompleteTask('manager',true,'worker')).toBe(true));
