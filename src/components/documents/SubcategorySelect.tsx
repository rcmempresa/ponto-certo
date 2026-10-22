import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type DocumentSubcategory = { id: string; categoria: string; nome: string };

export function SubcategorySelect({ categories, categoria, value, onChange, label = 'Subcategoria' }: {
  categories: DocumentSubcategory[]; categoria: string; value: string | null;
  onChange: (id: string | null) => void; label?: string;
}) {
  return <Select value={value || 'none'} onValueChange={id => onChange(id === 'none' ? null : id)}>
    <SelectTrigger aria-label={label} className="min-w-0 text-xs"><SelectValue placeholder="Sem subcategoria" /></SelectTrigger>
    <SelectContent className="max-w-[calc(100vw-2rem)]">
      <SelectItem value="none">Sem subcategoria</SelectItem>
      {categories.filter(c => c.categoria === categoria).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
    </SelectContent>
  </Select>;
}