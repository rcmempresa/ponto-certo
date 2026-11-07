import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders as sdkCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requestSchema } from './schema.ts';
import { recentRequestCutoff, requestInsert, requestTables } from './requests.ts';
import { addDay, dailySummary, dayBoundary, getAgentSecret, localDay, pairedHours, teamPresence, validSecret } from './rules.ts';

const corsHeaders = { ...sdkCorsHeaders, 'Access-Control-Allow-Headers': `${sdkCorsHeaders['Access-Control-Allow-Headers']}, x-agent-secret` };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// This shared secret grants administrative access; never use it in browser code.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'Método não permitido' }, 405);
  const secret = getAgentSecret(name => Deno.env.get(name));
  if (!secret) return response({ error: 'AGENT_SECRET não configurado' }, 503);
  if (!await validSecret(req.headers.get('x-agent-secret'), secret)) return response({ error: 'Unauthorized' }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { return response({ error: 'JSON inválido' }, 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return response({ error: 'Pedido inválido', details: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) }, 400);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return response({ error: 'Serviço não configurado' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const input = parsed.data;
  // Fetch all pages, so large teams and long date ranges are not silently truncated.
  async function punches(from: string, to: string, userId?: string) {
    const rows: { id: string; user_id: string; tipo: 'entrada' | 'saida'; timestamp: string; status: string; localizacao: string | null }[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = db.from('ponto').select('id,user_id,tipo,timestamp,status,localizacao')
        .gte('timestamp', dayBoundary(from)).lt('timestamp', dayBoundary(addDay(to)))
        .order('timestamp').order('id').range(offset, offset + 999);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }
  async function profiles() {
    const rows: { id: string; nome: string }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('profiles').select('id,nome').order('id').range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }
  try {
    if ('params' in input && input.params && 'user_id' in input.params && ['criar_ferias', 'criar_falta', 'criar_horas_extra', 'criar_folga_trabalhada', 'ver_saldo_ferias', 'meus_pedidos'].includes(input.action)) {
      const { data: profile, error } = await db.from('profiles').select('id,saldo_ferias,nome').eq('id', input.params.user_id).maybeSingle();
      if (error) throw error;
      if (!profile) return response({ error: 'Utilizador não encontrado' }, 404);
      if (input.action === 'ver_saldo_ferias') return response({ data: { saldo_ferias: Number(profile.saldo_ferias) } });
      const insert = requestInsert(input);
      if (insert) {
        const { data, error: insertError } = await db.from(insert.table).insert(insert.values).select(insert.select).single();
        if (insertError) throw insertError;
        return response({ data });
      }
    }
    switch (input.action) {
      case 'registar_ponto': {
        const { user_id, tipo, localizacao } = input.params;
        const { data, error } = await db.rpc('agent_register_punch', { p_user_id: user_id, p_tipo: tipo, p_localizacao: localizacao ?? null });
        if (error) throw error;
        const hours = tipo === 'saida' ? pairedHours(await punches(localDay(data.timestamp), localDay(data.timestamp), user_id)) : undefined;
        return response({ data: { timestamp: data.timestamp, ...(hours !== undefined ? { horas_hoje: hours } : {}) } });
      }
      case 'ver_ponto': {
        const data = await punches(input.params.date, input.params.date, input.params.user_id);
        return response({ data, total_horas: pairedHours(data) });
      }
      case 'presenca_equipa': {
        const today = localDay(new Date().toISOString());
        const [team, records] = await Promise.all([profiles(), punches(today, today)]);
        return response({ data: teamPresence(team, records) });
      }
      case 'resumo_semana': {
        const { user_id, date_from, date_to } = input.params;
        return response({ data: dailySummary(await punches(date_from, date_to, user_id), date_from, date_to) });
      }
      case 'pedidos_pendentes':
      case 'meus_pedidos': {
        const team = await profiles();
        const names = new Map(team.map(person => [person.id, person.nome]));
        const cutoff = recentRequestCutoff();
        const entries = await Promise.all(requestTables.map(async table => {
          const rows: Record<string, unknown>[] = [];
          for (let offset = 0; ; offset += 1000) {
            let query = db.from(table).select('*');
            if (input.action === 'meus_pedidos') {
              query = query.eq('user_id', input.params.user_id).or(`status.eq.pendente,created_at.gte.${cutoff}`);
            } else {
              query = query.eq('status', 'pendente');
            }
            const { data, error } = await query.order('created_at', { ascending: input.action === 'pedidos_pendentes' }).order('id').range(offset, offset + 999);
            if (error) throw error;
            rows.push(...(data ?? []).map(row => ({ ...row, name: names.get(row.user_id) ?? '' })));
            if (!data || data.length < 1000) return [table, rows];
          }
        }));
        return response({ data: Object.fromEntries(entries) });
      }
      case 'aprovar_pedido': {
        const { tipo, id, status, motivo } = input.params;
        const { data, error } = await db.rpc('agent_decide_request', { p_tipo: tipo, p_id: id, p_status: status, p_motivo: motivo ?? null });
        if (error) throw error;
        return response({ data });
      }
    }
  } catch (error) {
    const problem = error as { code?: string; message?: string };
    if (problem.code === 'P0002') return response({ error: problem.message }, 404);
    if (problem.code === 'P0001') return response({ error: problem.message }, 409);
    if (problem.code === '22023') return response({ error: problem.message }, 400);
    if (problem.code === '23503') return response({ error: 'Utilizador não encontrado' }, 404);
    if (problem.code === '23514' || problem.code === '22003') return response({ error: 'Valores inválidos para o pedido' }, 400);
    return response({ error: 'Não foi possível processar o pedido' }, 500);
  }
});