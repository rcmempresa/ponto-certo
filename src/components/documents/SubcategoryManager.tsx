import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { DocumentSubcategory } from './SubcategorySelect';
import { RenameFolderDialog } from './RenameFolderDialog';

export function SubcategoryManager({ parents, subcategories, onChange }: {
  parents: string[]; subcategories: DocumentSubcategory[]; onChange: () => void;
}) {
  const [parent, setParent] = useState('Geral');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('documento_subcategorias').insert({ categoria: parent, nome: name.trim() });
    setSaving(false);
    if (error) { toast({ title: 'Não foi possível criar a subcategoria', description: error.code === '23505' ? 'Esta subcategoria já existe nesta categoria.' : error.message, variant: 'destructive' }); return; }
    setName('');
    onChange();
    toast({ title: 'Subcategoria criada' });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('documento_subcategorias').delete().eq('id', id);
    if (error) { toast({ title: 'Não foi possível eliminar', variant: 'destructive' }); return; }
    onChange();
    toast({ title: 'Subcategoria eliminada', description: 'Os documentos continuam na categoria principal.' });
  };
  const rename = async (id: string, nome: string) => {
    const { error } = await supabase.from('documento_subcategorias').update({ nome }).eq('id', id).select('id').single();
    if (error) { toast({ title: 'Não foi possível mudar o nome', description: error.code === '23505' ? 'Esta subcategoria já existe nesta categoria.' : error.message, variant: 'destructive' }); return false; }
    onChange();
    toast({ title: 'Nome da subcategoria alterado' });
    return true;
  };
  return <div className="border-t pt-4 space-y-3">
    <h3 className="font-medium">Subcategorias</h3>
    <Label>Categoria principal</Label>
    <Select value={parent} onValueChange={setParent}><SelectTrigger aria-label="Categoria principal" className="min-w-0"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-2rem)]">{parents.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
    <div className="flex gap-2"><Input aria-label="Nome da subcategoria" value={name} onChange={e => setName(e.target.value)} placeholder="Nome da subcategoria" maxLength={80} className="min-w-0" /><Button size="icon" disabled={saving || !name.trim()} onClick={create} aria-label="Criar subcategoria" title="Criar subcategoria">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button></div>
    <ul className="divide-y">{subcategories.filter(s => s.categoria === parent).map(s => <li key={s.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 flex-1 break-words text-sm">{s.nome}</span><RenameFolderDialog name={s.nome} onRename={nome => rename(s.id, nome)} /><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Eliminar subcategoria ${s.nome}`} title="Eliminar subcategoria" className="shrink-0 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg"><AlertDialogHeader><AlertDialogTitle>Eliminar subcategoria?</AlertDialogTitle><AlertDialogDescription>Os documentos de “{s.nome}” continuam na categoria “{parent}”, sem subcategoria.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove(s.id)}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></li>)}</ul>
  </div>;
}