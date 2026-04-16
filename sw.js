const CACHE_NAME = 'bonsai-zen-v1';
const urlsToCache = [
  './',
  './index.html',
  './estilos.css',
  './main.js',
  './MotorBonsai.js',
  './MotorEntorno.js',
  './MotorAudio.js'
];

// Durante la instalación, guarda los archivos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Cuando la app pide un archivo, lo busca primero en la caché (Magia Offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
