-- Prueba de admin_fincas() con datos FICTICIOS (ningún nombre, lugar ni coordenada es real).
-- Revisa que lo que ve el administrador no traiga nombre de finca, correo, identificadores ni coordenadas,
-- ni en el primer nivel ni anidados, y que un departamento con menos de 3 fincas no se muestre.
\set QUIET on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- admin
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- 1. Finca como la guarda la app hoy (normalizarFinca): solo claves conocidas.
insert into public.fincas (user_id, nombre, datos) values ('00000000-0000-0000-0000-000000000001', 'Finca Ficticia Uno',
 '{"nombre":"Finca Ficticia Uno","depto":"Choluteca","area":5,"altitud":40,"pendiente":"plana","fuenteAgua":"Pozo",
   "cultivos":[{"nombre":"Melón","ha":3,"siembra":[0],"cosecha":[2]}],"especies":[{"nombre":"Spathodea campanulata","tipo":"Árbol","origen":"exótica","floracion":[0,1],"atrae":true,"riesgo":true}],
   "riego":"goteo","acciones":["Poner barreras vivas"],"nc":[{"criterio":"AF 1.1","dias":10}],
   "plaguicidas":[{"producto":"Ficticio 50 WP","componentes":[{"ia":"x","conc":50}],"meses":[1]}],
   "clima":{"fuente":"open-meteo","periodo":[2015,2024],"elevacion":40,"meses":[],"manual":[]},"gg":"si"}');
-- 2. Finca escrita directo a la API (sin la app) con claves extra, anidadas y en otra grafía.
insert into public.fincas (user_id, nombre, datos) values ('00000000-0000-0000-0000-000000000002', 'Finca Ficticia Dos',
 '{"nombre":"Finca Ficticia Dos","Nombre":"Finca Ficticia Dos","depto":"Choluteca","Lat":13.30001,"latitude":13.30002,
   "coordenadas":"13.30003,-87.10003","geo":{"type":"Point","coordinates":[-87.10004,13.30004]},
   "mapa":{"lat":13.30005,"lng":-87.10005,"contorno":[[13.30006,-87.10006]]},
   "especies":[{"nombre":"Guama","lat":13.30007,"lon":-87.10007}],
   "cultivos":[{"nombre":"Okra","ubicacion":{"latitud":13.30008,"longitud":-87.10008}}],
   "correo":"persona@ejemplo.org","email":"persona@ejemplo.org","user_id":"00000000-0000-0000-0000-000000000002",
   "propietario":{"nombre":"Persona Ficticia","telefono":"+504 0000-0000"}}');
-- 3 y 4. Más fincas en Choluteca (para que ese departamento llegue a 3) y una sola en Olancho.
insert into public.fincas (user_id, nombre, datos) values
 ('00000000-0000-0000-0000-000000000003', 'Finca Ficticia Tres', '{"nombre":"Finca Ficticia Tres","depto":"Choluteca","area":2}'),
 ('00000000-0000-0000-0000-000000000004', 'Finca Ficticia Cuatro', '{"nombre":"Finca Ficticia Cuatro","depto":"Olancho","area":80}');

create temp table salida as select null::text codigo, null::jsonb datos limit 0;
grant all on salida to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into salida select codigo, datos from public.admin_fincas();
reset role;

create temp table chequeo (prueba text, pasa boolean);
insert into chequeo
select 'sin nombre de finca en ningún nivel', not exists (select 1 from salida where datos::text ~* 'Finca Ficticia')
union all select 'sin coordenadas en ningún nivel', not exists (select 1 from salida where datos::text ~ '13\.3000|87\.1000')
union all select 'sin correo', not exists (select 1 from salida where datos::text ~* 'ejemplo\.org')
union all select 'sin user_id', not exists (select 1 from salida where datos::text ~ '00000000-0000-0000-0000')
union all select 'sin nombre ni teléfono de personas', not exists (select 1 from salida where datos::text ~* 'Persona Ficticia|0000-0000')
union all select 'departamento con menos de 3 fincas oculto', not exists (select 1 from salida where datos->>'depto' = 'Olancho')
union all select 'departamento con 3 o más fincas visible', exists (select 1 from salida where datos->>'depto' = 'Choluteca')
union all select 'datos agronómicos se conservan', exists (select 1 from salida where datos @> '{"cultivos":[{"nombre":"Melón","ha":3}],"riego":"goteo","area":5}')
union all select 'plaguicidas y especies se conservan', exists (select 1 from salida where datos @> '{"plaguicidas":[{"producto":"Ficticio 50 WP"}],"especies":[{"nombre":"Spathodea campanulata"}]}')
union all select 'cada lectura queda registrada', exists (select 1 from public.accesos_admin where accion = 'fincas' and filas = 4)
union all select 'un usuario normal no puede llamarla', true; -- se comprueba abajo

do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  perform * from public.admin_fincas();
  update chequeo set pasa = false where prueba = 'un usuario normal no puede llamarla';
exception when insufficient_privilege then null;
end $$;

\set QUIET off
\pset footer off
select case when pasa then 'PASA' else 'FALLA' end as resultado, prueba from chequeo;
\echo 'Lo que devolvió admin_fincas() para la finca 2 (escrita sin la app):'
select jsonb_pretty(datos) from salida where datos::text ~ 'Okra' or datos ? 'mapa' limit 1;
do $$ begin if exists (select 1 from chequeo where not pasa) then raise exception 'Hay pruebas que fallan'; end if; end $$;
