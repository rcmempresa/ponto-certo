import { useState, useEffect } from 'react';
import { Check, X, Loader2, Calendar, FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { pt } from 'date-fns/locale';

// Calculate business days (excluding weekends)
const countBusinessDays = (start: Date, end: Date): number => {
  const days = eachDayOfInterval({ start, end });
  return days.filter(day => !isWeekend(day)).length;
};

interface FeriasRequest {
  id: string;
  user_id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
  profile?: {
    nome: string;
    email: string;
    cargo: string | null;
  };
}

interface FaltaRequest {
  id: string;
  user_id: string;
  data: string;
  motivo: string;
  comprovativo_url: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
  profile?: {
    nome: string;
    email: string;
    cargo: string | null;
  };
}

export default function AdminAprovacoes() {
  const { toast } = useToast();
  const [ferias, setFerias] = useState<FeriasRequest[]>([]);
  const [faltas, setFaltas] = useState<FaltaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    // Fetch all profiles first
    const { data: profiles } = await supabase.from('profiles').select('id, nome, email, cargo');

    // Fetch ferias
    const { data: feriasData } = await supabase
      .from('ferias')
      .select('*')
      .order('created_at', { ascending: false });

    if (feriasData && profiles) {
      const feriasWithProfiles = feriasData.map((f) => ({
        ...f,
        profile: profiles.find((p) => p.id === f.user_id),
      }));
      setFerias(feriasWithProfiles);
    }

    // Fetch faltas
    const { data: faltasData } = await supabase
      .from('faltas')
      .select('*')
      .order('created_at', { ascending: false });

    if (faltasData && profiles) {
      const faltasWithProfiles = faltasData.map((f) => ({
        ...f,
        profile: profiles.find((p) => p.id === f.user_id),
      }));
      setFaltas(faltasWithProfiles);
    }

    setLoading(false);
  };

  const handleFeriasAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);

    // Find the request to get user_id and dates
    const request = ferias.find(f => f.id === id);
    if (!request) {
      setProcessingId(null);
      return;
    }

    // Update the status
    const { error } = await supabase
      .from('ferias')
      .update({ status: action })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível processar o pedido.',
        variant: 'destructive',
      });
      setProcessingId(null);
      return;
    }

    // If approved, deduct from saldo_ferias
    if (action === 'aprovado') {
      const businessDays = countBusinessDays(
        new Date(request.data_inicio),
        new Date(request.data_fim)
      );

      // Get current saldo
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('saldo_ferias')
        .eq('id', request.user_id)
        .single();

      if (profileData) {
        const currentSaldo = profileData.saldo_ferias ?? 22;
        const newSaldo = Math.max(0, currentSaldo - businessDays);
        
        await supabase
          .from('profiles')
          .update({ saldo_ferias: newSaldo })
          .eq('id', request.user_id);
      }
    }

    toast({
      title: action === 'aprovado' ? 'Férias aprovadas' : 'Férias rejeitadas',
      description: action === 'aprovado' 
        ? 'Os dias foram descontados do saldo do colaborador.'
        : 'O colaborador será notificado.',
    });
    fetchRequests();
    setProcessingId(null);
  };

  const handleFaltaAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);

    const { error } = await supabase
      .from('faltas')
      .update({ status: action })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível processar o pedido.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: action === 'aprovado' ? 'Falta aprovada' : 'Falta rejeitada',
        description: 'O colaborador será notificado.',
      });
      fetchRequests();
    }

    setProcessingId(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { 
      variant: 'default' | 'secondary' | 'destructive'; 
      label: string;
      className: string;
      icon: typeof Clock;
    }> = {
      pendente: { 
        variant: 'secondary', 
        label: 'Pendente',
        className: 'bg-warning/10 text-warning border-warning/30',
        icon: Clock
      },
      aprovado: { 
        variant: 'default', 
        label: 'Aprovado',
        className: 'bg-success/10 text-success border-success/30',
        icon: CheckCircle2
      },
      rejeitado: { 
        variant: 'destructive', 
        label: 'Rejeitado',
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        icon: AlertCircle
      },
    };
    return configs[status] || configs.pendente;
  };

  const pendingFerias = ferias.filter((f) => f.status === 'pendente');
  const pendingFaltas = faltas.filter((f) => f.status === 'pendente');
  const totalPending = pendingFerias.length + pendingFaltas.length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              {totalPending > 0 && (
                <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
                  {totalPending} pendente{totalPending > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Centro de Aprovações
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerir pedidos de férias e justificações de faltas
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingFerias.length}</p>
                <p className="text-xs text-muted-foreground">Férias</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingFaltas.length}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ferias" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger 
            value="ferias" 
            className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Calendar className="h-4 w-4" />
            Férias
            {pendingFerias.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 justify-center bg-warning/20 text-warning text-xs">
                {pendingFerias.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="faltas" 
            className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Faltas
            {pendingFaltas.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 justify-center bg-warning/20 text-warning text-xs">
                {pendingFaltas.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Férias Tab */}
        <TabsContent value="ferias">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Pedidos de Férias</h2>
                  <p className="text-sm text-muted-foreground">{ferias.length} pedidos no total</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : ferias.length > 0 ? (
                <div className="space-y-4">
                  {ferias.map((item, index) => {
                    const days = countBusinessDays(new Date(item.data_inicio), new Date(item.data_fim));
                    const statusConfig = getStatusConfig(item.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between p-5 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-all duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold">
                              {getInitials(item.profile?.nome || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-base">{item.profile?.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.data_inicio), "d 'de' MMMM", { locale: pt })} → {' '}
                              {format(new Date(item.data_fim), "d 'de' MMMM yyyy", { locale: pt })}
                            </p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {days} dia{days > 1 ? 's' : ''} útei{days > 1 ? 's' : 'l'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge 
                            variant="outline"
                            className={statusConfig.className}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                            {statusConfig.label}
                          </Badge>
                          {item.status === 'pendente' && (
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                                onClick={() => handleFeriasAction(item.id, 'rejeitado')}
                                disabled={processingId === item.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-success hover:bg-success/90 text-white transition-all"
                                onClick={() => handleFeriasAction(item.id, 'aprovado')}
                                disabled={processingId === item.id}
                              >
                                {processingId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                    <Calendar className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">
                    Não existem pedidos de férias
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Os pedidos aparecem aqui quando submetidos
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Faltas Tab */}
        <TabsContent value="faltas">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Justificações de Faltas</h2>
                  <p className="text-sm text-muted-foreground">{faltas.length} justificações no total</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : faltas.length > 0 ? (
                <div className="space-y-4">
                  {faltas.map((item, index) => {
                    const statusConfig = getStatusConfig(item.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div
                        key={item.id}
                        className="group flex items-start justify-between p-5 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-all duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold">
                              {getInitials(item.profile?.nome || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-base">{item.profile?.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
                            </p>
                            <p className="text-sm mt-2 text-foreground/80">{item.motivo}</p>
                            {item.comprovativo_url && (
                              <a
                                href={item.comprovativo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2 font-medium"
                              >
                                <FileText className="h-3 w-3" />
                                Ver comprovativo
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge 
                            variant="outline"
                            className={statusConfig.className}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                            {statusConfig.label}
                          </Badge>
                          {item.status === 'pendente' && (
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                                onClick={() => handleFaltaAction(item.id, 'rejeitado')}
                                disabled={processingId === item.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-success hover:bg-success/90 text-white transition-all"
                                onClick={() => handleFaltaAction(item.id, 'aprovado')}
                                disabled={processingId === item.id}
                              >
                                {processingId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">
                    Não existem justificações de faltas
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    As justificações aparecem aqui quando submetidas
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
