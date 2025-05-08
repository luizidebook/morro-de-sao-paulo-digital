/**
 * Módulo de controle principal da navegação
 * Gerencia o fluxo completo de navegação, desde o início até o cancelamento,
 * bem como o monitoramento contínuo da posição do usuário.
 *
 * Versão unificada que combina as melhores partes de diferentes implementações.
 */

// Importações organizadas por categoria e ordem alfabética:

// Core modules
import { map, plotRouteOnMap } from "../../map/map-controls.js";
import {
  navigationState,
  getLastRouteData as getLastSavedRouteData,
  setLastRouteData,
} from "../navigationState/navigationStateManager.js";
import { processRouteInstructions } from "../navigationInstructions/routeProcessor.js";

// UI components
import {
  createNavigationBanner,
  flashBanner,
  hideInstructionBanner,
  showInstructionBanner,
  simplifyInstruction,
  updateInstructionBanner,
} from "../navigationUi/bannerUI.js";
import {
  initNavigationControls,
  setMapRotation,
} from "./navigationControls.js";
import { UI_CONFIG } from "../navigationUi/navigationConfig.js";

// Utilities
import { appendMessage } from "../../assistant/assistant.js";
import { getGeneralText } from "../../i18n/translatePageContent.js";
import { showNotification } from "../../utils/notifications.js";
import { speak } from "../../utils/voice/voiceSystem.js";
import { showNavigationLoading } from "../navigationUi/bannerUI.js";
// Location services
import {
  animateMapToLocalizationUser,
  positionWatcherId,
  startPositionTracking,
  updateUserMarker,
  userLocation,
} from "../navigationUserLocation/user-location.js";

// State management

// Variáveis de estado local
let recalculationInProgress = false;
let originalRoute = null; // Rota original para referência
// Substituir a função initializeMapPlugins por uma verificação mais simples
function checkPlugins() {
  console.log("[navigationController] Verificando plugins do mapa");

  // Verificar se o plugin está disponível
  const rotatePluginAvailable =
    typeof L !== "undefined" &&
    typeof L.Map.prototype.setBearing === "function";

  const markerRotateAvailable =
    typeof L !== "undefined" &&
    typeof L.Marker.prototype.setRotationAngle === "function";

  console.log("[navigationController] Status dos plugins:", {
    mapa: rotatePluginAvailable ? "Disponível" : "Ausente",
    marcador: markerRotateAvailable ? "Disponível" : "Ausente",
  });

  return rotatePluginAvailable && markerRotateAvailable;
}

/**
 * Inicia a navegação para um destino específico
 *
 * Fluxo completo:
 * 1. Validação do destino
 * 2. Obtenção/verificação da localização do usuário
 * 3. Preparação da interface (sem esconder assistente)
 * 4. Cálculo da rota
 * 5. Processamento das instruções
 * 6. Exibição da interface de navegação
 * 7. Início do monitoramento contínuo
 *
 * @param {Object} destination - Objeto do destino {lat, lon, name}
 * @returns {Promise<boolean>} - Indica se a navegação foi iniciada com sucesso
 */
