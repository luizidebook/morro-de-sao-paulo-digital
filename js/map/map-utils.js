/**
 * Módulo de Utilitários do Mapa
 * Funções auxiliares para cálculos geográficos e helpers.
 */
import { map } from "../map/mapManager.js"; // Instância do mapa Leaflet
/**
 * Centraliza o mapa em [lat, lon], mas com um deslocamento vertical (offsetY em pixels)
 * @param {number} lat
 * @param {number} lon
 * @param {number} offsetY - deslocamento em pixels (positivo para cima)
 * @param {number} zoom
 */
export function flyToWithOffset(lat, lon, offsetY = -10, zoom = 16) {
  if (!map) return;
  // Converte lat/lon para ponto na tela
  const targetPoint = map.project([lat, lon], zoom);
  // Aplica o offset vertical
  targetPoint.y = targetPoint.y + offsetY;
  // Converte de volta para lat/lon
  const newCenter = map.unproject(targetPoint, zoom);
  map.flyTo(newCenter, zoom, { animate: true, duration: 1.5 });
}

/**
 * Verifica se um ponto está dentro de um raio em metros do centro.
 * @param {number} lat
 * @param {number} lon
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} radiusMeters
 * @returns {boolean}
 */
export function isWithinRadius(
  lat,
  lon,
  centerLat = -13.376,
  centerLon = -38.917,
  radiusMeters = 10000
) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat - centerLat);
  const dLon = toRad(lon - centerLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(centerLat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d <= radiusMeters;
}
