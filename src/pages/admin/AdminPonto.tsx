import { useState, useEffect } from 'react';
import { Clock, Search, Loader2, Plus, ChevronLeft, ChevronRight, Calendar, User, Check, X, AlertCircle, Timer, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { ManualPunchDialog } from '@/components/ponto/ManualPunchDialog';
import { EditPontoDialog } from '@/components/ponto/EditPontoDialog';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  subMonths,
  addMonths,
  isWeekend,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';
import { calculateWorkHours } from '@/lib/workHoursCalculator';

interface Profile {
  id: string;
  email: string;
  nome: string;
  cargo: string | null;
}

interface PontoRecord {
  id: string;
  user_id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
  localizacao: string | null;
  status?: string;
  manual?: boolean;
  observacoes?: string | null;
}

interface PendingPonto extends PontoRecord {
  profile?: Profile;
}

interface DaySummary {
  date: Date;
  hoursWorked: number;
  entries: PontoRecord[];
  isWeekend: boolean;
  isHoliday: boolean;
}

// Separate component for delete button to avoid portal issues with AlertDialog in loops
function DeletePontoButton({ 
  id, 
  tipo, 
  onDelete, 
  isDeleting 
}: { 
  id: string; 
  tipo: string; 
  onDelete: (id: string) => void; 
  isDeleting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O registo de {tipo} será eliminado permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onDelete(id);
              setOpen(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function AdminPonto() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [pontoData, setPontoData] = useState<PontoRecord[]>([]);
  const [pendingPontos, setPendingPontos] = useState<PendingPonto[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PontoRecord | null>(null);

  useEffect(() => {
    fetchProfiles();
    fetchPendingPontos();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchPontoData();
    }
  }, [selectedUser, currentMonth]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, nome, cargo')
      .order('nome');

    if (data) {
      setProfiles(data);
      if (data.length > 0) {
        setSelectedUser(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchPontoData = async () => {
    if (!selectedUser) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data } = await supabase
      .from('ponto')
      .select('*')
      .eq('user_id', selectedUser)
      .eq('status', 'aprovado')
      .gte('timestamp', monthStart.toISOString())
      .lte('timestamp', monthEnd.toISOString())
      .order('timestamp', { ascending: true });

    if (data) {
      setPontoData(data);
      calculateDaySummaries(data, monthStart, monthEnd);
    }
  };

  const fetchPendingPontos = async () => {
    const { data: pontoData } = await supabase
      .from('ponto')
      .select('*')
      .eq('manual', true)
      .eq('status', 'pendente')
      .order('timestamp', { ascending: false });

    if (pontoData) {
      const userIds = [...new Set(pontoData.map((p) => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo')
        .in('id', userIds);

      const pontoWithProfiles = pontoData.map((p) => ({
        ...p,
        profile: profilesData?.find((pr) => pr.id === p.user_id),
      }));
      setPendingPontos(pontoWithProfiles);
    }
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
        description: action === 'aprovado' 
          ? 'O registo foi aprovado e já aparece no calendário do colaborador.'
          : 'O colaborador será notificado.',
      });
      fetchPendingPontos();
      if (selectedUser) {
        fetchPontoData();
      }
    }

    setProcessingId(null);
  };

  const calculateDaySummaries = (records: PontoRecord[], monthStart: Date, monthEnd: Date) => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const now = new Date();

    const summaries: DaySummary[] = days.map((day) => {
      const dayRecords = records.filter((r) => isSameDay(new Date(r.timestamp), day));
      const isToday = isSameDay(day, now);

      // Use centralized calculation - past days without exit get 0 hours
      const hoursWorked = calculateWorkHours(dayRecords, isToday, true);

      return {
        date: day,
        hoursWorked,
        entries: dayRecords,
        isWeekend: isWeekend(day),
        isHoliday: isHoliday(day),
      };
    });

    setDaySummaries(summaries);
  };

  const handleAddPunch = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const handleEditPonto = (record: PontoRecord) => {
    setSelectedRecord(record);
    setEditDialogOpen(true);
  };

  const handleDeletePonto = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('ponto').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar o registo.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'O registo de ponto foi eliminado.' });
      fetchPendingPontos();
      fetchPontoData();
    }
    setDeletingId(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedProfile = profiles.find((p) => p.id === selectedUser);
  const totalHours = daySummaries.reduce((sum, d) => sum + d.hoursWorked, 0);
  const workingDays = daySummaries.filter((d) => !d.isWeekend && !d.isHoliday && d.hoursWorked > 0).length;

  const filteredProfiles = profiles.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Gestão de Ponto
            </h1>
            <p className="text-muted-foreground text-lg">
              Visualizar e registar horas dos colaboradores
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(totalHours)}h</p>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workingDays}</p>
                <p className="text-xs text-muted-foreground">Dias trabalhados</p>
              </div>
            </div>
            {pendingPontos.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-warning/10 backdrop-blur border border-warning/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{pendingPontos.length}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingPontos.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Timer className="h-5 w-5 text-warning" />
              Pedidos Pendentes de Aprovação
              <Badge variant="secondary" className="ml-2 bg-warning/20 text-warning">
                {pendingPontos.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingPontos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold text-sm">
                        {getInitials(item.profile?.nome || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{item.profile?.nome || 'Colaborador'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.timestamp), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge 
                        variant="outline" 
                        className={item.tipo === 'entrada' 
                          ? 'bg-success/10 text-success border-success/30' 
                          : 'bg-primary/10 text-primary border-primary/30'
                        }
                      >
                        {item.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                      <span className="text-sm font-medium">
                        às {format(new Date(item.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    {item.observacoes && (
                      <span className="text-sm text-muted-foreground ml-2">
                        — {item.observacoes}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                      onClick={() => handlePontoAction(item.id, 'rejeitado')}
                      disabled={processingId === item.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-success hover:bg-success/90 text-white"
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Selection & Month Navigation */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-12 rounded-xl border-border/50 bg-card">
              <SelectValue placeholder="Selecionar colaborador" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
              </div>
              {filteredProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(profile.nome || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span>{profile.nome || profile.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center px-4 py-2 rounded-xl bg-muted">
            {format(currentMonth, 'MMMM yyyy', { locale: pt })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            disabled={addMonths(currentMonth, 1) > new Date()}
            className="rounded-xl"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => handleAddPunch(new Date())} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Picagem
        </Button>
      </div>

      {/* Ponto Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              {selectedProfile?.nome || 'Colaborador'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Data</TableHead>
                  <TableHead className="font-semibold">Entradas</TableHead>
                  <TableHead className="font-semibold">Saídas</TableHead>
                  <TableHead className="font-semibold text-right">Horas</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daySummaries
                  .filter((d) => d.hoursWorked > 0 || (!d.isWeekend && !d.isHoliday))
                  .reverse()
                  .slice(0, 31)
                  .map((day) => {
                    const entries = day.entries.filter((e) => e.tipo === 'entrada');
                    const exits = day.entries.filter((e) => e.tipo === 'saida');

                    return (
                      <TableRow
                        key={day.date.toISOString()}
                        className={
                          day.isWeekend || day.isHoliday
                            ? 'bg-muted/20 text-muted-foreground'
                            : ''
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {format(day.date, "d 'de' MMM", { locale: pt })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({format(day.date, 'EEE', { locale: pt })})
                            </span>
                            {day.isHoliday && (
                              <Badge variant="secondary" className="text-xs">
                                Feriado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entries.map((e) => (
                              <div key={e.id} className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="bg-success/10 text-success border-success/30"
                                >
                                  {format(new Date(e.timestamp), 'HH:mm')}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  onClick={() => handleEditPonto(e)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <DeletePontoButton
                                  id={e.id}
                                  tipo="entrada"
                                  onDelete={handleDeletePonto}
                                  isDeleting={deletingId === e.id}
                                />
                              </div>
                            ))}
                            {entries.length === 0 && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {exits.map((e) => (
                              <div key={e.id} className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="bg-destructive/10 text-destructive border-destructive/30"
                                >
                                  {format(new Date(e.timestamp), 'HH:mm')}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  onClick={() => handleEditPonto(e)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <DeletePontoButton
                                  id={e.id}
                                  tipo="saída"
                                  onDelete={handleDeletePonto}
                                  isDeleting={deletingId === e.id}
                                />
                              </div>
                            ))}
                            {exits.length === 0 && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              day.hoursWorked >= 8
                                ? 'text-success'
                                : day.hoursWorked > 0
                                ? 'text-warning'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {day.hoursWorked > 0 ? `${day.hoursWorked}h` : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddPunch(day.date)}
                            className="h-8 px-2 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Manual Punch Dialog */}
      <ManualPunchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={selectedUser}
        userName={selectedProfile?.nome}
        selectedDate={selectedDate}
        onSuccess={fetchPontoData}
        isAdmin={true}
      />

      {/* Edit Ponto Dialog */}
      <EditPontoDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={selectedRecord}
        onSuccess={fetchPontoData}
      />
    </div>
  );
}
