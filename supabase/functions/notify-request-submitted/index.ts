import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.25.76'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const Body = z.object({ tipo: z.enum(['ferias', 'falta']), id: z.string().uuid() })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const pt = (d: string) => d.split('-').reverse().join('/')
const half = (t: string) => (t === 'manha' ? ' (manhã)' : t === 'tarde' ? ' (tarde)' : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: auth, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !auth.user) return json({ error: 'Unauthorized' }, 401)

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  const { tipo, id } = parsed.data

  const table = tipo === 'ferias' ? 'ferias' : 'faltas'
  const { data: row } = await admin.from(table).select('*').eq('id', id).maybeSingle()
  if (!row || row.user_id !== auth.user.id) return json({ error: 'Not found' }, 404)
  if (row.status !== 'pendente') return json({ sent: false, reason: 'not_pending' })

  const { data: profile } = await admin.from('profiles').select('nome, email').eq('id', row.user_id).maybeSingle()
  const nome = profile?.nome || profile?.email || auth.user.email || 'Colaborador'

  let templateData: Record<string, unknown>
  if (tipo === 'ferias') {
    const periodo = row.data_inicio === row.data_fim
      ? `${pt(row.data_inicio)}${half(row.tipo_inicio)}`
      : `${pt(row.data_inicio)}${half(row.tipo_inicio)} a ${pt(row.data_fim)}${half(row.tipo_fim)}`
    templateData = { tipo, nome, periodo }
  } else {
    let anexoUrl: string | undefined
    const marker = '/faltas_docs/'
    if (row.comprovativo_url?.includes(marker)) {
      const path = decodeURIComponent(row.comprovativo_url.split(marker)[1].split('?')[0])
      const { data: signed } = await admin.storage.from('faltas_docs').createSignedUrl(path, 60 * 60 * 24 * 7)
      anexoUrl = signed?.signedUrl
    }
    const detalhe = row.tipo_falta === 'parcial'
      ? `Parcial (${row.hora_inicio?.slice(0, 5)} – ${row.hora_fim?.slice(0, 5)})`
      : 'Dia inteiro'
    templateData = { tipo, nome, periodo: pt(row.data), detalhe, motivo: row.motivo, anexoUrl }
  }

  try {
    const result = await sendTemplateEmail('request-submitted', 'geral@nrtechsolucion.pt', {
      templateData,
      idempotencyKey: `request-submitted-${tipo}-${id}-${row.updated_at}`,
    })
    return json(result)
  } catch (e) {
    console.error('send failed', e)
    return json({ sent: false, reason: 'send_failed' }, 502)
  }
})
