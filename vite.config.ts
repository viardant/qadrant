/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],

      manifest: {
        name: 'Qadrant',
        short_name: 'Qadrant',
        description: 'Personal, agent-readable time tracking.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#fdf8f8',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{webmanifest,ico,png,svg,html,js,css,woff2}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/pb-qadrant(?:-[a-z]+)?\.viardant\.com\/api\/collections\/time_entries\/records.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pb-time-entries-v1',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 604800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/pb-qadrant(?:-[a-z]+)?\.viardant\.com\/api\/collections\/users\/records.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pb-users-v1',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css-v1',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-v1',
              expiration: { maxEntries: 30, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },

      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
