-- Tabela principal de disputas
CREATE TABLE public.proposal_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  house_proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  titulo TEXT,
  resultado TEXT NOT NULL DEFAULT 'em_aberto', -- 'ganha' | 'perdida' | 'em_aberto'
  winner_competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  winner_proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  motivo_resultado TEXT,
  observacoes TEXT,
  ai_analysis JSONB,
  ai_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_disputes_owner ON public.proposal_disputes(owner_id);
CREATE INDEX idx_proposal_disputes_house ON public.proposal_disputes(house_proposal_id);
CREATE INDEX idx_proposal_disputes_client ON public.proposal_disputes(client_id);

ALTER TABLE public.proposal_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages disputes" ON public.proposal_disputes
  FOR ALL USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_proposal_disputes_updated_at
  BEFORE UPDATE ON public.proposal_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de junção: concorrentes da disputa
CREATE TABLE public.dispute_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  dispute_id UUID NOT NULL REFERENCES public.proposal_disputes(id) ON DELETE CASCADE,
  competitor_proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dispute_id, competitor_proposal_id)
);

CREATE INDEX idx_dispute_competitors_dispute ON public.dispute_competitors(dispute_id);
CREATE INDEX idx_dispute_competitors_proposal ON public.dispute_competitors(competitor_proposal_id);

ALTER TABLE public.dispute_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages dispute competitors" ON public.dispute_competitors
  FOR ALL USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Campo rápido em proposals para marcação de status competitivo da CN Cold (sem precisar criar disputa)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS resultado_disputa TEXT, -- 'ganha' | 'perdida' | 'em_aberto'
  ADD COLUMN IF NOT EXISTS vencedor_competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_resultado TEXT;

CREATE INDEX IF NOT EXISTS idx_proposals_resultado ON public.proposals(resultado_disputa);