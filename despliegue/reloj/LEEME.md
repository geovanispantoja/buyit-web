# Reloj de Buy-iT (cron en el VPS)

Hasta ahora el "reloj" del sistema lo hacía el PIVO preguntando cada 4 segundos: con cada consulta
el backend aprovechaba para:

- abrir a todos los compradores los pedidos cuya ventana de "comprador de preferencia" ya venció,
- vencer los viajes viejos (NO PUBLICADA + aviso al cliente),
- soltar los mensajes en cola que ya esperaron demasiado,

Para ahorrar batería, el PIVO ahora duerme y solo se despierta cuando el backend le "toca el timbre"
(push por ntfy). Por eso hace falta otro reloj: **este VPS llama a `/api/reloj` una vez por minuto.**
Además, si el PIVO deja de reportarse durante 15 minutos, el reloj avisa a los gerentes con un push.

## Instalación (una sola vez, como root)

1. Copia el script:

   ```sh
   install -m 755 despliegue/reloj/reloj.sh /usr/local/bin/buyit-reloj
   ```

2. Crea el archivo con la clave (Geo te la pasa por privado; es la misma que tiene en Vercel como
   `RELOJ_CLAVE`):

   ```sh
   printf 'RELOJ_CLAVE=%s\n' 'LA_CLAVE_QUE_TE_PASE_GEO' > /etc/buyit-reloj.env
   chmod 600 /etc/buyit-reloj.env
   ```

   Opcional: `BACKEND_URL=https://...` en el mismo archivo si el backend cambia de dirección
   (por defecto `https://buyit-backend-nu.vercel.app`).

3. Pruébalo a mano. Tiene que terminar sin imprimir nada:

   ```sh
   /usr/local/bin/buyit-reloj && echo OK
   ```

   Si imprime `HTTP 401`, la clave no coincide con la de Vercel.

4. Añade la tarea a cron:

   ```sh
   echo '* * * * * root /usr/local/bin/buyit-reloj >> /var/log/buyit-reloj.log 2>&1' > /etc/cron.d/buyit-reloj
   ```

   El log solo guarda líneas cuando algo falla. Para que no crezca para siempre, puedes añadir
   `/var/log/buyit-reloj.log` a logrotate o vaciarlo de vez en cuando.

## Comprobar que corre

```sh
tail -f /var/log/buyit-reloj.log   # vacío = todo bien
grep buyit-reloj /var/log/syslog   # cron lo ejecuta cada minuto
```

## Quitarlo

```sh
rm /etc/cron.d/buyit-reloj /usr/local/bin/buyit-reloj /etc/buyit-reloj.env
```
