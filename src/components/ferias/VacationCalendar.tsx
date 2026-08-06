import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Loader2, Sun, Clock, CheckCircle2, XCircle } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday, getHolidayName } from '@/lib/holidays';

interface FeriasRecord {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

interface VacationCalendarProps {
  onSelectRange?: (start: Date, end: Date) => void;
  refreshKey?: number;
}

export function VacationCalendar({ onSelectRange, refreshKey }: VacationCalendarProps) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [ferias, setFerias] = useState<FeriasRecord[]>([]);
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      fetchFerias();
    }
  }, [user, refreshKey]);

  const fetchFerias = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('ferias')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      setFerias(data);
    }
    setLoading(false);
  };

  const getDayStatus = (day: Date) => {
    const isWeekendDay = isWeekend(day);
    const isHolidayDay = isHoliday(day);
    const holidayName = getHolidayName(day);

    // Check if day is part of any vacation request
    const vacation = ferias.find((f) => {
      const start = parseISO(f.data_inicio);
      const end = parseISO(f.data_fim);
      return isWithinInterval(day, { start, end });
    });

    return {
      isWeekend: isWeekendDay,
      isHoliday: isHolidayDay,
      holidayName,
      hasVacation: !!vacation,
      vacationStatus: vacation?.status,
    };
  };

  const isInSelection = (day: Date) => {
    if (!selectionStart) return false;
    const end = selectionEnd || hoveredDate;
    if (!end) return isSameDay(day, selectionStart);
    
    const start = selectionStart < end ? selectionStart : end;
    const endDate = selectionStart < end ? end : selectionStart;
    
    return isWithinInterval(day, { start, end: endDate });
  };

  const handleDayClick = (day: Date) => {
    const status = getDayStatus(day);
    if (status.isWeekend || status.isHoliday || status.hasVacation) return;

    if (!selectionStart || (selectionStart && selectionEnd)) {
      setSelectionStart(day);
      setSelectionEnd(null);
    } else {
      const start = selectionStart < day ? selectionStart : day;
      const end = selectionStart < day ? day : selectionStart;
      setSelectionEnd(end);
      setSelectionStart(start);
      if (onSelectRange) {
        onSelectRange(start, end);
      }
    }
  };

  const handleDayHover = (day: Date) => {
    if (selectionStart && !selectionEnd) {
      setHoveredDate(day);
    }
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setHoveredDate(null);
  };

  const getDayClass = (day: Date) => {
    const status = getDayStatus(day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = day < today;
    const isToday = isSameDay(day, new Date());

    if (status.isWeekend || status.isHoliday) {
      return 'bg-muted/50 text-muted-foreground cursor-not-allowed';
    }

    if (status.hasVacation) {
      if (status.vacationStatus === 'aprovado') {
        return 'bg-success/30 text-success-foreground border-success/50 cursor-not-allowed';
      }
      if (status.vacationStatus === 'rejeitado') {
        return 'bg-destructive/20 text-destructive border-destructive/50 cursor-not-allowed';
      }
      return 'bg-warning/30 text-warning-foreground border-warning/50 cursor-not-allowed';
    }

    if (isPast) {
      return 'bg-transparent text-muted-foreground/60 cursor-pointer hover:bg-muted';
    }

    if (isInSelection(day)) {
      return 'bg-primary text-primary-foreground cursor-pointer';
    }

    if (isToday) {
      return 'bg-primary/10 text-primary border-primary/50 cursor-pointer hover:bg-primary/20';
    }

    return 'bg-transparent hover:bg-muted cursor-pointer';
  };

  const getDayIcon = (day: Date) => {
    const status = getDayStatus(day);
    
    if (status.isHoliday) return <Sun className="h-3 w-3 text-warning" />;
    if (status.hasVacation) {
      if (status.vacationStatus === 'aprovado') return <CheckCircle2 className="h-3 w-3 text-success" />;
      if (status.vacationStatus === 'rejeitado') return <XCircle className="h-3 w-3 text-destructive" />;
      return <Clock className="h-3 w-3 text-warning" />;
    }
    return null;
  };

  const getTooltipContent = (day: Date) => {
    const status = getDayStatus(day);
    
    if (status.isHoliday) return `Feriado: ${status.holidayName}`;
    if (status.isWeekend) return 'Fim de semana';
    if (status.hasVacation) {
      const statusLabel = {
        pendente: 'Pendente',
        aprovado: 'Aprovadas',
        rejeitado: 'Rejeitadas',
      }[status.vacationStatus || 'pendente'];
      return `Férias ${statusLabel}`;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return 'Data passada';
    
    return 'Clique para selecionar';
  };

  // Get calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Count vacation days
  const approvedDays = ferias
    .filter((f) => f.status === 'aprovado')
    .reduce((acc, f) => {
      const days = eachDayOfInterval({
        start: parseISO(f.data_inicio),
        end: parseISO(f.data_fim),
      });
      return acc + days.filter((d) => !isWeekend(d) && !isHoliday(d)).length;
    }, 0);

  const pendingDays = ferias
    .filter((f) => f.status === 'pendente')
    .reduce((acc, f) => {
      const days = eachDayOfInterval({
        start: parseISO(f.data_inicio),
        end: parseISO(f.data_fim),
      });
      return acc + days.filter((d) => !isWeekend(d) && !isHoliday(d)).length;
    }, 0);

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Calendário de Férias</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: pt })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Selection info */}
        {selectionStart && (
          <div className="flex items-center justify-between mt-2 p-2 rounded-lg bg-primary/10 text-sm">
            <span>
              {selectionEnd ? (
                <>
                  <strong>{format(selectionStart, 'd MMM', { locale: pt })}</strong> até{' '}
                  <strong>{format(selectionEnd, 'd MMM yyyy', { locale: pt })}</strong>
                </>
              ) : (
                <>Selecione a data final</>
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Limpar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);

                if (!isCurrentMonth) {
                  return (
                    <div
                      key={day.toISOString()}
                      className="aspect-square p-1 text-center text-xs text-muted-foreground/30"
                    >
                      {format(day, 'd')}
                    </div>
                  );
                }

                const isToday = isSameDay(day, new Date());

                return (
                  <TooltipProvider key={day.toISOString()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleDayClick(day)}
                          onMouseEnter={() => handleDayHover(day)}
                          className={`aspect-square p-1 rounded-lg border text-center text-xs font-medium transition-colors ${getDayClass(day)} ${
                            isToday ? 'ring-2 ring-primary ring-offset-1' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{format(day, 'd')}</span>
                            {getDayIcon(day)}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {getTooltipContent(day)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-success/30 border border-success/50" />
                <span>Aprovadas ({approvedDays} dias)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-warning/30 border border-warning/50" />
                <span>Pendentes ({pendingDays} dias)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-primary" />
                <span>Seleção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-muted/50" />
                <span>Feriado/Fim-de-semana</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
