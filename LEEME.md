# Buy-iT web (PWA)

La versión web de Buy-iT: las mismas funciones que la app en modo **Internet** (compras, vitrina, viajes,
soporte), en el diseño A · Índigo. Se abre desde cualquier navegador y se puede "instalar" en la pantalla
de inicio (Android y iPhone). No usa SMS.

```
navegador --https://buyit.ic-vf.org/          --> buyit-web (archivos de la app)
navegador --https://buyit.ic-vf.org/api/...   --> buyit-web --> backend en Vercel
navegador --https://buyit.ic-vf.org/fotos/subir --> buyit-web --> buyit-imagenes:8090
```

Todo pasa por el mismo dominio, así el navegador no pide permisos extra (CORS) y la dirección que ve la
gente es la nuestra, no la de Vercel.

## Instalar en el VPS

1. Clonar el repo en el VPS (por ejemplo `/opt/buyit-web`):
   ```bash
   git clone https://github.com/geovanispantoja/buyit-web.git /opt/buyit-web
   cd /opt/buyit-web
   ```
2. Levantar (construye la app dentro de Docker; no hace falta Node en el VPS):
   ```bash
   docker compose up -d --build
   docker logs buyit-web        # nginx arrancado, sin errores
   ```
   La app se compila dentro de Docker: no hace falta copiar ningún build a mano.
   Debe estar en la misma red externa `pangolin` que `buyit-imagenes` (ya viene así en el compose).
3. **Pablo** agrega la ruta en Traefik: `buyit.ic-vf.org` -> `http://buyit-web:8080`
   (contenedor `buyit-web`, red `pangolin`, puerto interno 8080; no se publica ningún puerto) con su
   certificado HTTPS. **HTTPS es obligatorio**: sin él no se instala como app ni funcionan ubicación ni avisos.
4. Probar: `https://buyit.ic-vf.org/salud` debe responder `ok`. Luego abrir `https://buyit.ic-vf.org` en el teléfono, entrar con una cuenta y crear un pedido de prueba.

## Actualizar

```bash
cd /opt/buyit-web && git pull && docker compose up -d --build
```
Los teléfonos toman la versión nueva solos la próxima vez que abren la app.

## Variables (opcionales, en un `.env` junto al compose)

| Nombre | Por defecto | Para qué |
|---|---|---|
| `BACKEND_HOST` | `buyit-backend-nu.vercel.app` | host del backend en Vercel, sin `https://` ni barra |
| `FOTOS_INTERNO` | `buyit-imagenes:8090` | el servicio de fotos dentro de la red `pangolin` |
| `VITE_VERSION` | `web` | texto de versión que se ve al pie y en Soporte |

## Trabajar en local

```bash
npm install
npm run dev                  # http://localhost:5173, usa el backend de Vercel
BUYIT_BACKEND=http://localhost:3000 npm run dev   # contra el backend local
```

## Seguridad del contenedor (de la propuesta de Pablo)
nginx sin privilegios, sistema de archivos de solo lectura (`read_only` + `tmpfs`), 128 MB de memoria, sin
puertos publicados, cabeceras de seguridad en todas las respuestas y `/.well-known/` listo por si un día hay
app nativa de iOS.

## Notas
- **Cuenta en modo Internet:** al entrar por la web, la cuenta pasa a modo Internet y el backend deja de
  mandarle SMS de aviso (igual que cuando la app se pone en modo Internet).
- **Avisos:** mientras la web está abierta (aunque esté en segundo plano) recibe los avisos en vivo por el
  mismo servidor ntfy que la app y muestra una notificación. **Con la web cerrada no llegan avisos** (eso
  sería "web push", pendiente para una segunda entrega). Si ntfy falla, igual se actualiza cada pocos segundos.
- **iPhone:** conviene agregarla a la pantalla de inicio (Compartir → "Agregar a inicio"). Safari no deja
  elegir contactos de la agenda; el teléfono se escribe a mano.
