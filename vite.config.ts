import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Se muestra en Ajustes; sirve para soporte ("¿qué versión traes?").
const VERSION = '1.0.0'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg'],
      manifest: {
        name: 'POS Lite — Punto de venta',
        short_name: 'POS Lite',
        description: 'Punto de venta ligero para tienditas. Funciona sin internet.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todos los datos viven en IndexedDB; aquí solo cacheamos el app shell
        // para que la app abra sin internet.
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // El escáner por cámara (zxing) pesa; va en su propio chunk y solo se
        // descarga si el usuario abre la cámara.
        manualChunks: (id) => (id.includes('@zxing') ? 'camara' : undefined),
      },
    },
  },
  server: { host: true },
})
