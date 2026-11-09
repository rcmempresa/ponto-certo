ALTER TABLE public.tarefas ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id), ADD COLUMN concluida_por uuid REFERENCES public.profiles(id);
DROP POLICY "Admins read tasks" ON public.tarefas;
CREATE POLICY "Manager or assignee reads tasks" ON public.tarefas FOR SELECT TO authenticated USING ((public.is_admin(auth.uid()) AND auth.jwt()->>'email' = 'geral@nrtechsolucion.pt') OR responsavel_id = auth.uid());
CREATE INDEX tarefas_responsavel_idx ON public.tarefas(responsavel_id);