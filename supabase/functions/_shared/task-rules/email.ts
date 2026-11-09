import { sendTemplateEmail } from '../transactional-email-templates/send-email.ts';
import { MANAGER_EMAIL } from './permissions.ts';
export async function sendTaskEvent(task: {id:string;titulo:string;descricao:string;data_inicio:string;concluida_em:string|null}, employeeEmail: string | null, days?: number) {
 const completed = days === undefined;
 const templateData = {titulo:task.titulo,descricao:task.descricao,inicio:task.data_inicio.split('-').reverse().join('/'),dias:days,concluida:completed,
   conclusao: task.concluida_em ? new Date(task.concluida_em).toLocaleString('pt-PT',{timeZone:'Atlantic/Madeira'}) : ''};
 const eventKey = completed ? `task-completed-${task.id}` : `task-reminder-${task.id}-${task.data_inicio}-${days}`;
 // Independent expected recipients for this specific task; never a mailing list.
 let failed = false;
 let sent = false;
 try {
  const result = await sendTemplateEmail('task-event', MANAGER_EMAIL, {templateData, idempotencyKey:`${eventKey}-manager`});
  sent = result.sent;
 } catch { failed = true; }
 if (employeeEmail && employeeEmail.toLowerCase() !== MANAGER_EMAIL) {
  try {
   const result = await sendTemplateEmail('task-event', employeeEmail, {templateData:{...templateData,funcionario:true},idempotencyKey:`${eventKey}-employee`});
   sent = sent || result.sent;
  } catch { failed = true; }
 }
 if (failed) throw new Error('Task email unavailable');
 return sent ? {sent:true as const} : {sent:false as const,reason:'recipient_suppressed' as const};
}
