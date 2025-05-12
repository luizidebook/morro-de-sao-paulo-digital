import { navigationState } from "../navigationState/navigationStateManager.js";
import { map } from "../../map/map-controls.js";
import { formatDistance } from "../../navigation/navigationInstructions/routeProcessor.js";
import {
  estimateRemainingTime,
  formatDuration,
} from "../navigationController/navigationController.js";
import { updateInstructionBanner } from "../navigationUi/bannerUI.js";

/**
 * Atualiza a visualização da rota, apagando o caminho já percorrido
 * @param {Object} currentPosition - Posição atual do usuário
 * @param {Array} routeCoordinates - Coordenadas completas da rota
 * @param {number} progress - Progresso atual (0-100%)
 * @param {Function} progressUpdater - Função para atualizar a barra de progresso
 */
export function updateRouteDisplay(
  currentPosition,
  routeCoordinates,
  progress,
  progressUpdater
) {
  try {
    // Se não existe rota ou posição, não fazer nada
    if (!routeCoordinates || !routeCoordinates.length || !currentPosition) {
      console.warn(
        "[updateRouteDisplay] Dados insuficientes para atualizar rota"
      );
      return;
    }

    // Verificar se o mapa está disponível
    if (typeof map === "undefined" || !map) {
      console.error("[updateRouteDisplay] Mapa não disponível");
      return;
    }

    // Converter coordenadas para formato esperado pelo Leaflet
    const normalizedRoute = routeCoordinates.map((coord) => {
      if (Array.isArray(coord)) return coord;
      return [coord.lat || coord.latitude, coord.lng || coord.longitude];
    });

    // Encontrar o ponto mais próximo da rota
    const closestPointIndex = findClosestPointOnRoute(
      [currentPosition.latitude, currentPosition.longitude],
      normalizedRoute
    );

    if (closestPointIndex === -1) {
      console.warn(
        "[updateRouteDisplay] Não foi possível encontrar ponto próximo na rota"
      );
      return;
    }

    // Dividir a rota em duas partes: concluída e restante
    const completedRoute = normalizedRoute.slice(0, closestPointIndex + 1);
    const remainingRoute = normalizedRoute.slice(closestPointIndex);

    // Juntar o último ponto concluído com a posição atual para continuidade
    completedRoute.push([currentPosition.latitude, currentPosition.longitude]);

    // Remover rota anterior
    if (window.currentRoute) {
      map.removeLayer(window.currentRoute);
    }

    if (window.completedRoute) {
      map.removeLayer(window.completedRoute);
    }

    // Adicionar rota concluída com estilo diferente (mais fraca/apagada)
    window.completedRoute = L.polyline(completedRoute, {
      color: "#bbbbbb", // Cinza claro
      weight: 4,
      opacity: 0.6,
      lineCap: "round",
      lineJoin: "round",
      dashArray: "5,10", // Linha tracejada
    }).addTo(map);

    // Adicionar rota restante
    window.currentRoute = L.polyline(remainingRoute, {
      color: "#3b82f6", // Azul original
      weight: 5,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Usar o callback fornecido para atualizar a barra de progresso
    if (typeof progressUpdater === "function") {
      progressUpdater(progress);
    } else {
      console.warn(
        "[updateRouteDisplay] Função progressUpdater não disponível"
      );
    }

    return true;
  } catch (error) {
    console.error("[updateRouteDisplay] Erro ao atualizar rota:", error);
    return false;
  }
}

/**
 * Atualiza as instruções de navegação baseadas na posição atual
 * @param {Object} position - Posição atual do usuário
 */
export function updateNavigationInstructions(position) {
  if (!position || !navigationState || !navigationState.isActive) {
    return;
  }

  const instructions = navigationState.instructions;
  if (!Array.isArray(instructions) || instructions.length === 0) {
    return;
  }

  const currentIndex = navigationState.currentStepIndex || 0;
  const currentInstruction = instructions[currentIndex];

  if (!currentInstruction) {
    return;
  }

  try {
    // Verificar se já temos coordenadas da instrução atual
    const hasCoords = !!(
      (currentInstruction.latitude || currentInstruction.lat) &&
      (currentInstruction.longitude ||
        currentInstruction.lon ||
        currentInstruction.lng)
    );

    if (!hasCoords) {
      console.warn(
        "[updateNavigationInstructions] Instrução sem coordenadas:",
        currentIndex
      );
      return;
    }

    // Calcular distância até a próxima instrução
    const lat = currentInstruction.latitude || currentInstruction.lat;
    const lon =
      currentInstruction.longitude ||
      currentInstruction.lon ||
      currentInstruction.lng;

    // Distância até o ponto atual da instrução
    const distanceToInstruction = calculateDistance(
      position.latitude,
      position.longitude,
      lat,
      lon
    );

    // Atualizar a distância no banner
    const formattedDistance = formatDistance(distanceToInstruction);

    // Obter o tempo estimado para esta distância (considera velocidade média de caminhada)
    const estimatedTime = estimateRemainingTime(distanceToInstruction);
    const formattedTime = formatDuration(estimatedTime);

    // Atualizar banner com informação de distância
    updateInstructionBanner({
      instruction:
        currentInstruction.simplifiedInstruction ||
        currentInstruction.instruction,
      type:
        currentInstruction.type ||
        getInstructionType(currentInstruction.instruction),
      remainingDistance: formattedDistance,
      estimatedTime: formattedTime,
    });

    // Verificar se estamos perto o suficiente para avançar para a próxima instrução
    // (tipicamente 15m, mas pode variar com base na precisão do GPS)
    const proximityThreshold = position.accuracy
      ? Math.max(15, position.accuracy * 0.8)
      : 15;

    if (distanceToInstruction <= proximityThreshold) {
      // Só avança se houver uma próxima instrução disponível
      if (currentIndex < instructions.length - 1) {
        console.log(
          `[updateNavigationInstructions] Chegou próximo à instrução ${currentIndex}, avançando para próxima`
        );
        navigationState.currentStepIndex = currentIndex + 1;

        // Mostrar próxima instrução
        const nextInstruction = instructions[currentIndex + 1];
        if (nextInstruction) {
          displayNavigationStep(nextInstruction, true);
        }
      }
    }
  } catch (error) {
    console.error(
      "[updateNavigationInstructions] Erro ao atualizar instruções:",
      error
    );
  }
}
/**
 * Garante que todas as instruções tenham coordenadas válidas
 * @param {Array} instructions - Array de instruções da rota
 * @param {Object} routeData - Dados completos da rota
 * @returns {Array} Instruções com coordenadas garantidas
 */
export function ensureCoordinatesInInstructions(instructions, routeData) {
  if (!instructions || !instructions.length) return [];

  // Se não temos dados da rota, fazer o melhor com o que temos
  if (!routeData) return instructions;

  // Extrair geometria da rota
  const geometry = routeData.features?.[0]?.geometry;
  if (!geometry || !geometry.coordinates || !geometry.coordinates.length) {
    return instructions;
  }

  // Converter coordenadas da geometria: [lon, lat] para [lat, lon]
  const routePoints = geometry.coordinates.map((coord) => [coord[1], coord[0]]);

  return instructions.map((instruction, index) => {
    // Se já tem coordenadas válidas, manter como está
    if (instruction.latitude && instruction.longitude) {
      return instruction;
    }

    // Tentar extrair de way_points se disponível
    if (
      Array.isArray(instruction.way_points) &&
      instruction.way_points.length
    ) {
      const pointIndex = instruction.way_points[0];
      const coord = geometry.coordinates[pointIndex];
      if (coord) {
        return {
          ...instruction,
          latitude: coord[1],
          longitude: coord[0],
        };
      }
    }

    // Último recurso: distribuir ao longo da rota
    const position = index / instructions.length;
    const pointIndex = Math.floor(position * routePoints.length);
    const point = routePoints[Math.min(pointIndex, routePoints.length - 1)];

    return {
      ...instruction,
      latitude: point[0],
      longitude: point[1],
    };
  });
}

/**
 * Monitora a aproximação de curvas e fornece feedback progressivamente mais intenso
 * @param {Object} userLocation - Localização atual do usuário
 * @param {Object} nextTurn - Dados da próxima curva
 * @param {number} distance - Distância em metros até a curva
 * @param {Object} options - Opções adicionais
 */
export function monitorApproachingTurn(
  userLocation,
  nextTurn,
  distance,
  options = {}
) {
  if (!nextTurn || !distance) return;

  // Identificador único para esta curva
  const turnId = `${nextTurn.latitude || nextTurn.lat}-${
    nextTurn.longitude || nextTurn.lon
  }`;

  // Criar objeto para rastrear notificações se não existir
  if (!navigationState.notifiedTurns) {
    navigationState.notifiedTurns = {};
  }

  // Determinar tipo de curva para ajustar a notificação
  const turnType = nextTurn.type || getInstructionType(nextTurn.instruction);
  const isSignificantTurn = [2, 3, 4, 6, 7, 8].includes(turnType); // curvas significativas

  // Distâncias de alerta ajustadas pelo tipo de curva
  const alertDistance = isSignificantTurn ? 100 : 80;
  const warningDistance = isSignificantTurn ? 50 : 40;
  const immediateDistance = isSignificantTurn ? 20 : 15;

  // Feedback progressivo baseado na distância
  if (distance < alertDistance && distance >= warningDistance) {
    // Primeiro alerta suave
    if (!navigationState.notifiedTurns[turnId]?.level1) {
      console.log(
        `[monitorApproachingTurn] Aproximando-se de curva (${distance.toFixed(
          0
        )}m)`
      );

      // Visual: destacar suavemente o banner
      if (typeof highlightBanner === "function") {
        highlightBanner("approaching");
      }

      // Feedback tátil suave
      if (navigator.vibrate && !options.disableVibration) {
        navigator.vibrate(80);
      }

      // Marcar como notificado neste nível
      navigationState.notifiedTurns[turnId] = {
        ...navigationState.notifiedTurns[turnId],
        level1: true,
      };
    }
  } else if (distance < warningDistance && distance >= immediateDistance) {
    // Alerta intermediário
    if (!navigationState.notifiedTurns[turnId]?.level2) {
      console.log(
        `[monitorApproachingTurn] Curva próxima (${distance.toFixed(0)}m)`
      );

      // Visual: destacar o banner
      if (typeof highlightBanner === "function") {
        highlightBanner("imminent");
      }

      // Feedback tátil mais forte
      if (navigator.vibrate && !options.disableVibration) {
        navigator.vibrate([80, 50, 80]);
      }

      // Anunciar por voz
      if (typeof speak === "function" && !options.disableVoice) {
        const instruction =
          nextTurn.simplifiedInstruction || "Prepare-se para virar";
        speak(`Em ${Math.round(distance)} metros, ${instruction}`);
      }

      // Atualizar marcadores
      navigationState.notifiedTurns[turnId] = {
        ...navigationState.notifiedTurns[turnId],
        level1: true,
        level2: true,
      };
    }
  } else if (distance < immediateDistance) {
    // Alerta imediato
    if (!navigationState.notifiedTurns[turnId]?.level3) {
      console.log(
        `[monitorApproachingTurn] Execute a manobra agora! (${distance.toFixed(
          0
        )}m)`
      );

      // Visual: destacar intensamente
      if (typeof highlightBanner === "function") {
        highlightBanner("now");
      }

      // Feedback tátil forte
      if (navigator.vibrate && !options.disableVibration) {
        navigator.vibrate([150, 100, 150]);
      }

      // Anunciar por voz com urgência
      if (typeof speak === "function" && !options.disableVoice) {
        const instruction = nextTurn.simplifiedInstruction || "Vire agora";
        speak(instruction, { priority: "high" });
      }

      // Atualizar marcadores
      navigationState.notifiedTurns[turnId] = {
        ...navigationState.notifiedTurns[turnId],
        level1: true,
        level2: true,
        level3: true,
      };
    }
  }
}

/**
 * Extrai coordenadas de um objeto GeoJSON de rota
 * @param {Object} routeData - Dados GeoJSON da rota
 * @returns {Array} Array de coordenadas normalizadas no formato [{lat, lng}]
 */
function extractRouteCoordinates(routeData) {
  try {
    // Verificar validade dos dados
    if (!routeData || !routeData.features || !routeData.features.length) {
      console.warn(
        "[extractRouteCoordinates] Dados de rota inválidos ou vazios"
      );
      return [];
    }

    // Obter a geometria da rota (primeiro feature)
    const feature = routeData.features[0];

    if (!feature.geometry || !feature.geometry.coordinates) {
      console.warn("[extractRouteCoordinates] Geometria ausente ou inválida");
      return [];
    }

    const coordinates = feature.geometry.coordinates;

    // Verificar se temos coordenadas
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      console.warn("[extractRouteCoordinates] Array de coordenadas vazio");
      return [];
    }

    // Normalizar as coordenadas para o formato {lat, lng}
    // GeoJSON usa [longitude, latitude], precisamos inverter para [latitude, longitude]
    const normalizedCoordinates = coordinates
      .map((coord) => {
        if (!Array.isArray(coord) || coord.length < 2) {
          console.warn(
            "[extractRouteCoordinates] Ponto de coordenada inválido:",
            coord
          );
          return null;
        }

        return {
          lat: coord[1],
          lng: coord[0],
        };
      })
      .filter((coord) => coord !== null); // Remover pontos inválidos

    console.log(
      `[extractRouteCoordinates] Extraídas ${normalizedCoordinates.length} coordenadas da rota`
    );

    return normalizedCoordinates;
  } catch (error) {
    console.error(
      "[extractRouteCoordinates] Erro ao extrair coordenadas:",
      error
    );
    return [];
  }
}

// Garantir que a função seja exportada
export { extractRouteCoordinates };

/**
 * Encontra o ponto mais próximo em uma rota a partir de uma posição dada
 * @param {Array} position - Posição atual [latitude, longitude]
 * @param {Array} route - Array de pontos da rota, cada um como [latitude, longitude]
 * @returns {number} - Índice do ponto mais próximo no array da rota, ou -1 se não encontrado
 */
export function findClosestPointOnRoute(position, route) {
  try {
    // Verificações de segurança
    if (
      !position ||
      position.length < 2 ||
      !Array.isArray(route) ||
      route.length === 0
    ) {
      console.warn("[findClosestPointOnRoute] Parâmetros inválidos:", {
        position,
        routeLength: route?.length || 0,
      });
      return -1;
    }

    // Extrair coordenadas da posição atual
    const [currentLat, currentLon] = position;

    // Verificar validade das coordenadas
    if (!isValidCoordinate(currentLat, currentLon)) {
      console.warn(
        "[findClosestPointOnRoute] Coordenadas de posição inválidas"
      );
      return -1;
    }

    // Encontrar o ponto mais próximo
    let closestPointIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < route.length; i++) {
      const point = route[i];

      // Verificar formato do ponto (pode ser [lat, lon] ou {lat, lng})
      const pointLat = Array.isArray(point)
        ? point[0]
        : point.lat || point.latitude;
      const pointLon = Array.isArray(point)
        ? point[1]
        : point.lng || point.lon || point.longitude;

      // Pular pontos inválidos
      if (!isValidCoordinate(pointLat, pointLon)) {
        continue;
      }

      // Calcular distância Haversine
      const distance = calculateDistance(
        currentLat,
        currentLon,
        pointLat,
        pointLon
      );

      // Atualizar se encontrarmos um ponto mais próximo
      if (distance < minDistance) {
        minDistance = distance;
        closestPointIndex = i;
      }
    }

    return closestPointIndex;
  } catch (error) {
    console.error("[findClosestPointOnRoute] Erro:", error);
    return -1;
  }
}
/**
 * Determina o próximo ponto relevante para orientação do marcador
 * @param {Object} currentPosition - Posição atual do usuário
 * @param {Array} instructions - Array de instruções da navegação
 * @param {number} currentStepIndex - Índice atual na lista de instruções
 * @returns {Object|null} - Próximo ponto {latitude, longitude} ou null se não encontrado
 */
