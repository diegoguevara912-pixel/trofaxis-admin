-- Base simulada para probar el SQL del panel en un Postgres LOCAL (nunca en producción).
set client_min_messages = warning;
-- Imita lo mínimo de Supabase: roles anon/authenticated, auth.users y auth.uid().
-- Las tablas fincas, casos y bienvenida copian las restricciones que hoy tiene producción (leídas con list_tables, 2026-10-20).
drop schema if exists auth cascade;
drop schema public cascade;
create schema public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null default '' check (char_length(nombre) <= 200),
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 2000000),
  version integer not null default 1,
  actualizado timestamptz not null default now()
);
alter table public.fincas enable row level security;
create policy "fincas: dueño" on public.fincas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.fincas to authenticated;

create table public.casos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  perfil jsonb not null, acciones text[] not null default '{}', resultado jsonb not null default '{}',
  consentimiento timestamptz, version integer default 1, creado timestamptz default now()
);
alter table public.casos enable row level security;

create table public.bienvenida (
  id bigint generated always as identity primary key, creado timestamptz not null default now(),
  fuente text, usos text[] not null default '{}', version smallint not null default 1
);
alter table public.bienvenida enable row level security;
