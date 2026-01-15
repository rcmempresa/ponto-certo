import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

interface PontoRecord {
  id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
}

interface DayData {
  day: string;
  fullDate: string;
  hours: number;
  isToday: boolean;
}

export function WeeklyHoursChart() {
  const { user } = useAuth();
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWeekHours, setTotalWeekHours] = useState(0);

  useEffect(() => {
    if (user) {
      fetchWeekData();
    }
  }, [user]);

  const fetchWeekData = async () => {
    if (!user) return;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

    const { data: pontoData } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', weekStart.toISOString())
      .lte('timestamp', weekEnd.toISOString())
      .order('timestamp', { ascending: true });

    // Generate all days of the week
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    let weekTotal = 0;
    
    const chartData: DayData[] = weekDays.map((day) => {
      // Filter records for this day
      const dayRecords = (pontoData || []).filter((record) =>
        isSameDay(new Date(record.timestamp), day)
      );

      // Calculate hours for this day
      let daySeconds = 0;
      let entryTime: Date | null = null;

      for (const record of dayRecords) {
        if (record.tipo === 'entrada') {
          entryTime = new Date(record.timestamp);
        } else if (record.tipo === 'saida' && entryTime) {
          daySeconds += (new Date(record.timestamp).getTime() - entryTime.getTime()) / 1000;
          entryTime = null;
        }
      }

      // If still working (entry without exit on today), add current time
      if (entryTime && isSameDay(day, now)) {
        daySeconds += (now.getTime() - entryTime.getTime()) / 1000;
      }

      const hours = Math.round((daySeconds / 3600) * 10) / 10; // Round to 1 decimal
      weekTotal += hours;

      return {
        day: format(day, 'EEE', { locale: pt }).charAt(0).toUpperCase() + format(day, 'EEE', { locale: pt }).slice(1, 3),
        fullDate: format(day, 'd MMM', { locale: pt }),
        hours,
        isToday: isSameDay(day, now),
      };
    });

    setData(chartData);
    setTotalWeekHours(Math.round(weekTotal * 10) / 10);
    setLoading(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as DayData;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{item.fullDate}</p>
          <p className="text-lg font-semibold text-primary">{item.hours}h</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Horas Esta Semana</CardTitle>
          <div className="text-right">
            <span className="text-2xl font-semibold">{totalWeekHours}h</span>
            <span className="text-sm text-muted-foreground ml-1">total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
              <Bar 
                dataKey="hours" 
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.5)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary/50" />
            <span>Dias anteriores</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary" />
            <span>Hoje</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
