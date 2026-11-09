CREATE TABLE public.tarefas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
 descricao text NOT NULL DEFAULT '' CHECK (char_length(descricao) <= 2000),
 data_inicio date NOT NULL,
 lembretes_dias integer[] NOT NULL DEFAULT ARRAY[2,7,15,30] CHECK (lembretes_dias <@ ARRAY[2,7,15,30]),
 lembretes_processados integer[] NOT NULL DEFAULT '{}',
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 concluida_em timestamptz,
 conclusao_email_estado text NOT NULL DEFAULT 'pendente' CHECK (conclusao_email_estado IN ('pendente','enviado','suprimido')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tasks" ON public.tarefas FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX tarefas_pending_idx ON public.tarefas(data_inicio) WHERE concluida_em IS NULL;