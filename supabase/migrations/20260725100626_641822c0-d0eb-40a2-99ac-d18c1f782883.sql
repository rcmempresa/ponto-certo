
DROP POLICY IF EXISTS "Users can update own pending ferias or admin can update any" ON public.ferias;
DROP POLICY IF EXISTS "Users can delete own pending ferias" ON public.ferias;

CREATE POLICY "Users can update own ferias or admin can update any"
ON public.ferias
FOR UPDATE
USING (is_admin() OR auth.uid() = user_id);

CREATE POLICY "Users can delete own ferias or admin can delete any"
ON public.ferias
FOR DELETE
USING (is_admin() OR auth.uid() = user_id);
