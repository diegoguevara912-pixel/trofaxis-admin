// Vistas del panel de administración. Funciones puras: reciben datos y devuelven HTML. Todo texto pasa por esc().

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-HN') : '—');
const fecha = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short' }); };

export const PESTANAS = [
  { id: 'totales', nombre: 'Totales' },
  { id: 'fincas', nombre: 'Fincas' },
  { id: 'respuestas', nombre: 'Respuestas' },
  { id: 'cerebro', nombre: 'Cerebro' },
  { id: 'accesos', nombre: 'Registro de accesos' },
];

export function cabecera(activa, email) {
  return `<header class="admin-cab"><b>Trofaxis</b> · Administración
    <span class="muted small adm-quien">${esc(email)}</span>
    <a class="btn sm" href="https://trofaxis.github.io/" rel="noopener">Ir a la app</a>
    <button type="button" class="btn sm" data-adm="salir">Salir</button></header>
  <nav class="row adm-tabs" aria-label="Secciones">${PESTANAS.map((p) =>
    `<a class="btn sm${p.id === activa ? ' primary' : ''}" href="#${p.id}"${p.id === activa ? ' aria-current="page"' : ''}>${esc(p.nombre)}</a>`).join('')}</nav>`;
}

// Pantalla de entrada con el mismo diseño que la de la app (estilo OpenAI): cuenta recordada, otra cuenta de Google
// o enlace al correo. Las clases .bv, .cta-* y .bv-btn vienen de styles.css de la app publicada.
const HOJA = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
export const inicial = (email) => (String(email || '').trim()[0] || '?').toUpperCase();
const quien = (email) => `<span class="cta-avatar" aria-hidden="true">${esc(inicial(email))}</span><span class="cta-quien"><b>${esc(String(email).split('@')[0])}</b><span class="muted small">${esc(email)}</span></span>`;
const pantalla = (cuerpo) => `<section class="bv cta" aria-labelledby="cta-titulo"><div class="cta-centro">
    <span class="logo bv-logo" aria-hidden="true">${HOJA}</span>${cuerpo}</div></section>`;
const aviso = (msg) => (msg ? `<div class="notice" role="status"><span>${esc(msg)}</span></div>` : '');

export function vistaEntrar({ msg = '', cuenta = {}, correo = false } = {}) {
  const email = cuenta.email || '';
  const recordada = email
    ? `<div class="cta-tarjeta">
        <button type="button" class="cta-elegir" data-adm="cuenta">${quien(email)}</button>
        <button type="button" class="cta-x" data-adm="olvidar" aria-label="Quitar ${esc(email)} de este dispositivo">×</button>
      </div>
      <div class="cta-o" role="separator"><span>o</span></div>` : '';
  const formCorreo = correo
    ? `<form class="adm-form" data-adm="entrar">
        <div class="f"><label for="adm-email">Tu correo</label><input id="adm-email" type="email" required autocomplete="email" value="${esc(email)}"><span class="hint">Te enviamos un enlace de un solo uso. No hay contraseñas.</span></div>
        <button class="btn primary bv-btn" type="submit">Enviarme el enlace</button>
      </form>`
    : '<button type="button" class="btn bv-btn" data-adm="correo">Entrar con un enlace a mi correo</button>';
  return pantalla(`
      <h1 id="cta-titulo">${email ? 'Te damos la bienvenida de nuevo' : 'Entrar como administrador'}</h1>
      <p class="muted">${email ? 'Elige una cuenta para entrar al panel de Trofaxis.' : 'Solo entran cuentas marcadas como administradoras en la base de datos.'}</p>
      ${aviso(msg)}
      ${recordada}
      <button type="button" class="btn ${email ? '' : 'primary'} bv-btn" data-adm="google">${email ? 'Usar otra cuenta de Google' : 'Continuar con Google'}</button>
      ${formCorreo}
      <a class="btn bv-btn bv-fantasma" href="https://trofaxis.github.io/" rel="noopener">Ir a la app</a>`);
}

export const vistaNoAdmin = (email) => pantalla(`
      <h1 id="cta-titulo">Sin permiso</h1>
      <p class="muted">La cuenta ${esc(email)} no es administradora. Nada de los datos de usuarios se descargó y se cerró la sesión. Si la cuenta no tenía datos en Trofaxis, también se borró.</p>
      <button type="button" class="btn primary bv-btn" data-adm="volver">Entrar con otra cuenta</button>
      <a class="btn bv-btn bv-fantasma" href="https://trofaxis.github.io/" rel="noopener">Ir a la app</a>`);

function barras(obj, titulo) {
  const filas = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...filas.map(([, n]) => n));
  if (!filas.length) return `<div><h3>${esc(titulo)}</h3><p class="muted small">Sin datos todavía.</p></div>`;
  return `<div><h3>${esc(titulo)}</h3><ul class="adm-barras">${filas.map(([k, n]) =>
    `<li><span>${esc(k)}</span><span class="adm-barra"><i style="width:${Math.round((n / max) * 100)}%"></i></span><b>${num(n)}</b></li>`).join('')}</ul></div>`;
}

