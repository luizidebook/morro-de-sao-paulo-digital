/**
 * ============================================================
 * Morro Digital - mapManager.js
 * ============================================================
 * Sumário dos Módulos de Mapa
 *
 * Este arquivo centraliza e reexporta as funções dos módulos de mapa,
 * servindo como ponto único de importação para outros módulos do projeto.
 *
 * RESUMO DOS MÓDULOS E FUNÇÕES:
 *
 * --- map-init.js ---
 * - initializeMap(containerId, options): Inicializa o mapa Leaflet no container especificado, com opções de zoom, centro e offset.
 * - getMapInstance(): Retorna a instância atual do mapa Leaflet.
 *
 * --- map-markers.js ---
 * - clearMarkers(): Remove todos os marcadores do mapa, exceto o marcador da localização do usuário.
 * - showLocationOnMap(locationName, lat, lon): Exibe um marcador e popup para um local específico no mapa.
 * - showAllLocationsOnMap(locations): Exibe marcadores para uma lista de locais e ajusta o mapa para mostrar todos.
 * - highlightMarker(locationName): Destaca e centraliza o marcador de um local pelo nome.
 *
 * --- user-location.js ---
 * - requestAndTrackUserLocation(): Solicita permissão de GPS e rastreia a posição do usuário em tempo real.
 * - setupGeolocation(map): Centraliza o mapa na localização do usuário e atualiza o marcador.
 * - getCurrentPosition(): Obtém a localização atual do usuário (Promise).
 * - getBestEffortLocation(maxWaitMs, desiredAccuracy): Obtém a melhor localização possível dentro do tempo e precisão desejados.
 * - getPreciseLocationRealtime(desiredAccuracy, fallbackAccuracy, maxWaitMs, onUpdate): Rastreia a localização do usuário em tempo real até atingir a precisão desejada.
 *
 * --- map-routes.js ---
 * - showRoute(destination): Calcula e exibe a rota entre o usuário e o destino, mostrando resumo no assistente.
 * - plotRouteOnMap(startLat, startLon, destLat, destLon, profile): Consulta a API de rotas, plota a rota no mapa e ajusta o zoom.
 *
 * --- map-utils.js ---
 * - flyToWithOffset(lat, lon, offsetY, zoom): Centraliza o mapa em uma coordenada com deslocamento vertical.
 * - isWithinRadius(lat, lon, centerLat, centerLon, radiusMeters): Verifica se um ponto está dentro de um raio em metros do centro.
 *
 * --- uiMap.js ---
 * - hidePopup(name, remove): Esconde ou remove popups do mapa pelo nome.
 * - clearMarkers(): Remove todos os marcadores do mapa, exceto o destino e o usuário.
 * - showLocationOnMap(locationName, lat, lon): Mostra um local específico no mapa com popup.
 * - showAllLocationsOnMap(locations): Mostra vários locais no mapa.
 *
 * --- osm-service.js ---
 * - fetchOSMData(queryKey): Busca dados da Overpass API conforme a query.
 * - loadSubMenu(queryKey): Carrega e exibe itens do submenu.
 * - validateCoordinates(lat, lon): Valida coordenadas via Nominatim.
 * - queries: Dicionário de queries Overpass para diferentes categorias.
 * - NOMINATIM_URL, OVERPASS_API_URL, apiKey: Constantes de configuração.
 *
 * ============================================================
 */

// Variáveis de controle de mapa e marcadores
export let markers = []; // Array global para armazenar os marcadores no mapa
export let userLocation = null;
export let map;
export let userMarker = null; // Marcador do usuário
export let userLocationMarker = null; // Marcador da localização do usuário

// --- map-init.js ---
export { initializeMap, getMapInstance } from "./map-init.js";

// --- map-markers.js ---
export {
  clearMarkers,
  showLocationOnMap,
  showAllLocationsOnMap,
  highlightMarker,
} from "./map-markers.js";

// --- user-location.js ---
export {
  requestAndTrackUserLocation,
  setupGeolocation,
  getCurrentPosition,
  getPreciseLocationRealtime,
} from "../navigation/navigationUserLocation/user-location.js";
export { getBestEffortLocation } from "../navigation/navigationUserLocation/enhanced-geolocation.js";

// --- map-routes.js ---
export { showRoute, plotRouteOnMap } from "./map-controls.js";

// --- map-utils.js ---
export { flyToWithOffset, isWithinRadius } from "./map-utils.js";

// --- uiMap.js ---
export {
  hidePopup,
  createPopupContent,
  getLocationDescription,
} from "./uiMap.js";

// --- osm-service.js ---
export {
  fetchOSMData,
  loadSubMenu,
  validateCoordinates,
  queries,
  NOMINATIM_URL,
  OVERPASS_API_URL,
  apiKey,
} from "./osm-service.js";
