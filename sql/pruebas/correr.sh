#!/bin/sh
# Prueba el SQL del panel contra un Postgres LOCAL. Uso: PGHOST=... PGPORT=... PGUSER=... sh sql/pruebas/correr.sh
# Necesita psql y una base de pruebas vacía. Nunca apuntar a producción: el script borra el esquema public.
set -e
cd "$(dirname "$0")"
case "${PGHOST:-}" in *supabase*) echo "Esto es una base de pruebas local, no producción." >&2; exit 1;; esac
P="psql -v client_min_messages=warning -v ON_ERROR_STOP=1 -q -X"
$P -f base-simulada.sql
$P -f ../001_admin.sql
$P -f ../002_conteos.sql
[ -f ../003_admin_fincas_lista_blanca.sql ] && [ "${SIN_003:-}" != 1 ] && $P -f ../003_admin_fincas_lista_blanca.sql
$P -f admin_fincas.sql
