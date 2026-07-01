import { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, Loader2, CheckCircle2, Timer, User, Euro, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Profile {
  id: string;
  email: string;
  nome: string;
}

interface FolgaRecord {
  id: string;
  user_id: string;
  data: string;
  tipo_dia: string;
  tipo_periodo: string;
  horas: number;
  motivo: string | null;
  status: string;
  profile?: Profile;
}

const RATE_PER_HOUR = 8.16;
const formatHoras = (h: number) => {
  const i = Math.floor(h);
  const m = Math.round((h - i) * 60);
  return m === 0 ? `${i}h` : `${i}h${String(m).padStart(2, '0')}`;
};
const formatEuros = (h: number) => `${(h * RATE_PER_HOUR).toFixed(2).replace('.', ',')} €`;

export default function AdminFolgasTrabalhadas() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<FolgaRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: profilesData }, { data: recordsData }] = await Promise.all([
      supabase.from('profiles').select('id, email, nome').order('nome'),
      supabase.from('folgas_trabalhadas').select('*').order('data', { ascending: false }),
    ]);
    if (profilesData) setProfiles(profilesData as Profile[]);
    if (recordsData) {
      const enriched = recordsData.map((r: any) => ({
        ...r,
        profile: profilesData?.find((p) => p.id === r.user_id),
      }));
      setRecords(enriched as FolgaRecord[]);
    }
    setLoading(false);
  };

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const inSelectedMonth = (r: FolgaRecord) => {
    const d = new Date(r.data + 'T12:00:00');
    return d >= monthStart && d <= monthEnd;
  };

  const monthRecords = useMemo(() => records.filter(inSelectedMonth), [records, monthStart, monthEnd]);

  const filteredRecords = useMemo(() => {
    if (selectedUser === 'all') return monthRecords;
    return monthRecords.filter((r) => r.user_id === selectedUser);
  }, [monthRecords, selectedUser]);

  const summaryByUser = useMemo(() => {
    return profiles.map((p) => {
      const userAll = records.filter((r) => r.user_id === p.id);
      const userMonth = monthRecords.filter((r) => r.user_id === p.id);
      const monthApproved = userMonth.filter((r) => r.status === 'aprovado');
      const monthPending = userMonth.filter((r) => r.status === 'pendente');
      const totalApproved = userAll.filter((r) => r.status === 'aprovado').reduce((s, r) => s + Number(r.horas), 0);
      return {
        profile: p,
        totalApproved,
        monthApproved: monthApproved.reduce((s, r) => s + Number(r.horas), 0),
        monthPending: monthPending.reduce((s, r) => s + Number(r.horas), 0),
      };
    });
  }, [profiles, records, monthRecords]);

  const selectedSummary = useMemo(() => {
    if (selectedUser === 'all') return null;
    return summaryByUser.find((s) => s.profile.id === selectedUser) ?? null;
  }, [summaryByUser, selectedUser]);

  const getStatusBadge = (status: string) => {
    if (status === 'aprovado')
      return <Badge className="bg-success/10 text-success border-success/30">Aprovado</Badge>;
    if (status === 'rejeitado')
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">Rejeitado</Badge>;
    return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">Pendente</Badge>;
  };

  const getTipoBadge = (tipo: string) => {
    const map: any = {
      sabado: 'Sábado',
      domingo: 'Domingo',
      feriado: 'Feriado',
    };
    return <Badge variant="outline">{map[tipo] || tipo}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Folgas e Feriados (Admin)
          </h1>
          <p className="text-muted-foreground text-lg">
            Visualize folgas trabalhadas dos seus colaboradores
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-full md:w-80">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Selecionar colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium capitalize">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: pt })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="ml-1 text-xs" onClick={() => setCurrentMonth(new Date())}>
            Hoje
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : selectedUser === 'all' ? (
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Resumo por Colaborador — {format(currentMonth, "MMMM 'de' yyyy", { locale: pt })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Aprovado (mês)</TableHead>
                  <TableHead>Pendente (mês)</TableHead>
                  <TableHead>Total Acumulado</TableHead>
                  <TableHead>Valor a Pagar (mês)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByUser.map((s) => (
                  <TableRow key={s.profile.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {s.profile.nome || s.profile.email}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-success">{formatHoras(s.monthApproved)}</TableCell>
                    <TableCell className="font-semibold text-warning">{formatHoras(s.monthPending)}</TableCell>
                    <TableCell className="font-semibold">{formatHoras(s.totalApproved)}</TableCell>
                    <TableCell className="font-semibold text-success">{formatEuros(s.monthApproved)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedSummary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-soft">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aprovado (mês)</p>
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.monthApproved)}</p>
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
                      <p className="text-sm text-muted-foreground">Pendente (mês)</p>
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.monthPending)}</p>
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
                      <p className="text-sm text-muted-foreground">Total Acumulado</p>
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.totalApproved)}</p>
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
                      <p className="text-sm text-muted-foreground">Valor a Pagar (mês)</p>
                      <p className="text-2xl font-bold text-success">{formatEuros(selectedSummary.monthApproved)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Histórico — {format(currentMonth, "MMMM 'de' yyyy", { locale: pt })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Sem registos neste mês.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {format(new Date(r.data + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: pt })}
                        </TableCell>
                        <TableCell>{getTipoBadge(r.tipo_dia)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.tipo_periodo === 'dia_inteiro' ? 'Dia inteiro' : 'Meio dia'}
                        </TableCell>
                        <TableCell className="font-semibold">{formatHoras(Number(r.horas))}</TableCell>
                        <TableCell className="font-semibold text-success">{formatEuros(Number(r.horas))}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                          {r.motivo || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