export function determineNextPoint(
  currentPosition,
  instructions,
  currentStepIndex
) {
  // Verificações de segurança
  if (
    !currentPosition ||
    !Array.isArray(instructions) ||
    instructions.length === 0
  ) {
    return null;
  }

  // Garantir que o índice é válido
  const index = Math.max(
    0,
    Math.min(instructions.length - 1, currentStepIndex)
  );

  try {
    // Tentar usar o próximo ponto de instrução se houver
    if (index + 1 < instructions.length) {
      const nextInstruction = instructions[index + 1];
      if (nextInstruction) {
        // Extrair coordenadas (considerando diferentes formatos)
        const lat = nextInstruction.latitude || nextInstruction.lat;
        const lon =
          nextInstruction.longitude ||
          nextInstruction.lon ||
          nextInstruction.lng;

        if (isValidCoordinate(lat, lon)) {
          return { latitude: lat, longitude: lon };
        }
      }
    }

    // Se não tiver próximo ponto ou for inválido, usar o ponto atual da instrução
    const currentInstruction = instructions[index];
    if (currentInstruction) {
      const lat = currentInstruction.latitude || currentInstruction.lat;
      const lon =
        currentInstruction.longitude ||
        currentInstruction.lon ||
        currentInstruction.lng;

      if (isValidCoordinate(lat, lon)) {
        return { latitude: lat, longitude: lon };
      }
    }

    // Se nada funcionar e tivermos um destino final, usar ele
    const lastInstruction = instructions[instructions.length - 1];
    if (lastInstruction) {
      const lat = lastInstruction.latitude || lastInstruction.lat;
      const lon =
        lastInstruction.longitude || lastInstruction.lon || lastInstruction.lng;

      if (isValidCoordinate(lat, lon)) {
        return { latitude: lat, longitude: lon };
      }
    }

    // Nenhum ponto válido encontrado
    return null;
  } catch (error) {
    console.error(
      "[determineNextPoint] Erro ao determinar próximo ponto:",
      error
    );
    return null;
  }
}

/**
 * Verifica se as coordenadas são válidas
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - Se as coordenadas são válidas
 */
function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    !isNaN(lat) &&
    typeof lon === "number" &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Calcula a distância entre dois pontos geográficos usando Haversine
 * @param {number} lat1 - Latitude do primeiro ponto
 * @param {number} lon1 - Longitude do primeiro ponto
 * @param {number} lat2 - Latitude do segundo ponto
 * @param {number} lon2 - Longitude do segundo ponto
 * @returns {number} - Distância em metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
