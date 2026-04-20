DROP POLICY IF EXISTS "auth insert events" ON public.proposal_review_events;
DROP POLICY IF EXISTS "auth read events" ON public.proposal_review_events;

CREATE POLICY "owner reads review events" ON public.proposal_review_events
  FOR SELECT TO authenticated
  USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "owner inserts review events" ON public.proposal_review_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);