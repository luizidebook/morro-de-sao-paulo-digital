/**
 * calculators.js
 *
 * Funções utilitárias para cálculos de navegação
 */

// Constantes para cálculos
const EARTH_RADIUS = 6371000; // Raio médio da Terra em metros

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine
 * @param {number} lat1 - Latitude do primeiro ponto
 * @param {number} lon1 - Longitude do primeiro ponto
 * @param {number} lat2 - Latitude do segundo ponto
 * @param {number} lon2 - Longitude do segundo ponto
 * @returns {number} - Distância em metros
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Validação de parâmetros
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    console.error("[calculateDistance] Parâmetros inválidos:", {
      lat1,
      lon1,
      lat2,
      lon2,
    });
    return 0;
  }

  // Converter strings para números
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);

  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Verifica se uma coordenada geográfica é válida
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - true se for válida, false caso contrário
 */
export function isValidCoordinate(lat, lon) {
  // Validar se são números
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) return false;

  // Validar se estão dentro dos limites válidos
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  return latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180;
}

/**
 * Calcula o ângulo (bearing) entre dois pontos
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} Ângulo em graus (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  // Converter graus para radianos
  const toRad = (value) => (value * Math.PI) / 180;

  const startLat = toRad(lat1);
  const startLon = toRad(lon1);
  const destLat = toRad(lat2);
  const destLon = toRad(lon2);

  const y = Math.sin(destLon - startLon) * Math.cos(destLat);
  const x =
    Math.cos(startLat) * Math.sin(destLat) -
    Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLon - startLon);

  let bearing = Math.atan2(y, x);
  bearing = ((bearing * 180) / Math.PI + 360) % 360; // Converter para graus

  return bearing;
}

/**
 * Calcula se um ponto está próximo de um segmento de rota
 * @param {Object} point - Ponto atual {lat, lon}
 * @param {Object} routeSegment - Segmento da rota [{lat, lon}, {lat, lon}]
 * @param {number} threshold - Distância máxima considerada "próxima" (metros)
 * @returns {boolean} Se o ponto está próximo ao segmento
 */
export function isPointNearRouteSegment(point, routeSegment, threshold = 30) {
  const [start, end] = routeSegment;

  // Calcular distâncias
  const distanceToStart = calculateDistance(
    point.lat,
    point.lon,
    start.lat,
    start.lon
  );

  const distanceToEnd = calculateDistance(
    point.lat,
    point.lon,
    end.lat,
    end.lon
  );

  const segmentLength = calculateDistance(
    start.lat,
    start.lon,
    end.lat,
    end.lon
  );

  // Se o ponto está além do segmento, verificar a distância direta
  if (
    distanceToStart > segmentLength + threshold ||
    distanceToEnd > segmentLength + threshold
  ) {
    return Math.min(distanceToStart, distanceToEnd) <= threshold;
  }

  // Calcular distância perpendicular ao segmento
  // Usando a fórmula de distância de ponto a linha
  const a = distanceToStart;
  const b = distanceToEnd;
  const c = segmentLength;

  // Se o segmento é muito curto, usar a distância direta
  if (c < 1) return Math.min(a, b) <= threshold;

  // Calcular altura do triângulo usando a fórmula de Heron
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const height = (2 * area) / c;

  return height <= threshold;
}

/**
 * Estima o tempo de chegada com base na distância e velocidade
 * @param {number} distance - Distância em metros
 * @param {number} speed - Velocidade em metros/segundo
 * @returns {number} Tempo estimado em segundos
 */
export function estimateArrivalTime(distance, speed) {
  if (!speed || speed <= 0) {
    // Velocidade média de caminhada de 1.4 m/s (5 km/h)
    speed = 1.4;
  }

  return distance / speed;
}

/**
 * Calcula a progressão da rota com base na posição atual
 * @param {Object} currentPosition - Posição atual {lat, lon}
 * @param {Array} routeCoordinates - Coordenadas da rota [{lat, lon}, ...]
 * @param {number} totalDistance - Distância total da rota
 * @returns {Object} Informações de progresso
 */
