import { useEffect, useState } from 'react';
import { HeartPulse, Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUser } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { baixaDays } from '@/lib/baixaRules';

interface Baixa {
  id: string;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  comprovativo_url: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

const ptDate = (d: string) => d.split('-').reverse().join('/');

export default function BaixasMedicas() {
  const { user } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUser();
  const { toast } = useToast();
  const [items, setItems] = useState<Baixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [obs, setObs] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('baixas_medicas')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('data_inicio', { ascending: false });
    setItems((data as Baixa[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [effectiveUserId]);

  const days = inicio && fim ? baixaDays(inicio, fim) : null;

  const submit = async () => {
    if (!user || isImpersonating || !days) return;
    setSubmitting(true);
    let url: string | null = null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Ficheiro demasiado grande', description: 'Máximo 5MB.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      const path = `${user.id}/baixas/${Date.now()}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('faltas_docs').upload(path, file);
      if (!upErr) url = supabase.storage.from('faltas_docs').getPublicUrl(path).data.publicUrl;
    }
    const { data: inserted, error } = await supabase
      .from('baixas_medicas')
      .insert({ user_id: user.id, data_inicio: inicio, data_fim: fim, observacoes: obs.trim() || null, comprovativo_url: url })
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível submeter a baixa.', variant: 'destructive' });
    } else {
      supabase.functions.invoke('notify-request-submitted', { body: { tipo: 'baixa', id: inserted.id } })
        .catch((e) => console.error('Falha ao notificar', e));
      toast({ title: 'Baixa submetida', description: 'Enviada para aprovação.' });
      setOpen(false); setInicio(''); setFim(''); setObs(''); setFile(null);
      load();
    }
    setSubmitting(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('baixas_medicas').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: 'Não foi possível apagar.', variant: 'destructive' });
    else load();
  };

  const openFile = async (url: string) => {
    const marker = '/faltas_docs/';
    if (!url.includes(marker)) return window.open(url, '_blank');
    const path = decodeURIComponent(url.split(marker)[1].split('?')[0]);
    const { data } = await supabase.storage.from('faltas_docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const statusBadge = (s: Baixa['status']) => {
    const map = { pendente: ['secondary', 'Pendente'], aprovado: ['default', 'Aprovada'], rejeitado: ['destructive', 'Rejeitada'] } as const;
    return <Badge variant={map[s][0]}>{map[s][1]}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Baixas médicas</h1>
          <p className="text-muted-foreground">Registe o período da sua baixa para aprovação</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={isImpersonating}><Plus className="mr-2 h-4 w-4" />Nova baixa</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova baixa médica</DialogTitle>
              <DialogDescription>Indique de quando a quando vai estar de baixa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inicio">Data de início</Label>
                  <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fim">Data de fim</Label>
                  <Input id="fim" type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} />
                </div>
              </div>
              {inicio && fim && (
                <p className={`text-sm ${days ? 'text-muted-foreground' : 'text-destructive'}`}>
                  {days ? `${days} dia${days > 1 ? 's' : ''} de baixa` : 'A data de fim tem de ser igual ou posterior à de início'}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="obs">Observações (opcional)</Label>
                <Textarea id="obs" rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert">Certificado de baixa (opcional)</Label>
                <Input id="cert" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">PDF, JPG ou PNG (máx. 5MB)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={!days || submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A submeter...</> : 'Submeter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-soft">
        <CardHeader><CardTitle className="text-lg font-medium">As minhas baixas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <HeartPulse className="mx-auto mb-2 h-8 w-8" />Ainda não registou baixas médicas.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((b) => (
                <div key={b.id} className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium">{ptDate(b.data_inicio)} a {ptDate(b.data_fim)} <span className="text-sm text-muted-foreground">· {baixaDays(b.data_inicio, b.data_fim)} dias</span></p>
                    {b.observacoes && <p className="text-sm text-muted-foreground break-words">{b.observacoes}</p>}
                    {b.comprovativo_url && (
                      <button className="text-xs text-primary hover:underline" onClick={() => openFile(b.comprovativo_url!)}>Ver certificado</button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(b.status)}
                    {b.status === 'pendente' && !isImpersonating && (
                      <Button variant="ghost" size="icon" aria-label="Apagar" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