export function vistaTotales(t) {
  const kpi = (n, txt) => `<div class="card adm-kpi"><b>${num(n)}</b><span class="muted small">${esc(txt)}</span></div>`;
  return `<section class="adm-kpis">
    ${kpi(t.usuariosConFinca, 'usuarios con finca en Trofaxis')}${kpi(t.admins, 'administradores del panel')}${kpi(t.fincas, 'fincas en la nube')}${kpi(t.fincasUltimos30, 'fincas actualizadas en 30 días')}
    ${kpi(t.casos, 'casos anónimos compartidos')}${kpi(t.bienvenida, 'respuestas de bienvenida')}</section>
  <section class="card adm-grupos">
    ${barras(t.porFuente, 'Cómo conocieron Trofaxis')}${barras(t.porUso, 'Para qué la usarán')}${barras(t.porDepto, 'Fincas por departamento')}
    <p class="muted small">Cuentas registradas en total: ${num(t.cuentas)}. Solo cuenta como usuario quien tiene una finca guardada en la nube.</p>
    <p class="muted small">Un departamento con menos de 3 fincas se cuenta como «otros», para que ninguna finca sea reconocible (umbral: criterio propio).</p>
  </section>`;
}

// Resumen de una finca para la tabla. Solo campos que existen en normalizarFinca (src/core/storage.js de la app).
export function resumenFinca(d = {}) {
  const lista = (a) => (Array.isArray(a) ? a : []);
  return {
    depto: d.depto || '—',
    area: Number(d.area) || 0,
    cultivos: lista(d.cultivos).map((c) => c?.nombre).filter(Boolean).join(', ') || '—',
    riego: d.riego || '—',
    especies: lista(d.especies).length,
    plaguicidas: lista(d.plaguicidas).length,
    gg: { si: 'Certificada', quiero: 'Quiere certificar', no: 'No' }[d.gg] || '—',
  };
}

export function vistaFincas(filas) {
  if (!filas?.length) return `<section class="card"><h2>Fincas</h2><p class="muted">Ninguna finca guardada en la nube todavía.</p></section>`;
  return `<section class="card"><h2>Fincas (${num(filas.length)})</h2>
    <p class="muted small">Sin nombre de finca, sin correo y sin coordenadas: cada finca se identifica con un código. Abrir esta sección quedó en el registro de accesos.</p>
    <div class="adm-tabla"><table><thead><tr><th>Código</th><th>Actualizada</th><th>Departamento</th><th>Área (ha)</th><th>Cultivos</th><th>Riego</th><th>Especies</th><th>Aplicaciones</th><th>GLOBALG.A.P.</th></tr></thead>
    <tbody>${filas.map((f) => { const r = resumenFinca(f.datos); return `<tr>
      <td><code>${esc(f.codigo)}</code></td><td>${fecha(f.actualizado)}</td><td>${esc(r.depto)}</td><td>${num(r.area)}</td>
      <td>${esc(r.cultivos)}</td><td>${esc(r.riego)}</td><td>${num(r.especies)}</td><td>${num(r.plaguicidas)}</td><td>${esc(r.gg)}</td></tr>`; }).join('')}</tbody></table></div>
    ${filas.map((f) => `<details class="adm-det"><summary>Datos completos de <code>${esc(f.codigo)}</code></summary><pre>${esc(JSON.stringify(f.datos, null, 2))}</pre></details>`).join('')}
  </section>`;
}

export function vistaRespuestas(r) {
  const b = r?.bienvenida || [], c = r?.casos || [];
  return `<section class="card"><h2>Respuestas de bienvenida (${num(b.length)})</h2>
    ${b.length ? `<div class="adm-tabla"><table><thead><tr><th>Fecha</th><th>Cómo la conoció</th><th>Para qué</th></tr></thead><tbody>${b.map((x) =>
      `<tr><td>${fecha(x.creado)}</td><td>${esc(x.fuente || '—')}</td><td>${esc((x.usos || []).join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin respuestas todavía.</p>'}
  </section>
  <section class="card"><h2>Casos anónimos compartidos (${num(c.length)})</h2>
    ${c.length ? c.map((x) => `<details class="adm-det"><summary>${fecha(x.creado)} · ${esc(x.perfil?.cultivo || 'sin cultivo')} · ${num((x.acciones || []).length)} acciones</summary><pre>${esc(JSON.stringify(x, null, 2))}</pre></details>`).join('') : '<p class="muted">Ningún caso compartido todavía.</p>'}
  </section>`;
}

export function vistaAccesos(filas) {
  return `<section class="card"><h2>Registro de accesos</h2>
    <p class="muted small">Cada vez que este panel lee datos de usuarios queda una fila. Lo escribe la base de datos, no este sitio, así que no se puede saltar.</p>
    ${filas?.length ? `<div class="adm-tabla"><table><thead><tr><th>Fecha</th><th>Qué se leyó</th><th>Filas</th></tr></thead><tbody>${filas.map((a) =>
      `<tr><td>${fecha(a.creado)}</td><td>${esc(a.accion)}</td><td>${num(a.filas)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin accesos todavía.</p>'}
  </section>`;
}

export const vistaError = (msg) => `<section class="card"><p role="alert">${esc(msg)}</p></section>`;
