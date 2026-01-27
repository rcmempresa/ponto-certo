-- Add columns to track partial day absences
ALTER TABLE public.faltas 
ADD COLUMN tipo_falta text NOT NULL DEFAULT 'dia_inteiro' CHECK (tipo_falta IN ('dia_inteiro', 'parcial')),
ADD COLUMN hora_inicio time,
ADD COLUMN hora_fim time;

-- Add comment for documentation
COMMENT ON COLUMN public.faltas.tipo_falta IS 'Type of absence: dia_inteiro (full day) or parcial (partial hours)';
COMMENT ON COLUMN public.faltas.hora_inicio IS 'Start time for partial absences';
COMMENT ON COLUMN public.faltas.hora_fim IS 'End time for partial absences';