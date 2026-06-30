import { useState, useEffect } from 'react';
import { CalendarCheck, Plus, Loader2, CheckCircle2, XCircle, Timer, Trash2 } from 'lucide-react';
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
import { FolgaTrabalhadaDialog } from '@/components/folgas-trabalhadas/FolgaTrabalhadaDialog';
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

interface Record {
  id: string;
  data: string;
  tipo_dia: string;
  tipo_periodo: string;
  horas: number;
  motivo: string | null;
  status: string;
}

const formatHoras = (h: number) => {
  const i = Math.floor(h);
  const m = Math.round((h - i) * 60);
  return m === 0 ? `${i}h` : `${i}h${String(m).padStart(2, '0')}`;
};

export default function FolgasTrabalhadas() {
  const { user } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUser();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<Record[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalApproved: 0, totalPending: 0, monthlyApproved: 0 });

  useEffect(() => {
    if (effectiveUserId) fetchRecords();
  }, [effectiveUserId]);

  const fetchRecords = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from('folgas_trabalhadas')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('data', { ascending: false });

    if (data) {
      setRecords(data as Record[]);
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const approved = data.filter((r) => r.status === 'aprovado');
      const pending = data.filter((r) => r.status === 'pendente');
      const monthly = approved.filter((r) => {
        const d = new Date(r.data);
        return d >= monthStart && d <= monthEnd;
      });
      setStats({
        totalApproved: approved.reduce((s, r) => s + Number(r.horas), 0),
        totalPending: pending.reduce((s, r) => s + Number(r.horas), 0),
        monthlyApproved: monthly.reduce((s, r) => s + Number(r.horas), 0),
      });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('folgas_trabalhadas').delete().eq('id', id);
    if (error) toast.error('Erro ao eliminar registo');
    else {
      toast.success('Registo eliminado');
      fetchRecords();
    }
    setDeleteId(null);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'aprovado')
      return (
        <Badge className="bg-success/10 text-success border-success/30 hover:bg-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aprovado
        </Badge>
      );
    if (status === 'rejeitado')
      return (
        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3 mr-1" />
          Rejeitado
        </Badge>
      );
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
        <Timer className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getTipoBadge = (tipo: string) => {
    const map: any = {
      sabado: { label: 'Sábado', cls: 'bg-primary/10 text-primary border-primary/30' },
      domingo: { label: 'Domingo', cls: 'bg-warning/10 text-warning border-warning/30' },
      feriado: { label: 'Feriado', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
    };
    const cfg = map[tipo] || map.feriado;
    return <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                <CalendarCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Folgas e Feriados</h1>
            <p className="text-muted-foreground text-lg">
              Registe horas trabalhadas em sábados, domingos e feriados
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="lg" className="rounded-xl">
            <Plus className="mr-2 h-5 w-5" />
            Registar Folga Trabalhada
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Aprovado</p>
                <p className="text-2xl font-bold">{formatHoras(stats.totalApproved)}</p>
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
                <p className="text-2xl font-bold">{formatHoras(stats.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <CalendarCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold">{formatHoras(stats.monthlyApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Sem registos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {format(new Date(r.data + 'T12:00:00'), "d 'de' MMMM", { locale: pt })}
                    </TableCell>
                    <TableCell>{getTipoBadge(r.tipo_dia)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.tipo_periodo === 'dia_inteiro' ? 'Dia inteiro' : 'Meio dia'}
                    </TableCell>
                    <TableCell className="font-semibold">{formatHoras(Number(r.horas))}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {r.motivo || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell>
                      {r.status === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(r.id)}
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

      {user && (
        <FolgaTrabalhadaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={user.id}
          onSuccess={fetchRecords}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
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
