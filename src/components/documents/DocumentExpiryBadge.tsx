import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { documentExpiryState } from '@/lib/documentRules';

export function DocumentExpiryBadge({ validade }: { validade: string | null }) {
  if (!validade) return null;
  const { status, days } = documentExpiryState(validade);
  return (
    <Badge variant="outline" className={`max-w-full whitespace-normal text-xs ${status === 'expired' ? 'border-destructive/30 text-destructive' : status === 'expiring' ? 'border-warning/40 text-warning' : 'text-muted-foreground'}`}>
      {status === 'expired' ? 'Expirou' : days === 0 ? 'Expira hoje' : status === 'expiring' ? `Expira em ${days} dias` : 'Válido até'} · {format(parseISO(validade), 'dd/MM/yyyy')}
    </Badge>
  );
}