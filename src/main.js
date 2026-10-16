// Panel de administración de Trofaxis: sitio aparte de la app (otro origen, otra sesión).
// El cerebro y el manejo de sesión se importan de la app publicada: una sola fuente de verdad, sin copias.
import { cargarSesion, guardarSesion, borrarSesion, sesionDeHash, necesitaRenovar, crearCliente } from 'https://trofaxis.github.io/src/nube/cliente.js';
import { viewCerebro, montarCerebro } from 'https://trofaxis.github.io/src/admin/cerebro.js';
import { crearAdmin, ErrorAdmin } from './nube.js';
import { cabecera, vistaEntrar, vistaNoAdmin, vistaTotales, vistaFincas, vistaRespuestas, vistaAccesos, vistaError, PESTANAS } from './vistas.js';

const app = document.getElementById('app');
const admin = crearAdmin();
const cliente = crearCliente();
let sesion = null;

async function sesionVigente() {
  if (sesion && necesitaRenovar(sesion)) {
    try { sesion = await cliente.renovarSesion(sesion); guardarSesion(sesion); }
    catch (e) { if (e?.estado === 401) { borrarSesion(); sesion = null; } else throw e; }
  }
  return sesion;
}

const pestana = () => { const id = location.hash.slice(1); return PESTANAS.some((p) => p.id === id) ? id : 'totales'; };

async function render(msg = '') {
  if (!(await sesionVigente())) { app.innerHTML = vistaEntrar(msg); return; }
  let esAdmin = false;
  try { esAdmin = await admin.esAdmin(sesion); }
  catch (e) { if (e instanceof ErrorAdmin && e.estado === 401) { borrarSesion(); sesion = null; app.innerHTML = vistaEntrar(e.message); return; } }
  if (!esAdmin) { app.innerHTML = vistaNoAdmin(sesion.email); return; }

  const id = pestana();
  const cab = cabecera(id, sesion.email);
  app.innerHTML = `${cab}<p class="muted">Cargando…</p>`;
  try {
    if (id === 'cerebro') {
      // La vista del cerebro trae su propia cabecera con un enlace relativo a la app; aquí se usa la del panel.
      // Se monta en un contenedor nuevo en cada visita, para no repetir los manejadores de clic sobre #app.
      app.innerHTML = `${cab}<div id="adm-cerebro">${viewCerebro()}</div>`;
      app.querySelector('#adm-cerebro .admin-cab')?.remove();
      montarCerebro(app.querySelector('#adm-cerebro'));
      return;
    }
    const cuerpo = id === 'fincas' ? vistaFincas(await admin.fincas(sesion))
      : id === 'respuestas' ? vistaRespuestas(await admin.respuestas(sesion))
      : id === 'accesos' ? vistaAccesos(await admin.accesos(sesion))
      : vistaTotales(await admin.totales(sesion));
    app.innerHTML = cab + cuerpo;
  } catch (e) {
    app.innerHTML = cab + vistaError(e?.message || 'No se pudo leer la nube.');
  }
}

app.addEventListener('submit', async (ev) => {
  if (ev.target.dataset.adm !== 'entrar') return;
  ev.preventDefault();
  const email = ev.target.querySelector('#adm-email').value.trim();
  try { await admin.enviarEnlace(email, location.origin + location.pathname); render(`Si la cuenta existe, te llegó un enlace a ${email}. Ábrelo en este navegador.`); }
  catch (e) { render(e?.message || 'No se pudo enviar el enlace.'); }
});
app.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-adm="google"]')) { location.assign(admin.urlGoogle(location.origin + location.pathname)); return; }
  if (ev.target.closest('[data-adm="salir"]')) { borrarSesion(); sesion = null; render('Saliste del panel.'); }
});
addEventListener('hashchange', () => render());

// Al volver del enlace del correo, la sesión llega en el hash; se guarda y se limpia la URL.
const deHash = sesionDeHash(location.hash);
if (deHash) { guardarSesion(deHash); history.replaceState(null, '', location.pathname + '#totales'); }
// Un enlace vencido o ya usado vuelve con #error=…: se avisa y se limpia la URL.
const errorEnlace = new URLSearchParams(location.hash.slice(1)).get('error_code');
if (errorEnlace) history.replaceState(null, '', location.pathname + '#totales');
sesion = deHash || cargarSesion();
render(errorEnlace && !sesion ? 'Ese enlace ya venció o ya se usó. Pide uno nuevo.' : '');
