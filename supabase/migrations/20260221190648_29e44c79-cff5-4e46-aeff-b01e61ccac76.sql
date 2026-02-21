
CREATE POLICY "Admins can delete horas_extra"
ON public.horas_extra
FOR DELETE
USING (is_admin());
