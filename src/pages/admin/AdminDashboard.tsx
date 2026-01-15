import { useState, useEffect } from 'react';
import { Users, Clock, CheckSquare, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ActiveWorker {
  id: string;
  nome: string;
  cargo: string | null;
  lastPunch: string;
}

interface PendingCounts {
  ferias: number;
  faltas: number;
}

export default function AdminDashboard() {
  const [activeWorkers, setActiveWorkers] = useState<ActiveWorker[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ ferias: 0, faltas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date();

    // Fetch all profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      setTotalUsers(profiles.length);
    }

    // Fetch today's punches to determine who's working
    const { data: todayPunches } = await supabase
      .from('ponto')
      .select('user_id, tipo, timestamp')
      .gte('timestamp', startOfDay(today).toISOString())
      .lte('timestamp', endOfDay(today).toISOString())
      .order('timestamp', { ascending: true });

    if (todayPunches && profiles) {
      // Group by user and find last punch
      const userLastPunch: Record<string, { tipo: string; timestamp: string }> = {};
      
      todayPunches.forEach((punch) => {
        userLastPunch[punch.user_id] = { tipo: punch.tipo, timestamp: punch.timestamp };
      });

      // Filter users who are currently working (last punch was 'entrada')
      const working = Object.entries(userLastPunch)
        .filter(([_, punch]) => punch.tipo === 'entrada')
        .map(([userId, punch]) => {
          const profile = profiles.find((p) => p.id === userId);
          return {
            id: userId,
            nome: profile?.nome || 'Colaborador',
            cargo: profile?.cargo,
            lastPunch: punch.timestamp,
          };
        });

      setActiveWorkers(working);
    }

    // Fetch pending counts
    const { count: feriasPending } = await supabase
      .from('ferias')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    const { count: faltasPending } = await supabase
      .from('faltas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    setPendingCounts({
      ferias: feriasPending || 0,
      faltas: faltasPending || 0,
    });

    setLoading(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel de Administração</h1>
        <p className="text-muted-foreground">
          Visão geral de recursos humanos • {format(new Date(), "d 'de' MMMM", { locale: pt })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Colaboradores"
          value={totalUsers}
          subtitle="total registados"
          icon={Users}
        />
        <StatsCard
          title="A Trabalhar Agora"
          value={activeWorkers.length}
          subtitle="colaboradores ativos"
          icon={Clock}
        />
        <StatsCard
          title="Férias Pendentes"
          value={pendingCounts.ferias}
          subtitle="aguardam aprovação"
          icon={CheckSquare}
        />
        <StatsCard
          title="Faltas Pendentes"
          value={pendingCounts.faltas}
          subtitle="aguardam aprovação"
          icon={FileText}
        />
      </div>

      {/* Active Workers */}
      <Card className="border-0 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium">Quem Está a Trabalhar Agora</CardTitle>
          <Badge variant="secondary" className="font-normal">
            {activeWorkers.length} online
          </Badge>
        </CardHeader>
        <CardContent>
          {activeWorkers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback className="bg-success/20 text-success">
                        {getInitials(worker.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{worker.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {worker.cargo || 'Colaborador'} • Desde {format(new Date(worker.lastPunch), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhum colaborador a trabalhar neste momento.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
