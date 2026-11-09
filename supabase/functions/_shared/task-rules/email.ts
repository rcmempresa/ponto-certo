import { sendTemplateEmail } from '../transactional-email-templates/send-email.ts';
export async function sendTaskEvent(task: {id:string;titulo:string;descricao:string;data_inicio:string;concluida_em:string|null}, days?: number) {
 const completed = days === undefined;
 return await sendTemplateEmail('task-event','geral@nrtechsolucion.pt', {
   templateData: {titulo:task.titulo,descricao:task.descricao,inicio:task.data_inicio.split('-').reverse().join('/'),dias:days,concluida:completed,
   conclusao: task.concluida_em ? new Date(task.concluida_em).toLocaleString('pt-PT',{timeZone:'Atlantic/Madeira'}) : ''},
   idempotencyKey: completed ? `task-completed-${task.id}` : `task-reminder-${task.id}-${task.data_inicio}-${days}`,
 });
}
