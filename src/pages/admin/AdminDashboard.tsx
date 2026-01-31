import { useState, useEffect } from 'react';
import { Users, Clock, CheckSquare, FileText, Sparkles, TrendingUp, Calendar, Activity, Palmtree, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [onVacationCount, setOnVacationCount] = useState(0);
  const [notWorkingCount, setNotWorkingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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

    // Group by user and find last punch
    const userLastPunch: Record<string, { tipo: string; timestamp: string }> = {};
    
    if (todayPunches) {
      todayPunches.forEach((punch) => {
        userLastPunch[punch.user_id] = { tipo: punch.tipo, timestamp: punch.timestamp };
      });
    }

    // Filter users who are currently working (last punch was 'entrada')
    const workingUserIds = new Set(
      Object.entries(userLastPunch)
        .filter(([_, punch]) => punch.tipo === 'entrada')
        .map(([userId]) => userId)
    );

    if (profiles) {
      const working = Array.from(workingUserIds).map(userId => {
        const profile = profiles.find((p) => p.id === userId);
        return {
          id: userId,
          nome: profile?.nome || 'Colaborador',
          cargo: profile?.cargo,
          lastPunch: userLastPunch[userId].timestamp,
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

    // Fetch employees currently on vacation (approved vacation that includes today)
    const todayStr = format(today, 'yyyy-MM-dd');
    const { data: onVacation } = await supabase
      .from('ferias')
      .select('user_id')
      .eq('status', 'aprovado')
      .lte('data_inicio', todayStr)
      .gte('data_fim', todayStr);

    // Count unique users on vacation
    const uniqueUsersOnVacation = new Set(onVacation?.map(v => v.user_id) || []);
    setOnVacationCount(uniqueUsersOnVacation.size);

    // Calculate users not working today (not clocked in and not on vacation)
    if (profiles) {
      const notWorking = profiles.filter(p => 
        !workingUserIds.has(p.id) && !uniqueUsersOnVacation.has(p.id)
      ).length;
      
      setNotWorkingCount(notWorking);
    }

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

  const totalPending = pendingCounts.ferias + pendingCounts.faltas;

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-8">
      {/* Hero Header - Mobile Optimized */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-10 md:-right-20 -top-10 md:-top-20 h-32 md:h-64 w-32 md:w-64 rounded-full bg-primary/20 blur-2xl md:blur-3xl" />
        <div className="absolute -left-10 md:-left-20 -bottom-10 md:-bottom-20 h-24 md:h-48 w-24 md:w-48 rounded-full bg-primary/10 blur-2xl md:blur-3xl" />
        
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/20">
                <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <Badge variant="secondary" className="font-normal text-xs md:text-sm">
                {format(new Date(), isMobile ? "d MMM" : "EEEE, d 'de' MMMM", { locale: pt })}
              </Badge>
            </div>
            {totalPending > 0 && (
              <Badge className="bg-warning/20 text-warning border-warning/30 w-fit text-xs">
                <Activity className="h-3 w-3 mr-1" />
                {totalPending} pendente{totalPending > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 md:mb-2">
            Painel de Administração
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg max-w-xl">
            Visão geral em tempo real da sua equipa
          </p>
        </div>
      </div>

      {/* Quick Summary - Mobile Only */}
      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
          <div className="flex-shrink-0 flex items-center gap-2 bg-success/10 text-success px-3 py-2 rounded-full text-sm font-medium">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            {activeWorkers.length} online
          </div>
          <div className="flex-shrink-0 flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-full text-sm font-medium">
            <Users className="h-3.5 w-3.5" />
            {totalUsers} total
          </div>
          {pendingCounts.ferias > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 bg-warning/10 text-warning px-3 py-2 rounded-full text-sm font-medium">
              <Calendar className="h-3.5 w-3.5" />
              {pendingCounts.ferias} férias
            </div>
          )}
        </div>
      )}

      {/* Stats Grid - Responsive */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-6">
        <StatsCard
          title="Colaboradores"
          value={totalUsers}
          subtitle={isMobile ? "total" : "total registados"}
          icon={Users}
          variant="primary"
        />
        <StatsCard
          title={isMobile ? "Online" : "A Trabalhar Agora"}
          value={activeWorkers.length}
          subtitle={isMobile ? "ativos" : "colaboradores ativos"}
          icon={Clock}
          variant="success"
        />
        <StatsCard
          title={isMobile ? "De Férias" : "Em Férias Hoje"}
          value={onVacationCount}
          subtitle={isMobile ? "ausentes" : "colaboradores ausentes"}
          icon={Palmtree}
          variant="default"
        />
        <StatsCard
          title={isMobile ? "Ausentes" : "Não Entraram"}
          value={notWorkingCount}
          subtitle={isMobile ? "sem entrada" : "sem registo hoje"}
          icon={UserX}
          variant="destructive"
        />
        <StatsCard
          title={isMobile ? "Férias" : "Férias Pendentes"}
          value={pendingCounts.ferias}
          subtitle={isMobile ? "pendentes" : "aguardam aprovação"}
          icon={CheckSquare}
          variant="warning"
        />
        <StatsCard
          title={isMobile ? "Faltas" : "Faltas Pendentes"}
          value={pendingCounts.faltas}
          subtitle={isMobile ? "pendentes" : "aguardam aprovação"}
          icon={FileText}
          variant="warning"
        />
      </div>

      {/* Active Workers - Responsive */}
      <div className="rounded-xl md:rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border/50">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg md:rounded-xl bg-success/20">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-success" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-semibold">
                {isMobile ? 'A Trabalhar' : 'Quem Está a Trabalhar'}
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                Colaboradores ativos agora
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="bg-success/10 text-success border-success/30 font-medium px-2 md:px-3 py-1 text-xs md:text-sm"
          >
            <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2 mr-1.5 md:mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-success" />
            </span>
            {activeWorkers.length} online
          </Badge>
        </div>
        
        <div className="p-3 md:p-6">
          {activeWorkers.length > 0 ? (
            <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {activeWorkers.map((worker, index) => (
                <div
                  key={worker.id}
                  className="group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/30 border border-border/50 hover:border-success/30 hover:bg-success/5 transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 ring-2 ring-background shadow-lg">
                      <AvatarFallback className="bg-gradient-to-br from-success/30 to-success/10 text-success font-semibold text-xs md:text-sm">
                        {getInitials(worker.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 md:h-4 md:w-4 rounded-full bg-success border-2 border-background shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:text-success transition-colors text-sm md:text-base">
                      {worker.nome}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
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
            <div className="flex flex-col items-center justify-center py-10 md:py-16 text-center">
              <div className="flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-xl md:rounded-2xl bg-muted/50 mb-3 md:mb-4">
                <Users className="h-7 w-7 md:h-10 md:w-10 text-muted-foreground/50" />
              </div>
              <p className="text-base md:text-lg font-medium text-muted-foreground">
                Nenhum colaborador a trabalhar
              </p>
              <p className="text-xs md:text-sm text-muted-foreground/70 mt-1 max-w-xs">
                Os colaboradores aparecem aqui quando registam entrada
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions - Mobile Floating */}
      {isMobile && totalPending > 0 && (
        <div className="fixed bottom-20 right-4 z-40">
          <a 
            href="/admin/aprovacoes"
            className="flex items-center gap-2 bg-warning text-warning-foreground px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all animate-fade-in"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="font-medium text-sm">{totalPending} para aprovar</span>
          </a>
        </div>
      )}
    </div>
  );
}
