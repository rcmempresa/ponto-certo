import { useState, useEffect } from 'react';
import { Clock, Search, Loader2, Plus, ChevronLeft, ChevronRight, Calendar, User } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ManualPunchDialog } from '@/components/ponto/ManualPunchDialog';
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
}

interface DaySummary {
  date: Date;
  hoursWorked: number;
  entries: PontoRecord[];
  isWeekend: boolean;
  isHoliday: boolean;
}

export default function AdminPonto() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [pontoData, setPontoData] = useState<PontoRecord[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    fetchProfiles();
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
      .gte('timestamp', monthStart.toISOString())
      .lte('timestamp', monthEnd.toISOString())
      .order('timestamp', { ascending: true });

    if (data) {
      setPontoData(data);
      calculateDaySummaries(data, monthStart, monthEnd);
    }
  };

  const calculateDaySummaries = (records: PontoRecord[], monthStart: Date, monthEnd: Date) => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const summaries: DaySummary[] = days.map((day) => {
      const dayRecords = records.filter((r) => isSameDay(new Date(r.timestamp), day));

      let hoursWorked = 0;
      let entryTime: Date | null = null;

      for (const record of dayRecords) {
        if (record.tipo === 'entrada') {
          entryTime = new Date(record.timestamp);
        } else if (record.tipo === 'saida' && entryTime) {
          hoursWorked += (new Date(record.timestamp).getTime() - entryTime.getTime()) / 1000 / 3600;
          entryTime = null;
        }
      }

      return {
        date: day,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
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
          <div className="flex gap-4">
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
          </div>
        </div>
      </div>

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
                          <div className="space-y-1">
                            {entries.map((e) => (
                              <Badge
                                key={e.id}
                                variant="outline"
                                className="bg-success/10 text-success border-success/30 mr-1"
                              >
                                {format(new Date(e.timestamp), 'HH:mm')}
                              </Badge>
                            ))}
                            {entries.length === 0 && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {exits.map((e) => (
                              <Badge
                                key={e.id}
                                variant="outline"
                                className="bg-destructive/10 text-destructive border-destructive/30 mr-1"
                              >
                                {format(new Date(e.timestamp), 'HH:mm')}
                              </Badge>
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
    </div>
  );
}
