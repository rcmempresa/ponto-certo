import { useState, useEffect } from 'react';
import { Calendar, Plus, Sun, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, isWeekend, eachDayOfInterval } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';
import { VacationCalendar } from '@/components/ferias/VacationCalendar';

// Calculate business days (excluding weekends and holidays)
const countBusinessDays = (start: Date, end: Date): number => {
  const days = eachDayOfInterval({ start, end });
  return days.filter(day => !isWeekend(day) && !isHoliday(day)).length;
};

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
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);

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

  const handleSelectRange = (start: Date, end: Date) => {
    setSelectedRange({ start, end });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !selectedRange) return;

    const requestedDays = countBusinessDays(selectedRange.start, selectedRange.end);
    const availableDays = profile?.saldo_ferias ?? 22;

    if (requestedDays > availableDays) {
      toast({
        title: 'Saldo insuficiente',
        description: `Está a pedir ${requestedDays} dias úteis, mas só tem ${availableDays} dias disponíveis.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('ferias').insert({
      user_id: user.id,
      data_inicio: format(selectedRange.start, 'yyyy-MM-dd'),
      data_fim: format(selectedRange.end, 'yyyy-MM-dd'),
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
      setSelectedRange(null);
      fetchFerias();
      setCalendarKey((prev) => prev + 1);
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

  const selectedDays = selectedRange
    ? countBusinessDays(selectedRange.start, selectedRange.end)
    : 0;
  
  const availableDays = profile?.saldo_ferias ?? 22;
  const exceedsSaldo = selectedDays > availableDays;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Férias</h1>
        <p className="text-muted-foreground">Selecione as datas no calendário para pedir férias</p>
      </div>

      {/* Vacation Calendar */}
      <VacationCalendar key={calendarKey} onSelectRange={handleSelectRange} refreshKey={calendarKey} />

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setSelectedRange(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pedido de Férias</DialogTitle>
            <DialogDescription>
              Reveja os detalhes do seu pedido antes de submeter.
            </DialogDescription>
          </DialogHeader>
          {selectedRange && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Período:</span>
                  <span className="text-sm font-medium">
                    {format(selectedRange.start, 'd MMM', { locale: pt })} - {format(selectedRange.end, 'd MMM yyyy', { locale: pt })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Dias úteis:</span>
                  <span className={`text-sm font-medium ${exceedsSaldo ? 'text-destructive' : ''}`}>
                    {selectedDays} dias
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Saldo disponível:</span>
                  <span className="text-sm font-medium">{availableDays} dias</span>
                </div>
              </div>
              
              {exceedsSaldo && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  ⚠️ O número de dias solicitados excede o seu saldo disponível.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              setSelectedRange(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || exceedsSaldo}>
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
