# Trofaxis · Administración

Panel de administración de [Trofaxis](https://trofaxis.github.io), aparte de la app (otro sitio y otra sesión).

- **Totales**: cuentas, fincas, casos y respuestas de bienvenida, sin datos personales.
- **Fincas**: cada finca guardada en la nube, sin nombre, sin correo y sin coordenadas (código corto). Solo salen los campos que guarda la app (lista blanca) y un departamento con menos de 3 fincas sale como «otros».
- **Respuestas**: bienvenida y casos anónimos.
- **Cerebro**: el grafo de hechos con fuente, importado de la app publicada.
- **Registro de accesos**: cada lectura de datos de usuarios deja una fila, escrita por la base de datos.

## Seguridad

- Quién es administrador lo decide la base de datos (tabla `admins`, por `user_id`). Este código no guarda correos.
- Solo usa la clave publicable de Supabase. Nunca la clave `service_role`.
- El código es público; los datos no: sin una sesión de administrador, las funciones `admin_*` responden con error.
- Las migraciones están en `sql/` (001, 002 y 003, en orden). Diego las pega en el SQL Editor de Supabase; nadie más toca producción.
- Límite conocido: los textos libres que escribe el usuario (fuente de agua, acciones, criterio de una no conformidad, nombres de cultivos o especies) sí salen en el panel. Si alguien escribe ahí un nombre propio, el panel lo muestra.
- Las funciones `admin_*` son `security definer` y las puede llamar cualquier sesión (`authenticated`); el asesor de Supabase lo marca como aviso. Es a propósito: la primera línea de cada una corta si `es_admin()` es falso.

## Probar

`npm test` · Ver en local: `npx --yes http-server -p 8001`

Prueba del SQL con datos ficticios en un Postgres **local** (nunca en producción; el script borra el esquema `public`):

```bash
PGHOST=... PGPORT=... PGUSER=... PGDATABASE=... sh sql/pruebas/correr.sh   # todo debe decir PASA
SIN_003=1 PGHOST=... sh sql/pruebas/correr.sh                              # cómo estaba antes de la 003
```
