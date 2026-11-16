const WEBHOOK_URL = 'https://agent-production-29c8.up.railway.app/webhook/ponto'

/** Notify the external system; never throws. */
export async function notifyPontoWebhook(table: string, record: Record<string, unknown>) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('PONTO_WEBHOOK_TOKEN') ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'INSERT', table, record }),
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* ignore */ }
}