export async function startNavigation(destination) {
  try {
    console.group("[startNavigation] Iniciando fluxo de navegação");

    // NOVO: Diagnóstico inicial para depurar problemas de rotação
    console.log("[startNavigation] Estado de rotação:", {
      mapDefinido: !!map,
      pluginMarcador:
        typeof L !== "undefined" &&
        typeof L.Marker.prototype.setRotationAngle === "function",
      pluginMapa:
        typeof L !== "undefined" &&
        typeof L.Map.prototype.setBearing === "function",
      navegacaoAtiva: navigationState.isActive,
      rotacaoAtivada: navigationState.isRotationEnabled,
    });

    console.log("1. Estado inicial", { destino: destination });

    // Verificar e cancelar qualquer navegação existente
    if (navigationState.isActive) {
      console.log(
        "[startNavigation] Cancelando navegação anterior antes de iniciar nova"
      );
      await cancelNavigation(false);
    }

    // Atualizar estado de navegação
    navigationState.isActive = true;
    navigationState.destination = destination;

    // Mostrar indicador de carregamento
    showNavigationLoading();
    console.log("2. Controles inicializados");

    // 1. Validar destino
    if (!validateDestination(destination)) {
      console.error("[startNavigation] Destino inválido:", destination);
      showNotification(
        getGeneralText("destination_missing", navigationState.lang),
        "error"
      );
      return false;
    }
    console.log("3. Destino validado");

    // 2. Salvar destino no estado global
    navigationState.selectedDestination = destination;

    // 3. Verificar se temos localização do usuário
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      try {
        // Tentar obter localização atual
        const position = await getCurrentLocation({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        });

        if (!position) {
          console.error(
            "[startNavigation] Não foi possível obter localização do usuário"
          );
          showNotification(
            getGeneralText("location_error", navigationState.lang),
            "error"
          );
          return false;
        }
      } catch (error) {
        console.error("[startNavigation] Erro ao obter localização:", error);
        showNotification(
          getGeneralText("location_error", navigationState.lang),
          "error"
        );
        return false;
      }
    }

    // 4. Mostrar indicador de carregamento
    showNavigationLoading(
      getGeneralText("calculating_route", navigationState.lang)
    );

    // 5. Calcular a rota
    // Verificar se temos uma rota existente primeiro
    let routeData = getLastSavedRouteData();

    if (!routeData || !routeData.features || routeData.features.length === 0) {
      console.log("[startNavigation] Calculando nova rota");
      routeData = await plotRouteOnMap(
        userLocation.latitude,
        userLocation.longitude,
        destination.lat,
        destination.lon,
        "foot-walking",
        destination.name
      );

      if (
        !routeData ||
        !routeData.features ||
        routeData.features.length === 0
      ) {
        console.error("[startNavigation] Falha ao obter dados da rota");
        showNotification(
          getGeneralText("route_error", navigationState.lang),
          "error"
        );
        return false;
      }
    }

    console.log("4. Rota calculada", routeData);

    // Em startNavigation, modificar a parte onde processamos instruções:

    // 6. Extrair os passos da rota dos dados recebidos
    const routeFeature = routeData.features?.[0];
    const properties = routeFeature?.properties || {};
    const segments = properties.segments || [];
    const steps = segments[0]?.steps || [];

    if (!steps || steps.length === 0) {
      console.error("[startNavigation] Sem passos de rota disponíveis");
      showNotification(
        getGeneralText("route_error", navigationState.lang),
        "error"
      );
      return false;
    }

    // Esperar explicitamente que o processamento de instruções complete
    // CORREÇÃO: Passar routeData completo, não apenas steps
    const processedInstructions = await processRouteInstructions(
      routeData, // Passar routeData completo
      navigationState.lang
    );

    // ADICIONAR: Verificar se processedInstructions é válido
    if (!processedInstructions || !Array.isArray(processedInstructions)) {
      console.error("[startNavigation] Falha ao processar instruções da rota");
      showNotification(
        getGeneralText("route_error", navigationState.lang),
        "error"
      );
      return false;
    }

    // Atualizar o estado com as instruções processadas
    navigationState.instructions = processedInstructions;
    console.log("5. Instruções processadas", processedInstructions.length);

    // CORREÇÃO: ORDEM ALTERADA - primeiro criar e mostrar o banner, depois controles
    // 7. Criar e mostrar o banner
    console.log("[startNavigation] Criando e exibindo banner de navegação");
    const banner = createNavigationBanner();
    showInstructionBanner(true);

    // Verificar estado do banner após criação
    console.log("[startNavigation] Estado do banner após criação:", {
      id: banner.id,
      classes: Array.from(banner.classList),
      minimizado: banner.classList.contains(UI_CONFIG.CLASSES.MINIMIZED),
      visível: !banner.classList.contains(UI_CONFIG.CLASSES.HIDDEN),
    });

    // 8. Processar as instruções e mostrar a primeira instrução
    // Verificar se temos instruções
    if (processedInstructions.length > 0) {
      console.log(
        "[startNavigation] Exibindo primeira instrução:",
        processedInstructions[0]
      );
      displayNavigationStep(processedInstructions[0], true);
    } else {
      console.warn("[startNavigation] Sem instruções disponíveis para exibir");
    }

    // 9. Por último, inicializar os controles para não interferir na exibição
    console.log("[startNavigation] Adicionando controles de navegação");
    addNavigationControls();

    // Verificar estado final do banner
    console.log("[startNavigation] Estado final do banner:", {
      id: banner.id,
      classes: Array.from(banner.classList),
      minimizado: banner.classList.contains(UI_CONFIG.CLASSES.MINIMIZED),
      visível: !banner.classList.contains(UI_CONFIG.CLASSES.HIDDEN),
    });
    console.log("7. Interface de navegação exibida");
    // Iniciar monitoramento e adicionar controles
    startPositionTracking();
    console.log("8. Monitoramento de posição iniciado");

    monitorUserState();
    console.log("9. Monitoramento de estado do usuário iniciado");
    document.body.classList.add("navigation-active");

    // 10. Atualizar a localização do usuário no mapa
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      console.log(
        "[startNavigation] Iniciando navegação em tempo real com posição atual:",
        {
          lat: userLocation.latitude,
          lon: userLocation.longitude,
        }
      );
      updateRealTimeNavigation(userLocation);
    } else {
      console.warn(
        "[startNavigation] Posição do usuário não disponível para iniciar navegação em tempo real"
      );
    }

    // Chamar esta função no final de startNavigation()
    setupRealTimeUpdates();

    // ADICIONAR: Configurar verificação de integridade do banner
    setupBannerIntegrityCheck();

    console.groupEnd();
    return true;
  } catch (error) {
    console.error("[startNavigation] Erro crítico:", error);
    console.groupEnd();
    return false;
  }
}

/**
 * Calcula a distância restante da rota a partir da posição atual
 * @param {Object} currentPosition - Posição atual do usuário
 * @param {Array} instructions - Array de instruções da rota
 * @param {number} currentStepIndex - Índice atual na lista de instruções
 * @returns {number} - Distância restante em metros
 */
