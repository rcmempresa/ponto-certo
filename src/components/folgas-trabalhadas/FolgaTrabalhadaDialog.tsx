import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isHoliday, getHolidayName } from '@/lib/holidays';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

export function FolgaTrabalhadaDialog({ open, onOpenChange, userId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tipoPeriodo, setTipoPeriodo] = useState<'dia_inteiro' | 'meio_dia'>('dia_inteiro');
  const [motivo, setMotivo] = useState('');

  const dataObj = data ? new Date(data + 'T12:00:00') : null;
  const dayOfWeek = dataObj?.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHol = dataObj ? isHoliday(dataObj) : false;
  const isValidDay = isWeekend || isHol;

  const detectTipoDia = (): 'sabado' | 'domingo' | 'feriado' => {
    if (dayOfWeek === 6) return 'sabado';
    if (dayOfWeek === 0) return 'domingo';
    return 'feriado';
  };

  const handleSubmit = async () => {
    if (!isValidDay) {
      toast.error('Apenas pode registar folgas trabalhadas em sábados, domingos ou feriados');
      return;
    }
    setLoading(true);
    const horas = tipoPeriodo === 'dia_inteiro' ? 8 : 4;
    const { error } = await supabase.from('folgas_trabalhadas').insert({
      user_id: userId,
      data,
      tipo_dia: detectTipoDia(),
      tipo_periodo: tipoPeriodo,
      horas,
      motivo: motivo || null,
    });
    if (error) {
      toast.error('Erro ao registar folga trabalhada');
    } else {
      toast.success('Folga trabalhada registada. Aguarda aprovação.');
      setMotivo('');
      setTipoPeriodo('dia_inteiro');
      onOpenChange(false);
      onSuccess();
    }
    setLoading(false);
  };

  const dayLabel = dataObj
    ? isHol
      ? `Feriado: ${getHolidayName(dataObj)}`
      : dayOfWeek === 6
        ? 'Sábado'
        : dayOfWeek === 0
          ? 'Domingo'
          : 'Dia útil (não permitido)'
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registar Folga Trabalhada</DialogTitle>
          <DialogDescription>
            Registe horas trabalhadas em sábados, domingos ou feriados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            {dayLabel && (
              <p className={`text-xs ${isValidDay ? 'text-muted-foreground' : 'text-destructive'}`}>
                {dayLabel}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={tipoPeriodo} onValueChange={(v) => setTipoPeriodo(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia_inteiro">Dia inteiro (8 horas)</SelectItem>
                <SelectItem value="meio_dia">Meio dia (4 horas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do trabalho..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValidDay}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
