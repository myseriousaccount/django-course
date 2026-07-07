/**
 * Service Worker — для офлайн-режиму (PWA).
 *
 * РЕЖИМИ:
 * - На localhost — network-first (свіжі файли при кожному запуску, без капкану кешу)
 * - На production-домені — cache-first (швидко + офлайн)
 */
const CACHE = 'django-platform-v4';
const PRECACHE = [
    './',
    'index.html',
    'css/style.css',
    'js/app.js',
    'manifest.json',
    'content/topics.json',
];

const isLocalhost = location.hostname === 'localhost' ||
                    location.hostname === '127.0.0.1' ||
                    location.hostname === '[::1]' ||
                    location.hostname === '';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== location.origin) return;

    if (isLocalhost) {
        // Dev — network-first: завжди беремо свіжий файл, кеш — тільки fallback при офлайні
        e.respondWith(
            fetch(e.request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(e.request, copy));
                }
                return response;
            }).catch(() => caches.match(e.request))
        );
    } else {
        // Prod — cache-first
        e.respondWith(
            caches.match(e.request).then(cached => {
                const networkFetch = fetch(e.request).then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then(cache => cache.put(e.request, copy));
                    }
                    return response;
                }).catch(() => cached);
                return cached || networkFetch;
            })
        );
    }
});
