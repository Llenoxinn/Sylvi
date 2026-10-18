/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();

// The app shell, so Sylvi opens offline after the first visit.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// The tool lives under /app/ and the landing page at /, so each gets its own shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('app/index.html'), { allowlist: [/^\/app(\/|$)/] }));
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/app(\/|$)/] }));

// The face model and its WASM runtime are large, so they are cached the first
// time they're used rather than downloaded on install.
registerRoute(
  ({ url }) => url.pathname.startsWith('/mediapipe/') || url.pathname.startsWith('/models/'),
  new CacheFirst({ cacheName: 'sylvi-face-model', plugins: [new ExpirationPlugin({ maxEntries: 12 })] })
);
