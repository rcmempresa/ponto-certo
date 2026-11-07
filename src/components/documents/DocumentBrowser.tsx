import { useMemo, useState } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPager } from './ListPager';
import type { DocumentSubcategory } from './SubcategorySelect';
import type { DocumentRowDoc } from './DocumentRow';
import { paginate } from '@/lib/documentRules';
import type { ReactNode } from 'react';

interface Props<T extends DocumentRowDoc> {
  documents: T[];
  categories: string[];
  subcategories: DocumentSubcategory[];
  loading: boolean;
  renderDocument: (doc: T) => ReactNode;
}

export function DocumentBrowser<T extends DocumentRowDoc>({ documents, categories, subcategories, loading, renderDocument }: Props<T>) {
  const [category, setCategory] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const activeCategory = category && categories.includes(category) ? category : null;
  const activeSub = subcategories.find(s => s.id === sub && s.categoria === activeCategory);
  const searching = query.trim().length > 0;
  const visible = useMemo(() => documents.filter(doc => {
    if (activeCategory && doc.categoria !== activeCategory) return false;
    if (activeSub && doc.subcategoria_id !== activeSub.id) return false;
    const subName = subcategories.find(s => s.id === doc.subcategoria_id)?.nome || '';
    return !searching || `${doc.titulo} ${doc.categoria} ${subName}`.toLocaleLowerCase('pt').includes(query.trim().toLocaleLowerCase('pt'));
  }).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt')), [documents, activeCategory, activeSub, subcategories, searching, query]);
  const { items, page: currentPage, totalPages } = paginate(visible, page, 10);
  const folders = subcategories.filter(s => s.categoria === activeCategory);
  const openCategory = (name: string | null) => { setCategory(name); setSub(null); setQuery(''); setPage(1); };
  const openSub = (id: string | null) => { setSub(id); setPage(1); };

  return (
    <section className="min-w-0 space-y-5" aria-label="Arquivo de documentos">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Localização da pasta" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" onClick={() => openCategory(null)} className="h-auto px-2 py-2" aria-current={!activeCategory ? 'page' : undefined}><FolderOpen />Todas as pastas</Button>
          {activeCategory && <><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /><Button variant="ghost" onClick={() => openSub(null)} className="h-auto min-w-0 whitespace-normal px-2 py-2 text-left" aria-current={!activeSub ? 'page' : undefined}>{activeCategory}</Button></>}
          {activeSub && <><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words px-2 font-medium" aria-current="page">{activeSub.nome}</span></>}
        </nav>
        <div className="relative w-full shrink-0 sm:w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Pesquisar documentos" placeholder="Pesquisar documentos…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} className="pl-9 pr-10" />
          {query && <Button variant="ghost" size="icon" className="absolute right-0 top-0" aria-label="Limpar pesquisa" onClick={() => { setQuery(''); setPage(1); }}><X /></Button>}
        </div>
      </div>

      {loading ? <div role="status" className="py-16 text-center text-sm text-muted-foreground">A carregar documentos…</div> : (
        <>
          {!activeCategory && !searching ? (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...categories].sort((a, b) => Number(documents.some(d => d.categoria === b)) - Number(documents.some(d => d.categoria === a)) || a.localeCompare(b, 'pt')).map(name => {
                const count = documents.filter(d => d.categoria === name).length;
                const subCount = subcategories.filter(s => s.categoria === name).length;
                return <Button key={name} variant="outline" onClick={() => openCategory(name)} className="h-auto min-h-24 min-w-0 justify-start gap-3 whitespace-normal rounded-lg p-4 text-left">
                  <Folder className="h-7 w-7 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{count} documento{count !== 1 ? 's' : ''}{subCount > 0 ? ` · ${subCount} subpasta${subCount !== 1 ? 's' : ''}` : ''}</span></span>
                  <ChevronRight className="shrink-0 text-muted-foreground" />
                </Button>;
              })}
              {categories.length === 0 && <p className="py-10 text-sm text-muted-foreground">Ainda não existem pastas.</p>}
            </div>
          ) : (
            <>
              {activeCategory && !activeSub && folders.length > 0 && !searching && <div className="space-y-2">
                <h2 className="text-xs font-medium uppercase text-muted-foreground">Subpastas</h2>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <Button variant={!activeSub ? 'secondary' : 'outline'} className="h-auto min-h-12 justify-start whitespace-normal text-left" onClick={() => openSub(null)} aria-pressed={!activeSub}><FileText /><span className="min-w-0 flex-1">Todos os documentos</span><span className="text-xs text-muted-foreground">{documents.filter(d => d.categoria === activeCategory).length}</span></Button>
                  {folders.map(folder => <Button key={folder.id} variant={activeSub?.id === folder.id ? 'secondary' : 'outline'} onClick={() => openSub(folder.id)} aria-pressed={activeSub?.id === folder.id} className="h-auto min-h-12 min-w-0 justify-start whitespace-normal text-left"><Folder /><span className="min-w-0 flex-1 break-words">{folder.nome}</span><span className="text-xs text-muted-foreground">{documents.filter(d => d.subcategoria_id === folder.id).length}</span></Button>)}
                </div>
              </div>}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3">
                  <h2 className="font-semibold">{searching ? 'Resultados da pesquisa' : activeSub?.nome || 'Documentos'}</h2>
                  <span className="text-xs text-muted-foreground">{visible.length} documento{visible.length !== 1 ? 's' : ''}</span>
                </div>
                {items.length > 0 ? items.map(doc => <div key={doc.id}>
                  {(!activeCategory || (!activeSub && doc.subcategoria_id)) && <p className="px-3 pt-3 text-xs text-muted-foreground sm:px-4">{!activeCategory ? doc.categoria : ''}{doc.subcategoria_id ? `${!activeCategory ? ' / ' : ''}${subcategories.find(s => s.id === doc.subcategoria_id)?.nome || ''}` : ''}</p>}
                  {renderDocument(doc)}
                </div>) : <div className="flex flex-col items-center gap-3 py-14 text-center"><FileText className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{searching ? 'Nenhum documento encontrado.' : 'Esta pasta ainda não tem documentos.'}</p>{searching && <Button variant="outline" onClick={() => { setQuery(''); setPage(1); }}>Limpar pesquisa</Button>}</div>}
                <ListPager page={currentPage} totalPages={totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}