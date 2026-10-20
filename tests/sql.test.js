import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumenFinca } from '../src/vistas.js';

// La prueba completa de admin_fincas() corre en un Postgres local: sh sql/pruebas/correr.sh (ver README).
// Aquí solo se revisa el texto del SQL, para que un cambio descuidado no vuelva a abrir el nombre o el departamento.
const sql = readFileSync(new URL('../sql/003_admin_fincas_lista_blanca.sql', import.meta.url), 'utf8');
const lista = sql.match(/admin_claves_finca\(\)\s*returns text\[\][\s\S]*?array\[([\s\S]*?)\]/)[1]
  .split(',').map((s) => s.trim().replace(/^'|'$/g, ''));

test('003: la lista blanca no incluye el nombre de la finca ni coordenadas', () => {
  for (const k of ['nombre', 'lat', 'lng', 'lon', 'coords', 'ubicacion', 'email', 'correo', 'user_id']) assert.ok(!lista.includes(k), k);
});

test('003: lo que resume la tabla de fincas está en la lista blanca', () => {
  const usadas = Object.keys(resumenFinca({})).filter((k) => k !== 'especies' && k !== 'plaguicidas');
  for (const k of [...usadas, 'especies', 'plaguicidas', 'cultivos']) assert.ok(lista.includes(k), k);
});

test('003: el departamento con menos de 3 fincas sale como «otros», igual que en admin_totales', () => {
  assert.match(sql, /when dp\.c >= 3 then b\.depto else 'otros'/);
  assert.match(sql, /if not public\.es_admin\(\) then raise exception/);
  assert.match(sql, /revoke execute on function public\.admin_fincas\(\) from public, anon/);
});

test('el script de pruebas se niega a correr contra Supabase', () => {
  const sh = readFileSync(new URL('../sql/pruebas/correr.sh', import.meta.url), 'utf8');
  assert.match(sh, /\*supabase\*/);
});
