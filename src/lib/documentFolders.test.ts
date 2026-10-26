import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const token = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
describe.skipIf(!token)('Document folder renaming', () => {
  it('keeps existing documents and subcategory assignments when a parent is renamed', async () => {
    const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const original = `Teste pastas ${crypto.randomUUID()}`;
    const renamed = `${original} novo`;
    let subId: string | undefined;
    let docId: string | undefined;
    try {
      const category = await client.from('documento_categorias').insert({ nome: original });
      expect(category.error).toBeNull();
      const sub = await client.from('documento_subcategorias').insert({ categoria: original, nome: 'Subpasta existente' }).select('id').single();
      expect(sub.error).toBeNull();
      subId = sub.data?.id;
      const doc = await client.from('documentos').insert({ titulo: 'Documento existente', categoria: original, subcategoria_id: subId, ficheiro_url: 'https://example.invalid/test.pdf' }).select('id').single();
      expect(doc.error).toBeNull();
      docId = doc.data?.id;
      const result = await client.rpc('rename_document_category', { old_name: original, new_name: renamed });
      expect(result.error).toBeNull();
      const saved = await client.from('documentos').select('categoria,subcategoria_id').eq('id', docId ?? '').single();
      expect(saved.data).toEqual({ categoria: renamed, subcategoria_id: subId });
      const subSaved = await client.from('documento_subcategorias').select('categoria').eq('id', subId ?? '').single();
      expect(subSaved.data?.categoria).toBe(renamed);
      const subRename = await client.from('documento_subcategorias').update({ nome: 'Subpasta renomeada' }).eq('id', subId ?? '').select('nome').single();
      expect(subRename.data?.nome).toBe('Subpasta renomeada');
      const after = await client.from('documentos').select('subcategoria_id').eq('id', docId ?? '').single();
      expect(after.data?.subcategoria_id).toBe(subId);
    } finally {
      if (docId) await client.from('documentos').delete().eq('id', docId);
      if (subId) await client.from('documento_subcategorias').delete().eq('id', subId);
      await client.from('documento_categorias').delete().in('nome', [original, renamed]);
    }
  });
});