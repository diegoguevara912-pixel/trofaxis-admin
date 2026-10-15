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

export function vistaEntrar(msg = '') {
  return `<header class="admin-cab"><b>Trofaxis</b> · Administración</header>
  <section class="card adm-entrar">
    <h2>Entrar como administrador</h2>
    <p class="muted">Te llega un enlace al correo. Solo entran cuentas que ya existen en Trofaxis y están marcadas como administradoras en la base de datos.</p>
    <form class="row" data-adm="entrar">
      <div class="f adm-correo"><label for="adm-email">Correo</label><input id="adm-email" type="email" required autocomplete="email"></div>
      <button class="btn primary" type="submit">Enviar enlace</button>
    </form>
    ${msg ? `<p class="small" role="status">${esc(msg)}</p>` : ''}
  </section>`;
}

export const vistaNoAdmin = (email) => `<header class="admin-cab"><b>Trofaxis</b> · Administración
  <button type="button" class="btn sm" data-adm="salir">Salir</button></header>
  <section class="card"><h2>Sin permiso</h2><p>La cuenta ${esc(email)} no es administradora. Nada de los datos de usuarios se descargó.</p></section>`;

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
    ${kpi(t.usuarios, 'cuentas')}${kpi(t.fincas, 'fincas en la nube')}${kpi(t.fincasUltimos30, 'fincas actualizadas en 30 días')}
    ${kpi(t.casos, 'casos anónimos compartidos')}${kpi(t.bienvenida, 'respuestas de bienvenida')}</section>
  <section class="card adm-grupos">
    ${barras(t.porFuente, 'Cómo conocieron Trofaxis')}${barras(t.porUso, 'Para qué la usarán')}${barras(t.porDepto, 'Fincas por departamento')}
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
