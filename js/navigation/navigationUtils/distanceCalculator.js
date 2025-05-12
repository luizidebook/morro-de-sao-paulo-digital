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
 * Calcula uma rota entre dois pontos usando a API de roteamento
 * @param {Array} start - Coordenadas de início [longitude, latitude]
 * @param {Array} end - Coordenadas de destino [longitude, latitude]
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} - Objeto GeoJSON com a rota
 */
export async function calculateRoute(start, end, options = {}) {
  console.log("[calculateRoute] Calculando rota:", { start, end, options });

  try {
    // Parâmetros padrão
    const defaultOptions = {
      profile: "foot-walking",
      format: "geojson",
      instructions: true,
      language: "pt",
    };

    // Mesclar opções
    const finalOptions = { ...defaultOptions, ...options };

    // URL da API de roteamento (substitua pela API real em uso)
    // Exemplo usando OpenRouteService
    const apiKey = "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3"; // Substitua pela sua chave da API
    const baseUrl = "https://api.openrouteservice.org/v2/directions";

    // Construir URL
    const url = `${baseUrl}/${finalOptions.profile}/geojson`;

    // Preparar corpo da requisição
    const body = {
      coordinates: [start, end],
      language: finalOptions.language,
      instructions: finalOptions.instructions,
      elevation: false,
      continue_straight: true,
      preference: "shortest",
    };

    // Fazer requisição
    console.log("[calculateRoute] Enviando requisição:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
    });

    // Verificar se a requisição foi bem-sucedida
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erro na API (${response.status}): ${
          errorData.message || response.statusText
        }`
      );
    }

    // Processar resposta
    const data = await response.json();
    console.log("[calculateRoute] Rota calculada com sucesso");

    return data;
  } catch (error) {
    console.error("[calculateRoute] Erro ao calcular rota:", error);

    // Se for um erro de API, tentar usar API de fallback
    if (error.message.includes("Erro na API")) {
      console.log("[calculateRoute] Tentando API de fallback...");
      return calculateRouteFallback(start, end, options);
    }

    throw error;
  }
}

/**
 * Implementação de fallback para cálculo de rota
 * @param {Array} start - Coordenadas de início [longitude, latitude]
 * @param {Array} end - Coordenadas de destino [longitude, latitude]
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} - Objeto GeoJSON com a rota
 */
async function calculateRouteFallback(start, end, options = {}) {
  console.log("[calculateRouteFallback] Usando rota de fallback");

  try {
    // Criar uma rota simples (linha reta)
    const route = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [start, end],
          },
          properties: {
            summary: {
              distance: calculateDistanceFromCoords(
                start[1],
                start[0],
                end[1],
                end[0]
              ),
              duration: 600, // 10 minutos como estimativa
            },
            segments: [
              {
                steps: [
                  {
                    instruction: "Siga em direção ao destino",
                    distance: calculateDistanceFromCoords(
                      start[1],
                      start[0],
                      end[1],
                      end[0]
                    ),
                    duration: 600,
                    type: 0,
                    way_points: [0, 1],
                  },
                  {
                    instruction: `Chegou ao seu destino`,
                    distance: 0,
                    duration: 0,
                    type: 10,
                    way_points: [1, 1],
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    return route;
  } catch (error) {
    console.error("[calculateRouteFallback] Erro no fallback:", error);
    throw new Error("Não foi possível calcular a rota");
  }
}

/**
 * Calcula a distância entre dois pontos em coordenadas (latitude, longitude)
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} - Distância em metros
 */
function calculateDistanceFromCoords(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;

  function toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }
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

  bearingToCardinal,
  findClosestPointOnRoute,
};
