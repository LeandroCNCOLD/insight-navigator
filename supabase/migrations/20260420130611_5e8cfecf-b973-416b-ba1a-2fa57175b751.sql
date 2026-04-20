CREATE TABLE public.equipment_capacity_curves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  marca TEXT,
  modelo TEXT NOT NULL,
  tipo TEXT,
  gas_refrigerante TEXT,
  temp_evaporacao_c NUMERIC NOT NULL,
  temp_ambiente_c NUMERIC,
  capacidade_kcal_h NUMERIC NOT NULL,
  potencia_hp NUMERIC,
  fonte TEXT NOT NULL DEFAULT 'manual',
  proposal_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eqcurves_modelo ON public.equipment_capacity_curves (marca, modelo);
CREATE INDEX idx_eqcurves_owner ON public.equipment_capacity_curves (owner_id);

ALTER TABLE public.equipment_capacity_curves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages capacity curves"
ON public.equipment_capacity_curves
FOR ALL
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_eqcurves_updated_at
BEFORE UPDATE ON public.equipment_capacity_curves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();