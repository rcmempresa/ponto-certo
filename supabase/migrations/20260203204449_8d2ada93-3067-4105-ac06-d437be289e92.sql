-- Add column for vacation period type (full day, morning half, afternoon half)
ALTER TABLE public.ferias 
ADD COLUMN tipo_periodo text NOT NULL DEFAULT 'dia_inteiro';

-- Add comment for documentation
COMMENT ON COLUMN public.ferias.tipo_periodo IS 'Tipo de período: dia_inteiro, meio_dia_manha, meio_dia_tarde';