function calculateRouteRemainingDistance(
  currentPosition,
  instructions,
  currentStepIndex
) {
  // Validar parâmetros
  if (
    !currentPosition ||
    !instructions ||
    instructions.length === 0 ||
    currentStepIndex < 0
  ) {
    console.warn("[calculateRouteRemainingDistance] Parâmetros inválidos");
    return 0;
  }

  try {
    // Log para depuração
    console.log(
      "[calculateRouteRemainingDistance] Calculando distância restante:",
      {
        posição: `${currentPosition.latitude.toFixed(
          6
        )}, ${currentPosition.longitude.toFixed(6)}`,
        passoAtual: currentStepIndex,
        totalPassos: instructions.length,
      }
    );

    let totalRemaining = 0;

    // 1. Distância até o próximo ponto da instrução atual
    const currentStep = instructions[currentStepIndex];
    if (currentStep) {
      const stepLat = currentStep.latitude || currentStep.lat;
      const stepLon = currentStep.longitude || currentStep.lon;

      if (stepLat && stepLon) {
        const distToCurrent = calculateDistance(
          currentPosition.latitude,
          currentPosition.longitude,
          stepLat,
          stepLon
        );
        totalRemaining += distToCurrent;
      }
    }

    // 2. Somar distâncias das instruções restantes
    for (let i = currentStepIndex + 1; i < instructions.length; i++) {
      const step = instructions[i];
      if (step && step.distance) {
        totalRemaining += step.distance;
      }
    }

    console.log(
      `[calculateRouteRemainingDistance] Distância total restante: ${totalRemaining.toFixed(
        1
      )}m`
    );
    return totalRemaining;
  } catch (error) {
    console.error("[calculateRouteRemainingDistance] Erro:", error);
    return 0; // Fallback seguro
  }
}

/**
 * Estima o tempo restante com base na distância e velocidade
 * @param {number} distanceMeters - Distância restante em metros
 * @param {number} [speedMps=1.4] - Velocidade em metros por segundo (padrão: 1.4 m/s ≈ 5 km/h)
 * @returns {number} - Tempo estimado em segundos
 */
function estimateRemainingTime(distanceMeters, speedMps = 1.4) {
  if (!distanceMeters || distanceMeters <= 0) return 0;

  // Usar velocidade atual do usuário se disponível e razoável
  if (
    userLocation &&
    userLocation.speed &&
    userLocation.speed > 0.5 &&
    userLocation.speed < 10
  ) {
    speedMps = userLocation.speed; // m/s
  }

  // Calcular tempo (distância / velocidade)
  const timeSeconds = Math.round(distanceMeters / speedMps);

  console.log(
    `[estimateRemainingTime] Tempo estimado: ${timeSeconds}s (${Math.round(
      timeSeconds / 60
    )}min) ` + `usando velocidade de ${speedMps.toFixed(2)}m/s`
  );

  return timeSeconds;
}

/**
 * Calcula a porcentagem de progresso na rota
 * @param {number} remainingDistance - Distância restante em metros
 * @param {number} totalDistance - Distância total da rota em metros
 * @returns {number} - Porcentagem de conclusão (0-100)
 */
function calculateRouteProgress(remainingDistance, totalDistance) {
  // Validar entradas
  if (!totalDistance || totalDistance <= 0) return 0;
  if (!remainingDistance && remainingDistance !== 0) return 0;

  // Calcular progresso
  let completedDistance = totalDistance - remainingDistance;
  if (completedDistance < 0) completedDistance = 0;

  let progress = Math.round((completedDistance / totalDistance) * 100);

  // Limitar entre 0 e 100
  progress = Math.max(0, Math.min(100, progress));

  console.log(
    `[calculateRouteProgress] Progresso da rota: ${progress}% (${completedDistance.toFixed(
      1
    )}m de ${totalDistance.toFixed(1)}m)`
  );
  return progress;
}

/**
 * Cancela a navegação ativa
 */
export function cancelNavigation() {
  console.log("[cancelNavigation] Finalizando navegação...");

  // 1. Parar geolocalização contínua
  if (positionWatcherId) {
    navigator.geolocation.clearWatch(positionWatcherId);
    positionWatcherId = null;
  }

  // 2. Parar monitoramento do estado do usuário
  if (userStateInterval) {
    clearInterval(userStateInterval);
    userStateInterval = null;
  }

  // 3. Limpar estado de navegação
  navigationState.isActive = false;
  navigationState.isPaused = false;
  navigationState.instructions = [];
  navigationState.arrivalNotified = false;

  // 4. Remover rota do mapa
  if (window.currentRoute && map) {
    map.removeLayer(window.currentRoute);
    window.currentRoute = null;
  }

  // 5. Resetar rotação do mapa
  resetMapRotation();

  // 6. Esconder banner de instruções
  hideInstructionBanner();

  // 7. Remover classe do body
  document.body.classList.remove("navigation-active");

  // 8. Notificar o usuário
  showNotification(
    getGeneralText("navigation_stop", navigationState.lang),
    "info"
  );

  // 9. Enviar mensagem para o assistente
  appendMessage(
    "assistant",
    "Navegação guiada finalizada. Se precisar de outra rota, é só pedir! 🏁"
  );

  // Limpar todos os intervalos e timers
  if (navigationState.updateInterval) {
    clearInterval(navigationState.updateInterval);
    navigationState.updateInterval = null;
  }

  if (userStateInterval) {
    clearInterval(userStateInterval);
    userStateInterval = null;
  }

  // Limpar watchers de posição
  if (positionWatcherId) {
    navigator.geolocation.clearWatch(positionWatcherId);
    positionWatcherId = null;
  }

  // Resetar flags importantes
  recalculationInProgress = false;

  console.log("[cancelNavigation] Navegação cancelada com sucesso");
  return true;
}

