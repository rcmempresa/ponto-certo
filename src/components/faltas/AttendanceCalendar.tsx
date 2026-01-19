import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, Clock, FileText, Plus } from 'lucide-react';
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
  isAfter,
  isBefore,
  addMonths,
  subMonths,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday, getHolidayName } from '@/lib/holidays';
import { ManualPunchDialog } from '@/components/ponto/ManualPunchDialog';

const MINIMUM_HOURS = 8;

interface PontoRecord {
  id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
}

interface FaltaRecord {
  id: string;
  data: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  motivo: string;
}

interface DayStatus {
  date: Date;
  hoursWorked: number;
  isComplete: boolean;
  isIncomplete: boolean;
  hasFalta: boolean;
  faltaStatus?: 'pendente' | 'aprovado' | 'rejeitado';
  faltaMotivo?: string;
  isHoliday: boolean;
  holidayName?: string;
  isWeekend: boolean;
  isFuture: boolean;
  isToday: boolean;
  hasNoRecords: boolean;
}

interface AttendanceCalendarProps {
  onJustifyDay: (date: string) => void;
}

export function AttendanceCalendar({ onJustifyDay }: AttendanceCalendarProps) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [dayStatuses, setDayStatuses] = useState<DayStatus[]>([]);
  const [punchDialogOpen, setPunchDialogOpen] = useState(false);
  const [selectedDateForPunch, setSelectedDateForPunch] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchMonthData();
    }
  }, [user, currentMonth]);

  const fetchMonthData = async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Fetch ponto records for the month
    const { data: pontoData } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', monthStart.toISOString())
      .lte('timestamp', monthEnd.toISOString())
      .order('timestamp', { ascending: true });

    // Fetch faltas for the month
    const { data: faltasData } = await supabase
      .from('faltas')
      .select('*')
      .eq('user_id', user.id)
      .gte('data', format(monthStart, 'yyyy-MM-dd'))
      .lte('data', format(monthEnd, 'yyyy-MM-dd'));

    // Calculate status for each day
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const today = new Date();

    const statuses: DayStatus[] = days.map((day) => {
      const isWeekendDay = isWeekend(day);
      const isHolidayDay = isHoliday(day);
      const holidayName = getHolidayName(day);
      const isFutureDay = isAfter(day, today);
      const isTodayDay = isSameDay(day, today);

      // Find ponto records for this day
      const dayRecords = (pontoData || []).filter((record) =>
        isSameDay(new Date(record.timestamp), day)
      );

      // Calculate hours worked
      let hoursWorked = 0;
      let entryTime: Date | null = null;

      for (const record of dayRecords) {
        if (record.tipo === 'entrada') {
          entryTime = new Date(record.timestamp);
        } else if (record.tipo === 'saida' && entryTime) {
          hoursWorked += (new Date(record.timestamp).getTime() - entryTime.getTime()) / 1000 / 3600;
          entryTime = null;
        }
      }

      // If currently working (on today), add current time
      if (entryTime && isTodayDay) {
        hoursWorked += (today.getTime() - entryTime.getTime()) / 1000 / 3600;
      }

      hoursWorked = Math.round(hoursWorked * 10) / 10;

      // Check if there's a falta for this day
      const falta = (faltasData || []).find(
        (f) => f.data === format(day, 'yyyy-MM-dd')
      );

      // Determine if day is complete or incomplete
      const hasAnyRecords = dayRecords.length > 0;
      const isComplete = hoursWorked >= MINIMUM_HOURS;
      const isIncomplete =
        !isWeekendDay &&
        !isHolidayDay &&
        !isFutureDay &&
        !isTodayDay &&
        !isComplete &&
        (hasAnyRecords || (!hasAnyRecords && isBefore(day, today)));

      return {
        date: day,
        hoursWorked,
        isComplete: isComplete && !isWeekendDay && !isHolidayDay,
        isIncomplete: isIncomplete && !falta,
        hasFalta: !!falta,
        faltaStatus: falta?.status,
        faltaMotivo: falta?.motivo,
        isHoliday: isHolidayDay,
        holidayName,
        isWeekend: isWeekendDay,
        isFuture: isFutureDay,
        isToday: isTodayDay,
        hasNoRecords: !hasAnyRecords && !isWeekendDay && !isHolidayDay && !isFutureDay && !isTodayDay,
      };
    });

    setDayStatuses(statuses);
    setLoading(false);
  };

  const getDayClass = (status: DayStatus) => {
    if (status.isWeekend || status.isHoliday) {
      return 'bg-muted/50 text-muted-foreground';
    }
    if (status.isFuture) {
      return 'bg-transparent text-muted-foreground/50';
    }
    if (status.hasFalta) {
      if (status.faltaStatus === 'aprovado') {
        return 'bg-success/20 text-success-foreground border-success/50';
      }
      if (status.faltaStatus === 'rejeitado') {
        return 'bg-destructive/20 text-destructive border-destructive/50';
      }
      return 'bg-warning/20 text-warning-foreground border-warning/50';
    }
    if (status.isIncomplete) {
      return 'bg-destructive/10 text-destructive border-destructive/30 cursor-pointer hover:bg-destructive/20';
    }
    if (status.isComplete) {
      return 'bg-success/10 text-success border-success/30';
    }
    if (status.isToday) {
      return 'bg-primary/10 text-primary border-primary/50';
    }
    return 'bg-transparent';
  };

  const getDayIcon = (status: DayStatus) => {
    if (status.hasFalta) {
      if (status.faltaStatus === 'aprovado') return <CheckCircle2 className="h-3 w-3 text-success" />;
      if (status.faltaStatus === 'rejeitado') return <AlertCircle className="h-3 w-3 text-destructive" />;
      return <Clock className="h-3 w-3 text-warning" />;
    }
    if (status.isIncomplete) return <AlertCircle className="h-3 w-3 text-destructive" />;
    if (status.isComplete) return <CheckCircle2 className="h-3 w-3 text-success" />;
    return null;
  };

  const getTooltipContent = (status: DayStatus) => {
    if (status.isHoliday) return `Feriado: ${status.holidayName}`;
    if (status.isWeekend) return 'Fim de semana';
    if (status.isFuture) return 'Dia futuro';
    if (status.hasFalta) {
      const statusLabel = {
        pendente: 'Pendente',
        aprovado: 'Aprovada',
        rejeitado: 'Rejeitada',
      }[status.faltaStatus || 'pendente'];
      return `Falta justificada (${statusLabel}): ${status.faltaMotivo}`;
    }
    if (status.isIncomplete) {
      return `${status.hoursWorked}h trabalhadas (mín. ${MINIMUM_HOURS}h) - Clique para opções`;
    }
    if (status.isComplete) {
      return `${status.hoursWorked}h trabalhadas ✓`;
    }
    if (status.isToday) {
      return `Hoje: ${status.hoursWorked}h até agora`;
    }
    if (status.hasNoRecords) {
      return 'Sem registos - Clique para adicionar horas';
    }
    return '';
  };

  const handleDayClick = (status: DayStatus) => {
    // Allow clicking on incomplete days without falta to show options
  };

  const handleAddPunch = (date: Date) => {
    setSelectedDateForPunch(format(date, 'yyyy-MM-dd'));
    setPunchDialogOpen(true);
  };

  const handlePunchSuccess = () => {
    fetchMonthData();
  };

  // Get calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const incompleteDays = dayStatuses.filter((s) => s.isIncomplete).length;

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Calendário de Presenças</CardTitle>
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
              disabled={isAfter(addMonths(currentMonth, 1), new Date())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {incompleteDays > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Tem {incompleteDays} dia(s) com horas incompletas por justificar</span>
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
                const status = dayStatuses.find((s) => isSameDay(s.date, day));
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const canAddPunch = status && !status.isFuture && !status.isWeekend && !status.isHoliday;
                const showOptions = status && (status.isIncomplete || status.hasNoRecords) && !status.hasFalta;

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

                if (showOptions) {
                  return (
                    <DropdownMenu key={day.toISOString()}>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`aspect-square p-1 rounded-lg border text-center text-xs font-medium transition-colors ${
                            getDayClass(status)
                          } ${status.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{format(day, 'd')}</span>
                            {getDayIcon(status)}
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-48">
                        <DropdownMenuItem onClick={() => handleAddPunch(day)}>
                          <Plus className="mr-2 h-4 w-4 text-primary" />
                          Registar horas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onJustifyDay(format(day, 'yyyy-MM-dd'))}>
                          <FileText className="mr-2 h-4 w-4 text-warning" />
                          Justificar falta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                return (
                  <TooltipProvider key={day.toISOString()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          disabled
                          className={`aspect-square p-1 rounded-lg border text-center text-xs font-medium transition-colors ${
                            status ? getDayClass(status) : ''
                          } ${status?.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{format(day, 'd')}</span>
                            {status && getDayIcon(status)}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        {status && getTooltipContent(status)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-success/20 border border-success/50" />
                <span>Completo (≥8h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-destructive/10 border border-destructive/30" />
                <span>Incompleto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-warning/20 border border-warning/50" />
                <span>Falta pendente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-muted/50" />
                <span>Feriado/Fim-de-semana</span>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Manual Punch Dialog */}
      {user && (
        <ManualPunchDialog
          open={punchDialogOpen}
          onOpenChange={setPunchDialogOpen}
          userId={user.id}
          selectedDate={selectedDateForPunch}
          onSuccess={handlePunchSuccess}
        />
      )}
    </Card>
  );
}
