/**
 * Atualiza a visualização da rota, apagando o caminho já percorrido
 * @param {Object} currentPosition - Posição atual do usuário
 * @param {Array} routeCoordinates - Coordenadas completas da rota
 * @param {number} progress - Progresso atual (0-100%)
 */
export function updateRouteDisplay(
  currentPosition,
  routeCoordinates,
  progress
) {
  // Se não existe rota ou posição, não fazer nada
  if (!routeCoordinates || !routeCoordinates.length || !currentPosition) return;

  // Converter coordenadas se necessário
  const normalizedRoute = routeCoordinates.map((coord) => {
    if (Array.isArray(coord)) return coord;
    return [coord.lat || coord.latitude, coord.lng || coord.longitude];
  });

  // Encontrar o ponto mais próximo da rota
  const closestPointIndex = findClosestPointOnRoute(
    [currentPosition.latitude, currentPosition.longitude],
    normalizedRoute
  );

  if (closestPointIndex === -1) return;

  // Dividir a rota em duas partes: concluída e restante
  const completedRoute = normalizedRoute.slice(0, closestPointIndex + 1);
  const remainingRoute = normalizedRoute.slice(closestPointIndex);

  // Juntar o último ponto concluído com a posição atual para continuidade
  completedRoute.push([currentPosition.latitude, currentPosition.longitude]);

  // Remover rota anterior
  if (window.currentRoute) {
    map.removeLayer(window.currentRoute);
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

  // Atualizar barra de progresso
  updateProgressBar(progress);
}

/**
 * Atualiza as instruções de navegação baseadas na posição atual
 * @param {Object} position - Posição atual do usuário
 */
export function updateNavigationInstructions(position) {
  if (!position || !navigationState.isActive) return;

  const instructions = navigationState.instructions;
  if (!instructions || !instructions.length) return;

  const currentStepIndex = navigationState.currentStepIndex;
  let nextStepIndex = currentStepIndex + 1;

  // Verificar se chegamos no final das instruções
  if (nextStepIndex >= instructions.length) {
    checkDestinationArrival(position.latitude, position.longitude);
    return;
  }

  const nextStep = instructions[nextStepIndex];
  if (!nextStep) return;

  // Calcular distância até a próxima instrução
  const distanceToNextStep = calculateDistance(
    position.latitude,
    position.longitude,
    nextStep.latitude || nextStep.lat,
    nextStep.longitude || nextStep.lon || nextStep.lng
  );

  // Atualizar distância na instrução atual
  const currentStep = instructions[currentStepIndex];
  if (currentStep) {
    currentStep.formattedDistance = formatDistance(distanceToNextStep);
    currentStep.remainingDistance = distanceToNextStep;

    // Atualizar o banner com dados atualizados
    updateInstructionBanner(currentStep);
  }

  // Verificar se está próximo da próxima instrução para alertar o usuário
  if (distanceToNextStep <= 50) {
    // Destacar o banner se ainda não tiver sido destacado para esta instrução
    if (!navigationState.notifiedTurns[nextStepIndex]) {
      flashBanner(true);

      // Alerta sonoro ou vibratório
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      // Marcar como notificado
      navigationState.notifiedTurns[nextStepIndex] = true;

      // Alertar vocalmente se estiver muito próximo
      if (distanceToNextStep <= 20 && typeof speak === "function") {
        speak(
          nextStep.simplifiedInstruction || "Prepare-se para a próxima manobra"
        );
      }
    }
  }

  // Avançar para a próxima instrução se muito próximo
  if (distanceToNextStep <= 15) {
    navigationState.currentStepIndex = nextStepIndex;
    displayNavigationStep(nextStep, true);

    // Anunciar nova instrução
    if (typeof speak === "function") {
      speak(nextStep.simplifiedInstruction || "Nova manobra");
    }
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
export function extractRouteCoordinates(routeData) {
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
