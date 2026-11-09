import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// `base` is configurable for static hosting under a subdirectory (e.g. GitHub Pages
// project pages served from /career-studio/). Set CS_BASE when building for a subpath:
//   CS_BASE=/career-studio/ npm run build
// Routing uses HashRouter so deep links and refreshes work on any static host.
export default defineConfig({
  base: process.env.CS_BASE || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered manually in UpdateToast for the prompt UI
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Universal Career Studio',
        short_name: 'Career Studio',
        description: 'Create resumes, CVs, cover letters, portfolios and personal websites — private and offline-capable.',
        theme_color: '#2563eb',
        background_color: '#0b1120',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // App shell + all app chunks cached for offline use. Heavy processing
        // libraries (pdf.js, mammoth, docx) are included so those features work
        // offline once visited; OCR still needs the network for its model.
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2}'],
        navigateFallback: null, // HashRouter — no SPA fallback needed
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
