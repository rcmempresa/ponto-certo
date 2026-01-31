import { useState, useEffect } from 'react';
import { FileText, Plus, Loader2, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AttendanceCalendar } from '@/components/faltas/AttendanceCalendar';

interface FaltaRecord {
  id: string;
  data: string;
  motivo: string;
  comprovativo_url: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  tipo_falta: 'dia_inteiro' | 'parcial';
  hora_inicio: string | null;
  hora_fim: string | null;
  created_at: string;
}

export default function Faltas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [faltas, setFaltas] = useState<FaltaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  
  const [formData, setFormData] = useState({
    data: '',
    motivo: '',
    tipo_falta: 'dia_inteiro' as 'dia_inteiro' | 'parcial',
    hora_inicio: '',
    hora_fim: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const handleJustifyDay = (date: string) => {
    setFormData({ ...formData, data: date, tipo_falta: 'dia_inteiro', hora_inicio: '', hora_fim: '' });
    setDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      fetchFaltas();
    }
  }, [user]);

  const fetchFaltas = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('faltas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setFaltas(data.map(item => ({
        ...item,
        tipo_falta: item.tipo_falta as 'dia_inteiro' | 'parcial'
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !formData.data || !formData.motivo) return;

    setSubmitting(true);
    let comprovanteUrl = null;

    // Upload file if provided
    if (file) {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('faltas_docs')
        .upload(filePath, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('faltas_docs')
          .getPublicUrl(filePath);
        comprovanteUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('faltas').insert({
      user_id: user.id,
      data: formData.data,
      motivo: formData.motivo,
      comprovativo_url: comprovanteUrl,
      status: 'pendente',
      tipo_falta: formData.tipo_falta,
      hora_inicio: formData.tipo_falta === 'parcial' ? formData.hora_inicio : null,
      hora_fim: formData.tipo_falta === 'parcial' ? formData.hora_fim : null,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível submeter a justificação.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Justificação submetida',
        description: 'A sua justificação foi enviada para aprovação.',
      });
      setDialogOpen(false);
      setFormData({ data: '', motivo: '', tipo_falta: 'dia_inteiro', hora_inicio: '', hora_fim: '' });
      setFile(null);
      fetchFaltas();
      setCalendarKey((prev) => prev + 1); // Refresh calendar
    }

    setSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
      pendente: { variant: 'secondary', label: 'Pendente' },
      aprovado: { variant: 'default', label: 'Aprovada' },
      rejeitado: { variant: 'destructive', label: 'Rejeitada' },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faltas</h1>
          <p className="text-muted-foreground">Justificar ausências e gerir pedidos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Justificação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Justificar Falta</DialogTitle>
              <DialogDescription>
                Preencha os dados da sua ausência e anexe um comprovativo se necessário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data da Falta</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div className="space-y-3">
                <Label>Tipo de Falta</Label>
                <RadioGroup
                  value={formData.tipo_falta}
                  onValueChange={(value: 'dia_inteiro' | 'parcial') => 
                    setFormData({ ...formData, tipo_falta: value, hora_inicio: '', hora_fim: '' })
                  }
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="dia_inteiro" id="dia_inteiro" />
                    <Label htmlFor="dia_inteiro" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Dia Inteiro</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Faltei o dia todo</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="parcial" id="parcial" />
                    <Label htmlFor="parcial" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Horas Específicas</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Faltei apenas algumas horas</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.tipo_falta === 'parcial' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="space-y-2">
                    <Label htmlFor="hora_inicio">Hora Início</Label>
                    <Input
                      id="hora_inicio"
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hora_fim">Hora Fim</Label>
                    <Input
                      id="hora_fim"
                      type="time"
                      value={formData.hora_fim}
                      onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                    />
                  </div>
                  {formData.hora_inicio && formData.hora_fim && (() => {
                    const [startH, startM] = formData.hora_inicio.split(':').map(Number);
                    const [endH, endM] = formData.hora_fim.split(':').map(Number);
                    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const isInvalid = totalMinutes >= 480; // 8 hours = 480 minutes
                    
                    return (
                      <div className={`col-span-2 p-2 rounded-md ${isInvalid ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                        <p className="text-xs font-medium">
                          Duração: {hours}h {minutes > 0 ? `${minutes}min` : ''}
                          {isInvalid && ' — Para 8h ou mais, selecione "Dia Inteiro"'}
                        </p>
                      </div>
                    );
                  })()}
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Indique o período em que esteve ausente (máximo 8 horas)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo</Label>
                <Textarea
                  id="motivo"
                  placeholder="Descreva o motivo da sua ausência..."
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Comprovativo (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                  />
                </div>
                <p className="text-xs text-muted-foreground">PDF, JPG ou PNG (máx. 5MB)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={
                  !formData.data || 
                  !formData.motivo || 
                  submitting ||
                  (formData.tipo_falta === 'parcial' && (!formData.hora_inicio || !formData.hora_fim)) ||
                  (formData.tipo_falta === 'parcial' && formData.hora_inicio && formData.hora_fim && (() => {
                    const [startH, startM] = formData.hora_inicio.split(':').map(Number);
                    const [endH, endM] = formData.hora_fim.split(':').map(Number);
                    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                    return totalMinutes >= 480; // 8 hours or more
                  })())
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A submeter...
                  </>
                ) : (
                  'Submeter'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{faltas.length}</p>
                <p className="text-sm text-muted-foreground">Total de justificações</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Calendar className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {faltas.filter((f) => f.status === 'pendente').length}
                </p>
                <p className="text-sm text-muted-foreground">Pendentes de aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Calendar */}
      <AttendanceCalendar key={calendarKey} onJustifyDay={handleJustifyDay} />

      {/* List */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico de Justificações</CardTitle>
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
                  className="flex items-start justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {format(new Date(item.data), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </p>
                      {item.tipo_falta === 'parcial' && item.hora_inicio && item.hora_fim && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {item.hora_inicio.slice(0, 5)} - {item.hora_fim.slice(0, 5)}
                        </Badge>
                      )}
                      {item.tipo_falta === 'dia_inteiro' && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          Dia inteiro
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.motivo}</p>
                    {item.comprovativo_url && (
                      <a
                        href={item.comprovativo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver comprovativo
                      </a>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ainda não existem justificações de faltas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
