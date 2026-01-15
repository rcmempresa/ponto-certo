import { useState, useEffect } from 'react';
import { Users, Clock, CheckSquare, FileText, Sparkles } from 'lucide-react';
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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="secondary" className="font-normal">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Painel de Administração
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Visão geral em tempo real da sua equipa e recursos humanos
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Colaboradores"
          value={totalUsers}
          subtitle="total registados"
          icon={Users}
          variant="primary"
        />
        <StatsCard
          title="A Trabalhar Agora"
          value={activeWorkers.length}
          subtitle="colaboradores ativos"
          icon={Clock}
          variant="success"
        />
        <StatsCard
          title="Férias Pendentes"
          value={pendingCounts.ferias}
          subtitle="aguardam aprovação"
          icon={CheckSquare}
          variant="warning"
        />
        <StatsCard
          title="Faltas Pendentes"
          value={pendingCounts.faltas}
          subtitle="aguardam aprovação"
          icon={FileText}
          variant="warning"
        />
      </div>

      {/* Active Workers */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20">
              <Clock className="h-5 w-5 text-success" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Quem Está a Trabalhar</h2>
              <p className="text-sm text-muted-foreground">Colaboradores ativos agora</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="bg-success/10 text-success border-success/30 font-medium px-3 py-1"
          >
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            {activeWorkers.length} online
          </Badge>
        </div>
        
        <div className="p-6">
          {activeWorkers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeWorkers.map((worker, index) => (
                <div
                  key={worker.id}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-success/30 hover:bg-success/5 transition-all duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 ring-2 ring-background shadow-lg">
                      <AvatarFallback className="bg-gradient-to-br from-success/30 to-success/10 text-success font-semibold">
                        {getInitials(worker.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-success border-2 border-background shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-success transition-colors">
                      {worker.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {worker.cargo || 'Colaborador'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Desde {format(new Date(worker.lastPunch), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                <Users className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                Nenhum colaborador a trabalhar
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Os colaboradores aparecem aqui quando registam entrada
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
