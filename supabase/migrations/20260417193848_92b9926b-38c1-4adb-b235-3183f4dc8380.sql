ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS contato_nome TEXT,
  ADD COLUMN IF NOT EXISTS contato_cargo TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS analise_tecnica_profunda JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS padrao_camara TEXT;

CREATE INDEX IF NOT EXISTS idx_proposals_padrao_camara ON public.proposals(owner_id, padrao_camara) WHERE padrao_camara IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(owner_id, cnpj) WHERE cnpj IS NOT NULL;