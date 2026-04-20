ALTER TABLE public.competitors ADD COLUMN IF NOT EXISTS is_house boolean NOT NULL DEFAULT false;
UPDATE public.competitors SET is_house = true WHERE lower(nome) = 'cn code';
CREATE INDEX IF NOT EXISTS idx_competitors_is_house ON public.competitors (is_house);