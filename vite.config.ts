/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    {
      // Vite drops blocking="render" when it rewrites the entry script. The tool's
      // first paint waits for its script so the page transition from the landing
      // page snapshots the real UI, not an empty page.
      name: 'sylvi-render-blocking-app',
      transformIndexHtml: {
        order: 'post',
        handler: (html, ctx) =>
          /[\\/]app[\\/]index\.html$/.test(ctx.filename)
            ? html.replace(/<script type="module"(?![^>]*blocking=)/, '<script type="module" blocking="render"')
            : html
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      // A hand-written service worker: workbox's generated one breaks on
      // project paths containing an apostrophe.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], globIgnores: ['mediapipe/**', 'models/**'] },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Sylvi',
        short_name: 'Sylvi',
        description: 'Lay out ID photo packages and print them at true size.',
        theme_color: '#24443b',
        background_color: '#f6f7f6',
        display: 'standalone',
        // The installed app opens straight into the tool, not the landing page.
        id: '/app/',
        start_url: '/app/',
        scope: '/app/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
    })
  ],
  build: {
    // The landing page at / and the tool at /app/.
    rolldownOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url))
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
