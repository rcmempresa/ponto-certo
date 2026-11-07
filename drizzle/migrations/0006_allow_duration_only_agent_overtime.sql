ALTER TABLE public.horas_extra ALTER COLUMN hora_inicio DROP NOT NULL;
ALTER TABLE public.horas_extra ALTER COLUMN hora_fim DROP NOT NULL;
COMMENT ON COLUMN public.horas_extra.hora_inicio IS 'Optional for duration-only agent requests; null means no start time was supplied.';
COMMENT ON COLUMN public.horas_extra.hora_fim IS 'Optional for duration-only agent requests; null means no end time was supplied.';