export function addNavigationControls() {
  if (navigationState.controlsInitialized) {
    console.log("[addNavigationControls] Controles já inicializados, pulando");
    return;
  }

  console.log("[addNavigationControls] Controles de navegação adicionados");

  // Inicializar controles de navegação
  initNavigationControls({
    enableAutoMinimize: false, // CORREÇÃO: Desabilitar minimização automática
    disableCancelConfirmation: false,
  });

  // CORREÇÃO: Usar UI_CONFIG.IDS.BANNER em vez de UI_CONFIG.BANNER_ID
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (banner) {
    console.log(
      "[addNavigationControls] Verificando estado do banner após inicialização"
    );
    if (banner.classList.contains(UI_CONFIG.CLASSES.MINIMIZED)) {
      console.log(
        "[addNavigationControls] Removendo classe minimized do banner"
      );
      banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
    }
  }

  // Marcar como inicializado para evitar duplicação
  navigationState.controlsInitialized = true;
}

/**
 * Obtém a localização atual do usuário uma única vez.
 * @param {Object} options - Opções para getCurrentPosition
 * @returns {Promise<Object>} - Promessa resolvida com a localização ou null em caso de erro
 */
async function getCurrentLocation(
  options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
) {
  console.log("[getCurrentLocation] Solicitando posição atual...");

  // Verifica se a API de geolocalização está disponível
  if (!("geolocation" in navigator)) {
    showNotification(
      getGeneralText("location_error", navigationState.lang) ||
        "Geolocalização não suportada.",
      "error"
    );
    return null;
  }

  try {
    // Solicita a posição atual
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const userPos = { latitude, longitude, accuracy, heading, speed };

    console.log("[getCurrentLocation] Localização obtida:", userPos);
    return userPos;
  } catch (error) {
    console.error("[getCurrentLocation] Erro:", error);

    // Define mensagem de erro específica com base no código do erro
    let message = getGeneralText("location_error", navigationState.lang);
    if (error.code === 1) {
      // PERMISSION_DENIED
      message =
        getGeneralText("location_permission_denied", navigationState.lang) ||
        "Permissão de localização negada.";
    } else if (error.code === 2) {
      // POSITION_UNAVAILABLE
      message =
        getGeneralText("location_error", navigationState.lang) ||
        "Posição indisponível.";
    } else if (error.code === 3) {
      // TIMEOUT
      message =
        getGeneralText("location_error", navigationState.lang) ||
        "Tempo limite para obtenção de localização excedido.";
    }

    showNotification(message, "error");
    return null;
  }
}

/**
 * Exibe um passo de navegação no banner e destaca conforme necessário
 * @param {Object} step - Passo da navegação a ser exibido
 * @param {boolean} [highlight=true] - Se deve destacar o banner
 * @returns {boolean} - Indica se a operação foi bem-sucedida
 */
