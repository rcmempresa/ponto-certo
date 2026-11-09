import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { sendTaskEvent } from '../_shared/task-rules/email.ts';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0,10) === v);
const schema = z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),titulo:z.string().trim().min(1).max(200),descricao:z.string().trim().max(2000).default(''),data_inicio:date,lembretes_dias:z.array(z.union([z.literal(2),z.literal(7),z.literal(15),z.literal(30)])).min(1).max(4)}),
 z.object({action:z.literal('complete'),id:z.string().uuid()}),
 z.object({action:z.literal('delete'),id:z.string().uuid()}),
]);
const reply = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method !== 'POST') return reply({error:'Método não permitido'},405);
 try {
 const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url || !key) return reply({error:'Serviço indisponível'},500);
 const client=createClient(url,key);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token) return reply({error:'Sessão necessária'},401);
 const {data:auth,error:authError}=await client.auth.getUser(token);
 if(authError || !auth.user) return reply({error:'Sessão inválida'},401);
 const {data:role,error:roleError}=await client.from('user_roles').select('role').eq('user_id',auth.user.id).eq('role','admin').maybeSingle();
 if(roleError || !role) return reply({error:'Acesso reservado ao gerente'},403);
 const parsed=schema.safeParse(await req.json());
 if(!parsed.success) return reply({error:'Dados da tarefa inválidos'},400);
 const input=parsed.data;
 if(input.action==='create') {
 const {action,...fields}=input;
 const {data,error}=await client.from('tarefas').insert({...fields,lembretes_dias:[...new Set(fields.lembretes_dias)].sort((a,b)=>a-b),created_by:auth.user.id}).select('*').single();
 if(error) throw error;
 return reply({data});
 }
 if(input.action==='delete') {
 const {error}=await client.from('tarefas').delete().eq('id',input.id);
 if(error) throw error;
 return reply({deleted:true});
 }
 const {error:completeError}=await client.from('tarefas').update({concluida_em:new Date().toISOString()}).eq('id',input.id).is('concluida_em',null);
 if(completeError) throw completeError;
 const {data:task,error}=await client.from('tarefas').select('*').eq('id',input.id).single();
 if(error) return reply({error:'Tarefa não encontrada'},404);
 let email=task.conclusao_email_estado;
 if(email==='pendente') {
  try {
   const result=await sendTaskEvent(task);
   email=result.sent ? 'enviado' : 'suprimido';
   const {error:saveError}=await client.from('tarefas').update({conclusao_email_estado:email}).eq('id',task.id);
   if(saveError) throw saveError;
  } catch { email='pendente'; }
 }
 return reply({data:{...task,conclusao_email_estado:email},email});
 } catch { return reply({error:'Não foi possível guardar a tarefa'},500); }
});
