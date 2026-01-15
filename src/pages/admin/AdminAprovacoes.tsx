import { useState, useEffect } from 'react';
import { Check, X, Loader2, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

      console.log('Profile fetch:', { profileData, profileError, userId: request.user_id });

      if (profileData) {
        const currentSaldo = profileData.saldo_ferias ?? 22;
        const newSaldo = Math.max(0, currentSaldo - businessDays);
        
        console.log('Updating saldo:', { currentSaldo, businessDays, newSaldo });
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ saldo_ferias: newSaldo })
          .eq('id', request.user_id);
          
        if (updateError) {
          console.error('Error updating saldo:', updateError);
          toast({
            title: 'Aviso',
            description: 'Férias aprovadas mas houve erro ao atualizar o saldo.',
            variant: 'destructive',
          });
        } else {
          console.log('Saldo updated successfully to', newSaldo);
        }
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      pendente: { variant: 'secondary', label: 'Pendente' },
      aprovado: { variant: 'default', label: 'Aprovado' },
      rejeitado: { variant: 'destructive', label: 'Rejeitado' },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const pendingFerias = ferias.filter((f) => f.status === 'pendente');
  const pendingFaltas = faltas.filter((f) => f.status === 'pendente');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Centro de Aprovações</h1>
        <p className="text-muted-foreground">
          Gerir pedidos de férias e justificações de faltas
        </p>
      </div>

      <Tabs defaultValue="ferias" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ferias" className="gap-2">
            <Calendar className="h-4 w-4" />
            Férias
            {pendingFerias.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {pendingFerias.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="faltas" className="gap-2">
            <FileText className="h-4 w-4" />
            Faltas
            {pendingFaltas.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {pendingFaltas.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Férias Tab */}
        <TabsContent value="ferias">
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Pedidos de Férias</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ferias.length > 0 ? (
                <div className="space-y-4">
                  {ferias.map((item) => {
                    const days = countBusinessDays(new Date(item.data_inicio), new Date(item.data_fim));
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(item.profile?.nome || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{item.profile?.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.data_inicio), 'd MMM', { locale: pt })} -{' '}
                              {format(new Date(item.data_fim), 'd MMM yyyy', { locale: pt })} ({days} dias)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(item.status)}
                          {item.status === 'pendente' && (
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleFeriasAction(item.id, 'rejeitado')}
                                disabled={processingId === item.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-success hover:bg-success/90"
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
                <p className="text-sm text-muted-foreground text-center py-8">
                  Não existem pedidos de férias.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faltas Tab */}
        <TabsContent value="faltas">
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Justificações de Faltas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : faltas.length > 0 ? (
                <div className="space-y-4">
                  {faltas.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 rounded-lg bg-muted/30 border"
                    >
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(item.profile?.nome || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{item.profile?.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(item.data), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                          </p>
                          <p className="text-sm mt-1">{item.motivo}</p>
                          {item.comprovativo_url && (
                            <a
                              href={item.comprovativo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              Ver comprovativo
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(item.status)}
                        {item.status === 'pendente' && (
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleFaltaAction(item.id, 'rejeitado')}
                              disabled={processingId === item.id}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-8 w-8 bg-success hover:bg-success/90"
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
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Não existem justificações de faltas.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
