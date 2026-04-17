

## Passo 1 — Criar a tabela `proposal_review_events` (migração)

```sql
CREATE TABLE public.proposal_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('field_update','approve','reject','request_reprocess','comment')),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.proposal_review_events (proposal_id, created_at DESC);
ALTER TABLE public.proposal_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read events" ON public.proposal_review_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert events" ON public.proposal_review_events FOR INSERT TO authenticated WITH CHECK (true);
```

Depois disso o `types.ts` é regenerado automaticamente e os 8 erros do `review-center.ts` somem.

## Passo 2 — Ajustar `src/routes/app.review.tsx`

Trocar nos 4 pontos:
- `subtitle={...}` → `description={...}` (linhas 128, 140, 145, 160)
- `actions={...}` → `action={...}` (linha 161)

## Passo 3 — Pequeno ajuste de tipo em `review-center.ts`

Em `updateProposalField`, trocar `const patch = { [fieldName]: newValue } as Record<string, unknown>;` por `const patch: any = { [fieldName]: newValue };` para satisfazer o tipo estrito de update do supabase-js.

## Resultado

- 8 erros de TS sumirão após a migração regenerar `types.ts`.
- 4 erros do `app.review.tsx` sumirão com o rename de props.
- Funcionalidade de Central de Revisão (auditoria, aprovar/rejeitar/reprocessar com histórico) passa a funcionar de fato.

**Resposta direta à sua pergunta:** as edições do GitHub adicionaram código novo (Central de Revisão) mas **não vieram acompanhadas da migração da tabela** nem do alinhamento das props dos componentes existentes — por isso o build quebrou. Os 3 passos acima fecham o ciclo.

