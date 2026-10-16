-- Fase 1.1 del panel: contar usuarios de finca y administradores, y no dejar cuentas vacías creadas por el panel.
-- Problema: entrar al panel con Google con una cuenta que no es admin crea esa cuenta en auth.users,
-- y el panel la contaba como si alguien hubiera usado Trofaxis.

-- 1. Totales: «usuarios» pasa a ser cuentas con al menos una finca en la nube, y se suma el número de administradores.
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
    'usuariosConFinca', (select count(distinct user_id) from public.fincas),
    'cuentas', (select count(*) from auth.users),
    'admins', (select count(*) from public.admins),
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

-- 2. Cuando alguien que no es admin entra al panel, el panel llama a esta función: borra SU PROPIA cuenta
--    solo si no es admin y no tiene ningún dato (ni finca ni casos). Una cuenta con datos nunca se toca.
create or replace function public.descartar_cuenta_vacia()
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or public.es_admin() then return false; end if;
  if exists (select 1 from public.fincas where user_id = uid) or exists (select 1 from public.casos where user_id = uid) then return false; end if;
  delete from auth.users where id = uid;
  return true;
end $$;
revoke execute on function public.descartar_cuenta_vacia() from public, anon;
grant execute on function public.descartar_cuenta_vacia() to authenticated;
