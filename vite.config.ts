import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Path the app is served under: "/<repo>/" on GitHub Pages, "/" on a domain of its own.
const base = process.env.BASE_PATH || '/bookflix/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // pdf.js and libarchive workers must be cached for offline reading.
        globPatterns: ['**/*.{js,mjs,css,html,wasm,png,svg}'],
        maximumFileSizeToCacheInBytes: 10_000_000,
      },
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Bookflix',
        short_name: 'Bookflix',
        lang: 'fr',
        display: 'standalone',
        start_url: base,
        scope: base,
        theme_color: '#141414',
        background_color: '#141414',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom' },
})
