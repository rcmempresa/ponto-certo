import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedProfile, stopImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedProfile) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm backdrop-blur">
      <div className="flex items-center gap-2 text-warning-foreground">
        <Eye className="h-4 w-4 text-warning" />
        <span>
          A ver painel como{' '}
          <strong className="font-semibold">{impersonatedProfile.nome || impersonatedProfile.email}</strong>{' '}
          <span className="text-muted-foreground">(modo só-leitura)</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={stopImpersonation}
        className="h-7 rounded-lg border-warning/40 bg-background/60 hover:bg-background"
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Sair
      </Button>
    </div>
  );
}
