import { useEffect, useState } from 'react';
import { Plus, Check, Bell, Trash2, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { REMINDER_DAYS, reminderDate, madeiraToday } from '../../../supabase/functions/_shared/task-rules/index';
import type { Tables } from '@/integrations/supabase/types';
const ptDate = (iso: string) => iso.split('-').reverse().join('/');
export default function AdminTarefas() {
 const [tasks,setTasks] = useState<Tables<'tarefas'>[]>([]);
 const [loading,setLoading] = useState(true);
 const [loadError,setLoadError] = useState(false);
 const [open,setOpen] = useState(false);
 const [titulo,setTitulo] = useState('');
 const [descricao,setDescricao] = useState('');
 const [start,setStart] = useState(madeiraToday());
 const [days,setDays] = useState<number[]>([2,7,15,30]);
 const [busy,setBusy] = useState(false);
 const [filter,setFilter] = useState('pendentes');
 const [search,setSearch] = useState('');
 const [deleting,setDeleting] = useState<string | null>(null);
 const load = async () => {
  setLoading(true);
  const {data,error} = await supabase.from('tarefas').select('*').order('created_at',{ascending:false});
  setLoadError(Boolean(error));
  if(error) toast.error('Não foi possível carregar as tarefas'); else setTasks(data ?? []);
  setLoading(false);
 };
 useEffect(() => { void load(); },[]);
 const act = async (body: Record<string,unknown>) => {
  setBusy(true);
  try {
   const {data,error} = await supabase.functions.invoke('manage-task',{body});
   if(error || data?.error) throw new Error(data?.error || 'Não foi possível guardar a tarefa');
   if(body.action==='complete') {
    if(data.email==='pendente') toast.warning('Tarefa concluída; o email será tentado novamente na próxima verificação diária.');
    else if(data.email==='suprimido') toast.warning('Tarefa concluída; o destinatário não está a receber emails da aplicação.');
    else toast.success('Tarefa concluída e email enviado');
   } else toast.success(body.action==='create' ? 'Tarefa criada' : 'Tarefa eliminada');
   setOpen(false); setDeleting(null); await load();
  } catch (error) { toast.error(error instanceof Error ? error.message : 'Ocorreu um erro'); }
  finally { setBusy(false); }
 };
 const visible=tasks.filter(t => (filter==='todas' || (filter==='concluidas' ? Boolean(t.concluida_em) : !t.concluida_em)) && `${t.titulo} ${t.descricao}`.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt')));
 return <div className="space-y-6 pb-8 animate-fade-in">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <div><h1 className="text-2xl font-semibold">Tarefas</h1><p className="text-muted-foreground text-sm mt-1">{tasks.filter(t=>!t.concluida_em).length} pendentes · {tasks.filter(t=>t.concluida_em).length} concluídas</p></div>
   <Button onClick={()=>{setTitulo('');setDescricao('');setStart(madeiraToday());setDays([2,7,15,30]);setOpen(true);}}><Plus className="h-4 w-4 mr-2"/>Nova tarefa</Button>
  </header>
  <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
   <Tabs value={filter} onValueChange={setFilter}><TabsList><TabsTrigger value="pendentes">Pendentes</TabsTrigger><TabsTrigger value="concluidas">Concluídas</TabsTrigger><TabsTrigger value="todas">Todas</TabsTrigger></TabsList></Tabs>
   <Input aria-label="Pesquisar tarefas" placeholder="Pesquisar tarefas…" value={search} onChange={e=>setSearch(e.target.value)} className="sm:max-w-xs"/>
  </div>
  <div className="border-t border-border divide-y divide-border">
   {loading ? <p className="py-12 text-center text-muted-foreground">A carregar…</p> : loadError ? <div className="py-12 text-center"><p>Não foi possível carregar as tarefas.</p><Button variant="outline" onClick={load} className="mt-3">Tentar novamente</Button></div> : !visible.length ? <div className="py-16 text-center text-muted-foreground"><ClipboardCheck className="mx-auto h-8 w-8 mb-3"/><p>{search ? 'Nenhuma tarefa encontrada' : 'Sem tarefas neste separador'}</p></div> : visible.map(task => <article key={task.id} className="py-5 flex flex-col sm:flex-row gap-4 sm:items-start">
    <div className="min-w-0 flex-1 space-y-2">
     <h2 className="font-medium break-words">{task.titulo}</h2>
     {task.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{task.descricao}</p>}
     <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>Início: {ptDate(task.data_inicio)}</span>{task.concluida_em && <span>Conclusão: {new Date(task.concluida_em).toLocaleDateString('pt-PT',{timeZone:'Atlantic/Madeira'})}</span>}</div>
     {!task.concluida_em && <div className="flex flex-wrap gap-2">{task.lembretes_dias.map(d => <Badge variant="outline" key={d} className="font-normal gap-1"><Bell className="h-3 w-3"/>{d} dias · {ptDate(reminderDate(task.data_inicio,d))}{task.lembretes_processados.includes(d) && <Check className="h-3 w-3"/>}</Badge>)}</div>}
     {task.concluida_em && <Badge variant="secondary">Concluída</Badge>}
    </div>
    <div className="flex gap-2 shrink-0">
     {!task.concluida_em && <Button variant="outline" size="sm" disabled={busy} onClick={()=>act({action:'complete',id:task.id})}><Check className="h-4 w-4 mr-2"/>Concluir</Button>}
     {task.concluida_em && task.conclusao_email_estado==='pendente' && <Button size="sm" variant="outline" disabled={busy} onClick={()=>act({action:'complete',id:task.id})}><Bell className="h-4 w-4 mr-2"/>Reenviar aviso</Button>}
     <Button variant="ghost" size="icon" title="Eliminar tarefa" aria-label={`Eliminar ${task.titulo}`} disabled={busy} onClick={()=>setDeleting(task.id)}><Trash2 className="h-4 w-4 text-muted-foreground"/></Button>
    </div>
   </article>)}
  </div>
  <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
   <form onSubmit={e=>{e.preventDefault();void act({action:'create',titulo,descricao,data_inicio:start,lembretes_dias:days});}} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="task-title">Tarefa</Label><Input id="task-title" value={titulo} onChange={e=>setTitulo(e.target.value)} maxLength={200} required placeholder="Envio de material para Metrobeiras pela Logislink"/></div>
    <div className="space-y-2"><Label htmlFor="task-description">Detalhes</Label><Textarea id="task-description" value={descricao} onChange={e=>setDescricao(e.target.value)} maxLength={2000}/></div>
    <div className="space-y-2"><Label htmlFor="task-start">Data de início</Label><Input id="task-start" type="date" value={start} onChange={e=>setStart(e.target.value)} required/></div>
    <fieldset className="space-y-3"><legend className="text-sm font-medium mb-2">Lembrar por email após o início</legend><div className="grid grid-cols-2 gap-3">{REMINDER_DAYS.map(d=><label key={d} className="flex items-center gap-2 text-sm"><Checkbox checked={days.includes(d)} onCheckedChange={checked=>setDays(prev=>checked?[...prev,d].sort((a,b)=>a-b):prev.filter(v=>v!==d))}/>{d} dias</label>)}</div></fieldset>
    <p className="text-xs text-muted-foreground">Destinatário: geral@nrtechsolucion.pt</p>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy || !titulo.trim() || !days.length}>{busy ? 'A guardar…' : 'Criar tarefa'}</Button></DialogFooter>
   </form>
  </DialogContent></Dialog>
  <AlertDialog open={Boolean(deleting)} onOpenChange={v=>{if(!v && !busy)setDeleting(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar tarefa?</AlertDialogTitle><AlertDialogDescription>Esta ação remove a tarefa e cancela os seus lembretes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();if(deleting)void act({action:'delete',id:deleting});}}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
