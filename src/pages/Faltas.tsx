import { useState, useEffect } from 'react';
import { FileText, Plus, Upload, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface FaltaRecord {
  id: string;
  data: string;
  motivo: string;
  comprovativo_url: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
}

export default function Faltas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [faltas, setFaltas] = useState<FaltaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    data: '',
    motivo: '',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) {
      fetchFaltas();
    }
  }, [user]);

  const fetchFaltas = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('faltas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setFaltas(data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !formData.data || !formData.motivo) return;

    setSubmitting(true);
    let comprovanteUrl = null;

    // Upload file if provided
    if (file) {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('faltas_docs')
        .upload(filePath, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('faltas_docs')
          .getPublicUrl(filePath);
        comprovanteUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('faltas').insert({
      user_id: user.id,
      data: formData.data,
      motivo: formData.motivo,
      comprovativo_url: comprovanteUrl,
      status: 'pendente',
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível submeter a justificação.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Justificação submetida',
        description: 'A sua justificação foi enviada para aprovação.',
      });
      setDialogOpen(false);
      setFormData({ data: '', motivo: '' });
      setFile(null);
      fetchFaltas();
    }

    setSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      pendente: { variant: 'secondary', label: 'Pendente' },
      aprovado: { variant: 'default', label: 'Aprovada' },
      rejeitado: { variant: 'destructive', label: 'Rejeitada' },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faltas</h1>
          <p className="text-muted-foreground">Justificar ausências e gerir pedidos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Justificação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Justificar Falta</DialogTitle>
              <DialogDescription>
                Preencha os dados da sua ausência e anexe um comprovativo se necessário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data da Falta</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Textarea
                  id="motivo"
                  placeholder="Descreva o motivo da sua ausência..."
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Comprovativo (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                  />
                </div>
                <p className="text-xs text-muted-foreground">PDF, JPG ou PNG (máx. 5MB)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.data || !formData.motivo || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A submeter...
                  </>
                ) : (
                  'Submeter'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{faltas.length}</p>
                <p className="text-sm text-muted-foreground">Total de justificações</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Calendar className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {faltas.filter((f) => f.status === 'pendente').length}
                </p>
                <p className="text-sm text-muted-foreground">Pendentes de aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico de Faltas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : faltas.length > 0 ? (
            <div className="space-y-4">
              {faltas.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {format(new Date(item.data), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.motivo}</p>
                    {item.comprovativo_url && (
                      <a
                        href={item.comprovativo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver comprovativo
                      </a>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ainda não existem justificações de faltas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