export function displayNavigationStep(step, highlight = true) {
  try {
    console.log("[displayNavigationStep] Processando passo:", step);

    if (!step) {
      console.error("[displayNavigationStep] Passo inválido:", step);
      return false;
    }

    // 1. Extrair dados essenciais do passo, com fallbacks para diferentes estruturas
    const originalInstruction = step.original || step.instruction || "";
    const translatedInstruction = step.translated || originalInstruction;

    // CORREÇÃO: Extrair o nome da rua da instrução original se não estiver explicitamente definido
    const streetName =
      step.streetName || step.name || extractStreetName(originalInstruction);

    const distance = step.distance || 0;
    const formattedDistance =
      step.formattedDistance || formatDistance(distance);
    const stepType = step.type || getInstructionType(originalInstruction);

    // 2. Obter texto simplificado para o cabeçalho principal do banner
    const simplifiedText =
      step.simplifiedInstruction ||
      simplifyInstruction(originalInstruction, stepType);

    console.log("[displayNavigationStep] Dados processados:", {
      simplified: simplifiedText,
      original: originalInstruction,
      translated: translatedInstruction,
      street: streetName,
      distance: formattedDistance,
    });

    // 3. Criar objeto com todos os dados necessários para updateInstructionBanner
    const enhancedStep = {
      instruction: simplifiedText, // Texto principal do banner
      original: originalInstruction, // Instrução original para referência
      translated: translatedInstruction, // Versão traduzida (se disponível)
      simplifiedInstruction: simplifiedText, // Versão simplificada para UI
      streetName: streetName, // Nome da rua (preservado)
      distance: distance, // Distância numérica
      formattedDistance: formattedDistance, // Distância formatada
      type: stepType, // Tipo da manobra

      // Campos adicionais que podem ser usados por updateInstructionBanner
      remainingDistance: step.remainingDistance || formattedDistance,
      estimatedTime: step.estimatedTime || step.formattedTime || "",
      progress: step.progress || 0,
    };

    console.log(
      "[displayNavigationStep] Preparando atualização do banner:",
      enhancedStep
    );

    // 4. Atualizar o banner com os dados completos
    const banner = updateInstructionBanner(enhancedStep);

    // 5. Validar resultado da atualização
    if (!banner) {
      console.error("[displayNavigationStep] Falha ao atualizar banner");
      return false;
    }

    // 6. Destacar banner se solicitado
    if (highlight) {
      console.log("[displayNavigationStep] Destacando banner");
      flashBanner();
    }

    // 7. Reproduzir instrução se ativado
    try {
      if (typeof speak === "function" && !navigationState.isMuted) {
        // Sintetizar apenas o texto simplificado, sem distâncias
        speak(simplifiedText);
      }
    } catch (voiceError) {
      console.warn(
        "[displayNavigationStep] Erro ao sintetizar voz:",
        voiceError
      );
    }

    return true;
  } catch (error) {
    console.error("[displayNavigationStep] Erro:", error);
    return false;
  }
}

/**
 * Verifica se o usuário chegou ao destino
 * @param {number} userLat - Latitude atual do usuário
 * @param {number} userLon - Longitude atual do usuário
 */
export function checkDestinationArrival(userLat, userLon) {
  const destination = navigationState.selectedDestination;
  if (!destination || !destination.lat || !destination.lon) return;

  const distanceToDestination = calculateDistance(
    userLat,
    userLon,
    destination.lat,
    destination.lon
  );

  // Se estiver a menos de 20 metros do destino
  if (distanceToDestination <= 20) {
    // Verificar se essa notificação já foi exibida para evitar repetições
    if (!navigationState.arrivalNotified) {
      navigationState.arrivalNotified = true;

      // Notificar chegada ao destino
      showNotification(
        getGeneralText("navigation_arrived", navigationState.lang),
        "success"
      );

      // Reproduzir mensagem de voz
      speak(getGeneralText("navigation_arrived", navigationState.lang));

      // Atualizar banner
      updateInstructionBanner({
        instruction: getGeneralText("navigation_arrived", navigationState.lang),
        type: 11, // Código para "arrive"
        remainingDistance: "0 m",
        estimatedTime: "0 min",
      });

      // Destacar o banner
      flashBanner(true);
    }
  }
}

/**
 * Atualiza a navegação em tempo real com base na posição do usuário
 * @param {Object} [userPos=null] - Posição atual do usuário (opcional)
 */
