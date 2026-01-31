-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own ponto" ON public.ponto;

-- Create new INSERT policy that allows users to insert their own records OR admins to insert for anyone
CREATE POLICY "Users can insert own ponto or admin can insert any" 
ON public.ponto 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR is_admin());