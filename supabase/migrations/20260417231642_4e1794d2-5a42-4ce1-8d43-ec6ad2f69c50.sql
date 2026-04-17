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