export function updateRealTimeNavigation(userPos = null) {
  // Usar o parâmetro se fornecido, caso contrário usar a variável global
  const currentPos = userPos || userLocation;

  // Validar se temos uma posição válida
  if (!currentPos || !currentPos.latitude || !currentPos.longitude) {
    console.warn(
      "[updateRealTimeNavigation] Posição do usuário inválida ou indisponível"
    );
    return; // Sair da função se não houver posição válida
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
    const minDistanceChange = 5; // metros
    const distanceMoved = calculateDistance(
      currentPos.latitude,
      currentPos.longitude,
      navigationState.lastProcessedPosition.latitude,
      navigationState.lastProcessedPosition.longitude
    );

    if (distanceMoved < minDistanceChange) {
      console.log(
        "[updateRealTimeNavigation] Movimento insignificante, ignorando atualização"
      );
      return; // Ignorar atualizações muito próximas
    }
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
      // Calcular distância até o próximo passo
      const distanceToNextStep = calculateDistance(
        currentPos.latitude,
        currentPos.longitude,
        nextStep.latitude || nextStep.lat,
        nextStep.longitude || nextStep.lon
      );

      console.log(
        `[updateRealTimeNavigation] Distância até próximo passo: ${distanceToNextStep.toFixed(
          1
        )}m`
      );

      // Se estiver próximo ao próximo passo (menos de 20 metros), avançar
      if (distanceToNextStep <= 20) {
        nextStepIndex = currentStepIndex + 1;
        shouldUpdateStep = true;
        console.log(
          "[updateRealTimeNavigation] Próximo do passo seguinte, avançando instruções"
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

// Adicionar função auxiliar para formatação de distância
function formatDistance(distance) {
  return distance < 1000
    ? `${Math.round(distance)} m`
    : `${(distance / 1000).toFixed(1)} km`;
}

// Adicionar função auxiliar para formatação de tempo
function formatDuration(seconds) {
  return seconds < 60
    ? `${Math.round(seconds)} s`
    : `${Math.round(seconds / 60)} min`;
}

/**
 * Inicia o monitoramento periódico do estado do usuário durante a navegação
 * Verifica a proximidade do destino, desvios da rota e outros estados
 */
let userStateInterval = null;

export function monitorUserState() {
  // Limpar intervalo anterior se existir
  if (userStateInterval) {
    clearInterval(userStateInterval);
  }

  console.log(
    "[monitorUserState] Iniciando monitoramento do estado do usuário"
  );

  userStateInterval = setInterval(() => {
    // Verificar se a navegação ainda está ativa
    if (!navigationState.isActive) {
      clearInterval(userStateInterval);
      userStateInterval = null;
      console.log(
        "[monitorUserState] Monitoramento encerrado - navegação inativa"
      );
      return;
    }

    // Verificar se temos posição atual do usuário
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.log("[monitorUserState] Sem dados de localização do usuário");
      return;
    }

    console.log(
      "[monitorUserState] Verificando estado - distância para destino"
    );

    // Calcular e atualizar a distância até o destino
    if (navigationState.selectedDestination) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        navigationState.selectedDestination.lat,
        navigationState.selectedDestination.lon
      );

      navigationState.distanceToDestination = distance;

      console.log(
        `[monitorUserState] Distância até o destino: ${distance.toFixed(1)}m`
      );

      // Verificar se chegou ao destino (20 metros de proximidade)
      if (distance <= 20) {
        console.log("[monitorUserState] Chegou ao destino!");
        checkDestinationArrival(userLocation.latitude, userLocation.longitude);
      }

      // Se estiver muito longe do destino (possível desvio grande)
      if (distance > 2000) {
        console.warn(
          "[monitorUserState] Possível desvio grande detectado. Distância:",
          distance.toFixed(1),
          "metros"
        );

        // Se ainda não detectou desvio, notificar
        if (!navigationState.deviationDetected) {
          navigationState.deviationDetected = true;
          showNotification(
            getGeneralText("routeDeviated", navigationState.lang),
            "warning"
          );

          notifyDeviation(true, false);
        }
      } else {
        // Reset estado de desvio se voltou para distância razoável
        if (navigationState.deviationDetected) {
          console.log("[monitorUserState] Voltou para rota normal");
          navigationState.deviationDetected = false;
        }
      }
    }
  }, 10000); // checa a cada 10s

  console.log("[monitorUserState] Monitoramento iniciado com intervalo de 10s");
  return userStateInterval;
}

/**
 * Verifica se deve recalcular a rota baseado no desvio do usuário
 * @param {number} userLat - Latitude do usuário
 * @param {number} userLon - Longitude do usuário
 * @returns {boolean} - Se deve recalcular ou não
 */
export function shouldRecalculateRoute(userLat, userLon) {
  if (!navigationState.isActive || recalculationInProgress) {
    return false;
  }

  // Se o usuário está parado (velocidade muito baixa), não recalcula
  if (
    userLocation &&
    typeof userLocation.speed === "number" &&
    userLocation.speed < 0.5
  ) {
    return false;
  }

  const instructions = navigationState.instructions;
  if (!instructions || instructions.length === 0) {
    return false;
  }

  // Considere a precisão do GPS
  const gpsAccuracy =
    userLocation && userLocation.accuracy ? userLocation.accuracy : 15;

  // Verifique a menor distância do usuário para todos os pontos da rota
  let minDistance = Infinity;
  if (window.currentRoute && window.currentRoute.getLatLngs) {
    const latlngs = window.currentRoute.getLatLngs();
    for (const latlng of latlngs) {
      const d = calculateDistance(userLat, userLon, latlng.lat, latlng.lng);
      if (d < minDistance) minDistance = d;
    }
  } else {
    // Fallback: calcula para o próximo passo
    const currentStep = instructions[navigationState.currentStepIndex];
    if (currentStep) {
      minDistance = calculateDistance(
        userLat,
        userLon,
        currentStep.latitude || currentStep.lat,
        currentStep.longitude || currentStep.lon
      );
    }
  }

  // Só recalcula se estiver realmente longe da linha da rota
  const margin = 30; // metros extras de tolerância
  if (minDistance > gpsAccuracy * 2 + margin) {
    console.log(
      "[shouldRecalculateRoute] Desvio detectado: distância =",
      minDistance,
      "precisão GPS =",
      gpsAccuracy
    );
    return true;
  }

  return false;
}

/**
 * Notifica o usuário sobre desvio ou conclusão de recálculo
 * @param {boolean} starting - Se está iniciando o recálculo
 * @param {boolean} failed - Se houve falha no recálculo
 */
export function notifyDeviation(starting = true, failed = false) {
  if (starting) {
    if (!failed) {
      // Notificação inicial de desvio
      showNotification(
        getGeneralText("routeDeviated", navigationState.lang),
        "warning"
      );

      // Anunciar com voz
      speak(getGeneralText("routeDeviated", navigationState.lang));
    } else {
      // Notificação de falha
      showNotification(
        getGeneralText("recalculation_failed", navigationState.lang),
        "error"
      );
    }
  } else {
    // Recálculo concluído com sucesso
    showNotification(
      getGeneralText("routeRecalculatedOk", navigationState.lang),
      "success"
    );
  }
}

/**
 * Recalcula a rota quando o usuário se desvia
 * @param {number} userLat - Latitude do usuário
 * @param {number} userLon - Longitude do usuário
 * @param {number} destLat - Latitude do destino
 * @param {number} destLon - Longitude do destino
 * @param {Object} options - Opções adicionais
 */
export async function recalculateRoute(
  userLat,
  userLon,
  destLat,
  destLon,
  { lang = "pt", bigDeviation = false, profile = "foot-walking" } = {}
) {
  // Evitar múltiplos recálculos simultâneos
  if (recalculationInProgress) {
    console.log(
      "[recalculateRoute] Recálculo já em andamento, ignorando nova solicitação"
    );
    return;
  }

  recalculationInProgress = true;
  console.log("[recalculateRoute] Recalculando rota...");

  try {
    // Interrompe o rastreamento atual temporariamente
    if (positionWatcherId) {
      navigator.geolocation.clearWatch(positionWatcherId);
      positionWatcherId = null;
    }

    if (bigDeviation) {
      showNotification(getGeneralText("routeDeviated", lang), "warning");
      speak(getGeneralText("offRoute", lang));
    }

    showNavigationLoading(getGeneralText("recalculating", lang));

    // Remove a rota atual do mapa
    if (window.currentRoute && map) {
      map.removeLayer(window.currentRoute);
      window.currentRoute = null;
    }

    // Plota a nova rota
    const routeData = await plotRouteOnMap(
      userLat,
      userLon,
      destLat,
      destLon,
      profile
    );

    if (!routeData || !routeData.features || routeData.features.length === 0) {
      console.error("[recalculateRoute] Falha ao obter dados da rota");
      notifyDeviation(true, true);
      recalculationInProgress = false;
      startPositionTracking();
      return;
    }

    // Extrair e processar as instruções
    const routeFeature = routeData.features[0];
    const segments = routeFeature.properties?.segments || [];
    const steps = segments[0]?.steps || [];

    if (!steps || steps.length === 0) {
      console.error("[recalculateRoute] Sem passos de rota disponíveis");
      notifyDeviation(true, true);
      recalculationInProgress = false;
      startPositionTracking();
      return;
    }

    // Processar instruções usando routeProcessor
    const processedInstructions = await processRouteInstructions(
      steps,
      routeData,
      lang
    );

    if (!processedInstructions || processedInstructions.length === 0) {
      console.error("[recalculateRoute] Falha ao processar instruções");
      notifyDeviation(true, true);
      recalculationInProgress = false;
      startPositionTracking();
      return;
    }

    // Atualizar o estado de navegação
    navigationState.instructions = processedInstructions;
    navigationState.currentStepIndex = 0;
    navigationState.routeData = routeData;
    navigationState.deviationDetected = false;

    // Mostrar a primeira instrução
    if (processedInstructions.length > 0) {
      displayNavigationStep(processedInstructions[0]);
    }

    notifyDeviation(false); // Recálculo concluído

    // Reiniciar monitoramento contínuo
    startPositionTracking();
  } catch (error) {
    console.error("[recalculateRoute] Erro ao recalcular rota:", error);
    notifyDeviation(true, true);

    // Reiniciar monitoramento mesmo em caso de erro
    startPositionTracking();
  } finally {
    recalculationInProgress = false;
  }
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * @param {number} lat1 - Latitude do primeiro ponto.
 * @param {number} lon1 - Longitude do primeiro ponto.
 * @param {number} lat2 - Latitude do segundo ponto.
 * @param {number} lon2 - Longitude do segundo ponto.
 * @returns {number} Distância em metros.
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Em metros

  return distance;
}

/**
 * Reseta a rotação do mapa para o norte
 */
export function resetMapRotation() {
  const tilePane = document.querySelector(".leaflet-tile-pane");
  const controlsPane = document.querySelector(".leaflet-control-container");

  if (tilePane) {
    tilePane.style.transition = "transform 0.5s ease-out";
    tilePane.style.transform = "none";
  }

  if (controlsPane) {
    controlsPane.style.transition = "transform 0.5s ease-out";
    controlsPane.style.transform = "none";
  }

  navigationState.currentHeading = 0;
}

/**
 * Ativa a rotação automática do mapa durante a navegação
 */
export function enableAutoRotation() {
  navigationState.isRotationEnabled = true;
  document.body.classList.add("map-rotation-enabled");

  // Se houver um heading atual no userLocation, aplicar imediatamente
  if (
    userLocation &&
    userLocation.heading !== null &&
    userLocation.heading !== undefined
  ) {
    setMapRotation(userLocation.heading);
  }

  console.log("[enableAutoRotation] Rotação automática do mapa ativada");
}

/**
 * Desativa a rotação automática do mapa
 */
export function disableAutoRotation() {
  navigationState.isRotationEnabled = false;

  // Resetar rotação
  resetMapRotation();

  document.body.classList.remove("map-rotation-enabled");
  console.log("[disableAutoRotation] Rotação automática do mapa desativada");
}

/**
 * Valida se o destino é válido para navegação
 * @param {Object} destination - Objeto do destino
 * @returns {boolean} - Se o destino é válido
 */
export function validateDestination(destination) {
  if (!destination) {
    console.error("[validateDestination] Destino não definido");
    return false;
  }

  // Verificar coordenadas. Pode ser lat/lon ou latitude/longitude
  const lat = destination.lat || destination.latitude;
  const lon = destination.lon || destination.longitude || destination.lng;

  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    console.error("[validateDestination] Coordenadas inválidas:", lat, lon);
    return false;
  }

  // Verificar limites
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.error(
      "[validateDestination] Coordenadas fora dos limites permitidos:",
      lat,
      lon
    );
    return false;
  }

  return true;
}

