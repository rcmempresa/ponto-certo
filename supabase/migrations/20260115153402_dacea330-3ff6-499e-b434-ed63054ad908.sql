-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Enum para status de pedidos
CREATE TYPE public.request_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- Enum para tipo de picagem
CREATE TYPE public.ponto_tipo AS ENUM ('entrada', 'saida');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  cargo TEXT DEFAULT '',
  saldo_ferias INTEGER NOT NULL DEFAULT 22,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela de ponto (registos de entrada/saída)
CREATE TABLE public.ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo ponto_tipo NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  localizacao TEXT
);

-- Tabela de férias
CREATE TABLE public.ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status request_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de faltas
CREATE TABLE public.faltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  motivo TEXT NOT NULL,
  comprovativo_url TEXT,
  status request_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de documentos
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  ficheiro_url TEXT NOT NULL,
  visibilidade_geral BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função helper para verificar se é admin (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ferias_updated_at
  BEFORE UPDATE ON public.ferias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faltas_updated_at
  BEFORE UPDATE ON public.faltas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil e role ao registar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile or admin can view all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile (except saldo_ferias)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    CASE 
      WHEN public.is_admin() THEN true
      WHEN auth.uid() = id THEN true
      ELSE false
    END
  );

-- RLS Policies: user_roles
CREATE POLICY "Users can view own role or admin can view all"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS Policies: ponto
CREATE POLICY "Users can view own ponto or admin can view all"
  ON public.ponto FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own ponto"
  ON public.ponto FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: ferias
CREATE POLICY "Users can view own ferias or admin can view all"
  ON public.ferias FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create own ferias requests"
  ON public.ferias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending ferias or admin can update any"
  ON public.ferias FOR UPDATE
  USING (
    public.is_admin() OR 
    (auth.uid() = user_id AND status = 'pendente')
  );

CREATE POLICY "Users can delete own pending ferias"
  ON public.ferias FOR DELETE
  USING (auth.uid() = user_id AND status = 'pendente');

-- RLS Policies: faltas
CREATE POLICY "Users can view own faltas or admin can view all"
  ON public.faltas FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create own faltas"
  ON public.faltas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update faltas status"
  ON public.faltas FOR UPDATE
  USING (public.is_admin());

-- RLS Policies: documentos
CREATE POLICY "Authenticated users can view documents"
  ON public.documentos FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage documents"
  ON public.documentos FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update documents"
  ON public.documentos FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete documents"
  ON public.documentos FOR DELETE
  USING (public.is_admin());

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('faltas_docs', 'faltas_docs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('company_docs', 'company_docs', true);

-- Storage policies: faltas_docs
CREATE POLICY "Users can view own files or admin can view all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'faltas_docs' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()
  ));

CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'faltas_docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies: company_docs
CREATE POLICY "Anyone can view company docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company_docs');

CREATE POLICY "Only admins can upload company docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company_docs' AND public.is_admin());

CREATE POLICY "Only admins can delete company docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company_docs' AND public.is_admin());