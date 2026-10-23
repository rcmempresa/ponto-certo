import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';
import { DOCUMENT_EXPIRY_NOTICE_DAYS } from '@/lib/documentRules';
import { DocumentExpiryBadge } from './DocumentExpiryBadge';

type ExpiringDocument = { id: string; titulo: string; categoria: string; validade: string | null; ficheiro_url: string };

export function DocumentExpiryPanel() {
  const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('documentos')
        .select('id,titulo,categoria,validade,ficheiro_url')
        .not('validade', 'is', null)
        .lte('validade', format(addDays(new Date(), DOCUMENT_EXPIRY_NOTICE_DAYS), 'yyyy-MM-dd'))
        .order('validade');
      setError(Boolean(error));
      setDocuments(data || []);
      setLoading(false);
    };
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    const channel = supabase.channel('dashboard-document-expiry').on('postgres_changes', {
      event: '*', schema: 'public', table: 'documentos',
    }, refresh).subscribe();
    return () => {
      window.removeEventListener('focus', refresh);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="border-y py-5 space-y-4" aria-label="Documentos a expirar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 shrink-0 text-warning" />Documentos a expirar ({documents.length})</h2>
        <Button variant="outline" size="sm" asChild><Link to="/admin/avisos">Ver avisos<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? <p className="text-sm text-destructive">Não foi possível consultar a validade dos documentos.</p> : documents.length === 0 ? <p className="text-sm text-muted-foreground">Sem documentos expirados ou a expirar nos próximos 15 dias.</p> : (
        <ul className="divide-y">
          {documents.map(doc => <li key={doc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><a href={doc.ficheiro_url} target="_blank" rel="noopener noreferrer" className="font-medium break-words underline-offset-4 hover:underline">{doc.titulo}</a><p className="text-xs text-muted-foreground break-words">{doc.categoria}</p></div>
            <div className="shrink-0"><DocumentExpiryBadge validade={doc.validade} /></div>
          </li>)}
        </ul>
      )}
    </section>
  );
}