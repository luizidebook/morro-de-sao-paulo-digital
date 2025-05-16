/**
 * tileUtils.js
 * Funções para conversão entre coordenadas geográficas e índices de tile,
 * cálculo de bounding box e resolução espacial (metros/pixel).
 */

// Converte coluna X e zoom Z para longitude
export function tile2long(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

// Converte linha Y e zoom Z para latitude
export function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Retorna bounding box [minLon, minLat, maxLon, maxLat]
export function tileBBox(x, y, z) {
  const minLon = tile2long(x, z);
  const maxLon = tile2long(x + 1, z);
  const minLat = tile2lat(y + 1, z);
  const maxLat = tile2lat(y, z);
  return [minLon, minLat, maxLon, maxLat];
}

// Converte longitude para coluna X
export function long2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

// Converte latitude para linha Y
export function lat2tile(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z)
  );
}

// Calcula resolução aproximada (metros/pixel) em latitude média do tile
export function meterPerPixel(lat, z) {
  const earthCircumference = 40075016.686; // metros
  return (
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, z + 8)
  );
}
