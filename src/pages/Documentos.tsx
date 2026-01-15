import { useState, useEffect } from 'react';
import { FileText, Download, Folder, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface DocumentoRecord {
  id: string;
  titulo: string;
  categoria: string;
  ficheiro_url: string;
  created_at: string;
}

export default function Documentos() {
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentos();
  }, []);

  const fetchDocumentos = async () => {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('visibilidade_geral', true)
      .order('created_at', { ascending: false });

    if (data) {
      setDocumentos(data);
    }
    setLoading(false);
  };

  const categories = [...new Set(documentos.map((d) => d.categoria))];
  const filteredDocs = selectedCategory
    ? documentos.filter((d) => d.categoria === selectedCategory)
    : documentos;

  const getFileIcon = (url: string) => {
    if (url.includes('.pdf')) return '📄';
    if (url.includes('.doc')) return '📝';
    if (url.includes('.xls')) return '📊';
    return '📁';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
        <p className="text-muted-foreground">Manuais, regulamentos e documentos da empresa</p>
      </div>

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      {/* Documents Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} className="border-0 shadow-soft group hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                    {getFileIcon(doc.ficheiro_url)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{doc.titulo}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {doc.categoria}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(doc.created_at), "d MMM yyyy", { locale: pt })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  asChild
                >
                  <a href={doc.ficheiro_url} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Ainda não existem documentos disponíveis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
