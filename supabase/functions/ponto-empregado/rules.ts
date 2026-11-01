export type Punch = { tipo: 'entrada' | 'saida'; timestamp: string; status?: string };

// Integration totals are elapsed hours from completed pairs, not payroll totals.
export function pairedHours(records: Punch[]): number {
  let entry: number | undefined;
  let milliseconds = 0;
  for (const record of [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (record.status === 'rejeitado') continue;
    const time = Date.parse(record.timestamp);
    if (record.tipo === 'entrada') entry = time;
    else if (entry !== undefined) {
      milliseconds += Math.max(0, time - entry);
      entry = undefined;
    }
  }
  return Math.round(milliseconds / 3600000 * 100) / 100;
}

export function localDay(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Madeira', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)?.value).join('-');
}

export function addDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

export function dayBoundary(date: string): string {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  // Madeira has UTC+0 in winter and UTC+1 in summer; midday avoids DST transition ambiguity.
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Atlantic/Madeira', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date(midnight)));
  return new Date(midnight - hour * 3600000).toISOString();
}

export function dailySummary(records: Punch[], from: string, to: string) {
  const por_dia: { data: string; horas: number }[] = [];
  for (let date = from; date <= to; date = addDay(date)) {
    por_dia.push({ data: date, horas: pairedHours(records.filter(r => localDay(r.timestamp) === date)) });
  }
  return { por_dia, total_horas: Math.round(por_dia.reduce((sum, day) => sum + day.horas, 0) * 100) / 100 };
}

export function presence(records: Punch[]) {
  const ordered = [...records].filter(r => r.status !== 'rejeitado').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const last = ordered.at(-1);
  const entry = ordered.filter(r => r.tipo === 'entrada').at(-1);
  const exit = ordered.filter(r => r.tipo === 'saida').at(-1);
  return {
    estado: last ? (last.tipo === 'entrada' ? 'dentro' : 'fora') : 'sem_registo',
    ...(entry ? { ultima_entrada: entry.timestamp } : {}),
    ...(exit ? { ultima_saida: exit.timestamp } : {}),
  };
}

export function teamPresence(team: { id: string; nome: string }[], records: (Punch & { user_id: string })[]) {
  return team.map(person => ({
    user_id: person.id,
    name: person.nome,
    ...presence(records.filter(record => record.user_id === person.id)),
  }));
}

export function getAgentSecret(readEnv: (name: string) => string | undefined) {
  return readEnv('AGENT_SECRET');
}

export async function validSecret(provided: string | null, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([provided, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}