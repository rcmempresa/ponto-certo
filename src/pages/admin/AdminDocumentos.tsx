import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface DocumentoRecord {
  id: string;
  titulo: string;
  categoria: string;
  ficheiro_url: string;
  visibilidade_geral: boolean;
  created_at: string;
}

const CATEGORIAS = ['Geral', 'Regulamentos', 'Manuais', 'Políticas', 'Formulários'];

export default function AdminDocumentos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    categoria: 'Geral',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocumentos();
  }, []);

  const fetchDocumentos = async () => {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setDocumentos(data);
    }
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!user || !formData.titulo || !file) return;

    setSubmitting(true);

    // Upload file
    const fileExt = file.name.split('.').pop();
    const filePath = `${Date.now()}-${formData.titulo.replace(/\s+/g, '-')}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company_docs')
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload do ficheiro.',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('company_docs')
      .getPublicUrl(filePath);

    // Create document record
    const { error } = await supabase.from('documentos').insert({
      titulo: formData.titulo,
      categoria: formData.categoria,
      ficheiro_url: urlData.publicUrl,
      visibilidade_geral: true,
      uploaded_by: user.id,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o documento.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Documento criado',
        description: 'O documento foi adicionado com sucesso.',
      });
      setDialogOpen(false);
      setFormData({ titulo: '', categoria: 'Geral' });
      setFile(null);
      fetchDocumentos();
    }

    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    const { error } = await supabase.from('documentos').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível eliminar o documento.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Documento eliminado',
        description: 'O documento foi removido com sucesso.',
      });
      fetchDocumentos();
    }

    setDeletingId(null);
  };

  const getFileIcon = (url: string) => {
    if (url.includes('.pdf')) return '📄';
    if (url.includes('.doc')) return '📝';
    if (url.includes('.xls')) return '📊';
    return '📁';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão Documental</h1>
          <p className="text-muted-foreground">Carregar e gerir documentos da empresa</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Carregar Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Documento</DialogTitle>
              <DialogDescription>
                Carregue um documento para partilhar com a equipa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Manual do Colaborador"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Ficheiro</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                />
                <p className="text-xs text-muted-foreground">PDF, Word ou Excel</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={!formData.titulo || !file || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A carregar...
                  </>
                ) : (
                  'Carregar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents List */}
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documentos.length > 0 ? (
            <div className="space-y-3">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
                      {getFileIcon(doc.ficheiro_url)}
                    </div>
                    <div>
                      <p className="font-medium">{doc.titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {doc.categoria}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(doc.created_at), "d MMM yyyy", { locale: pt })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.ficheiro_url} target="_blank" rel="noopener noreferrer">
                        Ver
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar documento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser revertida. O documento será permanentemente eliminado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Eliminar'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Ainda não existem documentos.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
