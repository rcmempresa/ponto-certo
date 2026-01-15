import { useEffect, useState } from 'react';
import { Calendar, Clock, FileText, Sun } from 'lucide-react';
import { ClockWidget } from '@/components/ponto/ClockWidget';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

interface PontoRecord {
  id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [recentPontos, setRecentPontos] = useState<PontoRecord[]>([]);
  const [monthStats, setMonthStats] = useState({ days: 0, hours: 0 });

  useEffect(() => {
    if (user) {
      fetchRecentPontos();
      fetchMonthStats();
    }
  }, [user]);

  const fetchRecentPontos = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(6);

    if (data) {
      setRecentPontos(data);
    }
  };

  const fetchMonthStats = async () => {
    if (!user) return;

    const now = new Date();
    const { data } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', startOfMonth(now).toISOString())
      .lte('timestamp', endOfMonth(now).toISOString())
      .order('timestamp', { ascending: true });

    if (data) {
      // Calculate unique days worked
      const uniqueDays = new Set(
        data.map((p) => format(new Date(p.timestamp), 'yyyy-MM-dd'))
      );

      // Calculate total hours
      let totalSeconds = 0;
      let entryTime: Date | null = null;

      for (const record of data) {
        if (record.tipo === 'entrada') {
          entryTime = new Date(record.timestamp);
        } else if (record.tipo === 'saida' && entryTime) {
          totalSeconds += (new Date(record.timestamp).getTime() - entryTime.getTime()) / 1000;
          entryTime = null;
        }
      }

      setMonthStats({
        days: uniqueDays.size,
        hours: Math.round(totalSeconds / 3600),
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 19) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}, {profile?.nome?.split(' ')[0] || 'Colaborador'} 👋
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Clock Widget - Takes 2 columns on large screens */}
        <div className="md:col-span-2 lg:col-span-2">
          <ClockWidget />
        </div>

        {/* Stats Column */}
        <div className="space-y-4">
          <StatsCard
            title="Dias de Férias"
            value={profile?.saldo_ferias ?? 22}
            subtitle="dias disponíveis"
            icon={Sun}
          />
          <StatsCard
            title="Dias Trabalhados"
            value={monthStats.days}
            subtitle="este mês"
            icon={Calendar}
          />
          <StatsCard
            title="Horas Totais"
            value={`${monthStats.hours}h`}
            subtitle="este mês"
            icon={Clock}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPontos.length > 0 ? (
            <div className="space-y-3">
              {recentPontos.map((ponto) => (
                <div
                  key={ponto.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      ponto.tipo === 'entrada' ? 'bg-success' : 'bg-destructive'
                    }`} />
                    <span className="text-sm font-medium capitalize">{ponto.tipo}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(ponto.timestamp), "d MMM, HH:mm", { locale: pt })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ainda não existem registos de ponto.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
