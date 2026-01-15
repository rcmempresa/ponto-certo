import { useState, useEffect } from 'react';
import { Calendar, Plus, Sun, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
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
import { format, differenceInDays, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface FeriasRecord {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
}

export default function Ferias() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [ferias, setFerias] = useState<FeriasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    if (user) {
      fetchFerias();
    }
  }, [user]);

  const fetchFerias = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ferias')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setFerias(data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !dateRange?.from || !dateRange?.to) return;

    setSubmitting(true);

    const { error } = await supabase.from('ferias').insert({
      user_id: user.id,
      data_inicio: format(dateRange.from, 'yyyy-MM-dd'),
      data_fim: format(dateRange.to, 'yyyy-MM-dd'),
      status: 'pendente',
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível submeter o pedido.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pedido submetido',
        description: 'O seu pedido de férias foi enviado para aprovação.',
      });
      setDialogOpen(false);
      setDateRange(undefined);
      fetchFerias();
    }

    setSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      pendente: { variant: 'secondary', label: 'Pendente' },
      aprovado: { variant: 'default', label: 'Aprovado' },
      rejeitado: { variant: 'destructive', label: 'Rejeitado' },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const selectedDays = dateRange?.from && dateRange?.to
    ? differenceInDays(dateRange.to, dateRange.from) + 1
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Férias</h1>
          <p className="text-muted-foreground">Gerir os seus pedidos de férias</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Pedido de Férias</DialogTitle>
              <DialogDescription>
                Selecione as datas pretendidas para as suas férias.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={pt}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
              {selectedDays > 0 && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedDays}</span> dias selecionados
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!dateRange?.from || !dateRange?.to || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A submeter...
                  </>
                ) : (
                  'Submeter Pedido'
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Sun className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{profile?.saldo_ferias ?? 22}</p>
                <p className="text-sm text-muted-foreground">Dias disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {ferias.filter((f) => f.status === 'pendente').length}
                </p>
                <p className="text-sm text-muted-foreground">Pedidos pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ferias.length > 0 ? (
            <div className="space-y-4">
              {ferias.map((item) => {
                const days = differenceInDays(new Date(item.data_fim), new Date(item.data_inicio)) + 1;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {format(new Date(item.data_inicio), 'd MMM', { locale: pt })} -{' '}
                        {format(new Date(item.data_fim), 'd MMM yyyy', { locale: pt })}
                      </p>
                      <p className="text-sm text-muted-foreground">{days} dias</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ainda não existem pedidos de férias.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
