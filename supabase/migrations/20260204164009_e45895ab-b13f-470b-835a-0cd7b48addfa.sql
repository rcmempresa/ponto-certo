-- Change saldo_ferias from integer to numeric to support half-day values
ALTER TABLE public.profiles 
ALTER COLUMN saldo_ferias TYPE numeric(5,1) USING saldo_ferias::numeric(5,1);

-- Update default value
ALTER TABLE public.profiles 
ALTER COLUMN saldo_ferias SET DEFAULT 22;