import { useState, useEffect, useMemo } from 'react';
import { Calendar, Loader2, CheckCircle2, Clock, User, Sun } from 'lucide-react';
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
import { format, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isHoliday } from '@/lib/holidays';

interface Profile {
  id: string;
  email: string;
  nome: string;
  cargo: string | null;
  saldo_ferias: number;
}

interface FeriasRecord {
  id: string;
  user_id: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  tipo_inicio: string;
  tipo_fim: string;
  created_at: string;
  profile?: Profile;
}

const countDays = (r: FeriasRecord): number => {
  const start = parseISO(r.data_inicio);
  const end = parseISO(r.data_fim);
  const business = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d) && !isHoliday(d)).length;
  if (business === 0) return 0;
  if (r.data_inicio === r.data_fim) {
    return r.tipo_inicio === 'manha' && r.tipo_fim === 'tarde' ? 1 : 0.5;
  }
  let total = business;
  if (r.tipo_inicio === 'tarde') total -= 0.5;
  if (r.tipo_fim === 'manha') total -= 0.5;
  return total;
};

const formatDays = (d: number) => (d % 1 === 0 ? `${d} dia${d === 1 ? '' : 's'}` : `${d} dias`);

export default function AdminFerias() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<FeriasRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: profilesData }, { data: recordsData }] = await Promise.all([
      supabase.from('profiles').select('id, email, nome, cargo, saldo_ferias').order('nome'),
      supabase.from('ferias').select('*').order('data_inicio', { ascending: false }),
    ]);
    if (profilesData) setProfiles(profilesData as Profile[]);
    if (recordsData) {
      setRecords(
        (recordsData as any[]).map((r) => ({
          ...r,
          profile: profilesData?.find((p) => p.id === r.user_id),
        })) as FeriasRecord[]
      );
    }
    setLoading(false);
  };

  const years = useMemo(() => {
    const set = new Set<string>(records.map((r) => r.data_inicio.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort().reverse();
  }, [records]);

  const yearRecords = useMemo(
    () => records.filter((r) => r.data_inicio.slice(0, 4) === selectedYear),
    [records, selectedYear]
  );

  const filtered = useMemo(
    () =>
      yearRecords.filter(
        (r) =>
          (selectedUser === 'all' || r.user_id === selectedUser) &&
          (selectedStatus === 'all' || r.status === selectedStatus)
      ),
    [yearRecords, selectedUser, selectedStatus]
  );

  const summary = useMemo(
    () =>
      profiles.map((p) => {
        const own = yearRecords.filter((r) => r.user_id === p.id);
        const sum = (st: string) =>
          own.filter((r) => r.status === st).reduce((s, r) => s + countDays(r), 0);
        return {
          profile: p,
          aprovados: sum('aprovado'),
          pendentes: sum('pendente'),
          rejeitados: sum('rejeitado'),
        };
      }),
    [profiles, yearRecords]
  );

  const totals = useMemo(
    () => ({
      aprovados: summary.reduce((s, x) => s + x.aprovados, 0),
      pendentes: summary.reduce((s, x) => s + x.pendentes, 0),
      saldo: summary.reduce((s, x) => s + Number(x.profile.saldo_ferias ?? 0), 0),
    }),
    [summary]
  );

  const getStatusBadge = (status: string) => {
    if (status === 'aprovado')
      return <Badge className="bg-success/10 text-success border-success/30">Aprovado</Badge>;
    if (status === 'rejeitado')
      return (
        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
          Rejeitado
        </Badge>
      );
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
        Pendente
      </Badge>
    );
  };

  const periodo = (r: FeriasRecord) => {
    if (r.data_inicio === r.data_fim) {
      if (r.tipo_inicio === 'manha' && r.tipo_fim === 'tarde') return 'Dia inteiro';
      return r.tipo_inicio === 'manha' ? '½ dia (manhã)' : '½ dia (tarde)';
    }
    const details: string[] = [];
    if (r.tipo_inicio === 'tarde') details.push('início à tarde');
    if (r.tipo_fim === 'manha') details.push('fim de manhã');
    return details.length ? details.join(', ') : 'Dias inteiros';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Férias da Equipa</h1>
          <p className="text-muted-foreground">Consulte os pedidos e saldos de férias de todos os colaboradores</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Colaborador" />
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
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dias Aprovados ({selectedYear})</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatDays(totals.aprovados)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dias Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatDays(totals.pendentes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total da Equipa</CardTitle>
            <Sun className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatDays(totals.saldo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-employee summary */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <User className="h-4 w-4" /> Resumo por colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Aprovados</TableHead>
                <TableHead className="text-right">Pendentes</TableHead>
                <TableHead className="text-right">Rejeitados</TableHead>
                <TableHead className="text-right">Saldo disponível</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={s.profile.id}>
                  <TableCell className="font-medium">
                    {s.profile.nome || s.profile.email}
                    {s.profile.cargo && (
                      <span className="block text-xs text-muted-foreground">{s.profile.cargo}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatDays(s.aprovados)}</TableCell>
                  <TableCell className="text-right">{formatDays(s.pendentes)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDays(s.rejeitados)}</TableCell>
                  <TableCell className="text-right font-medium">{formatDays(Number(s.profile.saldo_ferias ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedUser(s.profile.id)}>
                      Ver pedidos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed requests */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Pedidos de férias ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem pedidos para os filtros escolhidos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.profile?.nome || r.profile?.email || '—'}</TableCell>
                    <TableCell>{format(parseISO(r.data_inicio), "d MMM yyyy", { locale: pt })}</TableCell>
                    <TableCell>{format(parseISO(r.data_fim), "d MMM yyyy", { locale: pt })}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{periodo(r)}</TableCell>
                    <TableCell className="text-right">{formatDays(countDays(r))}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
