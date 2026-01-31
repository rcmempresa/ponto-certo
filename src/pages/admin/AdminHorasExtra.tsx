import { useState, useEffect } from 'react';
import { Clock, Loader2, Check, X, Timer, User, Calendar, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { OvertimeDialog } from '@/components/horas-extra/OvertimeDialog';
import { formatOvertimeMinutes } from '@/lib/overtimeCalculator';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Profile {
  id: string;
  email: string;
  nome: string;
  cargo: string | null;
}

interface HorasExtraRecord {
  id: string;
  user_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  minutos_extra: number;
  motivo: string | null;
  status: string;
  tipo_periodo: string;
  created_at: string;
  profile?: Profile;
}

export default function AdminHorasExtra() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingRecords, setPendingRecords] = useState<HorasExtraRecord[]>([]);
  const [allRecords, setAllRecords] = useState<HorasExtraRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserForDialog, setSelectedUserForDialog] = useState<string>('');
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HorasExtraRecord | null>(null);
  const [editData, setEditData] = useState({
    data: '',
    hora_inicio: '',
    hora_fim: '',
    motivo: '',
  });

  useEffect(() => {
    fetchProfiles();
    fetchPendingRecords();
  }, []);

  useEffect(() => {
    fetchAllRecords();
  }, [currentMonth, selectedUser]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, nome, cargo')
      .order('nome');

    if (data) {
      setProfiles(data);
      if (data.length > 0) {
        setSelectedUserForDialog(data[0].id);
      }
    }
  };

  const fetchPendingRecords = async () => {
    const { data } = await supabase
      .from('horas_extra')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo')
        .in('id', userIds);

      const recordsWithProfiles = data.map((r) => ({
        ...r,
        profile: profilesData?.find((p) => p.id === r.user_id),
      }));

      setPendingRecords(recordsWithProfiles);
    }
  };

  const fetchAllRecords = async () => {
    setLoading(true);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    let query = supabase
      .from('horas_extra')
      .select('*')
      .gte('data', format(monthStart, 'yyyy-MM-dd'))
      .lte('data', format(monthEnd, 'yyyy-MM-dd'))
      .order('data', { ascending: false });

    if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser);
    }

    const { data } = await query;

    if (data) {
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo')
        .in('id', userIds);

      const recordsWithProfiles = data.map((r) => ({
        ...r,
        profile: profilesData?.find((p) => p.id === r.user_id),
      }));

      setAllRecords(recordsWithProfiles);
    }

    setLoading(false);
  };

  const handleAction = async (id: string, action: 'aprovado' | 'rejeitado') => {
    setProcessingId(id);

    const { error } = await supabase
      .from('horas_extra')
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
        title: action === 'aprovado' ? 'Horas extra aprovadas' : 'Horas extra rejeitadas',
        description: action === 'aprovado'
          ? 'As horas extra foram aprovadas com sucesso.'
          : 'O pedido foi rejeitado.',
      });
      fetchPendingRecords();
      fetchAllRecords();
    }

    setProcessingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('horas_extra').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível eliminar.', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'O registo de horas extra foi eliminado.' });
      fetchPendingRecords();
      fetchAllRecords();
    }
    setDeletingId(null);
  };

  const openEditDialog = (record: HorasExtraRecord) => {
    setSelectedRecord(record);
    setEditData({
      data: record.data,
      hora_inicio: record.hora_inicio.slice(0, 5),
      hora_fim: record.hora_fim.slice(0, 5),
      motivo: record.motivo || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord) return;
    setProcessingId(selectedRecord.id);
    
    const { error } = await supabase
      .from('horas_extra')
      .update({
        data: editData.data,
        hora_inicio: editData.hora_inicio,
        hora_fim: editData.hora_fim,
        motivo: editData.motivo || null,
      })
      .eq('id', selectedRecord.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível guardar.', variant: 'destructive' });
    } else {
      toast({ title: 'Guardado', description: 'O registo foi atualizado.' });
      setEditDialogOpen(false);
      fetchPendingRecords();
      fetchAllRecords();
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
    switch (status) {
      case 'aprovado':
        return <Badge className="bg-success/10 text-success border-success/30">Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">Pendente</Badge>;
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

  const totalApprovedThisMonth = allRecords
    .filter((r) => r.status === 'aprovado')
    .reduce((sum, r) => sum + r.minutos_extra, 0);

  const handleAddOvertime = () => {
    if (selectedUser !== 'all') {
      setSelectedUserForDialog(selectedUser);
    }
    setDialogOpen(true);
  };

  const selectedProfile = profiles.find((p) => p.id === selectedUserForDialog);

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
                <Timer className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Gestão de Horas Extra
            </h1>
            <p className="text-muted-foreground text-lg">
              Aprovar e visualizar horas extraordinárias da equipa
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRecords.length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-background/80 backdrop-blur border border-border/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Timer className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatOvertimeMinutes(totalApprovedThisMonth)}</p>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingRecords.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Timer className="h-5 w-5 text-warning" />
              Pedidos Pendentes de Aprovação
              <Badge variant="secondary" className="ml-2 bg-warning/20 text-warning">
                {pendingRecords.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold text-sm">
                        {getInitials(record.profile?.nome || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{record.profile?.nome || 'Colaborador'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(record.data + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getTipoBadge(record.tipo_periodo)}
                      <span className="text-sm">
                        {record.hora_inicio.slice(0, 5)} - {record.hora_fim.slice(0, 5)}
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {formatOvertimeMinutes(record.minutos_extra)}
                      </span>
                    </div>
                    {record.motivo && (
                      <span className="text-sm text-muted-foreground ml-2 truncate max-w-[200px]">
                        — {record.motivo}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                      onClick={() => handleAction(record.id, 'rejeitado')}
                      disabled={processingId === record.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-success hover:bg-success/90 text-white"
                      onClick={() => handleAction(record.id, 'aprovado')}
                      disabled={processingId === record.id}
                    >
                      {processingId === record.id ? (
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

      {/* Filters and Add Button */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-12 rounded-xl border-border/50 bg-card">
              <SelectValue placeholder="Filtrar por colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {profiles.map((profile) => (
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
            <Calendar className="h-4 w-4" />
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
            <Calendar className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={handleAddOvertime} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Horas Extra
        </Button>
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
          ) : allRecords.length === 0 ? (
            <div className="text-center py-12">
              <Timer className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Sem registos de horas extra para este período.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(record.profile?.nome || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{record.profile?.nome || 'Colaborador'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.data + 'T12:00:00'), "d 'de' MMMM", { locale: pt })}
                    </TableCell>
                    <TableCell>{getTipoBadge(record.tipo_periodo)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.hora_inicio.slice(0, 5)} - {record.hora_fim.slice(0, 5)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatOvertimeMinutes(record.minutos_extra)}
                    </TableCell>
                    <TableCell>
                      {record.motivo && (
                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                          {record.motivo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(record)}
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
                              <AlertDialogTitle>Eliminar registo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser revertida.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(record.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {deletingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      {selectedUserForDialog && (
        <OvertimeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={selectedUserForDialog}
          userName={selectedProfile?.nome}
          isAdmin
          onSuccess={() => {
            fetchPendingRecords();
            fetchAllRecords();
          }}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Horas Extra</DialogTitle>
            <DialogDescription>
              Alterar os dados do registo de {selectedRecord?.profile?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-data">Data</Label>
              <Input
                id="edit-data"
                type="date"
                value={editData.data}
                onChange={(e) => setEditData({ ...editData, data: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-hora-inicio">Hora Início</Label>
                <Input
                  id="edit-hora-inicio"
                  type="time"
                  value={editData.hora_inicio}
                  onChange={(e) => setEditData({ ...editData, hora_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-hora-fim">Hora Fim</Label>
                <Input
                  id="edit-hora-fim"
                  type="time"
                  value={editData.hora_fim}
                  onChange={(e) => setEditData({ ...editData, hora_fim: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-motivo">Motivo</Label>
              <Textarea
                id="edit-motivo"
                value={editData.motivo}
                onChange={(e) => setEditData({ ...editData, motivo: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={processingId === selectedRecord?.id}>
              {processingId === selectedRecord?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
