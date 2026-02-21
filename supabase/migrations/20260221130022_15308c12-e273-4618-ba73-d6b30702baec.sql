
-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_admin());

-- Allow admins to delete ferias (currently only users can delete own pending)
CREATE POLICY "Admins can delete ferias"
ON public.ferias
FOR DELETE
USING (is_admin());
