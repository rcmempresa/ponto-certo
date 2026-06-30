import { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, Loader2, CheckCircle2, Timer, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { format, startOfMonth, endOfMonth } from 'date-fns';
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

const formatHoras = (h: number) => {
  const i = Math.floor(h);
  const m = Math.round((h - i) * 60);
  return m === 0 ? `${i}h` : `${i}h${String(m).padStart(2, '0')}`;
};

export default function AdminFolgasTrabalhadas() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<FolgaRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');

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

  const filteredRecords = useMemo(() => {
    if (selectedUser === 'all') return records;
    return records.filter((r) => r.user_id === selectedUser);
  }, [records, selectedUser]);

  const summaryByUser = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return profiles.map((p) => {
      const userRecs = records.filter((r) => r.user_id === p.id);
      const approved = userRecs.filter((r) => r.status === 'aprovado');
      const pending = userRecs.filter((r) => r.status === 'pendente');
      const monthly = approved.filter((r) => {
        const d = new Date(r.data + 'T12:00:00');
        return d >= monthStart && d <= monthEnd;
      });
      return {
        profile: p,
        totalApproved: approved.reduce((s, r) => s + Number(r.horas), 0),
        totalPending: pending.reduce((s, r) => s + Number(r.horas), 0),
        monthlyApproved: monthly.reduce((s, r) => s + Number(r.horas), 0),
      };
    });
  }, [profiles, records]);

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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : selectedUser === 'all' ? (
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Resumo por Colaborador</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Total Aprovado</TableHead>
                  <TableHead>Pendente</TableHead>
                  <TableHead>Este Mês</TableHead>
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
                    <TableCell className="font-semibold text-success">
                      {formatHoras(s.totalApproved)}
                    </TableCell>
                    <TableCell className="font-semibold text-warning">
                      {formatHoras(s.totalPending)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatHoras(s.monthlyApproved)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedSummary && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-soft">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Aprovado</p>
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.totalApproved)}</p>
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
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.totalPending)}</p>
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
                      <p className="text-2xl font-bold">{formatHoras(selectedSummary.monthlyApproved)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
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
