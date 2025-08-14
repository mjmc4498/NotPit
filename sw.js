const STATIC_CACHE_NAME = 'notpit-static-v1';
const DYNAMIC_CACHE_NAME = 'notpit-dynamic-v1';

// Add all the assets that make up the "app shell"
const APP_SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/app.js',
    '/js/controller.js',
    '/js/store.js',
    '/js/view.js',
    '/manifest.json',
    '/images/icons/.gitkeep' // Not a real icon, but ensures the path is known
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            console.log('Service Worker: Caching App Shell...');
            return cache.addAll(APP_SHELL_ASSETS);
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys
                .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // For Bootstrap CDN files, use a network-first strategy.
    if (event.request.url.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            fetch(event.request).then(response => {
                // If fetch is successful, cache a clone of the response
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request.url, response.clone());
                    return response;
                });
            }).catch(() => {
                // If fetch fails (offline), try to get it from the cache
                return caches.match(event.request);
            })
        );
    } else {
        // For app shell assets, use a cache-first strategy.
        event.respondWith(
            caches.match(event.request).then(response => {
                // If it's in the cache, return it. Otherwise, fetch from network.
                return response || fetch(event.request);
            })
        );
    }
});
