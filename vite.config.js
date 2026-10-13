import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// En desarrollo (npm run dev) las llamadas a /api van al backend de Vercel,
// igual que en el VPS hace nginx. Se puede cambiar con BUYIT_BACKEND=http://localhost:3000
const BACKEND = process.env.BUYIT_BACKEND || "https://buyit-backend-nu.vercel.app";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "iconos/apple-touch-icon.png", "fonts/*.ttf"],
      manifest: {
        name: "Buy-iT",
        short_name: "Buy-iT",
        description: "Pide tus compras y viajes en Cuba",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F4F5FB",
        theme_color: "#3B4C9B",
        icons: [
          { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // La API y la subida de fotos NUNCA se sirven de la cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/fotos\//],
        globPatterns: ["**/*.{js,css,html,png,svg,ttf,woff2}"],
        runtimeCaching: [
          {
            // Fotos de la vitrina (servicio de fotos del VPS): se guardan para verlas sin señal.
            urlPattern: ({ url }) => url.hostname.startsWith("img."),
            handler: "CacheFirst",
            options: { cacheName: "fotos", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true, secure: true },
    },
  },
});
