/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
