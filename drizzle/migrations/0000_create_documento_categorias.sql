CREATE TABLE public.documento_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_categorias TO authenticated;
GRANT ALL ON public.documento_categorias TO service_role;
ALTER TABLE public.documento_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view categories" ON public.documento_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.documento_categorias FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());