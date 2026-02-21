import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  Clock,
  Users,
  Palmtree,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  CalendarDays,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO, differenceInMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateWorkHours } from '@/lib/workHoursCalculator';
import { exportToPDF, exportToExcel, ReportData } from '@/lib/exportUtils';
import { isHoliday } from '@/lib/holidays';

interface Profile {
  id: string;
  nome: string;
  cargo: string | null;
  saldo_ferias: number;
}

interface PontoRecord {
  id: string;
  user_id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
  status: string;
}

interface FeriasRecord {
  id: string;
  user_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  tipo_inicio: string;
  tipo_fim: string;
}

interface FaltaRecord {
  id: string;
  user_id: string;
  data: string;
  tipo_falta: string;
  motivo: string;
  status: string;
}

interface HorasExtraRecord {
  id: string;
  user_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  minutos_extra: number;
  status: string;
}

interface EmployeeMonthlyReport {
  userId: string;
  nome: string;
  cargo: string | null;
  diasTrabalhados: number;
  horasTrabalhadas: number;
  diasFerias: number;
  diasFalta: number;
  horasExtra: number;
  saldoFerias: number;
}

export default function AdminRelatorios() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pontoRecords, setPontoRecords] = useState<PontoRecord[]>([]);
  const [feriasRecords, setFeriasRecords] = useState<FeriasRecord[]>([]);
  const [faltasRecords, setFaltasRecords] = useState<FaltaRecord[]>([]);
  const [horasExtraRecords, setHorasExtraRecords] = useState<HorasExtraRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  // Generate last 12 months for selection
  const monthOptions = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, "MMMM 'de' yyyy", { locale: pt }),
      });
    }
    return months;
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);

    // Fetch all data in parallel
    const [profilesRes, pontoRes, feriasRes, faltasRes, horasExtraRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase
        .from('ponto')
        .select('*')
        .gte('timestamp', monthStart.toISOString())
        .lte('timestamp', monthEnd.toISOString())
        .eq('status', 'aprovado'),
      supabase
        .from('ferias')
        .select('*')
        .eq('status', 'aprovado')
        .or(`data_inicio.lte.${format(monthEnd, 'yyyy-MM-dd')},data_fim.gte.${format(monthStart, 'yyyy-MM-dd')}`),
      supabase
        .from('faltas')
        .select('*')
        .eq('status', 'aprovado')
        .gte('data', format(monthStart, 'yyyy-MM-dd'))
        .lte('data', format(monthEnd, 'yyyy-MM-dd')),
      supabase
        .from('horas_extra')
        .select('*')
        .eq('status', 'aprovado')
        .gte('data', format(monthStart, 'yyyy-MM-dd'))
        .lte('data', format(monthEnd, 'yyyy-MM-dd')),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (pontoRes.data) setPontoRecords(pontoRes.data as PontoRecord[]);
    if (feriasRes.data) setFeriasRecords(feriasRes.data);
    if (faltasRes.data) setFaltasRecords(faltasRes.data);
    if (horasExtraRes.data) setHorasExtraRecords(horasExtraRes.data);

    setLoading(false);
  };

  // Calculate monthly report for each employee
  const monthlyReports = useMemo(() => {
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return profiles
      .filter(p => selectedEmployee === 'all' || p.id === selectedEmployee)
      .map(profile => {
        // Calculate worked days and hours
        const userPonto = pontoRecords.filter(p => p.user_id === profile.id);
        const dayRecords: Record<string, PontoRecord[]> = {};
        
        userPonto.forEach(record => {
          const day = format(parseISO(record.timestamp), 'yyyy-MM-dd');
          if (!dayRecords[day]) dayRecords[day] = [];
          dayRecords[day].push(record);
        });

        let diasTrabalhados = 0;
        let horasTrabalhadas = 0;

        Object.entries(dayRecords).forEach(([day, records]) => {
          const hours = calculateWorkHours(
            records.map(r => ({ tipo: r.tipo, timestamp: r.timestamp, status: r.status })),
            false,
            true,
            true
          );
          if (hours > 0) {
            diasTrabalhados++;
            horasTrabalhadas += hours;
          }
        });

        // Calculate vacation days in this month (accounting for half-days)
        const userFerias = feriasRecords.filter(f => f.user_id === profile.id);
        let diasFerias = 0;
        
        userFerias.forEach(ferias => {
          const feriaStart = parseISO(ferias.data_inicio);
          const feriaEnd = parseISO(ferias.data_fim);
          const tipoInicio = ferias.tipo_inicio || 'manha';
          const tipoFim = ferias.tipo_fim || 'tarde';
          
          const businessDaysInRange: Date[] = [];
          daysInMonth.forEach(day => {
            if (day >= feriaStart && day <= feriaEnd && !isWeekend(day) && !isHoliday(day)) {
              businessDaysInRange.push(day);
            }
          });

          businessDaysInRange.forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const startStr = format(feriaStart, 'yyyy-MM-dd');
            const endStr = format(feriaEnd, 'yyyy-MM-dd');
            
            if (startStr === endStr) {
              // Single day vacation
              if (tipoInicio === 'manha' && tipoFim === 'tarde') {
                diasFerias += 1;
              } else {
                diasFerias += 0.5;
              }
            } else if (dayStr === startStr && tipoInicio === 'tarde') {
              diasFerias += 0.5;
            } else if (dayStr === endStr && tipoFim === 'manha') {
              diasFerias += 0.5;
            } else {
              diasFerias += 1;
            }
          });
        });

        // Calculate absence days
        const diasFalta = faltasRecords.filter(f => f.user_id === profile.id).length;

        // Calculate overtime hours
        const userHorasExtra = horasExtraRecords.filter(h => h.user_id === profile.id);
        const horasExtra = userHorasExtra.reduce((acc, h) => acc + Math.floor(h.minutos_extra / 60), 0);

        return {
          userId: profile.id,
          nome: profile.nome,
          cargo: profile.cargo,
          diasTrabalhados,
          horasTrabalhadas,
          diasFerias,
          diasFalta,
          horasExtra,
          saldoFerias: profile.saldo_ferias,
        } as EmployeeMonthlyReport;
      });
  }, [profiles, pontoRecords, feriasRecords, faltasRecords, horasExtraRecords, selectedMonth, selectedEmployee]);

  // Summary totals
  const summary = useMemo(() => {
    return {
      totalDiasTrabalhados: monthlyReports.reduce((acc, r) => acc + r.diasTrabalhados, 0),
      totalHorasTrabalhadas: monthlyReports.reduce((acc, r) => acc + r.horasTrabalhadas, 0),
      totalDiasFerias: monthlyReports.reduce((acc, r) => acc + r.diasFerias, 0),
      totalDiasFalta: monthlyReports.reduce((acc, r) => acc + r.diasFalta, 0),
      totalHorasExtra: monthlyReports.reduce((acc, r) => acc + r.horasExtra, 0),
      colaboradores: monthlyReports.length,
    };
  }, [monthlyReports]);

  // Prepare vacation details
  const vacationDetails = useMemo(() => {
    return feriasRecords
      .filter(f => selectedEmployee === 'all' || f.user_id === selectedEmployee)
      .map(f => {
        const profile = profiles.find(p => p.id === f.user_id);
        return {
          nome: profile?.nome || 'Desconhecido',
          inicio: format(parseISO(f.data_inicio), 'dd/MM/yyyy'),
          fim: format(parseISO(f.data_fim), 'dd/MM/yyyy'),
          status: f.status,
        };
      });
  }, [feriasRecords, profiles, selectedEmployee]);

  // Prepare absence details
  const absenceDetails = useMemo(() => {
    return faltasRecords
      .filter(f => selectedEmployee === 'all' || f.user_id === selectedEmployee)
      .map(f => {
        const profile = profiles.find(p => p.id === f.user_id);
        return {
          nome: profile?.nome || 'Desconhecido',
          data: format(parseISO(f.data), 'dd/MM/yyyy'),
          tipo: f.tipo_falta === 'dia_inteiro' ? 'Dia Inteiro' : 'Parcial',
          motivo: f.motivo,
        };
      });
  }, [faltasRecords, profiles, selectedEmployee]);

  // Export handlers
  const handleExportPDF = (type: 'resumo' | 'ferias' | 'faltas') => {
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    
    let reportData: ReportData;

    if (type === 'resumo') {
      reportData = {
        title: 'Relatório Mensal de Horas e Presenças',
        subtitle: monthLabel,
        headers: ['Colaborador', 'Cargo', 'Dias Trab.', 'Horas Trab.', 'Dias Férias', 'Dias Falta', 'Horas Extra'],
        rows: monthlyReports.map(r => [
          r.nome,
          r.cargo || '-',
          r.diasTrabalhados,
          r.horasTrabalhadas,
          Number.isInteger(r.diasFerias) ? r.diasFerias : r.diasFerias.toFixed(1).replace('.', ','),
          r.diasFalta,
          r.horasExtra,
        ]),
      };
    } else if (type === 'ferias') {
      reportData = {
        title: 'Relatório de Férias',
        subtitle: monthLabel,
        headers: ['Colaborador', 'Data Início', 'Data Fim', 'Estado'],
        rows: vacationDetails.map(v => [v.nome, v.inicio, v.fim, v.status === 'aprovado' ? 'Aprovado' : v.status]),
      };
    } else {
      reportData = {
        title: 'Relatório de Faltas',
        subtitle: monthLabel,
        headers: ['Colaborador', 'Data', 'Tipo', 'Motivo'],
        rows: absenceDetails.map(a => [a.nome, a.data, a.tipo, a.motivo]),
      };
    }

    exportToPDF(reportData, `relatorio-${type}-${selectedMonth}`);
  };

  const handleExportExcel = (type: 'resumo' | 'ferias' | 'faltas') => {
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    
    let reportData: ReportData;

    if (type === 'resumo') {
      reportData = {
        title: 'Relatório Mensal',
        headers: ['Colaborador', 'Cargo', 'Dias Trabalhados', 'Horas Trabalhadas', 'Dias Férias', 'Dias Falta', 'Horas Extra'],
        rows: monthlyReports.map(r => [
          r.nome,
          r.cargo || '-',
          r.diasTrabalhados,
          r.horasTrabalhadas,
          Number.isInteger(r.diasFerias) ? r.diasFerias : r.diasFerias.toFixed(1).replace('.', ','),
          r.diasFalta,
          r.horasExtra,
        ]),
      };
    } else if (type === 'ferias') {
      reportData = {
        title: 'Relatório de Férias',
        headers: ['Colaborador', 'Data Início', 'Data Fim', 'Estado'],
        rows: vacationDetails.map(v => [v.nome, v.inicio, v.fim, v.status === 'aprovado' ? 'Aprovado' : v.status]),
      };
    } else {
      reportData = {
        title: 'Relatório de Faltas',
        headers: ['Colaborador', 'Data', 'Tipo', 'Motivo'],
        rows: absenceDetails.map(a => [a.nome, a.data, a.tipo, a.motivo]),
      };
    }

    exportToExcel(reportData, `relatorio-${type}-${selectedMonth}`);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 md:p-10">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -right-10 md:-right-20 -top-10 md:-top-20 h-32 md:h-64 w-32 md:w-64 rounded-full bg-primary/20 blur-2xl md:blur-3xl" />
        <div className="absolute -left-10 md:-left-20 -bottom-10 md:-bottom-20 h-24 md:h-48 w-24 md:w-48 rounded-full bg-primary/10 blur-2xl md:blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/20">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <Badge variant="secondary" className="font-normal text-xs md:text-sm">
              Centro de Relatórios
            </Badge>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 md:mb-2">
            Relatórios
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg max-w-xl">
            Análise detalhada de horas, férias e faltas da equipa
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Colaborador</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os colaboradores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                <CalendarDays className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalDiasTrabalhados}</p>
                <p className="text-xs text-muted-foreground">Dias Trabalhados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalHorasTrabalhadas}h</p>
                <p className="text-xs text-muted-foreground">Horas Trabalhadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Palmtree className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Number.isInteger(summary.totalDiasFerias) ? summary.totalDiasFerias : summary.totalDiasFerias.toFixed(1).replace('.', ',')}</p>
                <p className="text-xs text-muted-foreground">Dias Férias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/20">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalDiasFalta}</p>
                <p className="text-xs text-muted-foreground">Dias Falta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                <Timer className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalHorasExtra}h</p>
                <p className="text-xs text-muted-foreground">Horas Extra</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports Tabs */}
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className={isMobile ? 'hidden' : ''}>Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="ferias" className="gap-2">
            <Palmtree className="h-4 w-4" />
            <span className={isMobile ? 'hidden' : ''}>Férias</span>
          </TabsTrigger>
          <TabsTrigger value="faltas" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className={isMobile ? 'hidden' : ''}>Faltas</span>
          </TabsTrigger>
        </TabsList>

        {/* Resumo Tab */}
        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resumo Mensal por Colaborador</CardTitle>
                  <CardDescription>
                    Visão geral de horas e presenças
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF('resumo')}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportExcel('resumo')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                        <TableHead className="text-center">Dias Trab.</TableHead>
                        <TableHead className="text-center">Horas Trab.</TableHead>
                        <TableHead className="text-center">Férias</TableHead>
                        <TableHead className="text-center">Faltas</TableHead>
                        <TableHead className="text-center">Horas Extra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReports.map(report => (
                        <TableRow key={report.userId}>
                          <TableCell className="font-medium">{report.nome}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {report.cargo || '-'}
                          </TableCell>
                          <TableCell className="text-center">{report.diasTrabalhados}</TableCell>
                          <TableCell className="text-center">{report.horasTrabalhadas}h</TableCell>
                          <TableCell className="text-center">
                            {report.diasFerias > 0 ? (
                              <Badge variant="secondary">{Number.isInteger(report.diasFerias) ? report.diasFerias : report.diasFerias.toFixed(1).replace('.', ',')}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {report.diasFalta > 0 ? (
                              <Badge variant="destructive">{report.diasFalta}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {report.horasExtra > 0 ? (
                              <Badge className="bg-warning/20 text-warning">{report.horasExtra}h</Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {monthlyReports.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum dado encontrado para o período selecionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Férias Tab */}
        <TabsContent value="ferias">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Férias Aprovadas</CardTitle>
                  <CardDescription>
                    Registo de férias do mês selecionado
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF('ferias')}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportExcel('ferias')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Data Início</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacationDetails.map((vacation, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{vacation.nome}</TableCell>
                          <TableCell>{vacation.inicio}</TableCell>
                          <TableCell>{vacation.fim}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-success/20 text-success">
                              Aprovado
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {vacationDetails.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum registo de férias para o período selecionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Faltas Tab */}
        <TabsContent value="faltas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Faltas Justificadas</CardTitle>
                  <CardDescription>
                    Registo de faltas do mês selecionado
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF('faltas')}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportExcel('faltas')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absenceDetails.map((absence, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{absence.nome}</TableCell>
                          <TableCell>{absence.data}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{absence.tipo}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground max-w-xs truncate">
                            {absence.motivo}
                          </TableCell>
                        </TableRow>
                      ))}
                      {absenceDetails.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum registo de faltas para o período selecionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
