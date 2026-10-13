# 1) Compilar la app
FROM node:20-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_VERSION=web
ENV VITE_VERSION=$VITE_VERSION
RUN npm run build

# 2) Servirla con nginx (sin node en la imagen final)
FROM nginx:1.27-alpine
COPY despliegue/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=compilar /app/dist /usr/share/nginx/html
# Solo se sustituyen NUESTRAS variables (nginx usa $ propios en la plantilla).
ENV NGINX_ENVSUBST_FILTER="^BUYIT_"
ENV BUYIT_BACKEND_HOST=buyit-backend-nu.vercel.app
ENV BUYIT_FOTOS_INTERNO=buyit-imagenes:8090
EXPOSE 8080
