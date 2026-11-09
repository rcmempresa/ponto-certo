export const MANAGER_EMAIL = 'geral@nrtechsolucion.pt';
export function isTaskManager(email: string | undefined, admin: boolean): boolean {
 return admin && email?.toLowerCase() === MANAGER_EMAIL;
}
export function canCompleteTask(userId: string, manager: boolean, assignee: string | null): boolean {
 return manager || assignee === userId;
}
