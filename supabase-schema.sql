-- Run this entire file once in Supabase Dashboard -> SQL Editor.
-- It enables secure shared storage for a static GitHub Pages site.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null unique check (student_id ~ '^[0-9]{5}$'),
  name text not null,
  dept text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, student_id, name, dept)
  values (new.id, new.raw_user_meta_data->>'student_id', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'dept');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

create table public.lost_found_items (
  id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type text not null check (type in ('lost','found')), name text not null, location text not null,
  lost_date date not null, description text not null default '', contact text not null default '',
  photos jsonb not null default '[]'::jsonb, status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create table public.suggestions (
  id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) <= 2000), category text not null, created_at timestamptz not null default now()
);
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category text not null, title text not null, event_date text, description text not null default '', created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
-- The suggestions RPC intentionally omits author_id.  This preserves anonymity
-- even for someone inspecting GitHub Pages network calls.
create or replace function public.public_suggestions() returns table(id uuid, text text, category text, created_at timestamptz)
language sql security definer set search_path = public as $$ select s.id,s.text,s.category,s.created_at from public.suggestions s order by s.created_at desc $$;
grant execute on function public.public_suggestions() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.lost_found_items enable row level security;
alter table public.suggestions enable row level security;
alter table public.portfolio_items enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (id=auth.uid());
create policy "read lost items" on public.lost_found_items for select to authenticated using (true);
create policy "create lost item" on public.lost_found_items for insert to authenticated with check (author_id=auth.uid());
create policy "edit own or admin lost item" on public.lost_found_items for update to authenticated using (author_id=auth.uid() or public.is_admin()) with check (author_id=auth.uid() or public.is_admin());
create policy "delete own or admin lost item" on public.lost_found_items for delete to authenticated using (author_id=auth.uid() or public.is_admin());
create policy "create suggestion" on public.suggestions for insert to authenticated with check (author_id=auth.uid());
create policy "read suggestions as admin" on public.suggestions for select to authenticated using (public.is_admin());
create policy "delete suggestion as admin" on public.suggestions for delete to authenticated using (public.is_admin());
create policy "own portfolio" on public.portfolio_items for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

insert into storage.buckets (id,name,public) values ('lost-found-photos','lost-found-photos',true) on conflict do nothing;
create policy "upload own lost photo" on storage.objects for insert to authenticated with check (bucket_id='lost-found-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "view lost photos" on storage.objects for select to authenticated using (bucket_id='lost-found-photos');
create policy "delete own lost photo" on storage.objects for delete to authenticated using (bucket_id='lost-found-photos' and (storage.foldername(name))[1]=auth.uid()::text);

-- After creating the first account, promote it manually in SQL Editor:
-- update public.profiles set is_admin = true where student_id = 'YOUR_STUDENT_ID';
