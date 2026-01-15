import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, Plus, FolderOpen, Users, Eye, EyeOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface Profile {
  id: string;
  nome: string;
  email: string;
}

interface DocumentPermission {
  documento_id: string;
  user_id: string;
}

const CATEGORIAS = ['Geral', 'Regulamentos', 'Manuais', 'Políticas', 'Formulários'];

export default function AdminDocumentos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<DocumentoRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentoRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    categoria: 'Geral',
    visibilidade_geral: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [docsResult, profilesResult, permissionsResult] = await Promise.all([
      supabase.from('documentos').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome, email'),
      supabase.from('documento_permissoes').select('documento_id, user_id'),
    ]);

    if (docsResult.data) setDocumentos(docsResult.data);
    if (profilesResult.data) setProfiles(profilesResult.data);
    if (permissionsResult.data) setPermissions(permissionsResult.data);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!user || !formData.titulo || !file) return;

    setSubmitting(true);

    // Sanitize filename - remove special characters and accents
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace special chars with dash
        .replace(/-+/g, '-') // Remove consecutive dashes
        .toLowerCase();
    };

    // Upload file
    const fileExt = file.name.split('.').pop();
    const sanitizedTitle = sanitizeFileName(formData.titulo);
    const filePath = `${Date.now()}-${sanitizedTitle}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company_docs')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
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
    const { data: newDoc, error } = await supabase.from('documentos').insert({
      titulo: formData.titulo,
      categoria: formData.categoria,
      ficheiro_url: urlData.publicUrl,
      visibilidade_geral: formData.visibilidade_geral,
      uploaded_by: user.id,
    }).select().single();

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o documento.',
        variant: 'destructive',
      });
    } else {
      // If not general visibility and users are selected, add permissions
      if (!formData.visibilidade_geral && selectedUsers.length > 0 && newDoc) {
        const permissionsToInsert = selectedUsers.map(userId => ({
          documento_id: newDoc.id,
          user_id: userId,
        }));
        await supabase.from('documento_permissoes').insert(permissionsToInsert);
      }

      toast({
        title: 'Documento criado',
        description: 'O documento foi adicionado com sucesso.',
      });
      setDialogOpen(false);
      setFormData({ titulo: '', categoria: 'Geral', visibilidade_geral: true });
      setFile(null);
      setSelectedUsers([]);
      fetchData();
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
      fetchData();
    }

    setDeletingId(null);
  };

  const openPermissionsDialog = (doc: DocumentoRecord) => {
    setSelectedDocument(doc);
    const docPermissions = permissions.filter(p => p.documento_id === doc.id);
    setSelectedUsers(docPermissions.map(p => p.user_id));
    setPermissionsDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedDocument) return;
    setSavingPermissions(true);

    // Delete existing permissions
    await supabase
      .from('documento_permissoes')
      .delete()
      .eq('documento_id', selectedDocument.id);

    // Insert new permissions
    if (selectedUsers.length > 0) {
      const permissionsToInsert = selectedUsers.map(userId => ({
        documento_id: selectedDocument.id,
        user_id: userId,
      }));
      await supabase.from('documento_permissoes').insert(permissionsToInsert);
    }

    toast({
      title: 'Permissões atualizadas',
      description: 'As permissões do documento foram atualizadas.',
    });
    setPermissionsDialogOpen(false);
    fetchData();
    setSavingPermissions(false);
  };

  const toggleVisibility = async (doc: DocumentoRecord) => {
    const { error } = await supabase
      .from('documentos')
      .update({ visibilidade_geral: !doc.visibilidade_geral })
      .eq('id', doc.id);

    if (!error) {
      setDocumentos(prev =>
        prev.map(d => d.id === doc.id ? { ...d, visibilidade_geral: !d.visibilidade_geral } : d)
      );
      toast({
        title: doc.visibilidade_geral ? 'Visibilidade restrita' : 'Visibilidade pública',
        description: doc.visibilidade_geral 
          ? 'O documento agora é visível apenas para utilizadores selecionados.'
          : 'O documento agora é visível para todos.',
      });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getFileIcon = (url: string) => {
    if (url.includes('.pdf')) return '📄';
    if (url.includes('.doc')) return '📝';
    if (url.includes('.xls')) return '📊';
    return '📁';
  };

  const getDocumentPermissionCount = (docId: string) => {
    return permissions.filter(p => p.documento_id === docId).length;
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
          <DialogContent className="max-w-lg">
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

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Visível para todos</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.visibilidade_geral 
                      ? 'Todos os colaboradores podem ver'
                      : 'Apenas utilizadores selecionados'}
                  </p>
                </div>
                <Switch
                  checked={formData.visibilidade_geral}
                  onCheckedChange={(checked) => setFormData({ ...formData, visibilidade_geral: checked })}
                />
              </div>

              {!formData.visibilidade_geral && (
                <div className="space-y-2">
                  <Label>Selecionar colaboradores</Label>
                  <ScrollArea className="h-[150px] rounded-md border p-2">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center space-x-2 py-2 px-1 hover:bg-muted/50 rounded"
                      >
                        <Checkbox
                          id={`user-${profile.id}`}
                          checked={selectedUsers.includes(profile.id)}
                          onCheckedChange={() => toggleUserSelection(profile.id)}
                        />
                        <label
                          htmlFor={`user-${profile.id}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          <span className="font-medium">{profile.nome || 'Sem nome'}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{profile.email}</span>
                        </label>
                      </div>
                    ))}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {selectedUsers.length} colaborador(es) selecionado(s)
                  </p>
                </div>
              )}
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

      {/* Permissions Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerir Permissões</DialogTitle>
            <DialogDescription>
              Selecione quais colaboradores podem ver o documento "{selectedDocument?.titulo}"
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px] rounded-md border p-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center space-x-2 py-2 px-1 hover:bg-muted/50 rounded"
              >
                <Checkbox
                  id={`perm-${profile.id}`}
                  checked={selectedUsers.includes(profile.id)}
                  onCheckedChange={() => toggleUserSelection(profile.id)}
                />
                <label
                  htmlFor={`perm-${profile.id}`}
                  className="flex-1 text-sm cursor-pointer"
                >
                  <span className="font-medium">{profile.nome || 'Sem nome'}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{profile.email}</span>
                </label>
              </div>
            ))}
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {selectedUsers.length} colaborador(es) selecionado(s)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={savingPermissions}>
              {savingPermissions ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                        <Badge 
                          variant={doc.visibilidade_geral ? 'default' : 'outline'} 
                          className="text-xs gap-1"
                        >
                          {doc.visibilidade_geral ? (
                            <>
                              <Eye className="h-3 w-3" />
                              Público
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" />
                              Restrito ({getDocumentPermissionCount(doc.id)})
                            </>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(doc.created_at), "d MMM yyyy", { locale: pt })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!doc.visibilidade_geral && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openPermissionsDialog(doc)}
                      >
                        <Users className="mr-1 h-4 w-4" />
                        Permissões
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVisibility(doc)}
                      title={doc.visibilidade_geral ? 'Tornar restrito' : 'Tornar público'}
                    >
                      {doc.visibilidade_geral ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
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
