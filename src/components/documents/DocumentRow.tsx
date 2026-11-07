import { useState } from 'react';
import { MoreVertical, Pencil, FolderInput, Users, Eye, EyeOff, Trash2, Loader2, FileText, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentExpiryBadge } from './DocumentExpiryBadge';
import { SubcategorySelect, type DocumentSubcategory } from './SubcategorySelect';
import { DOCUMENT_TITLE_MAX, documentTitle } from '@/lib/documentRules';

export interface DocumentRowDoc {
  id: string; titulo: string; categoria: string; ficheiro_url: string; visibilidade_geral: boolean;
  created_at: string; subcategoria_id: string | null; validade: string | null; aviso_dias: number;
}

interface Props {
  doc: DocumentRowDoc;
  icon: string;
  uploaderName?: string | null;
  permissionCount: number;
  categories: string[];
  categoryIcons: Record<string, string>;
  subcategories: DocumentSubcategory[];
  deleting: boolean;
  onRename: (doc: DocumentRowDoc, title: string) => Promise<boolean>;
  onMove: (doc: DocumentRowDoc, categoria: string, subcategoria: string | null) => Promise<boolean>;
  onPermissions: (doc: DocumentRowDoc) => void;
  onToggleVisibility: (doc: DocumentRowDoc) => void;
  onDelete: (id: string) => void;
}

export function DocumentRow(p: Props) {
  const { doc } = p;
  const [dialog, setDialog] = useState<null | 'rename' | 'move' | 'delete'>(null);
  const [title, setTitle] = useState(doc.titulo);
  const [cat, setCat] = useState(doc.categoria);
  const [sub, setSub] = useState<string | null>(doc.subcategoria_id);
  const [saving, setSaving] = useState(false);

  const open = (d: 'rename' | 'move' | 'delete') => {
    setTitle(doc.titulo); setCat(doc.categoria); setSub(doc.subcategoria_id); setDialog(d);
  };
  const run = async (fn: () => Promise<boolean>) => {
    setSaving(true);
    try { if (await fn()) setDialog(null); } finally { setSaving(false); }
  };
  const valid = documentTitle(title);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b px-3 py-4 hover:bg-muted/20 sm:px-4">
      <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{doc.ficheiro_url.toLowerCase().includes('.xls') ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div>
      <div className="min-w-0 flex-1">
        <p className="min-w-0 break-words text-sm font-medium leading-6">{doc.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{format(new Date(doc.created_at), 'd MMM yyyy', { locale: pt })}</span>
          <span className="inline-flex items-center gap-1">{doc.visibilidade_geral ? <><Eye className="h-3 w-3" />Público</> : <><EyeOff className="h-3 w-3" />Restrito{p.permissionCount > 0 ? ` · ${p.permissionCount}` : ''}</>}</span>
        </div>
        {doc.validade && <div className="mt-2"><DocumentExpiryBadge validade={doc.validade} avisoDias={doc.aviso_dias} /></div>}
      </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" asChild><a href={doc.ficheiro_url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${doc.titulo}`} title="Abrir documento"><ExternalLink className="h-4 w-4" /></a></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Ações de ${doc.titulo}`}><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => open('rename')}><Pencil className="mr-2 h-4 w-4" />Mudar nome</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('move')}><FolderInput className="mr-2 h-4 w-4" />Mover</DropdownMenuItem>
            {!doc.visibilidade_geral && <DropdownMenuItem onSelect={() => p.onPermissions(doc)}><Users className="mr-2 h-4 w-4" />Permissões</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => p.onToggleVisibility(doc)}>
              {doc.visibilidade_geral ? <><EyeOff className="mr-2 h-4 w-4" />Tornar restrito</> : <><Eye className="mr-2 h-4 w-4" />Tornar público</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => open('delete')} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialog === 'rename'} onOpenChange={o => !saving && setDialog(o ? 'rename' : null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader><DialogTitle>Mudar nome do documento</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (valid && valid !== doc.titulo) void run(() => p.onRename(doc, valid)); }}>
            <div className="space-y-2"><Label htmlFor={`title-${doc.id}`}>Nome</Label>
              <Input id={`title-${doc.id}`} value={title} onChange={e => setTitle(e.target.value)} maxLength={DOCUMENT_TITLE_MAX} autoFocus disabled={saving} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving || !valid || valid === doc.titulo}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'move'} onOpenChange={o => !saving && setDialog(o ? 'move' : null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader><DialogTitle>Mover documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Categoria</Label>
              <Select value={cat} onValueChange={v => { setCat(v); setSub(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">{p.categories.map(c => <SelectItem key={c} value={c}>{p.categoryIcons[c] || '📁'} {c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>Subcategoria</Label>
              <SubcategorySelect categories={p.subcategories} categoria={cat} value={sub} onChange={setSub} label="Subcategoria" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void run(() => p.onMove(doc, cat, sub))} disabled={saving || (cat === doc.categoria && sub === doc.subcategoria_id)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === 'delete'} onOpenChange={o => setDialog(o ? 'delete' : null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader><AlertDialogTitle>Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser revertida. "{doc.titulo}" será permanentemente eliminado.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => p.onDelete(doc.id)} className="bg-destructive hover:bg-destructive/90">{p.deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
