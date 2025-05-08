/**
 * Atualiza a navegação em tempo real com base na posição do usuário
 * @param {Object} [userPos=null] - Posição atual do usuário (opcional)
 */
export function updateRealTimeNavigation(userPos = null) {
  // Usar o parâmetro se fornecido, caso contrário usar a variável global
  const currentPos = userPos || userLocation;

  // Validação mais rigorosa
  if (!currentPos) {
    console.warn("[updateRealTimeNavigation] Posição indefinida");
    return;
  }

  if (typeof currentPos !== "object") {
    console.error(
      "[updateRealTimeNavigation] Tipo inválido de posição:",
      typeof currentPos
    );
    return;
  }

  if (
    !currentPos.latitude ||
    !currentPos.longitude ||
    isNaN(currentPos.latitude) ||
    isNaN(currentPos.longitude) ||
    Math.abs(currentPos.latitude) > 90 ||
    Math.abs(currentPos.longitude) > 180
  ) {
    console.warn(
      "[updateRealTimeNavigation] Posição com coordenadas inválidas:",
      currentPos
    );
    return;
  }

  console.log("[updateRealTimeNavigation] Atualizando com posição:", {
    lat: currentPos.latitude,
    lon: currentPos.longitude,
    accuracy: currentPos.accuracy || "N/A",
  });

  const instructions = navigationState.instructions;
  if (!instructions || instructions.length === 0) return;

  // Se não houver mudança significativa na posição, ignorar atualização
  if (navigationState.lastProcessedPosition) {
    const MOVEMENT_THRESHOLD = 3; // Metros (reduzido para maior sensibilidade)
    const distanceMoved = calculateDistance(
      currentPos.latitude,
      currentPos.longitude,
      navigationState.lastProcessedPosition.latitude,
      navigationState.lastProcessedPosition.longitude
    );

    // Verificar quando foi a última atualização
    const now = Date.now();
    const lastUpdateTime = navigationState.lastUpdateTime || 0;
    const timeSinceLastUpdate = now - lastUpdateTime;
    const FORCE_UPDATE_INTERVAL = 10000; // 10 segundos

    // Forçar atualização se passou tempo suficiente, mesmo sem movimento
    if (
      distanceMoved < MOVEMENT_THRESHOLD &&
      timeSinceLastUpdate < FORCE_UPDATE_INTERVAL
    ) {
      console.log(
        "[updateRealTimeNavigation] Movimento insignificante, ignorando atualização"
      );
      return; // Ignorar atualizações muito próximas
    }

    // Atualizar timestamp da última atualização
    navigationState.lastUpdateTime = now;
  }

  // Determinar qual passo atual deve ser exibido
  const currentStepIndex = navigationState.currentStepIndex;
  let shouldUpdateStep = false;
  let nextStepIndex = currentStepIndex;

  // Verificar se já passou do passo atual
  if (currentStepIndex < instructions.length - 1) {
    const currentStep = instructions[currentStepIndex];
    const nextStep = instructions[currentStepIndex + 1];

    if (currentStep && nextStep) {
      // Extrair coordenadas do próximo passo com mais robustez
      const nextStepLat =
        nextStep.latitude ||
        nextStep.lat ||
        (nextStep.location && nextStep.location[0]) ||
        (nextStep.coordinates && nextStep.coordinates[0]);

      const nextStepLon =
        nextStep.longitude ||
        nextStep.lon ||
        nextStep.lng ||
        (nextStep.location && nextStep.location[1]) ||
        (nextStep.coordinates && nextStep.coordinates[1]);

      // Imprimir valores para diagnóstico
      console.log("[updateRealTimeNavigation] Extraindo coordenadas:", {
        nextStep: {
          original: nextStep,
          lat: nextStepLat,
          lon: nextStepLon,
        },
        currentPos: {
          lat: currentPos.latitude,
          lon: currentPos.longitude,
        },
      });

      // Verificar validade explicitamente
      if (
        nextStepLat !== undefined &&
        nextStepLat !== null &&
        !isNaN(parseFloat(nextStepLat)) &&
        nextStepLon !== undefined &&
        nextStepLon !== null &&
        !isNaN(parseFloat(nextStepLon)) &&
        currentPos.latitude !== undefined &&
        !isNaN(parseFloat(currentPos.latitude)) &&
        currentPos.longitude !== undefined &&
        !isNaN(parseFloat(currentPos.longitude))
      ) {
        // ADICIONAR: Calcular o ângulo para o próximo passo
        const bearing = calculateBearing(
          parseFloat(currentPos.latitude),
          parseFloat(currentPos.longitude),
          parseFloat(nextStepLat),
          parseFloat(nextStepLon)
        );

        // MODIFICAÇÃO: Passar o ângulo já corrigido para evitar dupla correção
        const correctedBearing = (bearing + 180) % 360;

        // ADICIONAR: Atualizar o marcador com a orientação para o próximo passo
        updateUserMarker(
          currentPos.latitude,
          currentPos.longitude,
          correctedBearing, // Usar o ângulo já corrigido
          currentPos.accuracy || 15
        );

        console.log(
          `[updateRealTimeNavigation] Marcador orientado para próximo passo: ${bearing.toFixed(
            1
          )}°`
        );

        // Resto do código existente (cálculo de distância, etc.)
        // Converter explicitamente para números para garantir operações matemáticas corretas
        const lat1 = parseFloat(currentPos.latitude);
        const lon1 = parseFloat(currentPos.longitude);
        const lat2 = parseFloat(nextStepLat);
        const lon2 = parseFloat(nextStepLon);

        const distanceToNextStep = calculateDistance(lat1, lon1, lat2, lon2);

        console.log(
          `[updateRealTimeNavigation] Distância até próximo passo: ${distanceToNextStep.toFixed(
            1
          )}m`
        );

        // Monitorar aproximação de curvas
        monitorApproachingTurn(currentPos, nextStep, distanceToNextStep);

        // Se estiver próximo ao próximo passo (menos de 20 metros), avançar
        if (distanceToNextStep <= 20) {
          nextStepIndex = currentStepIndex + 1;
          shouldUpdateStep = true;
          console.log(
            "[updateRealTimeNavigation] Próximo do passo seguinte, avançando instruções"
          );
        }
      } else {
        console.warn(
          "[updateRealTimeNavigation] Dados de coordenadas inválidos:",
          {
            nextStep: nextStep,
            currentPos: {
              latitude: currentPos.latitude,
              longitude: currentPos.longitude,
            },
          }
        );
      }
    }
  }
  // Se chegou ao último passo, verificar proximidade com o destino final
  if (nextStepIndex === instructions.length - 1) {
    const destination = navigationState.selectedDestination;
    if (destination) {
      checkDestinationArrival(currentPos.latitude, currentPos.longitude);
    }
  }

  // Atualizar o passo se necessário
  if (shouldUpdateStep || navigationState.currentStepIndex !== nextStepIndex) {
    navigationState.currentStepIndex = nextStepIndex;
    displayNavigationStep(instructions[nextStepIndex]);
  }

  // Atualizar sempre a posição do marcador do usuário
  updateUserMarker(
    currentPos.latitude,
    currentPos.longitude,
    currentPos.heading
  );

  // CORREÇÃO: Calcular distância restante e tempo explicitamente
  const remainingDistance = calculateRouteRemainingDistance(
    currentPos,
    instructions,
    navigationState.currentStepIndex
  );
  const remainingTime = estimateRemainingTime(remainingDistance);

  // Atualizações mais frequentes do banner
  if (instructions[navigationState.currentStepIndex]) {
    let currentInstruction = {
      ...instructions[navigationState.currentStepIndex],
    };

    // Obter dados da rota completa para calcular progresso
    const routeData = navigationState.routeData || getLastSavedRouteData();
    const totalDistance =
      routeData && routeData.properties
        ? routeData.properties.summary.distance
        : 500; // Valor padrão se não houver dados

    // CORREÇÃO: Adicionar métricas atualizadas com tratamento de erro
    currentInstruction.remainingDistance = formatDistance(remainingDistance);
    currentInstruction.estimatedTime = formatDuration(remainingTime);
    currentInstruction.progress = calculateRouteProgress(
      remainingDistance,
      totalDistance
    );

    console.log("[updateRealTimeNavigation] Banner atualizado com métricas:", {
      distância: currentInstruction.remainingDistance,
      tempo: currentInstruction.estimatedTime,
      progresso: currentInstruction.progress + "%",
    });

    // Atualizar o banner com os dados atualizados
    updateInstructionBanner(currentInstruction);
  }

  // Atualizar a última posição processada
  navigationState.lastProcessedPosition = {
    latitude: currentPos.latitude,
    longitude: currentPos.longitude,
    accuracy: currentPos.accuracy,
    heading: currentPos.heading,
  };
}
