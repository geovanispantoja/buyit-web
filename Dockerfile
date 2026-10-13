# 1) Compilar la app (no hace falta Node en el VPS)
FROM node:20-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_VERSION=web
ENV VITE_VERSION=$VITE_VERSION
RUN npm run build

# 2) Servirla con nginx sin privilegios (como la propuesta de Pablo)
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY despliegue/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY despliegue/seguridad.conf /etc/nginx/seguridad.conf
COPY --from=compilar /app/dist /usr/share/nginx/html
# Solo se sustituyen estas variables; $host, $scheme, etc. quedan intactas.
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_HOST|FOTOS_INTERNO)$"
ENV BACKEND_HOST=buyit-backend-nu.vercel.app
ENV FOTOS_INTERNO=buyit-imagenes:8090
EXPOSE 8080
