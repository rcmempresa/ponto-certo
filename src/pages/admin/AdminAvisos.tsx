import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { documentExpiryState, documentNoticeDays, documentUploadValidity, paginate } from '@/lib/documentRules';
import { DocumentExpiryBadge } from '@/components/documents/DocumentExpiryBadge';
import { ListPager } from '@/components/documents/ListPager';

type Doc = { id: string; titulo: string; categoria: string; validade: string | null; aviso_dias: number; aviso_enviado_em: string | null; ficheiro_url: string };
type Filter = 'avisar' | 'expirados' | 'todos';
const PAGE_SIZE = 10;

export default function AdminAvisos() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('avisar');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newDays, setNewDays] = useState('15');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('documentos').select('id,titulo,categoria,validade,aviso_dias,aviso_enviado_em,ficheiro_url').not('validade', 'is', null).order('validade');
    setDocs((data as Doc[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const withState = useMemo(() => docs.map(d => ({ ...d, state: documentExpiryState(d.validade, new Date(), d.aviso_dias) })), [docs]);
  const counts = {
    expirados: withState.filter(d => d.state.status === 'expired').length,
    aExpirar: withState.filter(d => d.state.status === 'expiring').length,
    validos: withState.filter(d => d.state.status === 'valid').length,
  };
  const filtered = withState.filter(d => filter === 'todos' ? true : filter === 'expirados' ? d.state.status === 'expired' : d.state.status !== 'valid');
  const { items, page: current, totalPages } = paginate(filtered, page, PAGE_SIZE);

  const openEdit = (d: Doc) => { setEditing(d); setNewDate(d.validade || ''); setNewDays(String(d.aviso_dias)); };
  const save = async () => {
    if (!editing) return;
    let validade: string | null, aviso_dias: number;
    try { validade = documentUploadValidity(true, newDate); aviso_dias = documentNoticeDays(newDays); }
    catch (e) { toast({ title: 'Dados inválidos', description: e instanceof Error ? e.message : '', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('documentos').update({ validade, aviso_dias }).eq('id', editing.id);
    setSaving(false);
    if (error) { toast({ title: 'Não foi possível guardar', variant: 'destructive' }); return; }
    toast({ title: 'Validade atualizada', description: 'O aviso por email será enviado de novo na altura certa.' });
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Avisos</h1>
        <p className="text-sm text-muted-foreground">Documentos que precisam de ser renovados ou atualizados. Os avisos por email vão para geral@nrtechsolucion.pt.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-soft"><CardContent className="p-4"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="mt-2 text-2xl font-semibold">{counts.expirados}</p><p className="text-xs text-muted-foreground">Expirados</p></CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="p-4"><BellRing className="h-5 w-5 text-warning" /><p className="mt-2 text-2xl font-semibold">{counts.aExpirar}</p><p className="text-xs text-muted-foreground">A expirar</p></CardContent></Card>
        <Card className="border-0 shadow-soft"><CardContent className="p-4"><CheckCircle2 className="h-5 w-5 text-success" /><p className="mt-2 text-2xl font-semibold">{counts.validos}</p><p className="text-xs text-muted-foreground">Válidos</p></CardContent></Card>
      </div>

      <Tabs value={filter} onValueChange={v => { setFilter(v as Filter); setPage(1); }}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="avisar">A tratar</TabsTrigger>
          <TabsTrigger value="expirados">Expirados</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-0 shadow-soft overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Sem documentos nesta lista.</p>
          : <ul className="divide-y">
            {items.map(d => (
              <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium break-words">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground break-words">{d.categoria} · avisar {d.aviso_dias} dias antes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentExpiryBadge validade={d.validade} avisoDias={d.aviso_dias} />
                    {d.aviso_enviado_em && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />Email enviado a {format(parseISO(d.aviso_enviado_em), 'dd/MM/yyyy')}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" asChild><a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer">Ver</a></Button>
                  <Button size="sm" onClick={() => openEdit(d)}>Atualizar validade</Button>
                </div>
              </li>
            ))}
          </ul>}
        <ListPager page={current} totalPages={totalPages} onChange={setPage} />
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Atualizar validade</DialogTitle>
            <DialogDescription className="break-words">{editing?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="nova-validade">Nova data de validade</Label><Input id="nova-validade" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="novo-aviso">Avisar quantos dias antes</Label><Input id="novo-aviso" type="number" min={0} max={365} value={newDays} onChange={e => setNewDays(e.target.value)} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
