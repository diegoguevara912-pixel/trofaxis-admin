-- Fase 1.2 del panel: admin_fincas() con lista blanca en vez de quitar unas pocas claves.
-- Problema (probado en una base local con datos ficticios, sql/pruebas/admin_fincas.sql):
--   a) `datos - array[...]` solo quita claves del primer nivel y con esa grafía exacta. La tabla fincas solo exige que
--      datos sea un objeto, así que una finca escrita sin la app (o una versión futura de la app) con «Nombre», «mapa.lat»,
--      «especies[].lon», «correo» o «user_id» llegaba entera al panel. Con la app actual (normalizarFinca) no pasa.
--   b) admin_totales() junta los departamentos con menos de 3 fincas en «otros», pero admin_fincas() mostraba el
--      departamento de cada finca, así que una finca sola en su departamento sí quedaba reconocible.
-- Solución: solo salen las claves que guarda la app (normalizarFinca en src/core/storage.js de la app) menos «nombre»;
-- dentro de ellas se borran a cualquier profundidad las claves que parecen coordenadas, contacto o identificadores;
-- y el departamento con menos de 3 fincas sale como «otros» (mismo umbral, criterio propio, que admin_totales).
-- Los textos libres que escribe el usuario (fuente de agua, acciones, criterio de una no conformidad, nombres de
-- cultivos o especies) siguen saliendo: no se puede saber de forma fiable si traen un nombre propio. Ver la nota en README.

-- Claves del primer nivel que el panel puede ver. Si la app agrega un campo a normalizarFinca, hay que sumarlo aquí;
-- si no, el panel simplemente no lo ve (falla hacia el lado seguro).
create or replace function public.admin_claves_finca()
returns text[] language sql immutable set search_path = ''
as $$ select array['depto','area','areaProd','altitud','pendiente','fuenteAgua','distAgua','tieneCultivos','cultivos',
  'especies','riego','nAplicado','nObjetivo','pObjetivo','kObjetivo','fertPlan','fertMeses','lluviaMeses','plaguicidas',
  'sueloDesnudoMeses','sinPlaguicidas','labranza','plagas','cultivosAledanos','proposito','gg','minorAplicables',
  'minorFallas','nc','acciones','resultado','clima'] $$;

-- Borra, a cualquier profundidad, las claves que parecen coordenadas, contacto o identificadores (sin importar mayúsculas).
create or replace function public.admin_sin_sensibles(j jsonb)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare patron constant text := '^(lat|lng|lon|latitud|longitud|latitude|longitude|coord|coords|coordenadas|coordinates|geo|geom|geometria|ubicacion|ubicación|contorno|poligono|polígono|punto|gps|correo|email|e-mail|telefono|teléfono|tel|celular|user_id|userid|uid|propietario|productor|duenio|dueño|responsable|contacto|direccion|dirección)$';
begin
  case jsonb_typeof(j)
    when 'object' then
      return coalesce((select jsonb_object_agg(k, public.admin_sin_sensibles(v)) from jsonb_each(j) e(k, v) where lower(k) !~ patron), '{}'::jsonb);
    when 'array' then
      return coalesce((select jsonb_agg(public.admin_sin_sensibles(x) order by i) from jsonb_array_elements(j) with ordinality a(x, i)), '[]'::jsonb);
    else return j;
  end case;
end $$;
revoke execute on function public.admin_claves_finca() from public, anon;
revoke execute on function public.admin_sin_sensibles(jsonb) from public, anon;

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
    with deptos as (
      select coalesce(nullif(trim(x.datos->>'depto'), ''), 'sin departamento') d, count(*) c from public.fincas x group by 1
    ), base as (
      select f.id, f.actualizado, f.version,
             public.admin_sin_sensibles(coalesce((select jsonb_object_agg(k, v) from jsonb_each(f.datos) e(k, v)
                                                  where k = any (public.admin_claves_finca())), '{}'::jsonb)) d,
             coalesce(nullif(trim(f.datos->>'depto'), ''), 'sin departamento') depto
      from public.fincas f
    )
    select left(md5(b.id::text), 8), b.actualizado, b.version,
           case when b.d ? 'depto' then jsonb_set(b.d, '{depto}', to_jsonb(case when dp.c >= 3 then b.depto else 'otros' end)) else b.d end
    from base b join deptos dp on dp.d = b.depto
    order by b.actualizado desc limit 1000;
end $$;
revoke execute on function public.admin_fincas() from public, anon;
grant execute on function public.admin_fincas() to authenticated;
