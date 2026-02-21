import { useState, useEffect } from 'react';
import { Clock, Plus, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isWeekend } from 'date-fns';
import { 
  calculateOvertimeMinutes, 
  formatOvertimeMinutes, 
  getOvertimeType,
  getOvertimeDescription,
  OVERTIME_CONFIG 
} from '@/lib/overtimeCalculator';

interface OvertimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  selectedDate?: string;
  onSuccess?: () => void;
  isAdmin?: boolean;
}

export function OvertimeDialog({
  open,
  onOpenChange,
  userId,
  userName,
  selectedDate,
  onSuccess,
  isAdmin = false,
}: OvertimeDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    data: selectedDate || format(new Date(), 'yyyy-MM-dd'),
    horaInicio: '18:00',
    horaFim: '20:00',
    motivo: '',
  });

  // Update date when selectedDate changes
  useEffect(() => {
    if (selectedDate && selectedDate !== formData.data) {
      setFormData((prev) => ({ ...prev, data: selectedDate }));
    }
  }, [selectedDate]);

  const selectedDateObj = new Date(formData.data + 'T12:00:00');
  const isWeekendDay = isWeekend(selectedDateObj);
  const overtimeType = getOvertimeType(selectedDateObj);
  const overtimeDescription = getOvertimeDescription(selectedDateObj);

  // Calculate overtime preview
  const overtimeMinutes = formData.horaInicio && formData.horaFim
    ? calculateOvertimeMinutes(selectedDateObj, formData.horaInicio, formData.horaFim)
    : 0;

  const handleSubmit = async () => {
    if (!formData.data || !formData.horaInicio || !formData.horaFim) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (overtimeMinutes <= 0) {
      toast({
        title: 'Erro',
        description: 'O período indicado não corresponde a horas extra válidas.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const status = isAdmin ? 'aprovado' : 'pendente';

      const { error } = await supabase.from('horas_extra').insert({
        user_id: userId,
        data: formData.data,
        hora_inicio: formData.horaInicio,
        hora_fim: formData.horaFim,
        minutos_extra: overtimeMinutes,
        motivo: formData.motivo || null,
        tipo_periodo: overtimeType,
        status,
      });

      if (error) throw error;

      toast({
        title: isAdmin ? 'Horas extra registadas' : 'Pedido enviado',
        description: isAdmin 
          ? `${formatOvertimeMinutes(overtimeMinutes)} de horas extra registadas.`
          : 'O seu pedido foi enviado para aprovação pelo administrador.',
      });

      onOpenChange(false);
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        horaInicio: '18:00',
        horaFim: '20:00',
        motivo: '',
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error creating overtime request:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registar as horas extra.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Registar Horas Extra
          </DialogTitle>
          <DialogDescription>
            {isAdmin && userName
              ? `Adicionar horas extra para ${userName}`
              : 'O seu pedido será enviado para aprovação'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary mb-1">Horário de Horas Extra</p>
              <p className="text-muted-foreground">
                <strong>Dias úteis:</strong> 18:00 às 08:00 do dia seguinte<br/>
                <strong>Fins de semana:</strong> Todas as 24 horas
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data" className="text-sm font-medium">
              Data
            </Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="rounded-xl"
            />
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant="outline" 
                className={isWeekendDay 
                  ? 'bg-warning/10 text-warning border-warning/30' 
                  : 'bg-primary/10 text-primary border-primary/30'
                }
              >
                {isWeekendDay ? 'Fim de semana' : 'Dia útil'}
              </Badge>
              <span className="text-xs text-muted-foreground">{overtimeDescription}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horaInicio" className="text-sm font-medium">
                Hora de Início
              </Label>
              <Input
                id="horaInicio"
                type="time"
                value={formData.horaInicio}
                onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horaFim" className="text-sm font-medium">
                Hora de Fim
              </Label>
              <Input
                id="horaFim"
                type="time"
                value={formData.horaFim}
                onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-sm font-medium">
              Observações
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Finalização de projeto urgente..."
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              rows={4}
              maxLength={500}
              className="rounded-xl resize-none"
            />
          </div>

          {/* Overtime Preview */}
          {overtimeMinutes > 0 && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/30">
              <p className="text-sm text-muted-foreground mb-1">Horas extra a registar:</p>
              <p className="text-2xl font-bold text-success">
                {formatOvertimeMinutes(overtimeMinutes)}
              </p>
            </div>
          )}

          {overtimeMinutes === 0 && formData.horaInicio && formData.horaFim && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">
                O período indicado não corresponde a horas extra válidas para este dia.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.data || !formData.horaInicio || !formData.horaFim || overtimeMinutes <= 0 || submitting}
            className="rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A registar...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Registar Horas Extra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
