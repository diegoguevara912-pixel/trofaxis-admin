import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { esc, vistaTotales, vistaFincas, vistaRespuestas, vistaAccesos, resumenFinca, cabecera } from '../src/vistas.js';

test('esc escapa HTML', () => {
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('totales muestra los números y los grupos', () => {
  const h = vistaTotales({ usuarios: 4, fincas: 3, fincasUltimos30: 2, casos: 1, bienvenida: 5, porFuente: { zamorano: 3 }, porUso: {}, porDepto: { otros: 3 } });
  assert.match(h, /fincas en la nube/);
  assert.match(h, /zamorano/);
  assert.match(h, /Sin datos todavía/);
});

test('fincas: un texto con HTML no se inyecta', () => {
  const h = vistaFincas([{ codigo: 'ab12cd34', actualizado: '2026-10-15T00:00:00Z', version: 1, datos: { depto: '<script>x</script>', cultivos: [{ nombre: 'Melón' }] } }]);
  assert.ok(!h.includes('<script>x'));
  assert.match(h, /Melón/);
});

test('resumen de finca no usa el nombre de la finca', () => {
  const r = resumenFinca({ nombre: 'Finca Secreta', depto: 'Choluteca', area: 5 });
  assert.ok(!JSON.stringify(r).includes('Secreta'));
});

test('vistas vacías', () => {
  assert.match(vistaFincas([]), /Ninguna finca/);
  assert.match(vistaRespuestas({}), /Sin respuestas/);
  assert.match(vistaAccesos([]), /Sin accesos/);
  assert.match(cabecera('fincas', 'a@b.c'), /aria-current="page">Fincas/);
});

test('el repositorio no guarda correos ni claves secretas', () => {
  const raiz = new URL('..', import.meta.url).pathname;
  const archivos = [];
  const recorrer = (d) => { for (const n of readdirSync(d)) { if (n === '.git' || n === 'node_modules') continue; const p = join(d, n); statSync(p).isDirectory() ? recorrer(p) : archivos.push(p); } };
  recorrer(raiz);
  for (const p of archivos) {
    const t = readFileSync(p, 'utf8');
    assert.ok(!/@gmail\.com/i.test(t), `correo en ${p}`);
    // Clave secreta nueva (sb_secret_…) o JWT con rol service_role (en base64: c2VydmljZV9yb2xl).
    assert.ok(!/sb_secret_[A-Za-z0-9]|c2VydmljZV9yb2xl/.test(p.endsWith('vistas.test.js') ? '' : t), `clave secreta en ${p}`);
  }
});

test('index.html tiene noindex y CSP sin unsafe en scripts', () => {
  const h = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(h, /noindex, nofollow/);
  assert.match(h, /script-src 'self' https:\/\/trofaxis\.github\.io;/);
});
