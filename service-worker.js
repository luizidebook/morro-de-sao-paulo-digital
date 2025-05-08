//  service-worker.js – Cache offline e performance

const CACHE_NAME = "morro-digital-cache-v1";
const PRECACHE_URLS = [
  "/", // index.html
  "/styles.css",
  "/js/main.js",
  "/js/interface.js",
  "/js/assistant.js",
  "/js/dialog.js",
  "/js/map-control.js",
  "/js/voiceSystem.js",
  "/js/translatePageContent.js",
  "/js/submenu.js",
  "/js/osm-service.js",
  "/js/route.js",
  "/js/ux-ui-controls.js",
  "/js/performance.js",
  "/js/monitoring.js",
  "/i18n/pt.json",
  "/i18n/en.json",
  "/i18n/es.json",
  "/i18n/he.json",
];

// Instala o Service Worker e armazena os recursos em cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Arquivos pré-cacheados");
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Ativa e limpa caches antigos se houver
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  console.log("[SW] Ativado e pronto");
});

// Intercepta requisições e responde com cache (se disponível)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
