import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, FileDown, History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, activityActionLabel, activityDetailLines, activityEntityLabel, formatActivityDate, sanitizeActivitySearch } from '@/lib/adminActivity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListPager } from '@/components/documents/ListPager';

const PAGE_SIZE = 25;
type ActivityLog = Tables<'admin_activity_logs'>;

export default function AdminAtividade() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [action, setAction] = useState('todas');
  const [entity, setEntity] = useState('todas');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch, action, entity]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(false);
      let query = supabase.from('admin_activity_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (action !== 'todas') query = query.eq('acao', action);
      if (entity !== 'todas') query = query.eq('entidade', entity);
      const term = sanitizeActivitySearch(deferredSearch);
      if (term) query = query.or(`actor_nome.ilike.%${term}%,actor_email.ilike.%${term}%,descricao.ilike.%${term}%`);
      const from = (page - 1) * PAGE_SIZE;
      const { data, error: loadError, count } = await query.range(from, from + PAGE_SIZE - 1);
      if (!active) return;
      if (loadError) {
        setError(true);
        setLogs([]);
      } else {
        setLogs(data ?? []);
        setTotal(count ?? 0);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [page, action, entity, deferredSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(search || action !== 'todas' || entity !== 'todas');
  const subtitle = useMemo(() => total === 1 ? '1 ação registada' : `${total} ações registadas`, [total]);

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" />Área protegida · apenas administradores</div>
          <h1 className="text-2xl font-semibold tracking-tight">Atividade do gerente</h1>
          <p className="text-muted-foreground">Ações, alterações e exportações feitas no painel. {subtitle}.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_190px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Pesquisar atividade" className="pl-9" placeholder="Pesquisar por pessoa ou ação…" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-label="Filtrar por ação"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ações</SelectItem>
              {Object.entries(ACTIVITY_ACTIONS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger aria-label="Filtrar por área"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as áreas</SelectItem>
              {Object.entries(ACTIVITY_ENTITIES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="overflow-hidden rounded-xl border bg-card" aria-live="polite">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin" />A carregar atividade…</div>
        ) : error ? (
          <div className="py-16 text-center"><p>Não foi possível carregar o histórico.</p><Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button></div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {filtersActive ? <Search className="mx-auto mb-3 h-8 w-8" /> : <History className="mx-auto mb-3 h-8 w-8" />}
            <p>{filtersActive ? 'Nenhuma ação corresponde aos filtros.' : 'Ainda não há ações registadas.'}</p>
            {!filtersActive && <p className="mt-1 text-sm">As próximas alterações feitas no painel aparecem aqui.</p>}
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {logs.map(log => {
              const details = activityDetailLines(log.detalhes);
              return (
                <li key={log.id} className="p-4 sm:p-5">
                  <article className="flex gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      {log.acao === 'exportou' ? <FileDown className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="font-medium break-words first-letter:uppercase">{log.descricao}</h2>
                          <p className="mt-1 text-sm text-muted-foreground break-words">{log.actor_nome}{log.actor_email && log.actor_email !== log.actor_nome ? ` · ${log.actor_email}` : ''}</p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={log.created_at}>{formatActivityDate(log.created_at)}</time>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{activityActionLabel(log.acao)}</Badge>
                        <Badge variant="outline">{activityEntityLabel(log.entidade)}</Badge>
                      </div>
                      {(details.length > 0 || log.registo_id) && (
                        <details className="group text-sm">
                          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground">Ver detalhes<ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" /></summary>
                          <div className="mt-2 space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                            {details.map(detail => <p key={detail} className="break-words">{detail}</p>)}
                            {log.registo_id && <p className="break-all">Referência: {log.registo_id}</p>}
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
        {!loading && !error && <ListPager page={page} totalPages={totalPages} onChange={setPage} />}
      </section>
    </div>
  );
}
