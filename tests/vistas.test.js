import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { esc, vistaTotales, vistaFincas, vistaRespuestas, vistaAccesos, resumenFinca, cabecera, barraLateral } from '../src/vistas.js';

test('esc escapa HTML', () => {
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('totales muestra los números y los grupos', () => {
  const h = vistaTotales({ usuariosConFinca: 2, cuentas: 4, admins: 1, fincas: 3, fincasUltimos30: 2, casos: 1, bienvenida: 5, porFuente: { zamorano: 3 }, porUso: {}, porDepto: { otros: 3 } });
  assert.match(h, /fincas en la nube/);
  assert.match(h, /zamorano/);
  assert.match(h, /<b data-contar="2">2<\/b><span class="muted small">usuarios con finca/);
  assert.match(h, /<b data-contar="1">1<\/b><span class="muted small">administradores/);
  assert.match(h, /Sin datos todavía/);
  // contar() escribe sin separador de miles: desde 1000 el número queda quieto con su formato, y el 0 no cuenta.
  const grande = vistaTotales({ usuariosConFinca: 1200, admins: 0 });
  assert.match(grande, /<b>1[,.]200<\/b><span class="muted small">usuarios con finca/);
  assert.match(grande, /<b>0<\/b><span class="muted small">administradores/);
});

test('barra lateral como la de la app: sección activa, cuenta escapada y salir', () => {
  const b = barraLateral('fincas', '<i>@x.io');
  assert.match(b, /data-tab="fincas" aria-current="page">[\s\S]*?<span>Fincas<\/span>/);
  assert.equal((b.match(/aria-current="page"/g) || []).length, 1);
  assert.equal((b.match(/data-tab="/g) || []).length, 5);
  assert.ok(!b.includes('<i>@x.io'));
  assert.match(b, /data-adm="salir"/);
  assert.match(b, /href="https:\/\/trofaxis\.github\.io\/"/);
  assert.match(cabecera('accesos'), /class="label">Accesos<\/p><h1>Registro de accesos<\/h1>/);
  assert.match(cabecera('no-existe'), /<h1>Trofaxis en números<\/h1>/);
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
});

test('el repositorio no guarda correos ni claves secretas', () => {
  const raiz = new URL('..', import.meta.url).pathname;
  const archivos = [];
  const recorrer = (d) => { for (const n of readdirSync(d)) { if (n.startsWith('.') || n === 'node_modules') continue; const p = join(d, n); statSync(p).isDirectory() ? recorrer(p) : archivos.push(p); } };
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

test('entrar: mismo diseño que la app, Google y el enlace por correo como alternativa', async () => {
  const { vistaEntrar } = await import('../src/vistas.js');
  const h = vistaEntrar();
  assert.match(h, /class="bv cta"/);
  assert.match(h, /Entrar como administrador/);
  assert.match(h, /data-adm="google"[^>]*>Continuar con Google/);
  assert.match(h, /data-adm="correo"/);
  assert.ok(!/data-adm="entrar"/.test(h), 'el formulario del correo sale solo al pedirlo');
  assert.match(vistaEntrar({ correo: true }), /data-adm="entrar"/);
  const { crearAdmin } = await import('../src/nube.js');
  assert.equal(crearAdmin().urlGoogle('https://x.io/a/'), 'https://kfybqlknlkxrqphwopfx.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fx.io%2Fa%2F&prompt=select_account');
});

test('entrar: cuenta recordada como en OpenAI, con el texto escapado', async () => {
  const { vistaEntrar, vistaNoAdmin } = await import('../src/vistas.js');
  const h = vistaEntrar({ cuenta: { email: 'admin@ejemplo.com' }, msg: 'Saliste del panel.' });
  assert.match(h, /Te damos la bienvenida de nuevo/);
  assert.match(h, /data-adm="cuenta"/);
  assert.match(h, /data-adm="olvidar"/);
  assert.match(h, />Usar otra cuenta de Google</);
  assert.match(h, /role="status"><span>Saliste del panel\./);
  assert.ok(!vistaEntrar({ cuenta: { email: '<b>@x' } }).includes('<b>@x'));
  assert.match(vistaNoAdmin('a@b.c'), /class="bv cta"[\s\S]*Sin permiso[\s\S]*data-adm="volver"/);
});

test('index.html trae el fondo y los íconos de la app, y toda animación respeta «reducir movimiento»', () => {
  const h = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(h, /<div class="aurora" aria-hidden="true">/);
  for (const id of ['hoja', 'dash', 'brote', 'mensaje', 'grafo', 'historial', 'ir', 'salir']) assert.match(h, new RegExp(`<symbol id="i-${id}"`), id);
  const css = readFileSync(new URL('../src/admin.css', import.meta.url), 'utf8');
  const bloques = [];
  for (const m of css.matchAll(/@media \(prefers-reduced-motion:\s*no-preference\)\s*\{/g)) {
    let i = m.index + m[0].length, d = 1;
    while (d && i < css.length) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    bloques.push([m.index, i]);
  }
  const fuera = [...css.matchAll(/animation(-name)?\s*:/g)].filter((m) => !bloques.some(([a, b]) => m.index > a && m.index < b));
  assert.equal(fuera.length, 0, 'mueve las animaciones dentro de @media (prefers-reduced-motion:no-preference)');
});
