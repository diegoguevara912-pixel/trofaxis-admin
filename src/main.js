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

// Última cuenta admin que entró en este navegador (solo correo y proveedor), para la pantalla «Te damos la bienvenida de nuevo».
const CLAVE_CUENTA = 'trofaxis-admin:cuenta:v1';
const leerCuenta = () => { try { const c = JSON.parse(localStorage.getItem(CLAVE_CUENTA) || '{}'); return { email: String(c.email || ''), proveedor: c.proveedor === 'email' ? 'email' : c.email ? 'google' : '' }; } catch { return { email: '', proveedor: '' }; } };
const guardarCuenta = (c) => { try { c ? localStorage.setItem(CLAVE_CUENTA, JSON.stringify(c)) : localStorage.removeItem(CLAVE_CUENTA); } catch { /* sin almacenamiento */ } };
let cuenta = leerCuenta();
let verCorreo = false;
let ultimoMsg = '';

// Pantallas de entrada a pantalla completa, con el fondo de la app; el panel usa el ancho normal.
function pintar(html, entrada) { document.body.classList.toggle('en-bienvenida', entrada); app.innerHTML = html; }
const entrada = (msg = '') => { ultimoMsg = msg; pintar(vistaEntrar({ msg, cuenta, correo: verCorreo }), true); };

async function sesionVigente() {
  if (sesion && necesitaRenovar(sesion)) {
    try { sesion = await cliente.renovarSesion(sesion); guardarSesion(sesion); }
    catch (e) { if (e?.estado === 401) { borrarSesion(); sesion = null; } else throw e; }
  }
  return sesion;
}

const pestana = () => { const id = location.hash.slice(1); return PESTANAS.some((p) => p.id === id) ? id : 'totales'; };

async function render(msg = '') {
  if (!(await sesionVigente())) { entrada(msg); return; }
  let esAdmin = null;
  try { esAdmin = await admin.esAdmin(sesion); }
  catch (e) { if (e instanceof ErrorAdmin && e.estado === 401) { borrarSesion(); sesion = null; entrada(e.message); return; } }
  if (esAdmin === false) {
    // Entrar con Google crea la cuenta aunque no sea admin: si quedó vacía, se borra y se cierra la sesión.
    const email = sesion.email;
    try { await admin.descartarCuentaVacia(sesion); } catch { /* sin conexión: la cuenta vacía no cuenta como usuario */ }
    borrarSesion(); sesion = null;
    pintar(vistaNoAdmin(email), true); return;
  }
  if (!esAdmin) { entrada('No se pudo comprobar el permiso. Revisa la conexión y vuelve a intentar.'); return; }
  cuenta = { email: sesion.email || '', proveedor: sesion.proveedor === 'email' ? 'email' : 'google' }; guardarCuenta(cuenta);
  document.body.classList.remove('en-bienvenida');

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
  const irGoogle = () => location.assign(admin.urlGoogle(location.origin + location.pathname));
  if (ev.target.closest('[data-adm="google"]')) { irGoogle(); return; }
  if (ev.target.closest('[data-adm="cuenta"]')) { if (cuenta.proveedor === 'email') { verCorreo = true; entrada(ultimoMsg); app.querySelector('#adm-email')?.focus(); } else irGoogle(); return; }
  if (ev.target.closest('[data-adm="olvidar"]')) { cuenta = { email: '', proveedor: '' }; guardarCuenta(null); entrada(); return; }
  if (ev.target.closest('[data-adm="correo"]')) { verCorreo = true; entrada(ultimoMsg); app.querySelector('#adm-email')?.focus(); return; }
  if (ev.target.closest('[data-adm="salir"]')) { borrarSesion(); sesion = null; verCorreo = false; render('Saliste del panel.'); }
  if (ev.target.closest('[data-adm="volver"]')) { render(); }
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
