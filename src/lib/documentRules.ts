import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export const DOCUMENT_EXPIRY_NOTICE_DAYS = 15;
export const DOCUMENT_NOTICE_MAX_DAYS = 365;

export function documentExpiryState(validade: string | null, today = new Date(), noticeDays = DOCUMENT_EXPIRY_NOTICE_DAYS) {
  if (!validade) return { status: 'none' as const, days: null };
  const days = differenceInCalendarDays(parseISO(validade), parseISO(format(today, 'yyyy-MM-dd')));
  if (days < 0) return { status: 'expired' as const, days };
  if (days <= noticeDays) return { status: 'expiring' as const, days };
  return { status: 'valid' as const, days };
}

export function documentNoticeDays(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > DOCUMENT_NOTICE_MAX_DAYS) {
    throw new Error(`Indique um número de dias entre 0 e ${DOCUMENT_NOTICE_MAX_DAYS}.`);
  }
  return n;
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, totalPages };
}

export function documentCategoryChange(categoria: string) {
  return { categoria, subcategoria_id: null };
}

export function documentUploadValidity(hasExpiry: boolean, date: string) {
  if (!hasExpiry) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseISO(date).getTime())) {
    throw new Error('Indique uma data de validade válida.');
  }
  return date;
}
