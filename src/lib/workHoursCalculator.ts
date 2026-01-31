/**
 * Work Hours Calculator Utility
 * 
 * Business rules:
 * 1. Hours are always rounded down to whole hours (8h 30min = 8h)
 * 2. Days without exit (saida) are NOT counted - only complete entry/exit pairs count
 * 3. For today only, if still working (entry without exit), calculate hours up to current time
 */

interface PontoRecord {
  tipo: 'entrada' | 'saida';
  timestamp: string;
  status?: string;
}

/**
 * Calculate work hours for a set of records.
 * Only counts complete entry/exit pairs from APPROVED records.
 * For today, allows counting ongoing work (entry without exit yet).
 * 
 * @param records - Array of ponto records for the day
 * @param isToday - Whether this is the current day (allows counting ongoing work)
 * @param roundToWholeHours - Whether to round down to whole hours (default: true)
 * @param onlyApproved - Whether to only count approved records (default: true)
 * @returns Total hours worked (rounded to whole hours by default)
 */
export function calculateWorkHours(
  records: PontoRecord[],
  isToday: boolean = false,
  roundToWholeHours: boolean = true,
  onlyApproved: boolean = true
): number {
  let totalSeconds = 0;
  let entryTime: Date | null = null;

  // Filter to only approved records if required
  const filteredRecords = onlyApproved 
    ? records.filter(r => !r.status || r.status === 'aprovado')
    : records;

  // Sort records by timestamp to ensure proper pairing
  const sortedRecords = [...filteredRecords].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const record of sortedRecords) {
    if (record.tipo === 'entrada') {
      entryTime = new Date(record.timestamp);
    } else if (record.tipo === 'saida' && entryTime) {
      totalSeconds += (new Date(record.timestamp).getTime() - entryTime.getTime()) / 1000;
      entryTime = null;
    }
  }

  // Only count ongoing work (entry without exit) if it's today
  if (entryTime && isToday) {
    const now = new Date();
    totalSeconds += (now.getTime() - entryTime.getTime()) / 1000;
  }
  // Note: If there's an entry without exit on a past day, we DON'T count those hours

  const hours = totalSeconds / 3600;

  if (roundToWholeHours) {
    return Math.floor(hours); // Always round down to whole hours
  }

  return Math.round(hours * 10) / 10; // 1 decimal place
}

/**
 * Check if a day has an incomplete entry (entry without exit).
 * Useful for flagging days that need manual exit registration.
 * 
 * @param records - Array of ponto records for the day
 * @returns true if there's an entry without a matching exit
 */
export function hasIncompleteEntry(records: PontoRecord[]): boolean {
  let entryCount = 0;
  let exitCount = 0;

  for (const record of records) {
    if (record.tipo === 'entrada') {
      entryCount++;
    } else if (record.tipo === 'saida') {
      exitCount++;
    }
  }

  return entryCount > exitCount;
}

/**
 * Get the last entry without exit timestamp.
 * Useful for knowing when the incomplete entry started.
 * 
 * @param records - Array of ponto records for the day
 * @returns The timestamp of the last unmatched entry, or null if all entries are matched
 */
export function getLastIncompleteEntryTime(records: PontoRecord[]): Date | null {
  let entryTime: Date | null = null;

  // Sort records by timestamp
  const sortedRecords = [...records].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const record of sortedRecords) {
    if (record.tipo === 'entrada') {
      entryTime = new Date(record.timestamp);
    } else if (record.tipo === 'saida') {
      entryTime = null;
    }
  }

  return entryTime;
}
