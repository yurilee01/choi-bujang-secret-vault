-- Supabase learning table and seed data for public, virtual notes.
create table if not exists public.notes (
  id bigint generated always as identity primary key,
  owner_id uuid,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

revoke select, insert, update, delete on table public.notes from anon;
revoke select, insert, update, delete on table public.notes from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_title_content_key'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_title_content_key unique (title, content);
  end if;
end
$$;

insert into public.notes (title, content)
values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록')
on conflict (title, content) do nothing;
