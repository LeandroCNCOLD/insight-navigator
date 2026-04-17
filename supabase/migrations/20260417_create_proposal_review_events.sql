create table if not exists public.proposal_review_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  action text not null check (action in ('field_update', 'approve', 'reject', 'request_reprocess', 'comment')),
  field_name text null,
  old_value jsonb null,
  new_value jsonb null,
  comment text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposal_review_events_proposal_id
  on public.proposal_review_events(proposal_id);

create index if not exists idx_proposal_review_events_document_id
  on public.proposal_review_events(document_id);

alter table public.proposal_review_events enable row level security;

create policy "Allow authenticated users to read proposal review events"
on public.proposal_review_events
for select
to authenticated
using (true);

create policy "Allow authenticated users to insert proposal review events"
on public.proposal_review_events
for insert
to authenticated
with check (true);
