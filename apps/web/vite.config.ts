import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

const DAY = 24 * 60 * 60;

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // sem service worker em dev (e fora do build): não interfere no HMR nem nos e2e
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'freenem — estude para o ENEM de graça',
        short_name: 'freenem',
        description:
          'Banco de questões, simulados com TRI, redação com IA e plano de estudos. Gratuito e open-source.',
        lang: 'pt-BR',
        dir: 'ltr',
        display: 'standalone',
        start_url: '/inicio',
        scope: '/',
        // tokens: --ink (tema) e --bg (fundo do splash)
        theme_color: '#14213d',
        background_color: '#fbf6ea',
        categories: ['education'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // app shell (JS/CSS/HTML/ícones) pré-cacheado; o resto vai para a rede
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['og.png'],
        navigateFallback: '/index.html',
        // a API (outra origem ou /api) e os arquivos nunca caem no fallback da SPA
        navigateFallbackDenylist: [/^\/api\//, /^\/files\//, /^\/health/],
        cleanupOutdatedCaches: true,
        // Só o que está listado abaixo é cacheado em runtime. Nada de /api/auth/*
        // nem de respostas específicas do usuário (me, stats, plano, simulados, redações).
        runtimeCaching: [
          {
            // catálogo é público e muda pouco
            urlPattern: ({ url }) => url.pathname === '/api/v1/catalog',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'freenem-catalog',
              expiration: { maxEntries: 2, maxAgeSeconds: 7 * DAY },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // imagens das questões (storage local /files/* ou bucket público)
            urlPattern: ({ request, url, sameOrigin }) =>
              request.destination === 'image' &&
              (url.pathname.startsWith('/files/') || !sameOrigin),
            handler: 'CacheFirst',
            options: {
              cacheName: 'freenem-question-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'freenem-font-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'freenem-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
});
