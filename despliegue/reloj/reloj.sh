#!/bin/sh
# Reloj de Buy-iT: llama al backend una vez. Lo corre cron cada minuto (ver LEEME.md).
# Lee la clave de /etc/buyit-reloj.env (RELOJ_CLAVE=...), que NO va en el repositorio.
set -eu
[ -f /etc/buyit-reloj.env ] && . /etc/buyit-reloj.env
: "${RELOJ_CLAVE:?Falta RELOJ_CLAVE en /etc/buyit-reloj.env}"
BACKEND="${BACKEND_URL:-https://buyit-backend-nu.vercel.app}"

respuesta=$(curl -sS --max-time 40 -X POST \
  -H "x-reloj-clave: ${RELOJ_CLAVE}" \
  -w '\n%{http_code}' \
  "${BACKEND}/api/reloj") || { echo "$(date -Is) sin conexion con el backend"; exit 1; }

codigo=$(printf '%s' "$respuesta" | tail -n1)
cuerpo=$(printf '%s' "$respuesta" | sed '$d')
if [ "$codigo" != "200" ]; then
  echo "$(date -Is) HTTP $codigo $cuerpo"
  exit 1
fi
