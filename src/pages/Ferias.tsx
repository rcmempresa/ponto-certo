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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, isWeekend, eachDayOfInterval, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';
import { VacationCalendar } from '@/components/ferias/VacationCalendar';

type TipoPeriodo = 'dia_inteiro' | 'meio_dia_manha' | 'meio_dia_tarde';

// Calculate business days (excluding weekends and holidays)
const countBusinessDays = (start: Date, end: Date, tipoPeriodo: TipoPeriodo): number => {
  const days = eachDayOfInterval({ start, end });
  const businessDays = days.filter(day => !isWeekend(day) && !isHoliday(day)).length;
  
  // If it's a half day and only one day selected, count as 0.5
  if (tipoPeriodo !== 'dia_inteiro' && isSameDay(start, end)) {
    return 0.5;
  }
  
  return businessDays;
};

interface FeriasRecord {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
  tipo_periodo: TipoPeriodo;
}

export default function Ferias() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [ferias, setFerias] = useState<FeriasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('dia_inteiro');

  useEffect(() => {
    if (user) {
      fetchFerias();
      refreshProfile(); // Refresh profile to get updated saldo_ferias
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
      setFerias(data as FeriasRecord[]);
    }
    setLoading(false);
  };

  const handleSelectRange = (start: Date, end: Date) => {
    setSelectedRange({ start, end });
    // Reset to full day, but if same day allow half day option
    setTipoPeriodo('dia_inteiro');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !selectedRange) return;

    const requestedDays = countBusinessDays(selectedRange.start, selectedRange.end, tipoPeriodo);
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
      tipo_periodo: tipoPeriodo,
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
      setTipoPeriodo('dia_inteiro');
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

  const isSingleDay = selectedRange ? isSameDay(selectedRange.start, selectedRange.end) : false;
  
  const selectedDays = selectedRange
    ? countBusinessDays(selectedRange.start, selectedRange.end, tipoPeriodo)
    : 0;
  
  const availableDays = profile?.saldo_ferias ?? 22;
  const exceedsSaldo = selectedDays > availableDays;

  const getTipoPeriodoLabel = (tipo: TipoPeriodo): string => {
    switch (tipo) {
      case 'dia_inteiro': return 'Dia Inteiro';
      case 'meio_dia_manha': return 'Meio Dia (Manhã)';
      case 'meio_dia_tarde': return 'Meio Dia (Tarde)';
      default: return 'Dia Inteiro';
    }
  };

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
        if (!open) {
          setSelectedRange(null);
          setTipoPeriodo('dia_inteiro');
        }
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
              {/* Period type selector - only show for single day */}
              {isSingleDay && (
                <div className="space-y-2">
                  <Label htmlFor="tipo-periodo">Tipo de Período</Label>
                  <Select value={tipoPeriodo} onValueChange={(value) => setTipoPeriodo(value as TipoPeriodo)}>
                    <SelectTrigger id="tipo-periodo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
                      <SelectItem value="meio_dia_manha">Meio Dia (Manhã)</SelectItem>
                      <SelectItem value="meio_dia_tarde">Meio Dia (Tarde)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Período:</span>
                  <span className="text-sm font-medium">
                    {isSingleDay ? (
                      format(selectedRange.start, 'd MMM yyyy', { locale: pt })
                    ) : (
                      <>
                        {format(selectedRange.start, 'd MMM', { locale: pt })} - {format(selectedRange.end, 'd MMM yyyy', { locale: pt })}
                      </>
                    )}
                  </span>
                </div>
                {isSingleDay && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <span className="text-sm font-medium">
                      {getTipoPeriodoLabel(tipoPeriodo)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Dias úteis:</span>
                  <span className={`text-sm font-medium ${exceedsSaldo ? 'text-destructive' : ''}`}>
                    {selectedDays === 0.5 ? '½ dia' : `${selectedDays} dias`}
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
              setTipoPeriodo('dia_inteiro');
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
                const isSingleDayItem = item.data_inicio === item.data_fim;
                const isHalfDay = item.tipo_periodo !== 'dia_inteiro';
                const days = isHalfDay && isSingleDayItem 
                  ? 0.5 
                  : differenceInDays(new Date(item.data_fim), new Date(item.data_inicio)) + 1;
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {isSingleDayItem ? (
                          format(new Date(item.data_inicio), 'd MMM yyyy', { locale: pt })
                        ) : (
                          <>
                            {format(new Date(item.data_inicio), 'd MMM', { locale: pt })} -{' '}
                            {format(new Date(item.data_fim), 'd MMM yyyy', { locale: pt })}
                          </>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {days === 0.5 ? '½ dia' : `${days} dias`}
                        {isHalfDay && (
                          <span className="ml-1 text-muted-foreground">
                            ({item.tipo_periodo === 'meio_dia_manha' ? 'Manhã' : 'Tarde'})
                          </span>
                        )}
                      </p>
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
