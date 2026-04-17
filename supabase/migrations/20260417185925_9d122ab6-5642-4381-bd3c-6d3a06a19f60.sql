
CREATE TABLE IF NOT EXISTS public.forensic_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  modelo_ia text,
  score_global numeric,

  -- Bloco A — Estrutura
  tipo_documento text,
  secoes jsonb DEFAULT '[]'::jsonb,
  cabecalhos jsonb DEFAULT '[]'::jsonb,
  rodapes jsonb DEFAULT '[]'::jsonb,
  indice_paginas jsonb DEFAULT '[]'::jsonb,
  tem_tabelas boolean,
  tem_assinatura boolean,
  tem_docusign boolean,
  tem_carimbo boolean,
  tem_formulario boolean,

  -- Bloco B — Campos rastreáveis
  campos_literais jsonb DEFAULT '[]'::jsonb,

  -- Bloco D — Taxonomia
  taxonomia_blocos jsonb DEFAULT '[]'::jsonb,

  -- Bloco E — Análise comparável
  resumo_executivo text,
  resumo_tecnico text,
  resumo_comercial text,
  resumo_contratual text,
  riscos_operacionais text,
  riscos_juridicos text,
  padrao_posicionamento text,
  padrao_transferencia_risco text,
  padrao_pagamento text,
  padrao_garantia text,
  padrao_tecnico text,
  insights_benchmarking text,

  -- Bloco F — Inferências
  inferencias jsonb DEFAULT '[]'::jsonb,

  -- Conflitos documentais
  conflitos_documentais jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forensic_document ON public.forensic_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_forensic_owner ON public.forensic_analyses(owner_id);

ALTER TABLE public.forensic_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages forensic analyses"
ON public.forensic_analyses
FOR ALL
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_forensic_analyses_updated_at
BEFORE UPDATE ON public.forensic_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tem_analise_forense boolean DEFAULT false;
