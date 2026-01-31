-- Allow admins to delete from faltas table
CREATE POLICY "Admins can delete faltas"
ON public.faltas
FOR DELETE
USING (is_admin());

-- Allow admins to delete from ponto table
CREATE POLICY "Admins can delete ponto"
ON public.ponto
FOR DELETE
USING (is_admin());

-- Allow admins to delete from notifications table (cleanup)
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (is_admin());