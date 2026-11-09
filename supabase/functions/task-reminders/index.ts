import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { dueReminder, madeiraToday } from '../_shared/task-rules/index.ts';
import { sendTaskEvent } from '../_shared/task-rules/email.ts';
const reply = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 const denied=authenticateCronRequest(req);
 if(denied) return new Response(denied.body,{status:denied.status,headers:corsHeaders});
 if(req.method!=='POST') return reply({error:'Método não permitido'},405);
 try {
 const body=await req.json();
 if(!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return reply({error:'Corpo inválido'},400);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url || !key) return reply({error:'Serviço indisponível'},500);
 const client=createClient(url,key);
 const today=madeiraToday();
 const {data:tasks,error}=await client.from('tarefas').select('*').or('concluida_em.is.null,conclusao_email_estado.eq.pendente').order('created_at');
 if(error) throw error;
 let sent=0;
 // One event for one specific task and the expected manager recipient per send.
 for(const task of tasks ?? []) {
  const {data:employee,error:employeeError}=await client.from('profiles').select('email').eq('id',task.responsavel_id).maybeSingle();
  if(employeeError) throw employeeError;
  if(task.concluida_em) {
   const result=await sendTaskEvent(task,employee?.email ?? null);
   const {error:saveError}=await client.from('tarefas').update({conclusao_email_estado:result.sent?'enviado':'suprimido'}).eq('id',task.id);
   if(saveError) throw saveError;
   if(result.sent) sent++;
   continue;
  }
  const days=dueReminder(task.data_inicio,task.lembretes_dias,task.lembretes_processados,today);
  if(days===null) continue;
  // Recheck completion before sending a reminder.
  const {data:current,error:readError}=await client.from('tarefas').select('concluida_em').eq('id',task.id).single();
  if(readError || current.concluida_em) continue;
  const result=await sendTaskEvent(task,employee?.email ?? null,days);
  const processed=[...new Set([...task.lembretes_processados,...task.lembretes_dias.filter((d:number)=>d<=days)])];
  const {error:saveError}=await client.from('tarefas').update({lembretes_processados:processed}).eq('id',task.id);
  if(saveError) throw saveError;
  if(result.sent) sent++;
 }
 return reply({checked:tasks?.length ?? 0,sent});
 } catch { return reply({error:'Falha no processamento dos avisos'},500); }
});
