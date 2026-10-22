import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export const DOCUMENT_EXPIRY_NOTICE_DAYS = 15;

export function documentExpiryState(validade: string | null, today = new Date()) {
  if (!validade) return { status: 'none' as const, days: null };
  const days = differenceInCalendarDays(parseISO(validade), parseISO(format(today, 'yyyy-MM-dd')));
  if (days < 0) return { status: 'expired' as const, days };
  if (days <= DOCUMENT_EXPIRY_NOTICE_DAYS) return { status: 'expiring' as const, days };
  return { status: 'valid' as const, days };
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