
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS resumo_executivo text,
  ADD COLUMN IF NOT EXISTS resumo_tecnico text,
  ADD COLUMN IF NOT EXISTS resumo_comercial text,
  ADD COLUMN IF NOT EXISTS palavras_chave text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS porte_projeto text,
  ADD COLUMN IF NOT EXISTS indicio_fechamento text,
  ADD COLUMN IF NOT EXISTS segmentacao_cliente text,
  ADD COLUMN IF NOT EXISTS exclusoes_garantia text,
  ADD COLUMN IF NOT EXISTS fornecimento_cliente text,
  ADD COLUMN IF NOT EXISTS insights_benchmarking text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS resumo_executivo text;
