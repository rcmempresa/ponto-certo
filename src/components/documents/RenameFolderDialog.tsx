import { useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export function RenameFolderDialog({ name, onRename }: { name: string; onRename: (name: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !value.trim()) return;
    setSaving(true);
    try { if (await onRename(value.trim())) setOpen(false); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={next => { if (!saving) { setValue(name); setOpen(next); } }}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" aria-label={`Mudar nome de ${name}`} title="Mudar nome"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
    <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
      <DialogHeader><DialogTitle>Mudar nome da pasta</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="folder-name">Nome</Label><Input id="folder-name" value={value} onChange={event => setValue(event.target.value)} maxLength={80} autoFocus disabled={saving} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving || !value.trim() || value.trim() === name}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}