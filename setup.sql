-- Run once in a dedicated Supabase project's SQL Editor.
create table if not exists public.byc_profiles (
 id uuid primary key default gen_random_uuid(),
 session text not null,
 token_hash text not null,
 name text not null check (char_length(name) between 1 and 48),
 programme text not null default '',
 skills text[] not null default '{}',
 interests text[] not null default '{}',
 bio text not null default '',
 projects text[] not null default '{}',
 created_at timestamptz not null default now(),
 unique(session, token_hash)
);
alter table public.byc_profiles enable row level security;
revoke all on public.byc_profiles from anon, authenticated;
grant select, insert, update, delete on public.byc_profiles to service_role;
create or replace function public.byc_join(p_session text,p_token_hash text,p_name text,p_programme text,p_skills text[],p_interests text[],p_bio text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtext(p_session));
 select id into result from public.byc_profiles where session=p_session and token_hash=p_token_hash;
 if result is null and (select count(*) from public.byc_profiles where session=p_session) >= 60 then
  raise exception 'DEMO_CAPACITY';
 end if;
 insert into public.byc_profiles(session,token_hash,name,programme,skills,interests,bio)
 values(p_session,p_token_hash,p_name,p_programme,p_skills,p_interests,p_bio)
 on conflict(session,token_hash) do update set name=excluded.name,programme=excluded.programme,skills=excluded.skills,interests=excluded.interests,bio=excluded.bio
 returning id into result;
 return result;
end; $$;
revoke all on function public.byc_join(text,text,text,text,text[],text[],text) from public,anon,authenticated;
grant execute on function public.byc_join(text,text,text,text,text[],text[],text) to service_role;
notify pgrst, 'reload schema';
