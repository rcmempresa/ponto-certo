import { useState, useEffect } from 'react';
import { Clock, Plus, Loader2, Calendar, CheckCircle2, XCircle, Timer, Trash2, Euro } from 'lucide-react';

const RATE_PER_HOUR = 8.16;
const formatEuros = (minutos: number) =>
  `${((minutos / 60) * RATE_PER_HOUR).toFixed(2).replace('.', ',')} €`;
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUser } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { OvertimeDialog } from '@/components/horas-extra/OvertimeDialog';
import { formatOvertimeMinutes } from '@/lib/overtimeCalculator';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface HorasExtraRecord {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  minutos_extra: number;
  motivo: string | null;
  status: string;
  tipo_periodo: string;
  created_at: string;
}

export default function HorasExtra() {
  const { user } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUser();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HorasExtraRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalApproved: 0,
    totalPending: 0,
    monthlyApproved: 0,
  });

  useEffect(() => {
    if (effectiveUserId) {
      fetchRecords();
    }
  }, [effectiveUserId]);

  const fetchRecords = async () => {
    if (!effectiveUserId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('horas_extra')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('data', { ascending: false });

    if (data) {
      setRecords(data);
      
      // Calculate stats
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      const approved = data.filter(r => r.status === 'aprovado');
      const pending = data.filter(r => r.status === 'pendente');
      const monthlyApproved = approved.filter(r => {
        const date = new Date(r.data);
        return date >= monthStart && date <= monthEnd;
      });

      setStats({
        totalApproved: approved.reduce((sum, r) => sum + r.minutos_extra, 0),
        totalPending: pending.reduce((sum, r) => sum + r.minutos_extra, 0),
        monthlyApproved: monthlyApproved.reduce((sum, r) => sum + r.minutos_extra, 0),
      });
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('horas_extra').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao eliminar registo');
    } else {
      toast.success('Registo eliminado com sucesso');
      fetchRecords();
    }
    setDeleteId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return (
          <Badge className="bg-success/10 text-success border-success/30 hover:bg-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'rejeitado':
        return (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30 hover:bg-warning/20">
            <Timer className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === 'fim_de_semana' ? (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
        Fim de semana
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        Noturno
      </Badge>
    );
  };

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
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Horas Extra
            </h1>
            <p className="text-muted-foreground text-lg">
              Registe e acompanhe as suas horas extraordinárias
            </p>
          </div>

          {!isImpersonating && (
            <Button onClick={() => setDialogOpen(true)} size="lg" className="rounded-xl">
              <Plus className="mr-2 h-5 w-5" />
              Registar Horas Extra
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Aprovado</p>
                <p className="text-2xl font-bold">{formatOvertimeMinutes(stats.totalApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Timer className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold">{formatOvertimeMinutes(stats.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold">{formatOvertimeMinutes(stats.monthlyApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Euro className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor a Receber</p>
                <p className="text-2xl font-bold text-success">{formatEuros(stats.totalApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico de Horas Extra</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Ainda não existem registos de horas extra.</p>
              {!isImpersonating && (
                <Button onClick={() => setDialogOpen(true)} className="mt-4 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Registar Horas Extra
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.data + 'T12:00:00'), "d 'de' MMMM", { locale: pt })}
                    </TableCell>
                    <TableCell>{getTipoBadge(record.tipo_periodo)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.hora_inicio.slice(0, 5)} - {record.hora_fim.slice(0, 5)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatOvertimeMinutes(record.minutos_extra)}
                    </TableCell>
                    <TableCell className="font-semibold text-success">
                      {formatEuros(record.minutos_extra)}
                    </TableCell>
                    <TableCell>
                      {record.motivo && (
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {record.motivo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {record.status === 'pendente' && !isImpersonating && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      {user && (
        <OvertimeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={user.id}
          onSuccess={fetchRecords}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registo de horas extra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida. O registo será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
