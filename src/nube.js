// Acceso del administrador a Supabase. Solo la clave publicable (la misma de la app): quién es admin lo decide la base
// (tabla admins y funciones admin_*), nunca este código. Sin clave service_role.

export const NUBE = {
  url: 'https://kfybqlknlkxrqphwopfx.supabase.co',
  clavePublicable: 'sb_publishable_GZY64ytTNLaL9898VrIGKA_P0ZdFOXb',
};

export class ErrorAdmin extends Error {
  constructor(mensaje, estado = 0) { super(mensaje); this.estado = estado; }
}

export function crearAdmin({ nube = NUBE, fetchFn = globalThis.fetch } = {}) {
  async function pedir(ruta, { metodo = 'GET', cuerpo, sesion } = {}) {
    let r;
    try {
      r = await fetchFn(nube.url + ruta, {
        method: metodo,
        headers: {
          apikey: nube.clavePublicable,
          ...(sesion ? { Authorization: `Bearer ${sesion.token}` } : {}),
          ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    } catch { throw new ErrorAdmin('Sin conexión con la nube.'); }
    if (r.status === 401) throw new ErrorAdmin('Tu sesión venció: vuelve a entrar.', 401);
    if (r.status === 403 || r.status === 404) throw new ErrorAdmin('Esta cuenta no es administradora.', 403);
    if (!r.ok) throw new ErrorAdmin(`La nube respondió con un error (${r.status}).`, r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const rpc = (nombre, sesion) => pedir(`/rest/v1/rpc/${nombre}`, { metodo: 'POST', cuerpo: {}, sesion });
  return {
    // create_user: false. Este sitio no crea cuentas: solo entra quien ya existe.
    enviarEnlace: (email, volverA) => pedir(`/auth/v1/otp?redirect_to=${encodeURIComponent(volverA)}`, { metodo: 'POST', cuerpo: { email, create_user: false } }),
    // Entrar con Google: Supabase hace el inicio de sesión y vuelve aquí con la sesión en el hash, igual que el enlace del correo.
    // Requiere el proveedor Google activado en Supabase (Authentication › Sign In / Providers).
    urlGoogle: (volverA) => `${nube.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(volverA)}`,
    esAdmin: async (sesion) => (await rpc('es_admin', sesion)) === true,
    totales: (sesion) => rpc('admin_totales', sesion),
    fincas: (sesion) => rpc('admin_fincas', sesion),
    respuestas: (sesion) => rpc('admin_respuestas', sesion),
    accesos: (sesion) => pedir('/rest/v1/accesos_admin?select=accion,filas,creado&order=creado.desc&limit=100', { sesion }),
  };
}
