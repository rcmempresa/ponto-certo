import { describe, expect, it } from 'vitest';
import { documentCategoryChange, documentExpiryState, documentUploadValidity } from './documentRules';

describe('document validity', () => {
  const today = new Date(2026, 9, 22, 12);
  it('warns 15 days before expiry', () => {
    expect(documentExpiryState('2026-11-06', today)).toEqual({ status: 'expiring', days: 15 });
    expect(documentExpiryState('2026-11-07', today).status).toBe('valid');
  });
  it('does not warn for documents without validity', () => {
    expect(documentExpiryState(null, today).status).toBe('none');
    expect(documentUploadValidity(false, '2026-11-06')).toBeNull();
  });
  it('requires a date when validity is selected', () => {
    expect(() => documentUploadValidity(true, '')).toThrow();
    expect(documentUploadValidity(true, '2026-11-06')).toBe('2026-11-06');
  });
  it('includes expiry day and distinguishes expired documents', () => {
    expect(documentExpiryState('2026-10-22', today)).toEqual({ status: 'expiring', days: 0 });
    expect(documentExpiryState('2026-10-21', today)).toEqual({ status: 'expired', days: -1 });
  });
});

it('clears the previous subcategory when moving a document to another category', () => {
  expect(documentCategoryChange('Seguros')).toEqual({ categoria: 'Seguros', subcategoria_id: null });
});