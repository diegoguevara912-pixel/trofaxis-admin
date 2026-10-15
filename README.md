# Trofaxis · Administración

Panel de administración de [Trofaxis](https://trofaxis.github.io), aparte de la app (otro sitio y otra sesión).

- **Totales**: cuentas, fincas, casos y respuestas de bienvenida, sin datos personales.
- **Fincas**: cada finca guardada en la nube, sin nombre, sin correo y sin coordenadas (código corto).
- **Respuestas**: bienvenida y casos anónimos.
- **Cerebro**: el grafo de hechos con fuente, importado de la app publicada.
- **Registro de accesos**: cada lectura de datos de usuarios deja una fila, escrita por la base de datos.

## Seguridad

- Quién es administrador lo decide la base de datos (tabla `admins`, por `user_id`). Este código no guarda correos.
- Solo usa la clave publicable de Supabase. Nunca la clave `service_role`.
- El código es público; los datos no: sin una sesión de administrador, las funciones `admin_*` responden con error.
- La migración está en `sql/001_admin.sql`.

## Probar

`npm test` · Ver en local: `npx --yes http-server -p 8001`
