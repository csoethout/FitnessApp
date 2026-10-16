import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline app shell (Phase 6). The service worker caches the built app (HTML, JS, CSS,
    // icons, the barcode reader) so it opens with no signal. Your data is already offline in IndexedDB; API calls
    // (Supabase, USDA, Open Food Facts) are never cached by the service worker.
    VitePWA({
      registerType: 'prompt', // a new version waits for "Reload" (src/components/UpdatePrompt.tsx), never mid-set
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: "Soev's Strength Lab",
        short_name: "Soev's Lab", // home-screen label: the full name is cut off on iPhone
        description: 'Strength · Health · Discipline. Workouts, body weight and food, planned for you.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // the barcode reader (wasm) is ~1.1 MB
        navigateFallback: '/index.html', // any app URL opens offline (SPA routes)
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
