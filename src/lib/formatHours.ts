export function formatHours(h: number): string {
  const total = Math.round((Number(h) || 0) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}
