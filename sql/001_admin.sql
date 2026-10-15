-- Fase 1 del panel de administración de Trofaxis.
-- Quién es administrador vive SOLO en la base (tabla admins, por user_id). Ningún correo va en este archivo.
-- Lo que ve un usuario normal no cambia: anon y authenticated siguen con los mismos permisos sobre sus datos.

-- 1. Administradores. Sin políticas: nadie la lee ni la escribe por la API; se llena con SQL desde el panel de Supabase.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- 2. Registro de accesos: cada lectura del admin deja una fila. Solo las funciones de abajo escriben en él.
create table if not exists public.accesos_admin (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  accion text not null check (char_length(accion) <= 40),
  filas integer not null default 0,
  creado timestamptz not null default now()
);
alter table public.accesos_admin enable row level security;
revoke all on public.accesos_admin from anon, authenticated;
grant select on public.accesos_admin to authenticated;
drop policy if exists "accesos: el admin lee" on public.accesos_admin;
create policy "accesos: el admin lee" on public.accesos_admin for select to authenticated using ((select public.es_admin()));

-- 3. Totales anónimos. Un departamento con menos de 3 fincas se cuenta como «otros» para que nadie sea reconocible
--    (el 3 es criterio propio).
create or replace function public.admin_totales()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare r jsonb;
begin
  if not public.es_admin() then raise exception 'solo administradores' using errcode = '42501'; end if;
  with deptos as (
    select coalesce(nullif(trim(datos->>'depto'), ''), 'sin departamento') d, count(*) n from public.fincas group by 1
  ), agrupados as (
    select case when n >= 3 then d else 'otros' end d, sum(n) n from deptos group by 1
  )
  select jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'fincas', (select count(*) from public.fincas),
    'fincasUltimos30', (select count(*) from public.fincas where actualizado > now() - interval '30 days'),
    'casos', (select count(*) from public.casos),
    'bienvenida', (select count(*) from public.bienvenida),
    'porFuente', coalesce((select jsonb_object_agg(f, n) from (select coalesce(fuente, 'sin respuesta') f, count(*) n from public.bienvenida group by 1) t), '{}'::jsonb),
    'porUso', coalesce((select jsonb_object_agg(u, n) from (select unnest(usos) u, count(*) n from public.bienvenida group by 1) t), '{}'::jsonb),
    'porDepto', coalesce((select jsonb_object_agg(d, n) from agrupados), '{}'::jsonb)
  ) into r;
  insert into public.accesos_admin (user_id, accion) values ((select auth.uid()), 'totales');
  return r;
end $$;
revoke execute on function public.admin_totales() from public, anon;
grant execute on function public.admin_totales() to authenticated;

-- 4. Fincas individuales, sin nombre de finca, sin correo y sin user_id: solo un código corto estable.
--    Las coordenadas nunca se suben a la nube (normalizarFinca en src/core/storage.js no las guarda);
--    igual se quitan aquí por si una versión futura las agregara.
create or replace function public.admin_fincas()
returns table (codigo text, actualizado timestamptz, version integer, datos jsonb)
language plpgsql volatile security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.es_admin() then raise exception 'solo administradores' using errcode = '42501'; end if;
  select count(*) into n from public.fincas;
  insert into public.accesos_admin (user_id, accion, filas) values ((select auth.uid()), 'fincas', n);
  return query
    select left(md5(f.id::text), 8), f.actualizado, f.version,
           f.datos - array['nombre', 'lat', 'lng', 'lon', 'latitud', 'longitud', 'coords', 'ubicacion']
    from public.fincas f order by f.actualizado desc limit 1000;
end $$;
revoke execute on function public.admin_fincas() from public, anon;
grant execute on function public.admin_fincas() to authenticated;

-- 5. Respuestas de bienvenida y casos, filas sueltas (ya son anónimas en origen).
create or replace function public.admin_respuestas()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare r jsonb;
begin
  if not public.es_admin() then raise exception 'solo administradores' using errcode = '42501'; end if;
  select jsonb_build_object(
    'bienvenida', coalesce((select jsonb_agg(jsonb_build_object('creado', creado, 'fuente', fuente, 'usos', usos) order by creado desc)
                            from (select * from public.bienvenida order by creado desc limit 1000) b), '[]'::jsonb),
    'casos', coalesce((select jsonb_agg(jsonb_build_object('creado', creado, 'perfil', perfil, 'acciones', acciones, 'resultado', resultado) order by creado desc)
                       from (select * from public.casos order by creado desc limit 1000) c), '[]'::jsonb)
  ) into r;
  insert into public.accesos_admin (user_id, accion) values ((select auth.uid()), 'respuestas');
  return r;
end $$;
revoke execute on function public.admin_respuestas() from public, anon;
grant execute on function public.admin_respuestas() to authenticated;
