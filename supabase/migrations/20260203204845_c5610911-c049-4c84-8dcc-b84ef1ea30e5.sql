-- Add columns for start and end period types
ALTER TABLE public.ferias 
ADD COLUMN tipo_inicio text NOT NULL DEFAULT 'manha',
ADD COLUMN tipo_fim text NOT NULL DEFAULT 'tarde';

-- Add comments for documentation
COMMENT ON COLUMN public.ferias.tipo_inicio IS 'Como começa o primeiro dia: manha ou tarde';
COMMENT ON COLUMN public.ferias.tipo_fim IS 'Como termina o último dia: manha ou tarde';

-- Update existing records to have consistent values
UPDATE public.ferias 
SET tipo_inicio = CASE 
  WHEN tipo_periodo = 'meio_dia_tarde' THEN 'tarde'
  ELSE 'manha'
END,
tipo_fim = CASE 
  WHEN tipo_periodo = 'meio_dia_manha' THEN 'manha'
  ELSE 'tarde'
END;