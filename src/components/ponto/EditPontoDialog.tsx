import { useState, useEffect } from 'react';
import { Clock, Loader2, Save } from 'lucide-react';
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

interface PontoRecord {
  id: string;
  user_id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
  localizacao: string | null;
  status?: string;
  manual?: boolean;
  observacoes?: string | null;
}

interface EditPontoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PontoRecord | null;
  onSuccess?: () => void;
}

export function EditPontoDialog({
  open,
  onOpenChange,
  record,
  onSuccess,
}: EditPontoDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    data: '',
    hora: '',
    observacoes: '',
  });

  useEffect(() => {
    if (record) {
      const timestamp = new Date(record.timestamp);
      setFormData({
        tipo: record.tipo,
        data: format(timestamp, 'yyyy-MM-dd'),
        hora: format(timestamp, 'HH:mm'),
        observacoes: record.observacoes || '',
      });
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record || !formData.data || !formData.hora) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const newTimestamp = new Date(`${formData.data}T${formData.hora}:00`);

      const { error } = await supabase
        .from('ponto')
        .update({
          tipo: formData.tipo,
          timestamp: newTimestamp.toISOString(),
          observacoes: formData.observacoes || null,
        })
        .eq('id', record.id);

      if (error) throw error;

      toast({
        title: 'Registo atualizado',
        description: 'O registo de ponto foi atualizado com sucesso.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating ponto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o registo.',
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
            Editar Registo de Ponto
          </DialogTitle>
          <DialogDescription>
            Alterar os dados do registo de ponto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-sm font-medium">
              Tipo
            </Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: 'entrada' | 'saida') =>
                setFormData({ ...formData, tipo: value })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data" className="text-sm font-medium">
                Data
              </Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora" className="text-sm font-medium">
                Hora
              </Label>
              <Input
                id="hora"
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-sm font-medium">
              Observações
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Observações (opcional)"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.data || !formData.hora || submitting}
            className="rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
