// performance.js – Otimização de desempenho e cache

/* O que esse módulo faz:
Registra o Service Worker para permitir navegação offline e cache de páginas.
Ativa lazy loading em todas as imagens da página.
Pré-carrega os recursos críticos (CSS, JS e traduções).*/

/**
 * Registra um Service Worker para ativar cache offline e desempenho aprimorado.
 */
export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("[SW] Registrado com sucesso:", registration.scope);
      })
      .catch((error) => {
        console.warn("[SW] Falha ao registrar:", error);
      });
  } else {
    console.warn("[SW] Service Workers não suportados neste navegador.");
  }
}

/**
 * Adiciona lazy loading a todas as imagens da página.
 */
export function optimizeImageLoading() {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    img.loading = "lazy";
  });
}

/**
 * Pré-carrega recursos importantes do site.
 */
export function preloadCriticalAssets() {
  const links = [
    { rel: "preload", href: "/styles.css", as: "style" },
    { rel: "preload", href: "/js/main.js", as: "script" },
    {
      rel: "preload",
      href: "/i18n/pt.json",
      as: "fetch",
      type: "application/json",
    },
  ];

  links.forEach((linkData) => {
    const link = document.createElement("link");
    Object.entries(linkData).forEach(([key, val]) =>
      link.setAttribute(key, val)
    );
    document.head.appendChild(link);
  });
}

/**
 * Inicializa otimizações de performance
 */
export function initPerformanceOptimizations() {
  // Implementa carregamento lazy de imagens
  setupLazyLoading();

  // Implementa precaching de assets essenciais
  precacheEssentialAssets();

  // Monitoramento de performance
  monitorPerformanceMetrics();
}

/**
 * Configura carregamento lazy de imagens
 */
function setupLazyLoading() {
  // Verifica se o navegador suporta Intersection Observer
  if ("IntersectionObserver" in window) {
    const lazyImages = document.querySelectorAll("[data-src]");

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach((img) => imageObserver.observe(img));
  } else {
    // Fallback para navegadores antigos
    const lazyImages = document.querySelectorAll("[data-src]");
    lazyImages.forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }
}

/**
 * Pré-carrega assets essenciais em segundo plano
 */
function precacheEssentialAssets() {
  // Implementação para quando tiver Service Worker
  if ("serviceWorker" in navigator) {
    // Seria implementado com registro de Service Worker
    console.log("Service Worker disponível para precaching");
  } else {
    // Fallback manual de pré-carregamento
    const essentialAssets = [
      "/images/markers/beach-marker.png",
      "/images/markers/food-marker.png",
      "/images/markers/hotel-marker.png",
      "/images/markers/attraction-marker.png",
    ];

    essentialAssets.forEach((asset) => {
      const img = new Image();
      img.src = asset;
    });
  }
}

/**
 * Monitora métricas de performance do aplicativo
 */
function monitorPerformanceMetrics() {
  // Coleta Web Vitals
  if ("web-vitals" in window) {
    import("https://unpkg.com/web-vitals").then(
      ({ getCLS, getFID, getLCP }) => {
        getCLS(sendToAnalytics);
        getFID(sendToAnalytics);
        getLCP(sendToAnalytics);
      }
    );
  }

  // Monitora uso de memória (se suportado)
  if (window.performance && window.performance.memory) {
    setInterval(() => {
      const memoryUsage = window.performance.memory;
      if (memoryUsage.usedJSHeapSize > 100000000) {
        // 100MB
        console.warn("Alto uso de memória detectado");
      }
    }, 30000);
  }
}

/**
 * Envia métricas de performance para analytics
 */
function sendToAnalytics(metric) {
  if (window.trackEvent) {
    window.trackEvent("performance", metric.name, String(metric.value));
  }
}
