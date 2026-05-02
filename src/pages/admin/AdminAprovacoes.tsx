import { useState, useEffect } from 'react';
import { Check, X, Loader2, Calendar, FileText, Clock, AlertCircle, CheckCircle2, Timer, Pencil, Trash2, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';

type TipoInicio = 'manha' | 'tarde';
type TipoFim = 'manha' | 'tarde';

// Calculate business days with half-day adjustments
const countBusinessDays = (
  start: Date, 
  end: Date, 
  tipoInicio: TipoInicio = 'manha', 
  tipoFim: TipoFim = 'tarde'
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

const formatDays = (days: number): string => {
  if (days === 0.5) return '½ dia';
  if (days === 1) return '1 dia útil';
  if (days % 1 === 0.5) return `${Math.floor(days)}½ dias úteis`;
  return `${days} dias úteis`;
};

interface FeriasRequest {
  id: string;
  user_id: string;
  data_inicio: string;
  data_fim: string;
  tipo_inicio: TipoInicio;
  tipo_fim: TipoFim;
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

interface PontoRequest {
  id: string;
  user_id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
  status: string;
  manual: boolean;
  observacoes: string | null;
  localizacao: string | null;
  profile?: {
    nome: string;
    email: string;
    cargo: string | null;
  };
}

interface FolgaTrabRequest {
  id: string;
  user_id: string;
  data: string;
  tipo_dia: string;
  tipo_periodo: string;
  horas: number;
  motivo: string | null;
  status: string;
  created_at: string;
  profile?: { nome: string; email: string; cargo: string | null };
}

export default function AdminAprovacoes() {
  const { toast } = useToast();
  const [ferias, setFerias] = useState<FeriasRequest[]>([]);
  const [faltas, setFaltas] = useState<FaltaRequest[]>([]);
  const [pontos, setPontos] = useState<PontoRequest[]>([]);
  const [folgasTrab, setFolgasTrab] = useState<FolgaTrabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Edit states
  const [editFeriasOpen, setEditFeriasOpen] = useState(false);
  const [editFaltaOpen, setEditFaltaOpen] = useState(false);
  const [editPontoOpen, setEditPontoOpen] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState<FeriasRequest | null>(null);
  const [selectedFalta, setSelectedFalta] = useState<FaltaRequest | null>(null);
  const [selectedPonto, setSelectedPonto] = useState<PontoRequest | null>(null);
  
  // Edit form states
  const [editFeriasData, setEditFeriasData] = useState({ data_inicio: '', data_fim: '' });
  const [editFaltaData, setEditFaltaData] = useState({ data: '', motivo: '' });
  const [editPontoData, setEditPontoData] = useState({ timestamp: '', observacoes: '' });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data: profiles } = await supabase.from('profiles').select('id, nome, email, cargo');

    const { data: feriasData } = await supabase
      .from('ferias')
      .select('*')
      .order('created_at', { ascending: false });

    if (feriasData && profiles) {
      const feriasWithProfiles = feriasData.map((f) => ({
        ...f,
        tipo_inicio: (f.tipo_inicio || 'manha') as TipoInicio,
        tipo_fim: (f.tipo_fim || 'tarde') as TipoFim,
        profile: profiles.find((p) => p.id === f.user_id),
      }));
      setFerias(feriasWithProfiles as FeriasRequest[]);
    }

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

    const { data: pontoData } = await supabase
      .from('ponto')
      .select('*')
      .eq('manual', true)
      .order('timestamp', { ascending: false });

    if (pontoData && profiles) {
      const pontoWithProfiles = pontoData.map((p) => ({
        ...p,
        profile: profiles.find((pr) => pr.id === p.user_id),
      }));
      setPontos(pontoWithProfiles);
    }

    const { data: folgasData } = await supabase
      .from('folgas_trabalhadas')
      .select('*')
      .order('created_at', { ascending: false });

    if (folgasData && profiles) {
      setFolgasTrab(
        folgasData.map((f) => ({
          ...f,
          profile: profiles.find((p) => p.id === f.user_id),
        })) as FolgaTrabRequest[]
      );
    }

    setLoading(false);
  };

  const handleFolgaAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);
    const { error } = await supabase.from('folgas_trabalhadas').update({ status: action }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível processar.', variant: 'destructive' });
    } else {
      toast({
        title: action === 'aprovado' ? 'Folga trabalhada aprovada' : 'Folga trabalhada rejeitada',
        description: 'O colaborador será notificado.',
      });
      fetchRequests();
    }
    setProcessingId(null);
  };

  const handleDeleteFolga = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('folgas_trabalhadas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'O registo foi eliminado.' });
      fetchRequests();
    }
    setDeletingId(null);
  };

  const handleFeriasAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);
    const request = ferias.find(f => f.id === id);
    if (!request) {
      setProcessingId(null);
      return;
    }

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

    if (action === 'aprovado') {
      const businessDays = countBusinessDays(
        new Date(request.data_inicio),
        new Date(request.data_fim),
        request.tipo_inicio || 'manha',
        request.tipo_fim || 'tarde'
      );

      const { data: profileData } = await supabase
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

  const handlePontoAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);

    const { error } = await supabase
      .from('ponto')
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
        title: action === 'aprovado' ? 'Ponto aprovado' : 'Ponto rejeitado',
        description: 'O colaborador será notificado.',
      });
      fetchRequests();
    }

    setProcessingId(null);
  };

  // Delete handlers
  const handleDeleteFerias = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('ferias').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'O pedido de férias foi eliminado.' });
      fetchRequests();
    }
    setDeletingId(null);
  };

  const handleDeleteFalta = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('faltas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'A justificação de falta foi eliminada.' });
      fetchRequests();
    }
    setDeletingId(null);
  };

  const handleDeletePonto = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('ponto').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'O registo de ponto foi eliminado.' });
      fetchRequests();
    }
    setDeletingId(null);
  };

  // Edit handlers
  const openEditFerias = (item: FeriasRequest) => {
    setSelectedFerias(item);
    setEditFeriasData({ data_inicio: item.data_inicio, data_fim: item.data_fim });
    setEditFeriasOpen(true);
  };

  const openEditFalta = (item: FaltaRequest) => {
    setSelectedFalta(item);
    setEditFaltaData({ data: item.data, motivo: item.motivo });
    setEditFaltaOpen(true);
  };

  const openEditPonto = (item: PontoRequest) => {
    setSelectedPonto(item);
    const date = new Date(item.timestamp);
    setEditPontoData({ 
      timestamp: format(date, "yyyy-MM-dd'T'HH:mm"), 
      observacoes: item.observacoes || '' 
    });
    setEditPontoOpen(true);
  };

  const handleSaveFerias = async () => {
    if (!selectedFerias) return;
    setProcessingId(selectedFerias.id);
    const { error } = await supabase
      .from('ferias')
      .update({ data_inicio: editFeriasData.data_inicio, data_fim: editFeriasData.data_fim })
      .eq('id', selectedFerias.id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível guardar.', variant: 'destructive' });
    } else {
      toast({ title: 'Guardado', description: 'O pedido de férias foi atualizado.' });
      setEditFeriasOpen(false);
      fetchRequests();
    }
    setProcessingId(null);
  };

  const handleSaveFalta = async () => {
    if (!selectedFalta) return;
    setProcessingId(selectedFalta.id);
    const { error } = await supabase
      .from('faltas')
      .update({ data: editFaltaData.data, motivo: editFaltaData.motivo })
      .eq('id', selectedFalta.id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível guardar.', variant: 'destructive' });
    } else {
      toast({ title: 'Guardado', description: 'A justificação foi atualizada.' });
      setEditFaltaOpen(false);
      fetchRequests();
    }
    setProcessingId(null);
  };

  const handleSavePonto = async () => {
    if (!selectedPonto) return;
    setProcessingId(selectedPonto.id);
    const { error } = await supabase
      .from('ponto')
      .update({ timestamp: new Date(editPontoData.timestamp).toISOString(), observacoes: editPontoData.observacoes || null })
      .eq('id', selectedPonto.id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível guardar.', variant: 'destructive' });
    } else {
      toast({ title: 'Guardado', description: 'O registo de ponto foi atualizado.' });
      setEditPontoOpen(false);
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
  const pendingPontos = pontos.filter((p) => p.status === 'pendente');
  const totalPending = pendingFerias.length + pendingFaltas.length + pendingPontos.length;

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
              Gerir pedidos de férias, justificações de faltas e registos de ponto
            </p>
          </div>
          
          <div className="flex gap-4 flex-wrap">
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
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingPontos.length}</p>
                <p className="text-xs text-muted-foreground">Ponto</p>
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
          <TabsTrigger 
            value="ponto" 
            className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Timer className="h-4 w-4" />
            Ponto
            {pendingPontos.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 justify-center bg-warning/20 text-warning text-xs">
                {pendingPontos.length}
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
                    const days = countBusinessDays(
                      new Date(item.data_inicio), 
                      new Date(item.data_fim),
                      item.tipo_inicio || 'manha',
                      item.tipo_fim || 'tarde'
                    );
                    const statusConfig = getStatusConfig(item.status);
                    const StatusIcon = statusConfig.icon;
                    const isSingleDayItem = item.data_inicio === item.data_fim;
                    
                    // Build period description
                    const getPeriodDescription = () => {
                      if (isSingleDayItem) {
                        if (item.tipo_inicio === 'manha' && item.tipo_fim === 'tarde') {
                          return null; // Full day, no extra info needed
                        } else if (item.tipo_inicio === 'manha') {
                          return 'Manhã';
                        } else {
                          return 'Tarde';
                        }
                      }
                      // Multiple days
                      const parts: string[] = [];
                      if (item.tipo_inicio === 'tarde') parts.push('início à tarde');
                      if (item.tipo_fim === 'manha') parts.push('fim de manhã');
                      return parts.length > 0 ? parts.join(', ') : null;
                    };
                    
                    const periodDescription = getPeriodDescription();
                    
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
                              {isSingleDayItem ? (
                                format(new Date(item.data_inicio), "d 'de' MMMM yyyy", { locale: pt })
                              ) : (
                                <>
                                  {format(new Date(item.data_inicio), "d 'de' MMMM", { locale: pt })} → {' '}
                                  {format(new Date(item.data_fim), "d 'de' MMMM yyyy", { locale: pt })}
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {formatDays(days)}
                              </Badge>
                              {periodDescription && (
                                <Badge variant="secondary" className="text-xs">
                                  {periodDescription}
                                </Badge>
                              )}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={statusConfig.className}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                            {statusConfig.label}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditFerias(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar pedido de férias?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser revertida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteFerias(item.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {item.status === 'pendente' && (
                            <div className="flex gap-2 ml-2">
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
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={statusConfig.className}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                            {statusConfig.label}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditFalta(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar justificação de falta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser revertida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteFalta(item.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {item.status === 'pendente' && (
                            <div className="flex gap-2 ml-2">
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

        {/* Ponto Tab */}
        <TabsContent value="ponto">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <Timer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Registos de Ponto Manuais</h2>
                  <p className="text-sm text-muted-foreground">{pontos.length} registos no total</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pontos.length > 0 ? (
                <div className="space-y-4">
                  {pontos.map((item, index) => {
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
                              {format(new Date(item.timestamp), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={item.tipo === 'entrada' ? 'bg-success/10 text-success border-success/30' : 'bg-primary/10 text-primary border-primary/30'}>
                                {item.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                              </Badge>
                              <span className="text-sm font-medium">
                                às {format(new Date(item.timestamp), 'HH:mm')}
                              </span>
                            </div>
                            {item.observacoes && (
                              <p className="text-sm mt-2 text-foreground/80">{item.observacoes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={statusConfig.className}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                            {statusConfig.label}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditPonto(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar registo de ponto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser revertida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeletePonto(item.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {item.status === 'pendente' && (
                            <div className="flex gap-2 ml-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                                onClick={() => handlePontoAction(item.id, 'rejeitado')}
                                disabled={processingId === item.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-10 w-10 rounded-xl bg-success hover:bg-success/90 text-white transition-all"
                                onClick={() => handlePontoAction(item.id, 'aprovado')}
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
                    <Timer className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">
                    Não existem registos de ponto manuais
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Os pedidos aparecem aqui quando submetidos
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Férias Dialog */}
      <Dialog open={editFeriasOpen} onOpenChange={setEditFeriasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Férias</DialogTitle>
            <DialogDescription>
              Alterar as datas do pedido de férias de {selectedFerias?.profile?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-ferias-inicio">Data Início</Label>
              <Input
                id="edit-ferias-inicio"
                type="date"
                value={editFeriasData.data_inicio}
                onChange={(e) => setEditFeriasData({ ...editFeriasData, data_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ferias-fim">Data Fim</Label>
              <Input
                id="edit-ferias-fim"
                type="date"
                value={editFeriasData.data_fim}
                onChange={(e) => setEditFeriasData({ ...editFeriasData, data_fim: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeriasOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFerias} disabled={processingId === selectedFerias?.id}>
              {processingId === selectedFerias?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Falta Dialog */}
      <Dialog open={editFaltaOpen} onOpenChange={setEditFaltaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Justificação de Falta</DialogTitle>
            <DialogDescription>
              Alterar os dados da falta de {selectedFalta?.profile?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-falta-data">Data</Label>
              <Input
                id="edit-falta-data"
                type="date"
                value={editFaltaData.data}
                onChange={(e) => setEditFaltaData({ ...editFaltaData, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-falta-motivo">Motivo</Label>
              <Textarea
                id="edit-falta-motivo"
                value={editFaltaData.motivo}
                onChange={(e) => setEditFaltaData({ ...editFaltaData, motivo: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFaltaOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFalta} disabled={processingId === selectedFalta?.id}>
              {processingId === selectedFalta?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Ponto Dialog */}
      <Dialog open={editPontoOpen} onOpenChange={setEditPontoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registo de Ponto</DialogTitle>
            <DialogDescription>
              Alterar o registo de {selectedPonto?.tipo} de {selectedPonto?.profile?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-ponto-timestamp">Data e Hora</Label>
              <Input
                id="edit-ponto-timestamp"
                type="datetime-local"
                value={editPontoData.timestamp}
                onChange={(e) => setEditPontoData({ ...editPontoData, timestamp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ponto-obs">Observações</Label>
              <Textarea
                id="edit-ponto-obs"
                value={editPontoData.observacoes}
                onChange={(e) => setEditPontoData({ ...editPontoData, observacoes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPontoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePonto} disabled={processingId === selectedPonto?.id}>
              {processingId === selectedPonto?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
