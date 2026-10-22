CREATE TABLE public.documento_subcategorias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 categoria text NOT NULL,
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 80),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_subcategorias TO authenticated;
GRANT ALL ON public.documento_subcategorias TO service_role;
ALTER TABLE public.documento_subcategorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view subcategories" ON public.documento_subcategorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subcategories" ON public.documento_subcategorias FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE UNIQUE INDEX documento_subcategorias_unique_name ON public.documento_subcategorias (categoria, lower(trim(nome)));
ALTER TABLE public.documentos ADD COLUMN subcategoria_id uuid REFERENCES public.documento_subcategorias(id) ON DELETE SET NULL;
ALTER TABLE public.documentos ADD COLUMN validade date;
CREATE INDEX documentos_validade_idx ON public.documentos (validade) WHERE validade IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validate_document_subcategory() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.subcategoria_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.documento_subcategorias s WHERE s.id = NEW.subcategoria_id AND s.categoria = NEW.categoria) THEN
 RAISE EXCEPTION 'A subcategoria deve pertencer à categoria do documento';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_document_subcategory BEFORE INSERT OR UPDATE OF categoria, subcategoria_id ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.validate_document_subcategory();