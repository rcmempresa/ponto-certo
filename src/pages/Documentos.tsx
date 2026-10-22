import { useState, useEffect } from 'react';
import { FileText, Download, Folder, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentExpiryBadge } from '@/components/documents/DocumentExpiryBadge';
import { SubcategorySelect, type DocumentSubcategory } from '@/components/documents/SubcategorySelect';
import { useEffectiveUser } from '@/contexts/ImpersonationContext';

interface DocumentoRecord {
  id: string;
  titulo: string;
  categoria: string;
  ficheiro_url: string;
  created_at: string;
  validade: string | null;
  subcategoria_id: string | null;
}

export default function Documentos() {
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<DocumentSubcategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUser();

  useEffect(() => {
    fetchDocumentos();
  }, [effectiveUserId]);

  const fetchDocumentos = async () => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    const { data: subcats } = await supabase.from('documento_subcategorias').select('id,categoria,nome').order('nome');
    setSubcategories(subcats || []);
    const { data: generalDocs, error: generalError } = await supabase
      .from('documentos')
      .select('*')
      .eq('visibilidade_geral', true);

    const { data: permissionData, error: permError } = await supabase
      .from('documento_permissoes')
      .select('documento_id')
      .eq('user_id', effectiveUserId);

    if (permissionData && permissionData.length > 0) {
      const docIds = permissionData.map(p => p.documento_id);
      
      const { data: permDocs, error: permDocsError } = await supabase
        .from('documentos')
        .select('*')
        .in('id', docIds);

      // Combine and deduplicate
      const allDocs = [...(generalDocs || []), ...(permDocs || [])];
      const uniqueDocs = allDocs.filter((doc, index, self) =>
        index === self.findIndex((d) => d.id === doc.id)
      );
      
      // Sort by created_at descending
      uniqueDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setDocumentos(uniqueDocs);
    } else {
      setDocumentos(generalDocs || []);
    }
    
    setLoading(false);
  };

  const categories = [...new Set(documentos.map((d) => d.categoria))];
  const filteredDocs = selectedCategory
    ? documentos.filter((d) => d.categoria === selectedCategory && (!selectedSubcategory || d.subcategoria_id === selectedSubcategory))
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
            onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
          >
            Todos
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSelectedCategory(cat); setSelectedSubcategory(null); }}
              className="h-auto max-w-full whitespace-normal text-left"
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      {selectedCategory && <div className="max-w-xs"><SubcategorySelect categories={subcategories} categoria={selectedCategory} value={selectedSubcategory} onChange={setSelectedSubcategory} label="Filtrar subcategoria" /></div>}

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
                    <h3 className="font-medium break-words">{doc.titulo}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {doc.categoria}
                      </Badge>
                      {doc.subcategoria_id && <Badge variant="outline" className="whitespace-normal">{subcategories.find(s => s.id === doc.subcategoria_id)?.nome}</Badge>}
                      <DocumentExpiryBadge validade={doc.validade} />
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
