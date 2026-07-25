import { useState, useEffect } from 'react';
import { Calendar, Plus, Sun, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { useEffectiveUser } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, isWeekend, eachDayOfInterval, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';
import { VacationCalendar } from '@/components/ferias/VacationCalendar';

type TipoInicio = 'manha' | 'tarde';
type TipoFim = 'manha' | 'tarde';

// Calculate business days with half-day adjustments
const countBusinessDays = (
  start: Date, 
  end: Date, 
  tipoInicio: TipoInicio, 
  tipoFim: TipoFim
): number => {
  const days = eachDayOfInterval({ start, end });
  const businessDays = days.filter(day => !isWeekend(day) && !isHoliday(day)).length;
  
  if (businessDays === 0) return 0;
  
  // Single day case
  if (isSameDay(start, end)) {
    if (tipoInicio === 'manha' && tipoFim === 'tarde') {
      return 1; // Full day
    } else {
      return 0.5; // Half day
    }
  }
  
  // Multiple days case
  let total = businessDays;
  
  // If starts in the afternoon, subtract half day
  if (tipoInicio === 'tarde') {
    total -= 0.5;
  }
  
  // If ends in the morning, subtract half day
  if (tipoFim === 'manha') {
    total -= 0.5;
  }
  
  return total;
};

interface FeriasRecord {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
  tipo_inicio: TipoInicio;
  tipo_fim: TipoFim;
}

export default function Ferias() {
  const { user, profile, refreshProfile } = useAuth();
  const { effectiveUserId, effectiveProfile, isImpersonating } = useEffectiveUser();
  const { toast } = useToast();
  const [ferias, setFerias] = useState<FeriasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipoInicio, setTipoInicio] = useState<TipoInicio>('manha');
  const [tipoFim, setTipoFim] = useState<TipoFim>('tarde');
  const [tipoPeriodoSingleDay, setTipoPeriodoSingleDay] = useState<'dia_inteiro' | 'manha' | 'tarde'>('dia_inteiro');

  useEffect(() => {
    if (effectiveUserId) {
      fetchFerias();
      if (!isImpersonating) refreshProfile();
    }
  }, [effectiveUserId]);

  const fetchFerias = async () => {
    if (!effectiveUserId) return;

    const { data, error } = await supabase
      .from('ferias')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });

    if (data) {
      setFerias(data as FeriasRecord[]);
    }
    setLoading(false);
  };

  const handleSelectRange = (start: Date, end: Date) => {
    if (isImpersonating) return;
    setEditingId(null);
    setSelectedRange({ start, end });
    setTipoInicio('manha');
    setTipoFim('tarde');
    setTipoPeriodoSingleDay('dia_inteiro');
    setDialogOpen(true);
  };

  const handleEdit = (item: FeriasRecord) => {
    if (isImpersonating) return;
    const start = new Date(item.data_inicio + 'T00:00:00');
    const end = new Date(item.data_fim + 'T00:00:00');
    setEditingId(item.id);
    setSelectedRange({ start, end });
    setTipoInicio(item.tipo_inicio);
    setTipoFim(item.tipo_fim);
    if (isSameDay(start, end)) {
      if (item.tipo_inicio === 'manha' && item.tipo_fim === 'tarde') setTipoPeriodoSingleDay('dia_inteiro');
      else if (item.tipo_inicio === 'manha') setTipoPeriodoSingleDay('manha');
      else setTipoPeriodoSingleDay('tarde');
    } else {
      setTipoPeriodoSingleDay('dia_inteiro');
    }
    setDialogOpen(true);
  };

  const handleDelete = async (item: FeriasRecord) => {
    if (isImpersonating) return;
    if (!confirm('Tem a certeza que quer eliminar este pedido de férias?')) return;
    const { error } = await supabase.from('ferias').delete().eq('id', item.id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar o pedido.', variant: 'destructive' });
    } else {
      toast({ title: 'Pedido eliminado', description: 'O pedido de férias foi removido.' });
      fetchFerias();
      setCalendarKey((p) => p + 1);
    }
  };

  const resetForm = () => {
    setSelectedRange(null);
    setEditingId(null);
    setTipoInicio('manha');
    setTipoFim('tarde');
    setTipoPeriodoSingleDay('dia_inteiro');
  };

  const handleSubmit = async () => {
    if (!user || !selectedRange || isImpersonating) return;

    const isSingleDaySubmit = isSameDay(selectedRange.start, selectedRange.end);
    
    // For single day, derive tipo_inicio and tipo_fim from tipoPeriodoSingleDay
    let finalTipoInicio = tipoInicio;
    let finalTipoFim = tipoFim;
    
    if (isSingleDaySubmit) {
      if (tipoPeriodoSingleDay === 'dia_inteiro') {
        finalTipoInicio = 'manha';
        finalTipoFim = 'tarde';
      } else if (tipoPeriodoSingleDay === 'manha') {
        finalTipoInicio = 'manha';
        finalTipoFim = 'manha';
      } else {
        finalTipoInicio = 'tarde';
        finalTipoFim = 'tarde';
      }
    }

    const requestedDays = countBusinessDays(selectedRange.start, selectedRange.end, finalTipoInicio, finalTipoFim);
    const availableDays = profile?.saldo_ferias ?? 22;

    if (requestedDays > availableDays) {
      toast({
        title: 'Saldo insuficiente',
        description: `Está a pedir ${requestedDays} dias úteis, mas só tem ${availableDays} dias disponíveis.`,
        variant: 'destructive',
      });
      return;
    }

    if (requestedDays <= 0) {
      toast({
        title: 'Período inválido',
        description: 'Selecione um período válido de férias.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    // Check for conflicts with approved vacations from other users
    const startStr = format(selectedRange.start, 'yyyy-MM-dd');
    const endStr = format(selectedRange.end, 'yyyy-MM-dd');

    const { data: conflictingVacations } = await supabase
      .from('ferias')
      .select('*, profiles:user_id(nome)')
      .eq('status', 'aprovado')
      .neq('user_id', user.id)
      .lte('data_inicio', endStr)
      .gte('data_fim', startStr);

    if (conflictingVacations && conflictingVacations.length > 0) {
      const names = conflictingVacations
        .map((v: any) => v.profiles?.nome || 'Colaborador')
        .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index)
        .join(', ');
      
      toast({
        title: 'Conflito de férias',
        description: `Já existe(m) férias aprovadas nesse período para: ${names}. Escolha outras datas.`,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('ferias').insert({
      user_id: user.id,
      data_inicio: format(selectedRange.start, 'yyyy-MM-dd'),
      data_fim: format(selectedRange.end, 'yyyy-MM-dd'),
      status: 'pendente',
      tipo_inicio: finalTipoInicio,
      tipo_fim: finalTipoFim,
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
      resetForm();
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
  
  // Calculate selected days based on period type
  const getEffectiveTipos = () => {
    if (isSingleDay) {
      if (tipoPeriodoSingleDay === 'dia_inteiro') return { inicio: 'manha' as TipoInicio, fim: 'tarde' as TipoFim };
      if (tipoPeriodoSingleDay === 'manha') return { inicio: 'manha' as TipoInicio, fim: 'manha' as TipoFim };
      return { inicio: 'tarde' as TipoInicio, fim: 'tarde' as TipoFim };
    }
    return { inicio: tipoInicio, fim: tipoFim };
  };
  
  const effectiveTipos = getEffectiveTipos();
  const selectedDays = selectedRange
    ? countBusinessDays(selectedRange.start, selectedRange.end, effectiveTipos.inicio, effectiveTipos.fim)
    : 0;
  
  const availableDays = effectiveProfile?.saldo_ferias ?? 22;
  const exceedsSaldo = selectedDays > availableDays;

  const formatDays = (days: number): string => {
    if (days === 0.5) return '½ dia';
    if (days === 1) return '1 dia';
    if (days % 1 === 0.5) return `${Math.floor(days)}½ dias`;
    return `${days} dias`;
  };

  const getVacationDescription = (item: FeriasRecord): string => {
    const isSingleDayItem = item.data_inicio === item.data_fim;
    
    if (isSingleDayItem) {
      if (item.tipo_inicio === 'manha' && item.tipo_fim === 'tarde') {
        return '1 dia';
      } else if (item.tipo_inicio === 'manha') {
        return '½ dia (Manhã)';
      } else {
        return '½ dia (Tarde)';
      }
    }
    
    // Multiple days
    const days = eachDayOfInterval({
      start: new Date(item.data_inicio),
      end: new Date(item.data_fim),
    });
    const businessDays = days.filter(day => !isWeekend(day) && !isHoliday(day)).length;
    
    let total = businessDays;
    if (item.tipo_inicio === 'tarde') total -= 0.5;
    if (item.tipo_fim === 'manha') total -= 0.5;
    
    const parts: string[] = [];
    parts.push(formatDays(total));
    
    if (item.tipo_inicio === 'tarde' || item.tipo_fim === 'manha') {
      const details: string[] = [];
      if (item.tipo_inicio === 'tarde') details.push('início à tarde');
      if (item.tipo_fim === 'manha') details.push('fim de manhã');
      parts.push(`(${details.join(', ')})`);
    }
    
    return parts.join(' ');
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
        if (!open) resetForm();
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
              {/* Period configuration */}
              <div className="grid gap-4">
                {isSingleDay ? (
                  <div className="space-y-2">
                    <Label htmlFor="tipo-periodo">Tipo de período</Label>
                    <Select value={tipoPeriodoSingleDay} onValueChange={(value) => setTipoPeriodoSingleDay(value as 'dia_inteiro' | 'manha' | 'tarde')}>
                      <SelectTrigger id="tipo-periodo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
                        <SelectItem value="manha">Só Manhã (½ dia)</SelectItem>
                        <SelectItem value="tarde">Só Tarde (½ dia)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tipo-inicio">Primeiro dia começa</Label>
                      <Select value={tipoInicio} onValueChange={(value) => setTipoInicio(value as TipoInicio)}>
                        <SelectTrigger id="tipo-inicio">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">De Manhã</SelectItem>
                          <SelectItem value="tarde">À Tarde (½ dia)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo-fim">Último dia termina</Label>
                      <Select value={tipoFim} onValueChange={(value) => setTipoFim(value as TipoFim)}>
                        <SelectTrigger id="tipo-fim">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">De Manhã (½ dia)</SelectItem>
                          <SelectItem value="tarde">À Tarde</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
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
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Horário:</span>
                  <span className="text-sm font-medium">
                    {isSingleDay ? (
                      tipoPeriodoSingleDay === 'dia_inteiro' ? 'Dia inteiro' :
                      tipoPeriodoSingleDay === 'manha' ? 'Só manhã' :
                      'Só tarde'
                    ) : (
                      `${tipoInicio === 'manha' ? 'Manhã' : 'Tarde'} → ${tipoFim === 'manha' ? 'Manhã' : 'Tarde'}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className={`text-sm font-medium ${exceedsSaldo ? 'text-destructive' : ''}`}>
                    {formatDays(selectedDays)}
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
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || exceedsSaldo || selectedDays <= 0}
            >
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
                <p className="text-2xl font-semibold">
                  {effectiveProfile?.saldo_ferias !== undefined && effectiveProfile?.saldo_ferias !== null
                    ? (Number.isInteger(effectiveProfile.saldo_ferias) 
                        ? effectiveProfile.saldo_ferias 
                        : effectiveProfile.saldo_ferias.toFixed(1).replace('.', ',')) 
                    : 22}
                </p>
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
                        {getVacationDescription(item)}
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