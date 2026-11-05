import { Fragment, useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Trash2, Loader2, Plus, FolderOpen, Users, Eye, EyeOff, Settings2, ChevronDown, ChevronRight, Search, Filter } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { documentTitle, documentCategoryChange, documentNoticeDays, documentUploadValidity, paginate } from '@/lib/documentRules';
import { ListPager } from '@/components/documents/ListPager';
import { DocumentExpiryBadge } from '@/components/documents/DocumentExpiryBadge';
import { SubcategorySelect, type DocumentSubcategory } from '@/components/documents/SubcategorySelect';
import { SubcategoryManager } from '@/components/documents/SubcategoryManager';
import { RenameFolderDialog } from '@/components/documents/RenameFolderDialog';
import { DocumentRow } from '@/components/documents/DocumentRow';

interface DocumentoRecord {
  id: string;
  titulo: string;
  categoria: string;
  ficheiro_url: string;
  visibilidade_geral: boolean;
  created_at: string;
  uploaded_by: string | null;
  subcategoria_id: string | null;
  validade: string | null;
  aviso_dias: number;
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

const CATEGORIAS = [
  'Geral',
  'Regulamentos',
  'Políticas',
  'Formulários',
  'Manuais de Eletricidade',
  'Manuais de Telecomunicações',
  'Manuais de Equipamentos de Telecomunicações',
  'Manuais de Climatização',
  'Manuais de Segurança de Trabalho',
  'Comunicação da Empresa',
  'Documentação da Empresa',
  'Certidões',
  'Seguros',
  'Salários',
  'Medicina de Trabalho',
  'Formações',
  'Documentação Viaturas',
  'Documentação Funcionários',
  'Recibos de Vencimentos 2026',
];

const CATEGORIA_ICONS: Record<string, string> = {
  'Geral': '📁',
  'Regulamentos': '📋',
  'Políticas': '📜',
  'Formulários': '📝',
  'Manuais de Eletricidade': '⚡',
  'Manuais de Telecomunicações': '📡',
  'Manuais de Equipamentos de Telecomunicações': '🔧',
  'Manuais de Climatização': '❄️',
  'Manuais de Segurança de Trabalho': '🦺',
  'Comunicação da Empresa': '📢',
  'Documentação da Empresa': '🏢',
  'Certidões': '📃',
  'Seguros': '🛡️',
  'Salários': '💰',
  'Medicina de Trabalho': '🏥',
  'Formações': '🎓',
  'Documentação Viaturas': '🚗',
  'Documentação Funcionários': '👤',
  'Recibos de Vencimentos 2026': '💵',
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIAS));

  const [formData, setFormData] = useState({
    titulo: '',
    categoria: 'Geral',
    visibilidade_geral: true,
  });
  const [subcategories, setSubcategories] = useState<DocumentSubcategory[]>([]);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [noticeDays, setNoticeDays] = useState('15');
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const [expiryDate, setExpiryDate] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('all');
  const [file, setFile] = useState<File | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const allCategorias = useMemo(
    () => [...new Set([...customCats, ...documentos.map(d => d.categoria), ...subcategories.map(s => s.categoria)])],
    [customCats, documentos, subcategories]
  );

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const { error } = await supabase.rpc('rename_document_category', { old_name: oldName, new_name: newName });
    if (error) { toast({ title: 'Não foi possível mudar o nome', description: error.message, variant: 'destructive' }); return false; }
    if (filterCategoria === oldName) setFilterCategoria(newName);
    setFormData(prev => prev.categoria === oldName ? { ...prev, categoria: newName } : prev);
    setExpandedCategories(prev => { const next = new Set(prev); if (next.delete(oldName)) next.add(newName); return next; });
    await fetchData();
    toast({ title: 'Nome da categoria alterado' });
    return true;
  };

  const handleDeleteCategory = async (cat: string) => {
    if (cat === 'Geral') return;
    const count = documentos.filter((d) => d.categoria === cat).length;
    if (count) {
      const { error: moveError } = await supabase.from('documentos').update(documentCategoryChange('Geral')).eq('categoria', cat);
      if (moveError) {
        toast({ title: 'Erro ao mover documentos', description: moveError.message, variant: 'destructive' });
        return;
      }
    }
    const { error: subError } = await supabase.from('documento_subcategorias').delete().eq('categoria', cat);
    if (subError) { toast({ title: 'Erro ao eliminar subcategorias', variant: 'destructive' }); return; }
    const { error } = await supabase.from('documento_categorias').delete().eq('nome', cat);
    if (error) {
      toast({ title: 'Erro ao eliminar categoria', description: error.message, variant: 'destructive' });
      return;
    }
    setCustomCats((prev) => prev.filter((c) => c !== cat));
    setDocumentos((prev) => prev.map((d) => (d.categoria === cat ? { ...d, ...documentCategoryChange('Geral') } : d)));
    if (filterCategoria === cat) setFilterCategoria('all');
    if (formData.categoria === cat) setFormData((f) => ({ ...f, categoria: 'Geral' }));
    void fetchData();
    toast({ title: 'Categoria eliminada' });
  };

  const handleChangeCategory = async (doc: DocumentoRecord, categoria: string) => {
    if (categoria === doc.categoria) return;
    const { error } = await supabase.from('documentos').update(documentCategoryChange(categoria)).eq('id', doc.id);
    if (error) {
      toast({ title: 'Erro ao mudar categoria', description: error.message, variant: 'destructive' });
      return;
    }
    setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...documentCategoryChange(categoria) } : d)));
    setExpandedCategories((prev) => new Set(prev).add(categoria));
    toast({ title: 'Categoria alterada', description: `"${doc.titulo}" movido para ${categoria}.` });
  };

  const handleRenameDocument = async (doc: DocumentoRecord, value: string) => {
    const titulo = documentTitle(value);
    if (!titulo) return false;
    const { error } = await supabase.from('documentos').update({ titulo }).eq('id', doc.id);
    if (error) { toast({ title: 'Erro ao mudar nome', description: error.message, variant: 'destructive' }); return false; }
    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, titulo } : d));
    toast({ title: 'Nome alterado' });
    return true;
  };

  const handleMoveDocument = async (doc: DocumentoRecord, categoria: string, subcategoria_id: string | null) => {
    const { error } = await supabase.from('documentos').update({ categoria, subcategoria_id }).eq('id', doc.id);
    if (error) { toast({ title: 'Erro ao mover documento', description: error.message, variant: 'destructive' }); return false; }
    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, categoria, subcategoria_id } : d));
    setExpandedCategories(prev => new Set(prev).add(categoria));
    toast({ title: 'Documento movido', description: `"${doc.titulo}" está agora em ${categoria}.` });
    return true;
  };

  const handleChangeSubcategory = async (doc: DocumentoRecord, id: string | null) => {
    const { error } = await supabase.from('documentos').update({ subcategoria_id: id }).eq('id', doc.id);
    if (error) { toast({ title: 'Erro ao mudar subcategoria', variant: 'destructive' }); return; }
    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, subcategoria_id: id } : d));
    toast({ title: 'Subcategoria alterada' });
  };

  const handleCreateCategory = async () => {
    const nome = newCatName.trim();
    if (!nome) return;
    if (allCategorias.some((c) => c.toLowerCase() === nome.toLowerCase())) {
      toast({ title: 'Categoria já existe', variant: 'destructive' });
      return;
    }
    setSavingCat(true);
    const { error } = await supabase.from('documento_categorias').insert({ nome });
    setSavingCat(false);
    if (error) {
      toast({ title: 'Erro ao criar categoria', description: error.message, variant: 'destructive' });
      return;
    }
    setCustomCats((prev) => [...prev, nome]);
    setFormData((f) => ({ ...f, categoria: nome }));
    setSubcategory(null);
    setNewCatName('');
    toast({ title: 'Categoria criada', description: nome });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [docsResult, profilesResult, permissionsResult, catsResult, subcatsResult] = await Promise.all([
      supabase.from('documentos').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nome, email'),
      supabase.from('documento_permissoes').select('documento_id, user_id'),
      supabase.from('documento_categorias').select('nome').order('nome'),
      supabase.from('documento_subcategorias').select('id,categoria,nome').order('nome'),
    ]);

    if (subcatsResult.data) setSubcategories(subcatsResult.data);
    if (docsResult.error || subcatsResult.error) toast({ title: 'Erro ao consultar documentos', variant: 'destructive' });
    if (docsResult.data) setDocumentos(docsResult.data);
    if (profilesResult.data) setProfiles(profilesResult.data);
    if (permissionsResult.data) setPermissions(permissionsResult.data);
    if (catsResult.data) setCustomCats(catsResult.data.map((c) => c.nome));
    setLoading(false);
  };

  const getUploaderName = (uploadedBy: string | null) => {
    if (!uploadedBy) return null;
    const profile = profiles.find(p => p.id === uploadedBy);
    return profile?.nome || profile?.email || null;
  };

  const filteredDocuments = useMemo(() => {
    return documentos.filter(doc => {
      const matchesSearch = !searchQuery || 
        doc.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.categoria.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategoria === 'all' || doc.categoria === filterCategoria;
      return matchesSearch && matchesCategory && (filterSubcategory === 'all' || doc.subcategoria_id === filterSubcategory);
    });
  }, [documentos, searchQuery, filterCategoria, filterSubcategory]);

  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, DocumentoRecord[]> = {};
    for (const doc of filteredDocuments) {
      if (!grouped[doc.categoria]) {
        grouped[doc.categoria] = [];
      }
      grouped[doc.categoria].push(doc);
      grouped[doc.categoria].sort((a, b) => {
        const sa = subcategories.find(s => s.id === a.subcategoria_id)?.nome, sb = subcategories.find(s => s.id === b.subcategoria_id)?.nome;
        if (sa !== sb) return !sa ? 1 : !sb ? -1 : sa.localeCompare(sb, 'pt');
        return a.titulo.localeCompare(b.titulo, 'pt');
      });
    }
    // Sort categories by CATEGORIAS order
    const sorted: Record<string, DocumentoRecord[]> = {};
    for (const cat of allCategorias) {
      if (grouped[cat]) {
        sorted[cat] = grouped[cat];
      }
    }
    // Add any categories not in CATEGORIAS
    for (const cat of Object.keys(grouped)) {
      if (!sorted[cat]) {
        sorted[cat] = grouped[cat];
      }
    }
    return sorted;
  }, [filteredDocuments, allCategorias, subcategories]);

  const categoriesWithDocs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documentos) {
      counts[doc.categoria] = (counts[doc.categoria] || 0) + 1;
    }
    return counts;
  }, [documentos]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleUpload = async () => {
    if (!user || !formData.titulo || !file) return;

    let validade: string | null;
    let aviso_dias = 15;
    try { validade = documentUploadValidity(hasExpiry, expiryDate); if (hasExpiry) aviso_dias = documentNoticeDays(noticeDays); } catch (error) { toast({ title: 'Data de validade em falta', description: error instanceof Error ? error.message : '', variant: 'destructive' }); return; }
    setSubmitting(true);

    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
    };

    const fileExt = file.name.split('.').pop();
    const sanitizedTitle = sanitizeFileName(formData.titulo);
    const filePath = `${Date.now()}-${sanitizedTitle}.${fileExt}`;

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

    const { data: newDoc, error } = await supabase.from('documentos').insert({
      titulo: formData.titulo,
      categoria: formData.categoria,
      ficheiro_url: urlData.publicUrl,
      visibilidade_geral: formData.visibilidade_geral,
      uploaded_by: user.id,
      subcategoria_id: subcategory,
      validade,
      aviso_dias,
    }).select().single();

    if (error) {
      await supabase.storage.from('company_docs').remove([filePath]);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o documento.',
        variant: 'destructive',
      });
    } else {
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
      setSubcategory(null);
      setHasExpiry(false);
      setExpiryDate('');
      setNoticeDays('15');
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

    await supabase
      .from('documento_permissoes')
      .delete()
      .eq('documento_id', selectedDocument.id);

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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-lg p-4 sm:p-6">
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
                  onValueChange={(value) => { setFormData({ ...formData, categoria: value }); setSubcategory(null); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {allCategorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="flex items-center gap-2">
                          <span>{CATEGORIA_ICONS[cat] || '📁'}</span>
                          {cat}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <SubcategorySelect categories={subcategories} categoria={formData.categoria} value={subcategory} onChange={setSubcategory} />
              </div>
              <div className="flex items-center justify-between gap-3 border-b py-3">
                <Label htmlFor="has-expiry">O documento tem validade?</Label>
                <Switch id="has-expiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
              </div>
              {hasExpiry && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="validade">Data de validade</Label><Input id="validade" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="aviso-dias">Avisar quantos dias antes</Label><Input id="aviso-dias" type="number" min={0} max={365} value={noticeDays} onChange={e => setNoticeDays(e.target.value)} /></div><p className="text-xs text-muted-foreground sm:col-span-2">Nesse dia aparece em Avisos e é enviado um email para geral@nrtechsolucion.pt.</p></div>}
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
                          className="min-w-0 flex-1 break-words text-sm cursor-pointer"
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
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={!formData.titulo.trim() || !file || submitting || (hasExpiry && !expiryDate)}>
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-lg p-4 sm:p-6">
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
                  className="min-w-0 flex-1 break-words text-sm cursor-pointer"
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
          <DialogFooter className="gap-2">
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{documentos.length}</p>
            <p className="text-xs text-muted-foreground">Total de documentos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{Object.keys(categoriesWithDocs).length}</p>
            <p className="text-xs text-muted-foreground">Categorias com docs</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{documentos.filter(d => d.visibilidade_geral).length}</p>
            <p className="text-xs text-muted-foreground">Públicos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{documentos.filter(d => !d.visibilidade_geral).length}</p>
            <p className="text-xs text-muted-foreground">Restritos</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategoria} onValueChange={value => { setFilterCategoria(value); setFilterSubcategory('all'); }}>
          <SelectTrigger className="min-w-0 w-full">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar categoria" />
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            <SelectItem value="all">Todas as categorias</SelectItem>
            {allCategorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span className="flex items-center gap-2">
                  <span>{CATEGORIA_ICONS[cat] || '📁'}</span>
                  {cat}
                  {categoriesWithDocs[cat] ? ` (${categoriesWithDocs[cat]})` : ''}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
          <Settings2 className="mr-2 h-4 w-4" />
          Gerir pastas
        </Button>
        <Button variant="outline" onClick={() => setSubDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova subcategoria
        </Button>
      </div>

      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Subcategorias</DialogTitle>
            <DialogDescription>Escolha a categoria principal, escreva o nome e carregue em +.</DialogDescription>
          </DialogHeader>
          <SubcategoryManager parents={allCategorias} subcategories={subcategories} onChange={() => { void fetchData(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="hidden">
      </div>

      {filterCategoria !== 'all' && <Select value={filterSubcategory} onValueChange={setFilterSubcategory}><SelectTrigger aria-label="Filtrer subcategoria" className="w-full min-w-0 sm:max-w-xs"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-2rem)]"><SelectItem value="all">Todas as subcategorias</SelectItem>{subcategories.filter(s => s.categoria === filterCategoria).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>}

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Gerir pastas</DialogTitle>
            <DialogDescription>Categorias e subcategorias dos documentos da empresa.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="new-category-name">Nova categoria</Label>
          <div className="flex gap-2">
          <Input
            id="new-category-name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Ex: Contratos"
            maxLength={80}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <Button size="icon" aria-label="Criar categoria" title="Criar categoria" onClick={handleCreateCategory} disabled={savingCat || !newCatName.trim()} className="shrink-0">
            {savingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
          </div>
          {allCategorias.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Categorias criadas</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                {allCategorias.map((cat) => (
                  <div key={cat} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">{cat}</span>
                    <RenameFolderDialog name={cat} onRename={nome => handleRenameCategory(cat, nome)} />
                    {cat !== 'Geral' && <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={`Eliminar categoria ${cat}`} title="Eliminar categoria"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
                        <AlertDialogHeader><AlertDialogTitle>Eliminar categoria?</AlertDialogTitle><AlertDialogDescription>A categoria “{cat}” e as suas subcategorias serão eliminadas. Os {categoriesWithDocs[cat] || 0} documentos permanecem guardados e passam para “Geral”.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCategory(cat)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Os documentos de uma categoria eliminada passam para "Geral".</p>
            </div>
          )}

          <SubcategoryManager parents={allCategorias} subcategories={subcategories} onChange={() => { void fetchData(); }} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents grouped by Category */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(documentsByCategory).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(documentsByCategory).map(([categoria, allDocs]) => {
            const { items: docs, page: catPage, totalPages: catPages } = paginate(allDocs, categoryPages[categoria] || 1, 10);
            return (
            <Collapsible
              key={categoria}
              open={expandedCategories.has(categoria)}
              onOpenChange={() => toggleCategory(categoria)}
            >
              <Card className="border-0 shadow-soft overflow-hidden">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="h-auto w-full flex items-center justify-between gap-3 whitespace-normal rounded-none p-4 hover:bg-muted/30 transition-colors text-left">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-xl">{CATEGORIA_ICONS[categoria] || '📁'}</span>
                      <div>
                        <p className="break-words font-semibold">{categoria}</p>
                        <p className="text-xs text-muted-foreground">{allDocs.length} documento{allDocs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {expandedCategories.has(categoria) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    {docs.map((doc, index) => {
                      const hasSubs = subcategories.some(s => s.categoria === categoria);
                      const groupKey = `${categoria}:${doc.subcategoria_id || 'none'}`;
                      const startsGroup = hasSubs && (index === 0 || docs[index - 1].subcategoria_id !== doc.subcategoria_id);
                      const collapsed = hasSubs && collapsedGroups.has(groupKey);
                      return (
                        <Fragment key={doc.id}>
                          {startsGroup && (
                            <button type="button" onClick={() => setCollapsedGroups(prev => { const n = new Set(prev); n.has(groupKey) ? n.delete(groupKey) : n.add(groupKey); return n; })}
                              className="flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-2 text-left text-sm font-medium hover:bg-muted/60">
                              {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 break-words">{subcategories.find(s => s.id === doc.subcategoria_id)?.nome || 'Sem subcategoria'}</span>
                              <span className="text-xs text-muted-foreground">{allDocs.filter(d => d.subcategoria_id === doc.subcategoria_id).length}</span>
                            </button>
                          )}
                          {!collapsed && (
                            <DocumentRow
                              doc={doc}
                              icon={getFileIcon(doc.ficheiro_url)}
                              uploaderName={getUploaderName(doc.uploaded_by)}
                              permissionCount={getDocumentPermissionCount(doc.id)}
                              categories={allCategorias}
                              categoryIcons={CATEGORIA_ICONS}
                              subcategories={subcategories}
                              deleting={deletingId === doc.id}
                              onRename={handleRenameDocument}
                              onMove={handleMoveDocument}
                              onPermissions={d => openPermissionsDialog(doc)}
                              onToggleVisibility={() => toggleVisibility(doc)}
                              onDelete={handleDelete}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                  <ListPager page={catPage} totalPages={catPages} onChange={p => setCategoryPages(prev => ({ ...prev, [categoria]: p }))} />
                </CollapsibleContent>
              </Card>
            </Collapsible>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-soft">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery || filterCategoria !== 'all' 
                  ? 'Nenhum documento encontrado com esses filtros.' 
                  : 'Ainda não existem documentos.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}