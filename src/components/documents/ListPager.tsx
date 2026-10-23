import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ListPager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
        <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Anterior</span>
      </Button>
      <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Página seguinte">
        <span className="hidden sm:inline mr-1">Seguinte</span><ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