export function calculateRouteProgress(
  currentPosition,
  routeCoordinates,
  totalDistance
) {
  if (!currentPosition || !routeCoordinates || !routeCoordinates.length) {
    return {
      progress: 0,
      distanceTraveled: 0,
      distanceRemaining: totalDistance || 0,
      isOffRoute: false,
      nearestSegmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let cumulativeDistance = 0;
  let isOffRoute = true;

  // Encontrar o segmento mais próximo da posição atual
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const segment = [routeCoordinates[i], routeCoordinates[i + 1]];

    // Verificar se o ponto está próximo a este segmento
    const isNear = isPointNearRouteSegment(
      currentPosition,
      segment,
      30 // Threshold de 30 metros
    );

    if (isNear) {
      isOffRoute = false;

      // Calcular distância da posição atual ao início do segmento
      const distance = calculateDistance(
        currentPosition.lat,
        currentPosition.lon,
        segment[0].lat,
        segment[0].lon
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestSegmentIndex = i;
      }
    }

    // Calcular distância cumulativa até este segmento
    if (i < nearestSegmentIndex) {
      cumulativeDistance += calculateDistance(
        routeCoordinates[i].lat,
        routeCoordinates[i].lon,
        routeCoordinates[i + 1].lat,
        routeCoordinates[i + 1].lon
      );
    }
  }

  // Calcular distâncias
  const distanceTraveled = Math.min(cumulativeDistance, totalDistance);
  const distanceRemaining = Math.max(0, totalDistance - distanceTraveled);

  // Calcular progresso como porcentagem
  const progress =
    totalDistance > 0 ? (distanceTraveled / totalDistance) * 100 : 0;

  return {
    progress: Math.min(100, Math.max(0, progress)), // Garantir entre 0-100%
    distanceTraveled,
    distanceRemaining,
    isOffRoute,
    nearestSegmentIndex,
  };
}

/**
 * Verifica se o usuário está se aproximando de uma instrução
 * @param {Object} userLocation - Localização atual {lat, lon}
 * @param {Object} instructionLocation - Localização da instrução {lat, lon}
 * @param {number} threshold - Distância de proximidade (metros)
 * @returns {boolean} Se está próximo da instrução
 */
export function isNearInstruction(
  userLocation,
  instructionLocation,
  threshold = 50
) {
  if (!userLocation || !instructionLocation) return false;

  const distance = calculateDistance(
    userLocation.lat,
    userLocation.lon,
    instructionLocation.lat,
    instructionLocation.lon
  );

  return distance <= threshold;
}

/**
 * Verifica se o usuário chegou ao destino
 * @param {Object} userLocation - Localização atual {lat, lon}
 * @param {Object} destination - Destino {lat, lon}
 * @param {number} threshold - Distância considerada como chegada (metros)
 * @returns {boolean} Se chegou ao destino
 */
export function hasArrived(userLocation, destination, threshold = 15) {
  if (!userLocation || !destination) return false;

  const distance = calculateDistance(
    userLocation.lat,
    userLocation.lon,
    destination.lat,
    destination.lon
  );

  return distance <= threshold;
}

/**
 * Converte um ângulo de direção (0-360) para uma direção cardeal (N, NE, E, etc.)
 * @param {number} bearing - Ângulo em graus (0-360)
 * @returns {string} Direção cardeal
 */
export function bearingToCardinal(bearing) {
  const directions = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Calcula o ponto mais próximo em uma linha (rota) para um ponto de referência
 * @param {Array<Array<number>>} routePoints - Array de pontos [lat, lon] da rota
 * @param {number} refLat - Latitude do ponto de referência
 * @param {number} refLon - Longitude do ponto de referência
 * @returns {Object} Ponto mais próximo e distância
 */
export function findClosestPointOnRoute(routePoints, refLat, refLon) {
  let minDist = Infinity;
  let closestPoint = null;
  let closestIndex = -1;

  for (let i = 0; i < routePoints.length; i++) {
    const [lat, lon] = routePoints[i];
    const dist = calculateDistance(refLat, refLon, lat, lon);

    if (dist < minDist) {
      minDist = dist;
      closestPoint = [lat, lon];
      closestIndex = i;
    }
  }

  return {
    point: closestPoint,
    distance: minDist,
    index: closestIndex,
  };
}

export default {
  calculateDistance,
  calculateBearing,
  bearingToCardinal,
  findClosestPointOnRoute,
};
