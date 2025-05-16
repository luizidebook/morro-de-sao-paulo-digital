/**
 * Módulo de Inicialização do Mapa Leaflet
 * Responsável por criar e configurar o mapa e fornecer sua instância.
 */

export let map;

/**
 * Inicializa o mapa Leaflet e configura as camadas.
 * @param {string} containerId - ID do elemento HTML que conterá o mapa.
 * @param {Object} options - Opções de inicialização do mapa.
 * @returns {Object} Instância do mapa Leaflet.
 */
export function initializeMap(containerId, options = {}) {
  if (map) {
    console.warn("[initializeMap] Mapa já inicializado.");
    return map; // Retorna a instância existente
  }

  const mapElement = document.getElementById(containerId);
  if (!mapElement) {
    console.error(
      `[initializeMap] Elemento com ID "${containerId}" não encontrado no DOM.`
    );
    return null;
  }

  // Permite customizar o zoom, offset inicial do topo e centro do mapa
  const initialZoom = options.zoom || 1;
  const initialOffsetTopPx =
    options.offsetTopPx !== undefined ? options.offsetTopPx : 10;
  const initialLat =
    options.centerLat !== undefined ? options.centerLat : -13.3775457;
  const initialLng =
    options.centerLng !== undefined ? options.centerLng : -38.9159969;

  // Inicializa o mapa normalmente
  map = L.map(containerId, { zoomControl: false }).setView(
    [initialLat, initialLng],
    initialZoom
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Centraliza o mapa próximo ao topo (offsetTopPx)
  map.whenReady(() => {
    const mapHeight = map.getSize().y;
    const offsetY = initialOffsetTopPx - mapHeight / 2;
    const centerPoint = map
      .project([initialLat, initialLng], initialZoom)
      .subtract([0, offsetY]);
    const targetLatLng = map.unproject(centerPoint, initialZoom);
    map.setView(targetLatLng, initialZoom, { animate: false });
    console.log(
      `[initializeMap] Mapa centralizado com offsetTopPx: ${initialOffsetTopPx} e centro: (${initialLat}, ${initialLng})`
    );
  });

  console.log("[initializeMap] Mapa inicializado com sucesso.");
  return map;
}

export function getMapInstance() {
  return map || window.map;
}

/**
 * Atualiza a referência interna da instância do mapa
 * Útil quando o mapa é recriado ou trocado entre 2D e 3D
 * @param {Object} mapInstance - Nova instância do mapa
 */
export function updateMapReference(mapInstance) {
  if (mapInstance) {
    map = mapInstance;
    console.log("[map-init] Referência de mapa atualizada");
  }
}
