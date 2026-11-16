DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documentos;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can view subcategories" ON public.documento_subcategorias;
CREATE POLICY "Signed-in users can view subcategories" ON public.documento_subcategorias FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);