/**
 * Obtém os dados da última rota calculada
 * @returns {Object|null} - Dados da rota ou null
 */
export function getLastRouteData() {
  return window.lastRouteData || null;
}

/**
 * Substituir a implementação de appendNavigationInstruction para usar apenas banners
 */
export function appendNavigationInstruction(icon, title, details = "") {
  // Em vez de usar o assistente, atualizar o banner de navegação
  const instruction = {
    instruction: title,
    type: getTypeFromIcon(icon),
    details: details,
  };

  // Atualizar o banner com esta instrução especial
  updateInstructionBanner(instruction);

  // Destacar o banner para chamar atenção
  highlightBanner();

  console.log(
    "[appendNavigationInstruction] Instrução exibida no banner:",
    title
  );
}

// Exportar objetos e funções principais
export default {
  startNavigation,
  cancelNavigation,
  addNavigationControls,
  displayNavigationStep,
  updateRealTimeNavigation,
  calculateDistance,
  enableAutoRotation,
  disableAutoRotation,
  navigationState,
  validateDestination,
  notifyDeviation,
  recalculateRoute,
};

function setupRealTimeUpdates() {
  // Limpar intervalo existente se houver
  if (navigationState.updateInterval)
    clearInterval(navigationState.updateInterval);

  // Atualizar métricas a cada 3 segundos
  navigationState.updateInterval = setInterval(() => {
    if (navigationState.isActive && userLocation) {
      updateRealTimeNavigation(userLocation);
    }
  }, 3000);

  console.log(
    "[setupRealTimeUpdates] Monitoramento de métricas em tempo real iniciado"
  );
}

