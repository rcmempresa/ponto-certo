import { useState } from 'react';
import { Clock, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ManualPunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
  selectedDate?: string;
  onSuccess?: () => void;
  isAdmin?: boolean;
}

export function ManualPunchDialog({
  open,
  onOpenChange,
  userId,
  userName,
  selectedDate,
  onSuccess,
  isAdmin = false,
}: ManualPunchDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    data: selectedDate || format(new Date(), 'yyyy-MM-dd'),
    horaEntrada: '09:00',
    horaSaida: '18:00',
    motivo: '',
  });

  const handleSubmit = async () => {
    if (!formData.data || !formData.horaEntrada || !formData.horaSaida) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    // Validate times
    if (formData.horaEntrada >= formData.horaSaida) {
      toast({
        title: 'Erro',
        description: 'A hora de saída deve ser posterior à hora de entrada.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create entry timestamp
      const entryTimestamp = new Date(`${formData.data}T${formData.horaEntrada}:00`);
      const exitTimestamp = new Date(`${formData.data}T${formData.horaSaida}:00`);

      // Insert entry record
      const { error: entryError } = await supabase.from('ponto').insert({
        user_id: userId,
        tipo: 'entrada',
        timestamp: entryTimestamp.toISOString(),
        localizacao: formData.motivo ? `Manual: ${formData.motivo}` : 'Registo manual',
      });

      if (entryError) throw entryError;

      // Insert exit record
      const { error: exitError } = await supabase.from('ponto').insert({
        user_id: userId,
        tipo: 'saida',
        timestamp: exitTimestamp.toISOString(),
        localizacao: formData.motivo ? `Manual: ${formData.motivo}` : 'Registo manual',
      });

      if (exitError) throw exitError;

      toast({
        title: 'Picagem registada',
        description: `Entrada às ${formData.horaEntrada} e saída às ${formData.horaSaida} registadas com sucesso.`,
      });

      onOpenChange(false);
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        horaEntrada: '09:00',
        horaSaida: '18:00',
        motivo: '',
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error creating manual punch:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registar a picagem manual.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Update date when selectedDate changes
  if (selectedDate && selectedDate !== formData.data) {
    setFormData((prev) => ({ ...prev, data: selectedDate }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Registar Horas Manualmente
          </DialogTitle>
          <DialogDescription>
            {isAdmin && userName
              ? `Adicionar registo de horas para ${userName}`
              : 'Adicione as horas que trabalhou neste dia'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horaEntrada" className="text-sm font-medium">
                Hora de Entrada
              </Label>
              <Input
                id="horaEntrada"
                type="time"
                value={formData.horaEntrada}
                onChange={(e) => setFormData({ ...formData, horaEntrada: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horaSaida" className="text-sm font-medium">
                Hora de Saída
              </Label>
              <Input
                id="horaSaida"
                type="time"
                value={formData.horaSaida}
                onChange={(e) => setFormData({ ...formData, horaSaida: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-sm font-medium">
              Justificação (opcional)
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Esqueci-me de picar o ponto..."
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>

          {/* Time Preview */}
          {formData.horaEntrada && formData.horaSaida && formData.horaEntrada < formData.horaSaida && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Tempo de trabalho:</p>
              <p className="text-lg font-semibold text-primary">
                {(() => {
                  const [entryH, entryM] = formData.horaEntrada.split(':').map(Number);
                  const [exitH, exitM] = formData.horaSaida.split(':').map(Number);
                  const totalMinutes = (exitH * 60 + exitM) - (entryH * 60 + entryM);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  return `${hours}h ${minutes > 0 ? `${minutes}min` : ''}`;
                })()}
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
            disabled={!formData.data || !formData.horaEntrada || !formData.horaSaida || submitting}
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
                Registar Horas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
