# Trofaxis · Administración — instrucciones para Claude Code

Panel de administración de Trofaxis (https://trofaxis.github.io), aparte de la app. Dueño: Diego Guevara.

- Responde en español, corto y técnico. Mismas reglas de datos que el repositorio de la app: no inventar datos ni referencias.
- Identidad de commits: `Diego Guevara <335656306+diegoguevara912-pixel@users.noreply.github.com>`. Nunca escribas el correo personal de Diego en el repo (hay una prueba que lo verifica).
- Quién es admin vive solo en Supabase (tabla `admins`). Solo la clave publicable; nunca `service_role`.
- Nunca mostrar coordenadas, nombre de finca ni correo de usuarios.
- Cambios por rama y PR; no push directo a `main` salvo el commit inicial.
- `npm test` antes y después de cada cambio. Sin build ni dependencias.
