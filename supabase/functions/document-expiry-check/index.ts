import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const toPt = (iso: string) => iso.split('-').reverse().join('/')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')

  const { data: docs, error } = await supabase
    .from('documentos')
    .select('id,titulo,categoria,validade,aviso_dias')
    .not('validade', 'is', null)
    .is('aviso_enviado_em', null)
    .limit(200)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })

  let sent = 0
  for (const doc of docs ?? []) {
    const exp = new Date(doc.validade + 'T00:00:00Z')
    const dias = Math.round((exp.getTime() - today.getTime()) / 86400000)
    if (dias > doc.aviso_dias) continue
    try {
      const result = await sendTemplateEmail('document-expiry', 'geral@nrtechsolucion.pt', {
        templateData: { titulo: doc.titulo, categoria: doc.categoria, validade: toPt(doc.validade), dias },
        idempotencyKey: `document-expiry-${doc.id}-${doc.validade}-${doc.aviso_dias}`,
      })
      if (result.sent || result.reason === 'recipient_suppressed') {
        await supabase.from('documentos').update({ aviso_enviado_em: new Date().toISOString() }).eq('id', doc.id)
        if (result.sent) sent++
      }
    } catch (e) {
      console.error('document-expiry send failed', doc.id, e)
    }
  }

  return new Response(JSON.stringify({ checked: docs?.length ?? 0, sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
