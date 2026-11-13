-- Supabase learning table and seed data for virtual notes.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint notes_title_body_key unique (title, body)
);

-- Enable Row Level Security.
alter table public.notes enable row level security;

-- Revoke direct table access; server functions handle note CRUD.
revoke all privileges on table public.notes
  from public, anon, authenticated;

-- Index for owner-based queries.
create index if not exists notes_owner_id_idx
  on public.notes (owner_id);

-- Recreate ownership policies safely.
drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

-- Users can read only their own notes.
create policy notes_select_own
  on public.notes
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- Users can create notes only for themselves.
create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Users can update only their own notes.
create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Users can delete only their own notes.
create policy notes_delete_own
  on public.notes
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Seed virtual notes.
insert into public.notes (title, body)
values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록')
on conflict (title, body) do nothing;