/**
 * Configura e ativa a rotação do mapa
 * @param {number} angle - Ângulo de rotação em graus
 */
export function rotateMap(angle) {
  try {
    const mapInstance = window.map || (typeof map !== "undefined" ? map : null);

    if (!mapInstance) {
      console.error("[rotateMap] Mapa não encontrado");
      return false;
    }

    console.log(`[rotateMap] Tentando rotacionar mapa para ${angle} graus`);

    // Verificar se o método setBearing está disponível
    if (typeof mapInstance.setBearing !== "function") {
      console.error(
        "[rotateMap] Método setBearing não está disponível. O plugin foi carregado?"
      );
      return false;
    }

    // Aplicar rotação
    mapInstance.setBearing(angle);
    console.log(`[rotateMap] Mapa rotacionado para ${angle} graus`);

    return true;
  } catch (error) {
    console.error("[rotateMap] Erro ao rotacionar mapa:", error);
    return false;
  }
}

// Adicionar ao arquivo navigationController.js
/**
 * Configura a verificação periódica da integridade do banner e seus elementos
 * Garantindo que todos os elementos visuais estejam funcionando corretamente
 */
export function setupBannerIntegrityCheck() {
  // Cancelar qualquer verificação existente
  if (window.bannerIntegrityInterval) {
    clearInterval(window.bannerIntegrityInterval);
  }

  // Importar as funções necessárias do módulo bannerUI
  import("../navigationUi/bannerUI.js")
    .then((bannerUI) => {
      // Verificar integridade imediatamente
      bannerUI.ensureBannerIntegrity();

      // Configurar verificação a cada 5 segundos
      window.bannerIntegrityInterval = setInterval(() => {
        if (navigationState.isActive) {
          bannerUI.ensureBannerIntegrity();
        }
      }, 5000);

      console.log(
        "[setupBannerIntegrityCheck] Verificação de integridade do banner configurada"
      );
    })
    .catch((err) => {
      console.error(
        "[setupBannerIntegrityCheck] Erro ao importar bannerUI:",
        err
      );
    });

  return true;
}

/**
 * Extrai o nome da rua de uma instrução de navegação
 * @param {string} instruction - Texto da instrução completa
 * @returns {string} - Nome da rua extraído ou "-" se não encontrado
 */
function extractStreetName(instruction) {
  if (!instruction) return "-";

  const instructionLower = instruction.toLowerCase();

  // Verificar padrões comuns para extrair o nome da rua
  if (instructionLower.includes(" on ")) {
    return instruction.split(" on ")[1];
  } else if (instructionLower.includes(" onto ")) {
    return instruction.split(" onto ")[1];
  }

  return "-";
}
