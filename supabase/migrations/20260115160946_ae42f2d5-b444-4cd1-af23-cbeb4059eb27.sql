-- Create document permissions table
CREATE TABLE public.documento_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(documento_id, user_id)
);

-- Enable RLS
ALTER TABLE public.documento_permissoes ENABLE ROW LEVEL SECURITY;

-- Admins can manage document permissions
CREATE POLICY "Admins can manage document permissions"
ON public.documento_permissoes
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Users can view their own permissions
CREATE POLICY "Users can view own document permissions"
ON public.documento_permissoes
FOR SELECT
USING (auth.uid() = user_id);

-- Drop old SELECT policy on documentos
DROP POLICY IF EXISTS "Authenticated users can view documents " ON public.documentos;

-- Create new SELECT policy: user can see if visibilidade_geral=true OR user has specific permission OR user is admin
CREATE POLICY "Users can view allowed documents"
ON public.documentos
FOR SELECT
USING (
  is_admin() 
  OR visibilidade_geral = true 
  OR EXISTS (
    SELECT 1 FROM public.documento_permissoes 
    WHERE documento_id = documentos.id 
    AND user_id = auth.uid()
  )
);