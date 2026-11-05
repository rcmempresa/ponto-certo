import { useEffect, useState } from 'react';
import { Check, X, Trash2, Loader2, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { baixaDays } from '@/lib/baixaRules';

interface Row {
  id: string; user_id: string; data_inicio: string; data_fim: string;
  observacoes: string | null; comprovativo_url: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado'; nome: string;
}

const ptDate = (d: string) => d.split('-').reverse().join('/');

export function AdminBaixasTab({ onPendingChange }: { onPendingChange?: (n: number) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data }, { data: profiles }] = await Promise.all([
      supabase.from('baixas_medicas').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome, email'),
    ]);
    const names = new Map((profiles || []).map((p) => [p.id, p.nome || p.email]));
    const list = (data || []).map((b) => ({ ...b, nome: names.get(b.user_id) || 'Colaborador' })) as Row[];
    setRows(list);
    onPendingChange?.(list.filter((r) => r.status === 'pendente').length);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: 'aprovado' | 'rejeitado') => {
    const { error } = await supabase.from('baixas_medicas').update({ status }).eq('id', id);
    if (error) toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
    else { toast({ title: status === 'aprovado' ? 'Baixa aprovada' : 'Baixa rejeitada' }); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('baixas_medicas').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    else load();
  };

  const openFile = async (url: string) => {
    const marker = '/faltas_docs/';
    if (!url.includes(marker)) return window.open(url, '_blank');
    const path = decodeURIComponent(url.split(marker)[1].split('?')[0]);
    const { data } = await supabase.storage.from('faltas_docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const label = { pendente: 'Pendente', aprovado: 'Aprovada', rejeitado: 'Rejeitada' } as const;

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="border-b border-border/50 p-4 sm:p-6">
        <h3 className="font-semibold">Baixas médicas</h3>
        <p className="text-sm text-muted-foreground">{rows.length} baixas no total</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground"><HeartPulse className="mx-auto mb-2 h-8 w-8" />Não existem baixas médicas</div>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.nome}</p>
                  <Badge variant={r.status === 'aprovado' ? 'default' : r.status === 'rejeitado' ? 'destructive' : 'secondary'}>{label[r.status]}</Badge>
                </div>
                <p className="text-sm">{ptDate(r.data_inicio)} a {ptDate(r.data_fim)} · {baixaDays(r.data_inicio, r.data_fim)} dias</p>
                {r.observacoes && <p className="text-sm text-muted-foreground break-words">{r.observacoes}</p>}
                {r.comprovativo_url && (
                  <button className="text-xs text-primary hover:underline" onClick={() => openFile(r.comprovativo_url!)}>Ver certificado</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.status === 'pendente' && (
                  <>
                    <Button size="sm" onClick={() => decide(r.id, 'aprovado')}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, 'rejeitado')}><X className="mr-1 h-4 w-4" />Rejeitar</Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar baixa?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(r.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
