import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (установка на iOS/Android с gymwithai.me). Регистрация SW — вручную
    // в main.jsx и только при platform='web': Telegram Mini App живёт без SW,
    // чтобы кэш не задерживал его обновления.
    // injectManifest: собственный src/sw.js — precache + Web Push хендлеры.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/favicon-64.png'],
      manifest: {
        name: 'AI Trainer — тренировки с AI',
        short_name: 'AI Trainer',
        description: 'AI-тренер: программа, трекинг подходов и аналитика прогресса',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050507',
        theme_color: '#050507',
        categories: ['fitness', 'health', 'sports'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Лендинг — отдельная статическая страница, в app shell не входит.
        // Runtime-кэши и push-хендлеры — в src/sw.js.
        globIgnores: ['landing.html', 'gym-machine.jpg'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    include: ['src/**/*.test.js'],
  },
})
