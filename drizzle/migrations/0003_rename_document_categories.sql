CREATE OR REPLACE FUNCTION public.rename_document_category(old_name text, new_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE clean_name text := btrim(new_name);
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem alterar categorias' USING ERRCODE = '42501'; END IF;
 IF clean_name IS NULL OR length(clean_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'O nome deve ter entre 1 e 80 caracteres' USING ERRCODE = '22023'; END IF;
 LOCK TABLE public.documento_categorias, public.documento_subcategorias, public.documentos IN SHARE ROW EXCLUSIVE MODE;
 IF NOT EXISTS (SELECT 1 FROM public.documento_categorias WHERE nome = old_name) THEN RAISE EXCEPTION 'Categoria não encontrada' USING ERRCODE = 'P0002'; END IF;
 IF clean_name = old_name THEN RETURN; END IF;
 IF EXISTS (SELECT 1 FROM public.documento_categorias WHERE lower(btrim(nome)) = lower(clean_name) AND nome <> old_name)
 OR EXISTS (SELECT 1 FROM public.documentos WHERE lower(btrim(categoria)) = lower(clean_name) AND categoria <> old_name)
 OR EXISTS (SELECT 1 FROM public.documento_subcategorias WHERE lower(btrim(categoria)) = lower(clean_name) AND categoria <> old_name)
 THEN RAISE EXCEPTION 'Já existe uma categoria com este nome' USING ERRCODE = '23505'; END IF;
 UPDATE public.documento_categorias SET nome = clean_name WHERE nome = old_name;
 UPDATE public.documento_subcategorias SET categoria = clean_name WHERE categoria = old_name;
 UPDATE public.documentos SET categoria = clean_name WHERE categoria = old_name;
END;
$$;
REVOKE ALL ON FUNCTION public.rename_document_category(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_document_category(text, text) TO authenticated;