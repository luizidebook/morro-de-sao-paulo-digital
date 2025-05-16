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
import { repositionMessagesArea } from "../../utils/ui-position.js";
import { setupInitialMapOrientation } from "../../map/map-orientation.js";
import { processRouteInstructions } from "../navigationInstructions/routeProcessor.js";
import {
  adjustUIForNavigation,
  setupNavigationUIObserver,
  dispatchActionEvent,
} from "../../utils/ui-position.js";
import { startRotationMonitor } from "../../map/map-rotation-monitor.js";
import {
  requestLocationPermission,
  getBestEffortLocation,
  isValidCoordinate,
} from "../navigationUserLocation/enhanced-geolocation.js";
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
  positionWatcherId,
  startPositionTracking,
  updateUserMarker,
  userLocation,
  determineCurrentSegment,
  getSegmentDirection,
} from "../navigationUserLocation/user-location.js";

// State management
let navigationUIObserver;
function initNavigationUI() {
  // Iniciar o observador de navegação
  navigationUIObserver = setupNavigationUIObserver();

  // Resto do código de inicialização...
}

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
 * Ferramenta de diagnóstico para o sistema de navegação
 */

export function runNavigationDiagnostic() {
  console.group("Diagnóstico do Sistema de Navegação");

  // 1. Verificar disponibilidade de recursos de geolocalização
  const geoAvailable = "geolocation" in navigator;
  console.log(
    `1. Geolocalização: ${geoAvailable ? "✅ Disponível" : "❌ Indisponível"}`
  );

  // 2. Verificar plugins necessários
  const leafletAvailable = typeof L !== "undefined";
  console.log(
    `2. Leaflet: ${leafletAvailable ? "✅ Disponível" : "❌ Não carregado"}`
  );

  // Verificar plugins específicos se Leaflet estiver disponível
  if (leafletAvailable) {
    const rotatedMarkerPlugin =
      typeof L.Marker.prototype.setRotationAngle === "function";
    console.log(
      `3. Plugin de rotação de marcadores: ${
        rotatedMarkerPlugin ? "✅ Disponível" : "❌ Não carregado"
      }`
    );

    const mapBearingPlugin = typeof L.Map.prototype.setBearing === "function";
    console.log(
      `4. Plugin de rotação de mapa: ${
        mapBearingPlugin ? "✅ Disponível" : "❌ Não carregado"
      }`
    );

    const polylineDecoratorPlugin = typeof L.polylineDecorator === "function";
    console.log(
      `5. Plugin de decoração de linhas: ${
        polylineDecoratorPlugin ? "✅ Disponível" : "❌ Não carregado"
      }`
    );
  }

  // 3. Verificar componentes de UI
  const banner = document.getElementById("instruction-banner");
  console.log(
    `6. Banner de instruções: ${banner ? "✅ Presente no DOM" : "❌ Ausente"}`
  );

  if (banner) {
    const requiredElements = [
      "instruction-arrow",
      "instruction-main",
      "instruction-details",
      "instruction-distance",
      "instruction-time",
      "route-progress",
      "progress-text",
      "minimize-navigation-btn",
    ];

    console.group("   Elementos do banner:");
    for (const id of requiredElements) {
      const elem = document.getElementById(id);
      console.log(`   - ${id}: ${elem ? "✅ Presente" : "❌ Ausente"}`);
    }
    console.groupEnd();
  }

  // 4. Verificar traduções necessárias
  try {
    const criticalTranslations = [
      "navigation_turn_left",
      "navigation_turn_right",
      "navigation_on",
      "navigation_for",
    ];

    console.group("7. Traduções críticas:");

    import("../../i18n/translatePageContent.js").then((module) => {
      const { getGeneralText } = module;

      criticalTranslations.forEach((key) => {
        const hasTranslation = getGeneralText(key, "pt") !== key;
        console.log(
          `   - ${key}: ${hasTranslation ? "✅ Presente" : "❌ Ausente"}`
        );
      });
    });

    console.groupEnd();
  } catch (error) {
    console.log("7. Erro ao verificar traduções:", error);
  }

  console.groupEnd();
}
/**
 * Inicia a navegação para um destino específico
 * Versão aprimorada com melhor tratamento de erros, centralização no usuário e feedback visual
 *
 * @param {Object} destination - Destino da navegação
 * @returns {Promise<boolean>} - Indica se a navegação foi iniciada com sucesso
 */
export async function startNavigation(destination) {
  try {
    console.group("[startNavigation] Iniciando fluxo de navegação");
    // Notificar que a navegação está começando para ajustar a UI
    adjustUIForNavigation(true);
    // Verificar e inicializar componentes
    ensureNavigationComponents();

    console.log("1. Estado inicial", { destino: destination });

    // Verificar e cancelar qualquer navegação existente
    if (navigationState.isActive) {
      console.log(
        "[startNavigation] Cancelando navegação anterior antes de iniciar nova"
      );
      await cancelNavigation(false);
    }

    // MELHORADO: Resetar estado de navegação de forma mais completa
    navigationState.isActive = true;
    navigationState.isPaused = false;
    navigationState.currentStepIndex = 0;
    navigationState.arrivalNotified = false;
    navigationState.deviationDetected = false;
    navigationState.routeProgress = 0; // IMPORTANTE: Resetar progresso ao iniciar
    navigationState.instructions = [];
    navigationState.routeData = null;
    navigationState.lastProcessedPosition = null;
    navigationState.lastUpdateTime = Date.now();
    navigationState.notifiedTurns = {}; // Reset das notificações de curvas

    // NOVO: Inicializar objeto de desempenho para diagnóstico
    navigationState.performance = {
      startTime: Date.now(),
      locationUpdates: 0,
      recalculations: 0,
      lastPositions: [],
    };

    // Salvar o destino no objeto de estado
    navigationState.destination = destination;
    // Salvar destino no estado global
    navigationState.selectedDestination = destination;

    // Mostrar indicador de carregamento
    showNavigationLoading();
    console.log("2. Controles inicializados");

    // 1. Verificar se o destino é válido
    if (!destination || (!destination.latitude && !destination.lat)) {
      console.error("[startNavigation] Destino inválido:", destination);
      showNotification("Destino inválido para navegação", "error");
      return false;
    }

    // Verificar permissão de localização antes
    let hasPermission = false;
    try {
      console.log("[startNavigation] Verificando permissão de localização");
      hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.warn("[startNavigation] Permissão de localização negada");
        showNotification(
          "É necessário permitir o acesso à localização para iniciar a navegação",
          "error"
        );
        return false;
      }
      console.log("[startNavigation] Permissão de localização concedida");
    } catch (permissionError) {
      console.error(
        "[startNavigation] Erro ao verificar permissão:",
        permissionError
      );
      showNotification("Erro ao verificar permissão de localização", "error");
      return false;
    }

    // Exibir banner informando que a navegação está sendo iniciada
    showNotification("Preparando sua navegação...", "info", {
      icon: "walking",
      duration: 3000,
    });

    // Normalizar destino para garantir que temos lat/lon consistentes
    const destLat = destination.latitude || destination.lat;
    const destLon = destination.longitude || destination.lon || destination.lng;

    // 3. Verificar se temos localização do usuário
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      try {
        console.log("[startNavigation] Obtendo posição atual do usuário...");

        // MODIFICAÇÃO: Mostrar notificação de espera
        showNotification(
          getGeneralText("locating", navigationState.lang) ||
            "Obtendo sua localização...",
          "info"
        );

        // Tentar obter localização atual com mais tempo e tentativas
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const position = await getBestEffortLocation(
              15000 + attempt * 5000, // Aumentar timeout progressivamente
              300 // 300m de precisão é aceitável para iniciar navegação
            );

            if (position) {
              console.log(
                `[startNavigation] Posição obtida na tentativa ${attempt + 1}:`,
                position
              );

              // Atualizar localização global
              if (window.userLocation) {
                Object.assign(window.userLocation, position);
              } else {
                window.userLocation = position;
              }

              // Atualizar variável exportada
              Object.assign(userLocation, position);

              // Criar marcador do usuário se não existir
              if (
                !window.userMarker &&
                typeof createUserMarker === "function"
              ) {
                createUserMarker(
                  position.latitude,
                  position.longitude,
                  position.heading || 0,
                  position.accuracy || 15
                );
              }

              break; // Sair do loop se posição for obtida
            }
          } catch (attemptError) {
            console.warn(
              `[startNavigation] Tentativa ${attempt + 1} falhou:`,
              attemptError
            );

            // Aguardar um pouco antes da próxima tentativa
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }

        // Verificar novamente se obteve localização
        if (
          !userLocation ||
          !userLocation.latitude ||
          !userLocation.longitude
        ) {
          console.warn(
            "[startNavigation] Não foi possível obter localização após múltiplas tentativas"
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

    // NOVO: Centralizar mapa na localização do usuário com zoom adequado
    updateMapWithUserLocation();

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
        destLat,
        destLon,
        "foot-walking", // Usar o modo de transporte apropriado
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

    // NOVO: Salvar dados da rota no estado
    navigationState.routeData = routeData;
    setLastRouteData(routeData);

    // 6. Extrair os passos da rota dos dados recebidos e processar instruções
    const processedInstructions = await processRouteInstructions(
      routeData,
      navigationState.lang
    );

    // Verificar se processedInstructions é válido
    if (!processedInstructions || !Array.isArray(processedInstructions)) {
      console.error("[startNavigation] Falha ao processar instruções da rota");
      showNotification(
        getGeneralText("route_error", navigationState.lang),
        "error"
      );
      return false;
    }

    // MODIFICAR: Normalizar as instruções antes de armazenar
    const normalizedInstructions = normalizeInstructions(processedInstructions);
    navigationState.instructions = normalizedInstructions;

    // NOVO: Calcular e salvar a distância total da rota
    const totalDistance = routeData.properties?.summary?.distance || 0;
    navigationState.totalRouteDistance = totalDistance;

    // NOVO: Inicializar objeto de progresso com mais detalhes
    navigationState.progress = {
      totalDistance: totalDistance,
      completedDistance: 0,
      percentage: 0,
      lastUpdated: Date.now(),
    };

    // 7. Criar e mostrar o banner
    console.log("[startNavigation] Criando e exibindo banner de navegação");
    const banner = createNavigationBanner();
    showInstructionBanner(true);

    // NOVO: Garantir que o botão de minimizar tenha o handler correto
    addMinimizeButtonHandler();

    // IMPORTANTE: Resetar visualmente a barra de progresso
    updateProgressBar(0);

    // 8. Processar as instruções e mostrar a primeira instrução
    if (normalizedInstructions.length > 0) {
      console.log(
        "[startNavigation] Exibindo primeira instrução:",
        normalizedInstructions[0]
      );
      displayNavigationStep(normalizedInstructions[0], true);
    } else {
      console.warn("[startNavigation] Sem instruções disponíveis para exibir");
    }

    // 9. Adicionar controles de navegação
    console.log("[startNavigation] Adicionando controles de navegação");
    addNavigationControls();

    // Iniciar monitoramento de posição
    startPositionTracking();
    console.log("8. Monitoramento de posição iniciado");

    monitorUserState();
    console.log("9. Monitoramento de estado do usuário iniciado");
    document.body.classList.add("navigation-active");

    // NOVO: Registrar evento para análise
    if (typeof logNavigationEvent === "function") {
      logNavigationEvent("navigation_start", {
        destination: destination.name || "Destino",
        coords: `${destLat},${destLon}`,
        routeDistance: totalDistance,
        estimatedTime: routeData.properties?.summary?.duration || 0,
      });
    }

    // 10. Atualizar a localização do usuário no mapa com zoom adequado e centralização
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      console.log(
        "[startNavigation] Iniciando navegação em tempo real com posição atual:",
        {
          lat: userLocation.latitude,
          lon: userLocation.longitude,
        }
      );

      // Center map on user location with zoom level 18
      updateMapWithUserLocation();
      updateRealTimeNavigation(userLocation);
    }

    setupRealTimeUpdates();
    setupBannerIntegrityCheck();
    setupInitialMarkerOrientation();

    // MELHORADO: Realizar um reposicionamento final das áreas da UI
    repositionMessagesArea();

    console.groupEnd();
    return true;
  } catch (error) {
    console.error("[startNavigation] Erro crítico:", error);
    console.groupEnd();

    // Limpar estado em caso de falha para evitar estado inconsistente
    navigationState.isActive = false;

    // Notificar o usuário sobre o erro
    showNotification(
      getGeneralText("navigation_error", navigationState.lang) ||
        "Erro ao iniciar navegação",
      "error"
    );

    return false;
  }
}

/**
 * Atualiza a posição do mapa com a localização do usuário
 * @param {number} zoomLevel - Nível de zoom a ser utilizado (padrão: 18)
 * @returns {boolean} - Se a operação foi bem-sucedida
 */
export function updateMapWithUserLocation(zoomLevel = 20) {
  try {
    // Verificar se temos um objeto de localização válido e mapa inicializado
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.warn(
        "[updateMapWithUserLocation] Localização do usuário inválida ou incompleta"
      );
      return false;
    }

    if (!map) {
      console.warn("[updateMapWithUserLocation] Objeto de mapa não disponível");
      return false;
    }

    // Centralizar mapa na posição do usuário com o zoom especificado
    map.setView([userLocation.latitude, userLocation.longitude], zoomLevel);
    console.log(
      `[updateMapWithUserLocation] Mapa centralizado em ${userLocation.latitude}, ${userLocation.longitude} com zoom ${zoomLevel}`
    );

    // Se estiver em navegação ativa, tentar posicionar o usuário no centro visual da tela
    if (navigationState && navigationState.isActive) {
      // Usar uma abordagem mais segura para buscar o marcador
      const userMarker = window.userMarker || null;

      // Verificar se o marcador existe e tem uma propriedade _icon
      if (userMarker && userMarker._icon) {
        userMarker._icon.style.position = "absolute";
        userMarker._icon.style.top = "50%";
        userMarker._icon.style.left = "50%";
        userMarker._icon.style.transform = "translate(-50%, -50%)";
        userMarker._icon.style.zIndex = "1000";
        console.log(
          "[updateMapWithUserLocation] Marcador do usuário posicionado no centro da tela"
        );
      } else {
        console.log(
          "[updateMapWithUserLocation] Marcador do usuário não encontrado ou não está pronto"
        );
      }
    }

    return true;
  } catch (error) {
    console.error(
      "[updateMapWithUserLocation] Erro ao atualizar posição:",
      error
    );
    return false;
  }
}

/**
 * Configura a orientação inicial do marcador do usuário para a rota
 */
function setupInitialMarkerOrientation() {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    console.warn(
      "[setupInitialMarkerOrientation] Posição do usuário indisponível"
    );
    return;
  }

  // Obter pontos da rota
  let routePoints = window.lastRoutePoints;

  // Código existente para encontrar pontos de rota...

  if (!routePoints || routePoints.length === 0) {
    console.warn(
      "[setupInitialMarkerOrientation] Pontos da rota indisponíveis"
    );
    return;
  }

  // NOVO: Atualizar orientação do marcador imediatamente
  if (typeof updateUserMarkerDirection === "function") {
    updateUserMarkerDirection(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy || 15,
      },
      routePoints
    );

    console.log(
      "[setupInitialMarkerOrientation] Orientação inicial do marcador configurada"
    );
  } else {
    console.warn(
      "[setupInitialMarkerOrientation] Função updateUserMarkerDirection não disponível"
    );
  }
}

/**
 * Extrai coordenadas dos dados geométricos da rota
 * @param {Object} routeData - Dados GeoJSON da rota
 * @param {Array} instructions - Instruções a serem mapeadas
 * @returns {Array} - Instruções com coordenadas corretas
 */
function extractCoordinatesFromRoute(routeData, instructions) {
  if (!routeData || !routeData.features || !routeData.features[0]) {
    console.error("[extractCoordinatesFromRoute] Dados da rota inválidos");
    return null;
  }

  try {
    // Obter geometria da rota
    const geometry = routeData.features[0].geometry;
    if (
      !geometry ||
      !geometry.coordinates ||
      !Array.isArray(geometry.coordinates)
    ) {
      console.error("[extractCoordinatesFromRoute] Geometria inválida");
      return null;
    }

    // Mapear pontos de rota para instruções
    const routePoints = geometry.coordinates;

    // Se houver way_points nas instruções, usá-los
    const instructionsWithWaypoints = instructions.map((instruction, index) => {
      const wayPointIndices = instruction.way_points;

      if (Array.isArray(wayPointIndices) && wayPointIndices.length >= 1) {
        const pointIndex = wayPointIndices[0]; // Geralmente o início do segmento

        if (routePoints[pointIndex]) {
          // Coordenadas GeoJSON são [longitude, latitude]
          const point = routePoints[pointIndex];
          return {
            ...instruction,
            longitude: point[0],
            latitude: point[1],
          };
        }
      }

      // Fallback: distribuir pontos uniformemente se não houver way_points
      const pointIndex = Math.floor(
        (index / instructions.length) * routePoints.length
      );
      if (routePoints[pointIndex]) {
        return {
          ...instruction,
          longitude: routePoints[pointIndex][0],
          latitude: routePoints[pointIndex][1],
        };
      }

      return instruction;
    });

    return instructionsWithWaypoints;
  } catch (error) {
    console.error(
      "[extractCoordinatesFromRoute] Erro ao extrair coordenadas:",
      error
    );
    return null;
  }
}

/**
 * Extrai coordenadas específicas para uma instrução da geometria da rota
 * @param {Object} routeData - Dados GeoJSON da rota
 * @param {number} stepIndex - Índice da instrução
 * @returns {Object|null} - Coordenadas normalizadas ou null
 */
function extractCoordinatesFromGeometry(routeData, stepIndex) {
  if (!routeData || !routeData.features || !routeData.features[0]) {
    return null;
  }

  try {
    // Obter geometria da rota
    const geometry = routeData.features[0].geometry;
    if (
      !geometry ||
      !geometry.coordinates ||
      !Array.isArray(geometry.coordinates)
    ) {
      return null;
    }

    // Obter propriedades para encontrar way_points
    const properties = routeData.features[0].properties;
    const segments = properties?.segments || [];
    const steps = segments[0]?.steps || [];

    // Verificar se temos o passo correspondente
    if (steps[stepIndex]) {
      const wayPoints = steps[stepIndex].way_points;

      if (Array.isArray(wayPoints) && wayPoints.length >= 1) {
        const pointIndex = wayPoints[0]; // Geralmente o início do segmento

        if (geometry.coordinates[pointIndex]) {
          // Coordenadas GeoJSON são [longitude, latitude]
          const point = geometry.coordinates[pointIndex];
          return {
            longitude: point[0],
            latitude: point[1],
          };
        }
      }
    }

    // Fallback: distribuir pontos uniformemente
    const pointIndex = Math.floor(
      (stepIndex / steps.length) * geometry.coordinates.length
    );
    if (geometry.coordinates[pointIndex]) {
      return {
        longitude: geometry.coordinates[pointIndex][0],
        latitude: geometry.coordinates[pointIndex][1],
      };
    }

    return null;
  } catch (error) {
    console.error("[extractCoordinatesFromGeometry] Erro:", error);
    return null;
  }
}

// Adicionar função de diagnóstico:

/**
 * Gera um relatório detalhado do estado atual da navegação
 * @param {string} [title="Diagnóstico de Navegação"] - Título do relatório
 */
export function diagnosticReport(title = "Diagnóstico de Navegação") {
  console.group(title);

  // Estado geral
  console.log("Estado da navegação:", {
    ativa: navigationState.isActive,
    pausada: navigationState.isPaused,
    passoAtual: navigationState.currentStepIndex,
    totalPassos: navigationState.instructions?.length || 0,
    destino: navigationState.selectedDestination,
  });

  // Verificar instruções
  if (navigationState.instructions && navigationState.instructions.length > 0) {
    console.group("Instruções:");

    navigationState.instructions.forEach((instruction, index) => {
      const isCurrentStep = index === navigationState.currentStepIndex;

      console.log(
        `${isCurrentStep ? "→" : " "} Passo ${index}: ${
          instruction.original || "?"
        }`
      );

      const coords = {
        lat: instruction.latitude || instruction.lat,
        lon: instruction.longitude || instruction.lon || instruction.lng,
      };

      const hasValidCoords =
        coords.lat !== undefined &&
        !isNaN(coords.lat) &&
        coords.lon !== undefined &&
        !isNaN(coords.lon);

      console.log(
        `   Coordenadas: ${
          hasValidCoords
            ? `Lat ${coords.lat}, Lon ${coords.lon}`
            : "❌ INVÁLIDAS"
        }`
      );
    });

    console.groupEnd();
  } else {
    console.log("❌ Sem instruções disponíveis");
  }

  // Verificar posição atual
  console.log(
    "Posição atual:",
    userLocation
      ? {
          lat: userLocation.latitude,
          lon: userLocation.longitude,
          precisão: userLocation.accuracy || "N/A",
          heading: userLocation.heading || "N/A",
        }
      : "❌ Indefinida"
  );

  // Destino
  if (navigationState.selectedDestination) {
    const destination = navigationState.selectedDestination;
    console.log("Destino:", {
      nome: destination.name || "Destino sem nome",
      lat: destination.lat,
      lon: destination.lon,
    });

    // Se temos posição e destino, calcular distância
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      const distanceToDestination = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        destination.lat,
        destination.lon
      );

      console.log(
        `Distância até o destino: ${distanceToDestination.toFixed(1)}m`
      );
    }
  } else {
    console.log("❌ Destino indefinido");
  }

  console.groupEnd();
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
  // Validação robusta de parâmetros com valores padrão
  if (!currentPosition) {
    console.warn(
      "[calculateRouteRemainingDistance] Posição atual indefinida, usando valor padrão"
    );
    // Usar destino para estimar valor padrão
    if (navigationState && navigationState.selectedDestination) {
      const dest = navigationState.selectedDestination;
      return dest ? 500 : 0; // Valor padrão arbitrário
    }
    return 0;
  }

  if (!currentPosition.latitude || !currentPosition.longitude) {
    console.warn(
      "[calculateRouteRemainingDistance] Coordenadas de posição inválidas"
    );
    // Tentar usar últimas coordenadas válidas disponíveis
    if (navigationState && navigationState.lastProcessedPosition) {
      currentPosition = navigationState.lastProcessedPosition;
      console.log(
        "[calculateRouteRemainingDistance] Usando última posição conhecida como fallback"
      );
    } else {
      return 0;
    }
  }

  // Validar instruções com valores padrão
  if (!Array.isArray(instructions) || instructions.length === 0) {
    console.warn("[calculateRouteRemainingDistance] Instruções inválidas");
    // Estimar distância diretamente ao destino
    if (navigationState && navigationState.selectedDestination) {
      const dest = navigationState.selectedDestination;
      const directDistanceToDest = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        dest.lat,
        dest.lon
      );
      console.log(
        "[calculateRouteRemainingDistance] Usando distância direta ao destino:",
        directDistanceToDest
      );
      return directDistanceToDest;
    }
    return 0;
  }

  if (typeof currentStepIndex !== "number" || currentStepIndex < 0) {
    // Se o índice for inválido, assumir o início
    console.warn(
      "[calculateRouteRemainingDistance] Índice de passo inválido, usando 0"
    );
    currentStepIndex = 0;
  }

  // Garantir que o índice não exceda o array
  currentStepIndex = Math.min(currentStepIndex, instructions.length - 1);

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
      const stepLat = currentStep.latitude || currentStep.lat || 0;
      const stepLon =
        currentStep.longitude || currentStep.lon || currentStep.lng || 0;

      if (stepLat && stepLon && !isNaN(stepLat) && !isNaN(stepLon)) {
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
      if (step && typeof step.distance === "number" && !isNaN(step.distance)) {
        totalRemaining += step.distance;
      } else if (step && i < instructions.length - 1) {
        // Se não tiver distância definida, calcular da coordenada atual para a próxima
        const nextStep = instructions[i + 1];

        const currentLat = step.latitude || step.lat;
        const currentLon = step.longitude || step.lon || step.lng;

        const nextLat = nextStep.latitude || nextStep.lat;
        const nextLon = nextStep.longitude || nextStep.lon || nextStep.lng;

        if (currentLat && currentLon && nextLat && nextLon) {
          const segmentDist = calculateDistance(
            currentLat,
            currentLon,
            nextLat,
            nextLon
          );
          totalRemaining += segmentDist;
        }
      }
    }

    // Garantir valor não-negativo
    totalRemaining = Math.max(0, totalRemaining);

    console.log(
      `[calculateRouteRemainingDistance] Distância total restante: ${totalRemaining.toFixed(
        1
      )}m`
    );
    return totalRemaining;
  } catch (error) {
    console.error("[calculateRouteRemainingDistance] Erro:", error);

    // Em caso de erro, fazer uma estimativa simples da distância até o destino final
    try {
      if (instructions.length > 0) {
        const finalStep = instructions[instructions.length - 1];
        const finalLat = finalStep.latitude || finalStep.lat;
        const finalLon = finalStep.longitude || finalStep.lon || finalStep.lng;

        if (finalLat && finalLon) {
          const directDistance = calculateDistance(
            currentPosition.latitude,
            currentPosition.longitude,
            finalLat,
            finalLon
          );

          console.log(
            `[calculateRouteRemainingDistance] Distância direta estimada: ${directDistance.toFixed(
              1
            )}m (fallback)`
          );
          return directDistance;
        }
      }
    } catch (estimationError) {
      console.error(
        "[calculateRouteRemainingDistance] Erro no fallback:",
        estimationError
      );
    }

    return 0; // Fallback final seguro
  }
}

/**
 * Verifica se a navegação está em um estado inconsistente e tenta recuperá-la
 * @returns {boolean} - Se a recuperação foi bem-sucedida
 */
function recoverNavigationIfNeeded() {
  if (!navigationState.isActive) {
    return false; // Não há navegação ativa para recuperar
  }

  // Verificar problemas comuns
  const problems = [];

  // 1. Verificar se temos instruções
  if (
    !navigationState.instructions ||
    navigationState.instructions.length === 0
  ) {
    problems.push("instruções ausentes");
  }

  // 2. Verificar se temos destino selecionado
  if (!navigationState.selectedDestination) {
    problems.push("destino ausente");
  }

  // 3. Verificar se o marcador do usuário existe
  if (!window.userMarker) {
    problems.push("marcador do usuário ausente");
  }

  // 4. Verificar se há rota no mapa
  if (!window.currentRoute) {
    problems.push("rota ausente no mapa");
  }

  // 5. Verificar se o banner existe
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (!banner) {
    problems.push("banner ausente");
  }

  // Se não houver problemas, não é necessária recuperação
  if (problems.length === 0) {
    return true;
  }

  console.warn(
    `[recoverNavigationIfNeeded] Detectados problemas: ${problems.join(", ")}`
  );

  // Tentar recuperar com base no problema
  try {
    // Se faltar o banner, tentar recriar
    if (!banner && typeof createNavigationBanner === "function") {
      createNavigationBanner();
      console.log("[recoverNavigationIfNeeded] Banner recriado");
    }

    // Se faltar o marcador do usuário e tivermos posição, recriar
    if (!window.userMarker && window.userLocation) {
      if (typeof createUserMarker === "function") {
        createUserMarker(
          window.userLocation.latitude,
          window.userLocation.longitude,
          window.userLocation.heading || 0,
          window.userLocation.accuracy || 15
        );
        console.log("[recoverNavigationIfNeeded] Marcador do usuário recriado");
      }
    }

    // Se faltar a rota e tivermos destino e posição, recalcular
    if (
      !window.currentRoute &&
      navigationState.selectedDestination &&
      window.userLocation &&
      typeof recalculateRoute === "function"
    ) {
      console.log("[recoverNavigationIfNeeded] Recalculando rota");
      recalculateRoute(window.userLocation, {
        showNotifications: false,
        forceRecalculation: true,
      });
    }

    // Verificar barra de progresso
    if (typeof ensureProgressBarExists === "function") {
      ensureProgressBarExists();
    }

    return true;
  } catch (error) {
    console.error(
      "[recoverNavigationIfNeeded] Erro durante recuperação:",
      error
    );
    return false;
  }
}

/**
 * Calcula o progresso atual da rota com maior precisão e tolerância a erros
 * @param {Object} userLocation - Posição atual do usuário
 * @param {Object} routeData - Dados completos da rota
 * @param {Array} instructions - Instruções de navegação processadas
 * @param {Number} currentStepIndex - Índice da instrução atual
 * @returns {Number} - Progresso como porcentagem (0-100)
 */
function calculateRouteProgress(
  currentPosition,
  instructions,
  currentStepIndex
) {
  try {
    // Valores padrão
    const defaultProgress = {
      percentage: 0,
      completed: 0,
      total: 0,
    };

    // Validações básicas
    if (
      !currentPosition ||
      !currentPosition.latitude ||
      !currentPosition.longitude
    ) {
      return defaultProgress;
    }

    if (!Array.isArray(instructions) || instructions.length === 0) {
      return defaultProgress;
    }

    // Calcular distância total da rota somando todas as instruções
    let totalDistance = 0;
    let calculatedTotal = false;

    // Primeiro tentar usar totalRouteDistance se disponível
    if (
      navigationState &&
      typeof navigationState.totalRouteDistance === "number" &&
      navigationState.totalRouteDistance > 0
    ) {
      totalDistance = navigationState.totalRouteDistance;
      calculatedTotal = true;
    }

    // Se não tiver totalRouteDistance, calcular manualmente
    if (!calculatedTotal) {
      for (let i = 0; i < instructions.length; i++) {
        const step = instructions[i];
        if (
          step &&
          typeof step.distance === "number" &&
          !isNaN(step.distance)
        ) {
          totalDistance += step.distance;
        }
      }
    }

    // Verificar se temos uma distância total válida
    if (totalDistance <= 0) {
      // Último recurso: estimar baseado no destino final
      if (navigationState && navigationState.selectedDestination) {
        const dest = navigationState.selectedDestination;
        totalDistance = calculateDistance(
          instructions[0].latitude || instructions[0].lat,
          instructions[0].longitude ||
            instructions[0].lon ||
            instructions[0].lng,
          dest.lat,
          dest.lon
        );
        totalDistance = Math.max(totalDistance, 50); // Mínimo de 50m para evitar divisões por zero
      } else {
        totalDistance = 100; // Valor arbitrário para evitar erros
      }
    }

    // Calcular distância restante
    const remainingDistance = calculateRouteRemainingDistance(
      currentPosition,
      instructions,
      currentStepIndex
    );

    // Verificar valores negativos ou inválidos
    if (isNaN(remainingDistance) || remainingDistance < 0) {
      return defaultProgress;
    }

    // Calcular distância percorrida e percentual
    const completedDistance = Math.max(0, totalDistance - remainingDistance);
    let percentage = Math.round((completedDistance / totalDistance) * 100);

    // Validar percentual para estar entre 0 e 100
    percentage = Math.max(0, Math.min(100, percentage));

    // Verificar valores inconsistentes
    if (isNaN(percentage)) {
      percentage = 0;
    }

    return {
      percentage,
      completed: completedDistance,
      total: totalDistance,
    };
  } catch (error) {
    console.error("[calculateRouteProgress] Erro:", error);
    return {
      percentage: 0,
      completed: 0,
      total: 0,
    };
  }
}

/**
 * Atualiza a barra de progresso visual com animação suave
 * @param {Number} progress - Progresso como percentual (0-100)
 */
function updateProgressBar(progress) {
  try {
    // Garantir valor numérico válido
    const validProgress = Math.max(
      0.1,
      Math.min(100, parseFloat(progress) || 0.1)
    );

    // Encontrar elemento da barra de progresso
    const progressBar =
      document.querySelector(".progress-bar") ||
      document.getElementById("progress");

    if (!progressBar) {
      console.warn(
        "[updateProgressBar] Barra de progresso não encontrada, criando..."
      );

      // Tentar criar a barra de progresso usando ensureProgressBarExists
      if (typeof ensureProgressBarExists === "function") {
        ensureProgressBarExists();
        // Tentar novamente após criar
        setTimeout(() => updateProgressBar(validProgress), 50);
      }
      return false;
    }

    // Aplicar largura com base na porcentagem
    progressBar.style.width = `${validProgress}%`;

    // Atualizar atributo aria para acessibilidade
    progressBar.setAttribute("aria-valuenow", validProgress);

    // Adicionar classes visuais para diferentes marcos
    if (validProgress >= 90) {
      progressBar.classList.add("almost-complete");
      progressBar.classList.remove("half-complete");
    } else if (validProgress >= 50) {
      progressBar.classList.add("half-complete");
      progressBar.classList.remove("almost-complete");
    } else {
      progressBar.classList.remove("half-complete", "almost-complete");
    }

    // Atualizar texto de progresso se existir
    const progressText = document.getElementById("progress-text");
    if (progressText) {
      progressText.textContent = `${Math.round(validProgress)}%`;
    }

    return true;
  } catch (error) {
    console.error(
      "[updateProgressBar] Erro ao atualizar barra de progresso:",
      error
    );
    return false;
  }
}

/**
 * Atualiza o progresso da navegação e a barra visual
 * @param {Object} userLocation - Localização atual do usuário
 */
function updateNavigationProgress(userLocation) {
  try {
    // Verificar se temos localização válida
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.warn("[updateNavigationProgress] Localização inválida");
      return 0;
    }

    // Obter dados necessários
    const routeData = navigationState.routeData || getLastSavedRouteData();
    const instructions = navigationState.instructions || [];
    const currentStepIndex = navigationState.currentStepIndex || 0;

    // Calcular progresso atual
    const progress = calculateRouteProgress(
      userLocation,
      routeData,
      instructions,
      currentStepIndex
    );

    // Garantir que esteja pelo menos com o valor mínimo visível
    const displayProgress = Math.max(0.1, progress);

    // Atualizar estado apenas se o valor mudou significativamente (>0.5%)
    if (Math.abs((navigationState.routeProgress || 0) - progress) > 0.5) {
      // Atualizar estado
      navigationState.routeProgress = progress;

      // Atualizar barra de progresso visual
      updateProgressBar(displayProgress);

      // Log do progresso
      console.log(
        `[updateNavigationProgress] Progresso atualizado: ${progress}%`
      );
    }

    return progress;
  } catch (error) {
    console.error(
      "[updateNavigationProgress] Erro ao atualizar progresso:",
      error
    );
    return 0;
  }
}
/**
 * Cancela a navegação ativa
 */
export function cancelNavigation(options = {}) {
  console.log("[cancelNavigation] Finalizando navegação...");
  // Disparar evento
  dispatchActionEvent("cancelNavigation");
  // Notificar que a navegação está terminando para restaurar a UI
  adjustUIForNavigation(false);
  // Restaurar posição da área de mensagens
  repositionMessagesArea(false);
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
 * @returns {boolean} - Indica se a atualização foi bem-sucedida
 */
export function updateRealTimeNavigation(userPos = null) {
  // Usar o parâmetro se fornecido, caso contrário usar a variável global
  const currentPos = userPos || userLocation;

  // Validação mais rigorosa
  if (!currentPos) {
    console.warn("[updateRealTimeNavigation] Posição indefinida");
    return false;
  }

  if (typeof currentPos !== "object") {
    console.error(
      "[updateRealTimeNavigation] Tipo inválido de posição:",
      typeof currentPos
    );
    return false;
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
    return false;
  }

  console.log("[updateRealTimeNavigation] Atualizando com posição:", {
    lat: currentPos.latitude,
    lon: currentPos.longitude,
    accuracy: currentPos.accuracy || "N/A",
  });

  const instructions = navigationState.instructions;
  if (!instructions || instructions.length === 0) return false;

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
      return true; // Ignorar atualizações muito próximas, mas não é erro
    }

    // Atualizar timestamp da última atualização
    navigationState.lastUpdateTime = now;
  }

  // Determinar qual passo atual deve ser exibido
  const currentStepIndex = navigationState.currentStepIndex;
  let shouldUpdateStep = false;
  let nextStepIndex = currentStepIndex;

  // Modificar esta parte para sempre calcular e usar a direção para o próximo passo
  if (currentStepIndex < instructions.length - 1) {
    const currentStep = instructions[currentStepIndex];
    const nextStep = instructions[currentStepIndex + 1];

    if (currentStep && nextStep) {
      // Extrair coordenadas do próximo passo
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

      // Verificar validade das coordenadas
      if (nextStepLat !== undefined && nextStepLon !== undefined) {
        // Calcular o ângulo para o próximo passo
        const bearing = calculateBearing(
          parseFloat(currentPos.latitude),
          parseFloat(currentPos.longitude),
          parseFloat(nextStepLat),
          parseFloat(nextStepLon)
        );

        // Armazenar a direção calculada para uso posterior
        navigationState.calculatedBearing = bearing;

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

  // MODIFICAÇÃO: Em vez de usar o heading do dispositivo, usar a direção para o próximo passo
  // ou usar a direção para o próximo passo se disponível
  if (window.lastRoutePoints && window.lastRoutePoints.length > 0) {
    // Atualizar a direção do marcador baseado nos pontos da rota
    updateUserMarkerDirection(currentPos, window.lastRoutePoints);
  } else if (navigationState.calculatedBearing !== undefined) {
    // Fallback: Usar o bearing calculado anteriormente
    updateUserMarker(
      currentPos.latitude,
      currentPos.longitude,
      navigationState.calculatedBearing,
      currentPos.accuracy || 15
    );
  }

  // Atualizar a última posição processada
  navigationState.lastProcessedPosition = {
    latitude: currentPos.latitude,
    longitude: currentPos.longitude,
    accuracy: currentPos.accuracy,
    heading: navigationState.calculatedBearing || currentPos.heading, // Usar o bearing calculado
  };

  return true;
}

/**
 * Verifica se os plugins necessários para rotação estão carregados
 * @returns {boolean} Se os plugins estão disponíveis
 */
export function checkRotationPluginsAvailability() {
  // Verificar rotação de marcadores
  const markerRotationAvailable =
    typeof L !== "undefined" &&
    typeof L.Marker.prototype.setRotationAngle === "function";

  // Verificar rotação de mapa
  const mapRotationAvailable =
    typeof L !== "undefined" &&
    typeof L.Map.prototype.setBearing === "function";

  console.log("[checkRotationPluginsAvailability] Plugins de rotação:", {
    marcador: markerRotationAvailable ? "✅ Disponível" : "❌ Não carregado",
    mapa: mapRotationAvailable ? "✅ Disponível" : "❌ Não carregado",
  });

  return markerRotationAvailable && mapRotationAvailable;
}

// Chamar no início da aplicação ou ao inicializar o mapa
/**
 * Extrai coordenadas de dados GeoJSON ou outros formatos de maneira robusta
 * @param {Object} point - Ponto a ser normalizado
 * @returns {Object} - Objeto com latitude e longitude normalizadas
 */
function normalizeCoordinates(point) {
  if (!point) return null;

  // Inicializar coordenadas
  let lat = null,
    lon = null;

  // Caso 1: Objeto já tem latitude/longitude
  if (
    typeof point.latitude === "number" &&
    typeof point.longitude === "number"
  ) {
    lat = point.latitude;
    lon = point.longitude;
  }
  // Caso 2: Objeto tem lat/lon ou lat/lng
  else if (
    typeof point.lat === "number" &&
    (typeof point.lon === "number" || typeof point.lng === "number")
  ) {
    lat = point.lat;
    lon = point.lon || point.lng;
  }
  // Caso 3: Formato GeoJSON (coordinates: [lon, lat])
  else if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    // GeoJSON usa [longitude, latitude]
    lon = point.coordinates[0];
    lat = point.coordinates[1];
  }
  // Caso 4: Array [lat, lon]
  else if (Array.isArray(point) && point.length >= 2) {
    // Decisão baseada em magnitude (latitude geralmente < 90)
    if (Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180) {
      lat = point[0];
      lon = point[1];
    } else {
      // Provavelmente [lon, lat]
      lon = point[0];
      lat = point[1];
    }
  }

  // Validar
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    console.warn(
      "[normalizeCoordinates] Não foi possível extrair coordenadas válidas:",
      point
    );
    return null;
  }

  return { latitude: lat, longitude: lon };
}

// Adicionar função de diagnóstico e recuperação:

/**
 * Diagnostica e recupera navegação com problemas
 * @param {Error} error - Erro capturado
 * @param {Object} state - Estado atual de navegação
 * @returns {boolean} - Se conseguiu recuperar
 */
function recoverFromNavigationError(error, state = navigationState) {
  console.error("[recoverFromNavigationError] Problema na navegação:", error);

  // Verificar instruções
  if (
    !state.instructions ||
    !Array.isArray(state.instructions) ||
    state.instructions.length === 0
  ) {
    console.warn(
      "[recoverFromNavigationError] Instruções inválidas:",
      state.instructions
    );
    return false;
  }

  console.log("[recoverFromNavigationError] Diagnóstico de instruções:");

  // Verificar cada instrução
  let hasValidCoordinates = false;

  state.instructions.forEach((instruction, index) => {
    const coords = normalizeCoordinates(instruction);
    console.log(`Passo ${index}: ${instruction.original || "Desconhecido"}`);
    console.log(
      `  Coords: ${
        coords
          ? `Lat: ${coords.latitude}, Lon: ${coords.longitude}`
          : "INVÁLIDO"
      }`
    );

    if (coords) {
      // Corrigir instruções com coordenadas inválidas
      instruction.latitude = coords.latitude;
      instruction.longitude = coords.longitude;
      hasValidCoordinates = true;
    }
  });

  if (!hasValidCoordinates) {
    console.error(
      "[recoverFromNavigationError] Não foi possível recuperar - nenhuma coordenada válida"
    );
    return false;
  }

  console.log(
    "[recoverFromNavigationError] Coordenadas normalizadas, tentando continuar navegação"
  );
  return true;
}

/**
 * Monitora a aproximação de curvas e fornece feedback apropriado
 * @param {Object} currentPos - Posição atual do usuário
 * @param {Object} nextTurn - Dados da próxima curva
 * @param {number} distance - Distância em metros até a curva
 */
export function monitorApproachingTurn(currentPos, nextTurn, distance) {
  if (!nextTurn || distance === undefined) return;

  try {
    // Não notificar novamente se já notificou para essa curva
    const turnId = `${nextTurn.latitude || nextTurn.lat}-${
      nextTurn.longitude || nextTurn.lon || nextTurn.lng
    }`;

    // Criar objeto para rastrear notificações se não existir
    if (!navigationState.notifiedTurns) {
      navigationState.notifiedTurns = {};
    }

    // Níveis de aproximação com feedback gradual
    if (distance < 100 && distance >= 50) {
      // Primeiro alerta suave
      if (!navigationState.notifiedTurns[turnId]?.level100) {
        console.log(
          `[monitorApproachingTurn] Aproximando-se de curva (${distance.toFixed(
            0
          )}m)`
        );

        // Destacar banner se função disponível
        if (typeof flashBanner === "function") {
          flashBanner(true);
        }

        // Vibrar se disponível
        if ("vibrate" in navigator) {
          navigator.vibrate(100);
        }

        // Marcar como notificado
        navigationState.notifiedTurns[turnId] = {
          ...navigationState.notifiedTurns[turnId],
          level100: true,
        };
      }
    } else if (distance < 50 && distance >= 20) {
      // Alerta mais intenso
      if (!navigationState.notifiedTurns[turnId]?.level50) {
        console.log(
          `[monitorApproachingTurn] Curva iminente (${distance.toFixed(0)}m)`
        );

        if ("vibrate" in navigator) {
          navigator.vibrate([100, 50, 100]);
        }

        // Anunciar por voz se função disponível
        if (typeof speak === "function" && !navigationState.isMuted) {
          const simplifiedInstruction =
            nextTurn.simplifiedInstruction || "Prepare-se para virar";
          speak(`Em ${Math.round(distance)} metros, ${simplifiedInstruction}`);
        }

        navigationState.notifiedTurns[turnId] = {
          ...navigationState.notifiedTurns[turnId],
          level50: true,
          level100: true,
        };
      }
    } else if (distance < 20) {
      // Alerta de manobra imediata
      if (!navigationState.notifiedTurns[turnId]?.level20) {
        console.log(
          `[monitorApproachingTurn] Execute a manobra agora! (${distance.toFixed(
            0
          )}m)`
        );

        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }

        if (typeof speak === "function" && !navigationState.isMuted) {
          const instruction = nextTurn.simplifiedInstruction || "Vire agora";
          speak(instruction);
        }

        navigationState.notifiedTurns[turnId] = {
          ...navigationState.notifiedTurns[turnId],
          level20: true,
          level50: true,
          level100: true,
        };
      }
    } else if (distance > 150) {
      // Reset notificações quando estiver longe da curva
      if (navigationState.notifiedTurns[turnId]) {
        delete navigationState.notifiedTurns[turnId];
      }
    }
  } catch (error) {
    console.error("[monitorApproachingTurn] Erro:", error);
  }
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
 * @param {Object} userLocation - Objeto com dados de localização do usuário
 * @param {number} [userLocation.latitude] - Latitude atual do usuário
 * @param {number} [userLocation.longitude] - Longitude atual do usuário
 * @param {Object} [options] - Opções adicionais para o recálculo
 * @returns {Promise<boolean>} - Indica se o recálculo foi bem-sucedido
 */
export async function recalculateRoute(
  userLocation,
  options = { showNotifications: true, forceRecalculation: false }
) {
  // Verificar se já há um recálculo em andamento
  if (recalculationInProgress && !options.forceRecalculation) {
    console.log(
      "[recalculateRoute] Recálculo já em andamento, ignorando nova solicitação"
    );
    return false;
  }

  recalculationInProgress = true;
  console.log("[recalculateRoute] Iniciando recálculo de rota...");

  // Incrementar contador de recálculos para análise
  if (navigationState.performance) {
    navigationState.performance.recalculations =
      (navigationState.performance.recalculations || 0) + 1;
  }

  try {
    // Validar dados de entrada
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.error(
        "[recalculateRoute] Dados de localização do usuário inválidos"
      );
      return false;
    }

    const destination = navigationState.selectedDestination;
    if (!destination || !destination.lat || !destination.lon) {
      console.error("[recalculateRoute] Destino não definido");
      return false;
    }

    // Backup da rota atual e instruções antes do recálculo
    const previousInstructions = [...(navigationState.instructions || [])];
    const previousRouteData = navigationState.routeData;

    // Verificar se devemos notificar o usuário sobre o recálculo
    if (options.showNotifications) {
      // Notificar usuário sobre recálculo
      showNotification(
        getGeneralText("recalculating", navigationState.lang),
        "info"
      );

      // Indicação visual
      showNavigationLoading(
        getGeneralText("recalculating", navigationState.lang)
      );

      // Feedback de voz se não estiver em modo mudo
      if (!navigationState.isMuted && typeof speak === "function") {
        speak(getGeneralText("recalculating", navigationState.lang));
      }
    }

    // Calcular nova rota
    const routeData = await plotRouteOnMap(
      userLocation.latitude,
      userLocation.longitude,
      destination.lat,
      destination.lon,
      "foot-walking",
      destination.name
    );

    // Verificar se a rota foi calculada com sucesso
    if (!routeData || !routeData.features || routeData.features.length === 0) {
      console.error("[recalculateRoute] Falha ao obter dados da nova rota");

      if (options.showNotifications) {
        showNotification(
          getGeneralText("route_error", navigationState.lang),
          "error"
        );
      }

      // Reverter para a rota anterior
      navigationState.routeData = previousRouteData;
      return false;
    }

    // Salvar a nova rota
    navigationState.routeData = routeData;
    setLastRouteData(routeData);

    // Processar as novas instruções
    const processedInstructions = await processRouteInstructions(
      routeData,
      navigationState.lang
    );

    // Verificar se as instruções foram processadas corretamente
    if (!processedInstructions || processedInstructions.length === 0) {
      console.error(
        "[recalculateRoute] Falha ao processar instruções da nova rota"
      );

      // Tentar reverter para as instruções anteriores
      navigationState.instructions = previousInstructions;

      if (options.showNotifications) {
        showNotification(
          getGeneralText("route_error", navigationState.lang),
          "error"
        );
      }

      return false;
    }

    // Após recalcular com sucesso:
    if (processedInstructions.length > 0) {
      // Atualizar instruções
      navigationState.instructions = processedInstructions;

      // IMPORTANTE: Recalcular progresso com base na nova rota
      const newProgress = calculateRouteProgress(
        userLocation,
        routeData,
        processedInstructions,
        0 // Começa na primeira instrução da nova rota
      );

      // Reiniciar o índice atual para a primeira instrução
      navigationState.currentStepIndex = 0;
      navigationState.deviationDetected = false;
      navigationState.notifiedTurns = {}; // Limpar notificações de curvas prévias

      // Atualizar estado e UI
      navigationState.routeProgress = newProgress;
      updateProgressBar(newProgress);

      // Atualizar objeto de progresso com mais detalhes
      navigationState.progress = {
        totalDistance: routeData.properties?.summary?.distance || 0,
        completedDistance: 0,
        percentage: newProgress,
        lastUpdated: Date.now(),
      };

      // Exibir a primeira instrução da nova rota
      if (processedInstructions[0]) {
        displayNavigationStep(processedInstructions[0], true);
      }

      // Adicionar diagnóstico na interface para desenvolvimento
      if (options.debug) {
        const diagElement = document.createElement("div");
        diagElement.className = "route-diagnostic";
        diagElement.style.display = "none";
        diagElement.textContent = JSON.stringify({
          timestamp: new Date().toISOString(),
          recalculated: true,
          progress: newProgress,
          totalDistance: routeData.properties?.summary?.distance || 0,
          userPosition: [userLocation.latitude, userLocation.longitude],
        });
        document.body.appendChild(diagElement);
      }

      console.log(
        `[recalculateRoute] Rota recalculada com sucesso. Novo progresso: ${newProgress}%. ` +
          `Instruções: ${processedInstructions.length}, Distância total: ${
            routeData.properties?.summary?.distance?.toFixed(1) || "?"
          }m`
      );

      // Notificar usuário sobre recálculo bem-sucedido
      if (options.showNotifications) {
        showNotification(
          getGeneralText("routeRecalculatedOk", navigationState.lang),
          "success"
        );
      }

      // Medir tempo que o recálculo levou se estamos armazenando métricas
      if (navigationState.performance) {
        navigationState.performance.lastRecalculation = {
          timestamp: Date.now(),
          success: true,
          position: [userLocation.latitude, userLocation.longitude],
        };
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error("[recalculateRoute] Erro durante recálculo:", error);

    // Notificar erro
    if (options.showNotifications) {
      showNotification(
        getGeneralText("route_error", navigationState.lang),
        "error"
      );
    }

    // Registrar falha
    if (navigationState.performance) {
      navigationState.performance.lastRecalculation = {
        timestamp: Date.now(),
        success: false,
        error: error.message,
      };
    }

    return false;
  } finally {
    recalculationInProgress = false;

    // Remover indicador de carregamento
    const loadingIndicator = document.querySelector(".navigation-loading");
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
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
  if (!lat1 || !lon1 || !lat2) return Infinity;

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
  validateDestination,
  notifyDeviation,
  recalculateRoute,
};

// Modificação na função setupRealTimeUpdates (por volta da linha 1679)

/**
 * Configura atualizações em tempo real da navegação,
 * incluindo posição do usuário, progresso da rota e atualização da interface
 */
function setupRealTimeUpdates() {
  // Limpar intervalo existente se houver
  if (navigationState.updateInterval) {
    clearInterval(navigationState.updateInterval);
  }

  // Definir constante para intervalo de atualização
  const UPDATE_INTERVAL = 1000; // 1 segundo para maior fluidez

  // Monitorar última vez que a barra de progresso foi atualizada
  let lastProgressUpdate = 0;
  const PROGRESS_UPDATE_INTERVAL = 2000; // Atualizar a cada 2 segundos

  // Rastrear último cálculo de direção para evitar atualizações desnecessárias
  let lastDirectionUpdate = 0;
  const DIRECTION_UPDATE_INTERVAL = 1500; // Atualizar a cada 1.5 segundos

  // Configurar intervalo para atualizações regulares
  navigationState.updateInterval = setInterval(() => {
    // Verificar se a navegação está ativa
    if (!navigationState.isActive || navigationState.isPaused) {
      return;
    }

    // NOVO: Tentar recuperar se necessário a cada 30 segundos
    const now = Date.now();
    const RECOVERY_INTERVAL = 30000; // 30 segundos

    if (now - (navigationState.lastRecoveryAttempt || 0) > RECOVERY_INTERVAL) {
      navigationState.lastRecoveryAttempt = now;
      recoverNavigationIfNeeded();
    }

    // Obter localização do usuário
    const userLocation = window.userLocation;
    if (
      !userLocation ||
      !isValidCoordinate(userLocation.latitude, userLocation.longitude)
    ) {
      console.warn("[setupRealTimeUpdates] Posição do usuário inválida");
      return;
    }

    // Calcular distância movida desde a última atualização
    let distanceMoved = 0;
    if (navigationState.lastProcessedPosition) {
      distanceMoved = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        navigationState.lastProcessedPosition.latitude,
        navigationState.lastProcessedPosition.longitude
      );
    }

    // MODIFICADO: Verificação de erro antes de chamar as funções
    try {
      updateRealTimeNavigation(userLocation);
    } catch (error) {
      console.error(
        "[setupRealTimeUpdates] Erro ao atualizar navegação:",
        error
      );
    }

    // Atualizar progresso da rota - apenas a cada intervalo definido ou se houver movimento significativo
    try {
      if (
        now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL ||
        distanceMoved > 5
      ) {
        updateNavigationProgress(userLocation);
        lastProgressUpdate = now;

        // Atualizar elemento visual do texto de progresso se existir
        const progressTextElement = document.getElementById("progress-text");
        if (
          progressTextElement &&
          navigationState.routeProgress !== undefined
        ) {
          progressTextElement.textContent = `${navigationState.routeProgress}%`;
        }
      }
    } catch (error) {
      console.error(
        "[setupRealTimeUpdates] Erro ao atualizar progresso:",
        error
      );
    }

    // Verificar chegada ao destino
    try {
      checkDestinationArrival(userLocation.latitude, userLocation.longitude);
    } catch (error) {
      console.error("[setupRealTimeUpdates] Erro ao verificar chegada:", error);
    }

    // IMPORTANTE: Atualizar a orientação do marcador com base na rota, não no heading
    try {
      if (
        window.lastRoutePoints &&
        window.lastRoutePoints.length > 0 &&
        (now - lastDirectionUpdate > DIRECTION_UPDATE_INTERVAL ||
          distanceMoved > 3)
      ) {
        lastDirectionUpdate = now;
        updateUserMarkerDirection(userLocation, window.lastRoutePoints);

        // Verificar se a direção calculada está disponível para debug
        if (navigationState.calculatedBearing !== undefined) {
          console.log(
            `[setupRealTimeUpdates] Direção para próximo ponto: ${navigationState.calculatedBearing.toFixed(
              1
            )}°`
          );
        }
      }
    } catch (error) {
      console.error(
        "[setupRealTimeUpdates] Erro ao atualizar direção do marcador:",
        error
      );
    }

    // Obter pontos da rota para orientação do marcador quando não disponíveis em lastRoutePoints
    try {
      if (!window.lastRoutePoints || window.lastRoutePoints.length === 0) {
        let routePoints = null;

        // Tentar extrair da rota atual
        if (
          window.currentRoute &&
          typeof window.currentRoute.getLatLngs === "function"
        ) {
          routePoints = window.currentRoute.getLatLngs();
          if (routePoints && routePoints.length > 0) {
            window.lastRoutePoints = routePoints;
            updateUserMarkerDirection(userLocation, routePoints);
          }
        }
        // Por último, tentar usar os waypoints de navigationState
        else if (
          navigationState.instructions &&
          navigationState.instructions.length > 0
        ) {
          routePoints = navigationState.instructions
            .map((instruction) => ({
              lat: instruction.latitude || instruction.lat,
              lng: instruction.longitude || instruction.lon || instruction.lng,
            }))
            .filter((point) => point.lat && point.lng);

          if (routePoints && routePoints.length > 0) {
            window.lastRoutePoints = routePoints;
            updateUserMarkerDirection(userLocation, routePoints);
          }
        }
      }
    } catch (error) {
      console.error(
        "[setupRealTimeUpdates] Erro ao obter pontos da rota:",
        error
      );
    }

    // Verificar se a rota precisa ser recalculada (se o usuário desviou)
    try {
      if (
        shouldRecalculateRoute &&
        typeof shouldRecalculateRoute === "function"
      ) {
        if (
          shouldRecalculateRoute(userLocation.latitude, userLocation.longitude)
        ) {
          const destination = navigationState.selectedDestination;
          if (destination && destination.lat && destination.lon) {
            console.log(
              "[setupRealTimeUpdates] Desencadeando recálculo de rota"
            );
            recalculateRoute(userLocation, {
              showNotifications: true,
              forceRecalculation: false,
            });
          }
        }
      }
    } catch (error) {
      console.error(
        "[setupRealTimeUpdates] Erro ao verificar necessidade de recálculo:",
        error
      );
    }

    // Atualizar a posição do marcador do usuário e armazenar a última posição processada
    navigationState.lastProcessedPosition = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      accuracy: userLocation.accuracy,
      heading: navigationState.calculatedBearing || userLocation.heading, // Preferir a direção calculada
      timestamp: now,
    };
  }, UPDATE_INTERVAL);

  console.log(
    "[setupRealTimeUpdates] Monitoramento em tempo real iniciado com intervalo de",
    UPDATE_INTERVAL,
    "ms"
  );

  // Verificar integridade da barra de progresso
  try {
    ensureProgressBarExists();
  } catch (error) {
    console.error(
      "[setupRealTimeUpdates] Erro ao verificar barra de progresso:",
      error
    );
  }

  return navigationState.updateInterval;
}

function ensureProgressBarExists() {
  try {
    // Verificar se já existe
    let progressBar =
      document.querySelector(".progress-bar") ||
      document.getElementById("progress");
    if (progressBar) return progressBar;

    console.log("[ensureProgressBarExists] Criando barra de progresso");

    // Buscar o banner de instrução
    const banner = document.getElementById("instruction-banner");
    if (!banner) {
      console.error("[ensureProgressBarExists] Banner não encontrado");
      return null;
    }

    // Buscar ou criar a seção secundária
    let secondarySection = banner.querySelector(".instruction-secondary");
    if (!secondarySection) {
      secondarySection = document.createElement("div");
      secondarySection.className = "instruction-secondary";
      banner.appendChild(secondarySection);
    }

    // Criar container da barra de progresso
    const container = document.createElement("div");
    container.className = "progress-container";
    container.style.position = "relative";
    container.style.height = "4px";
    container.style.width = "100%";
    container.style.background = "rgba(0,0,0,0.1)";
    container.style.borderRadius = "2px";
    container.style.overflow = "hidden";
    container.style.margin = "8px 0";
    secondarySection.appendChild(container);

    // Criar a barra de progresso
    progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.id = "progress";

    // Adicionar atributos ARIA para acessibilidade
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuenow", "0");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");

    // Estilo inline para garantir funcionamento
    progressBar.style.position = "absolute";
    progressBar.style.top = "0";
    progressBar.style.left = "0";
    progressBar.style.height = "100%";
    progressBar.style.background = "#3B82F6"; // Azul
    progressBar.style.width = "0.1%";
    progressBar.style.transition = "width 0.5s ease-out";
    progressBar.style.borderRadius = "2px";

    container.appendChild(progressBar);

    // Adicionar texto de progresso
    const progressText = document.createElement("span");
    progressText.id = "progress-text";
    progressText.className = "progress-text";
    progressText.textContent = "0%";
    progressText.style.position = "absolute";
    progressText.style.right = "0";
    progressText.style.top = "-18px";
    progressText.style.fontSize = "12px";
    progressText.style.color = "rgba(0,0,0,0.7)";

    container.appendChild(progressText);

    console.log(
      "[ensureProgressBarExists] Barra de progresso criada com sucesso"
    );
    return progressBar;
  } catch (error) {
    console.error(
      "[ensureProgressBarExists] Erro ao criar barra de progresso:",
      error
    );
    return null;
  }
}

// Add these functions to your existing map-controls.js file

/**
 * Sets the map rotation based on the provided heading
 * @param {number} heading - Heading in degrees (0-359)
 */
export function rotateMap(heading) {
  if (!map || typeof heading !== "number" || isNaN(heading)) {
    console.warn("[rotateMap] Invalid parameters:", { map, heading });
    return;
  }

  try {
    // Check if rotation is enabled in navigation state
    const isRotationEnabled =
      window.navigationState &&
      window.navigationState.isActive &&
      window.navigationState.isRotationEnabled;

    if (!isRotationEnabled) {
      // Reset to north if rotation is disabled
      if (map.getBearing && map.getBearing() !== 0) {
        map.resetBearing();
      }
      return;
    }

    // Apply rotation using the plugin if available
    if (typeof map.setBearing === "function") {
      map.setBearing(heading);
      console.log(`[rotateMap] Map rotated to ${heading.toFixed(1)}°`);
    } else {
      console.warn("[rotateMap] Map rotation plugin not available");
    }
  } catch (error) {
    console.error("[rotateMap] Error rotating map:", error);
  }
}

/**
 * Centers the map on the user's position with appropriate offset
 * @param {number} lat - User's latitude
 * @param {number} lng - User's longitude
 * @param {number} heading - User's heading (optional)
 * @param {number} zoom - Zoom level (optional)
 */
export function centerMapOnUser(lat, lng, heading = null, zoom = null) {
  if (!map || !lat || !lng || isNaN(lat) || isNaN(lng)) {
    console.warn("[centerMapOnUser] Invalid parameters:", { map, lat, lng });
    return;
  }

  try {
    // Check if we're in navigation mode
    const isNavigating =
      window.navigationState && window.navigationState.isActive;

    // Determine zoom level
    const zoomLevel = zoom !== null ? zoom : isNavigating ? 18 : map.getZoom();

    // During navigation, apply an offset to see more of the route ahead
    if (isNavigating) {
      // Get the current bearing/heading
      const userHeading =
        heading !== null
          ? heading
          : window.userLocation && window.userLocation.heading
          ? window.userLocation.heading
          : 0;

      // Calculate offset point (more area visible ahead of user)
      const offsetPoint = calculatePointAhead(lat, lng, userHeading, 30); // 30 meters ahead

      map.setView([offsetPoint.lat, offsetPoint.lng], zoomLevel, {
        animate: true,
        duration: 0.5,
        easeLinearity: 0.25,
      });

      console.log(
        `[centerMapOnUser] Map centered with forward offset: ${JSON.stringify(
          offsetPoint
        )}`
      );
    } else {
      // Standard centering without offset
      map.setView([lat, lng], zoomLevel, {
        animate: true,
        duration: 0.5,
      });
      console.log(`[centerMapOnUser] Map centered on position: ${lat}, ${lng}`);
    }
  } catch (error) {
    console.error("[centerMapOnUser] Error centering map:", error);
  }
}

/**
 * Calculate a point ahead of the current position based on bearing
 * @param {number} lat - Starting latitude
 * @param {number} lng - Starting longitude
 * @param {number} bearing - Direction in degrees
 * @param {number} distance - Distance in meters
 * @returns {Object} - {lat, lng} of the new point
 */
export function calculatePointAhead(lat, lng, bearing, distance) {
  // Earth's radius in meters
  const R = 6371000;

  // Convert to radians
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const bearingRad = (bearing * Math.PI) / 180;

  // Calculate angular distance
  const angularDistance = distance / R;

  // Calculate new latitude
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  // Calculate new longitude
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  // Convert back to degrees
  const newLat = (newLatRad * 180) / Math.PI;
  const newLng = (newLngRad * 180) / Math.PI;

  return { lat: newLat, lng: newLng };
}

// Adicionar ao arquivo navigationController.js
/**
 * Configura a verificação periódica da integridade do banner e seus elementos
 * Garantindo que todos os elementos visuais estejam funcionando corretamente
 */
// Substituir a função setupBannerIntegrityCheck

export function setupBannerIntegrityCheck() {
  // Cancelar qualquer verificação existente
  if (window.bannerIntegrityInterval) {
    clearInterval(window.bannerIntegrityInterval);
  }

  // Importar as funções necessárias do módulo bannerUI
  import("../navigationUi/bannerUI.js")
    .then((bannerUI) => {
      try {
        // Garantir que o banner está no DOM antes da verificação
        const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
        if (!banner) {
          console.warn(
            "[setupBannerIntegrityCheck] Banner não encontrado no DOM, recriando..."
          );
          const newBanner = bannerUI.createNavigationBanner();
          if (newBanner) {
            console.log(
              "[setupBannerIntegrityCheck] Banner recriado com sucesso"
            );
          }
        }

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
      } catch (err) {
        console.error(
          "[setupBannerIntegrityCheck] Erro ao verificar integridade do banner:",
          err
        );
      }
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

/**
 * Normaliza as instruções para garantir formato consistente
 * @param {Array} instructions - Array de instruções a normalizar
 * @returns {Array} Instruções normalizadas
 */
function normalizeInstructions(instructions) {
  if (!instructions || !Array.isArray(instructions)) return [];

  return instructions.map((instruction) => {
    // Criar cópia para não modificar original
    const normalized = { ...instruction };

    // Garantir coordenadas no formato esperado
    if (instruction.coordinates && Array.isArray(instruction.coordinates)) {
      normalized.latitude = instruction.coordinates[0];
      normalized.longitude = instruction.coordinates[1];
    } else if (instruction.location && Array.isArray(instruction.location)) {
      normalized.latitude = instruction.location[0];
      normalized.longitude = instruction.longitude[1];
    }

    // Se tem lat/lon/lng, usar esses valores
    if (instruction.lat !== undefined) {
      normalized.latitude = instruction.lat;
    }
    if (instruction.lon !== undefined || instruction.lng !== undefined) {
      normalized.longitude = instruction.lon || instruction.lng;
    }

    // Normalizar outros campos para formato consistente
    if (instruction.type !== undefined && !normalized.stepType) {
      normalized.stepType = instruction.type;
    }

    return normalized;
  });
}

// Também criar uma função para limpar todos estados ao finalizar
export function resetNavigationState() {
  navigationState.isActive = false;
  navigationState.isPaused = false;
  navigationState.currentStepIndex = 0;
  navigationState.arrivalNotified = false;
  navigationState.deviationDetected = false;
  navigationState.instructions = [];
  navigationState.routeData = null;
  navigationState.lastProcessedPosition = null;
  navigationState.lastUpdateTime = null;
  navigationState.selectedDestination = null;

  // Limpar intervalos e watchers
  if (navigationState.updateInterval) {
    clearInterval(navigationState.updateInterval);
    navigationState.updateInterval = null;
  }
}

/**
 * Verifica e inicializa todos os componentes necessários para navegação
 * @returns {boolean} - Se todos os componentes estão prontos
 */
function ensureNavigationComponents() {
  // Verificar objetos principais
  if (!navigationState) {
    console.error(
      "[ensureNavigationComponents] Estado de navegação não inicializado"
    );
    return false;
  }

  // Verificar banner
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (!banner) {
    console.log("[ensureNavigationComponents] Criando banner de navegação");
    createNavigationBanner();
  }

  // Verificar barra de progresso
  ensureProgressBarExists();

  return true;
}

/**
 * Atualiza o marcador do usuário para apontar para o próximo ponto da rota
 * Versão robusta que garante que o marcador sempre aponte na direção correta
 * @param {Object} userPos - Posição do usuário: {latitude, longitude}
 * @param {Array} routePoints - Pontos da rota
 * @returns {number|null} - O ângulo calculado ou null em caso de erro
 */

export function updateUserMarkerDirection(userPos, routePoints) {
  // Controle de atualização para evitar chamadas excessivas
  if (!window._directionUpdateControl) {
    window._directionUpdateControl = {
      lastUpdateTime: 0,
      updateInterval: 500, // Atualizar no máximo a cada 500ms
      lastBearing: null,
      minBearingChange: 5, // Mudança mínima de 5 graus para atualizar
    };
  }

  const now = Date.now();
  const control = window._directionUpdateControl;

  // Se a última atualização foi muito recente, ignorar
  if (now - control.lastUpdateTime < control.updateInterval) {
    return control.lastBearing;
  }

  // Verificações de validade robustas
  if (!userPos || !userPos.latitude || !userPos.longitude) {
    console.warn("[updateUserMarkerDirection] Posição do usuário inválida");
    return null;
  }

  if (!routePoints || !Array.isArray(routePoints) || routePoints.length < 2) {
    console.warn("[updateUserMarkerDirection] Pontos de rota inválidos");
    return null;
  }

  try {
    // Código existente para encontrar o ponto mais próximo...
    let nearestPointIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < routePoints.length; i++) {
      const point = routePoints[i];
      const lat = Array.isArray(point) ? point[0] : point.lat;
      const lon = Array.isArray(point) ? point[1] : point.lng || point.lon;

      if (lat !== undefined && lon !== undefined) {
        const distance = calculateDistance(
          userPos.latitude,
          userPos.longitude,
          lat,
          lon
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestPointIndex = i;
        }
      }
    }

    // Encontrar o próximo ponto na rota (pelo menos 10m à frente)
    let nextPointIndex = nearestPointIndex;
    let nextPoint = null;

    // Procurar um ponto à frente que seja significativo (>10m de distância)
    for (
      let i = nearestPointIndex + 1;
      i < routePoints.length && i < nearestPointIndex + 20;
      i++
    ) {
      const point = routePoints[i];
      const lat = Array.isArray(point) ? point[0] : point.lat;
      const lon = Array.isArray(point) ? point[1] : point.lng || point.lon;

      if (lat !== undefined && lon !== undefined) {
        const distanceToPoint = calculateDistance(
          userPos.latitude,
          userPos.longitude,
          lat,
          lon
        );

        // Se o ponto está a mais de 10m de distância, usar como ponto de destino
        if (distanceToPoint > 10) {
          nextPointIndex = i;
          nextPoint = { lat, lon };
          break;
        }
      }
    }

    // Se não encontrou um ponto adequado, usar o próximo da sequência
    if (!nextPoint && nextPointIndex + 1 < routePoints.length) {
      const point = routePoints[nextPointIndex + 1];
      const lat = Array.isArray(point) ? point[0] : point.lat;
      const lon = Array.isArray(point) ? point[1] : point.lng || point.lon;

      if (lat !== undefined && lon !== undefined) {
        nextPoint = { lat, lon };
      }
    }

    // Se temos um próximo ponto, calcular o ângulo e atualizar o marcador
    if (nextPoint) {
      const bearing = calculateBearing(
        userPos.latitude,
        userPos.longitude,
        nextPoint.lat,
        nextPoint.lon
      );

      // Verificar se a mudança de ângulo é significativa
      const hasSignificantChange =
        control.lastBearing === null ||
        Math.abs(bearing - control.lastBearing) > control.minBearingChange;

      if (hasSignificantChange) {
        if (window.userMarker) {
          updateUserMarker(
            userPos.latitude,
            userPos.longitude,
            bearing,
            userPos.accuracy || 15
          );

          // Atualizar controles
          control.lastUpdateTime = now;
          control.lastBearing = bearing;

          // Armazenar a direção atual para referência
          if (window.navigationState) {
            window.navigationState.currentMarkerDirection = bearing;
            window.navigationState.calculatedBearing = bearing;
          }

          // Adicionar classe para identificar que o marcador está usando direção fixa
          if (window.userMarker._icon) {
            window.userMarker._icon.classList.add("fixed-direction");
          }
        }
      }

      return bearing;
    }

    return control.lastBearing;
  } catch (error) {
    console.error("[updateUserMarkerDirection] Erro:", error);
    return null;
  }
}

/**
 * Estima o tempo restante com base na distância e velocidade média de caminhada
 * @param {number} distance - Distância em metros
 * @param {number} [speed=1.4] - Velocidade média em m/s (padrão: 5 km/h = 1.4 m/s para caminhada)
 * @returns {number} - Tempo estimado em segundos
 */
function estimateRemainingTime(distance, speed = 1.4) {
  if (!distance || isNaN(distance) || distance <= 0) {
    return 0;
  }

  // Calcular o tempo baseado na distância e velocidade
  const timeInSeconds = Math.round(distance / speed);

  // Aplicar um fator de ajuste para considerar possíveis paradas, curvas, etc.
  const adjustmentFactor = 1.2; // 20% adicional

  return Math.round(timeInSeconds * adjustmentFactor);
}

/**
 * Adicione esta função ao seu arquivo navigationController.js
 * Esta função garante que o handler seja adicionado corretamente
 */
export function addMinimizeButtonHandler() {
  // Obter referência ao banner
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);

  if (!banner) {
    console.error("[addMinimizeButtonHandler] Banner não encontrado");
    return false;
  }

  // Obter o botão de minimizar com ID correto
  let minimizeButton = banner.querySelector(
    `#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`
  );

  // Verificar se encontrou o botão
  console.log(
    "[addMinimizeButtonHandler] Botão encontrado?",
    !!minimizeButton,
    "ID procurado:",
    UI_CONFIG.IDS.MINIMIZE_BUTTON
  );

  // Se não encontrar, tentar pela classe
  if (!minimizeButton) {
    minimizeButton = banner.querySelector(".minimize-button");
    console.warn(
      "[addMinimizeButtonHandler] Botão encontrado pela classe em vez do ID"
    );
  }

  // Se ainda não encontrar, criar novo botão
  if (!minimizeButton) {
    console.warn(
      "[addMinimizeButtonHandler] Botão não encontrado, criando novo"
    );

    const primarySection = banner.querySelector(".instruction-primary");
    if (primarySection) {
      minimizeButton = document.createElement("button");
      minimizeButton.id = UI_CONFIG.IDS.MINIMIZE_BUTTON;
      minimizeButton.className = "minimize-button";
      minimizeButton.setAttribute(
        "aria-label",
        "Minimizar instruções de navegação"
      );
      minimizeButton.setAttribute("aria-expanded", "true");
      primarySection.appendChild(minimizeButton);
    }
  }

  if (!minimizeButton) {
    console.error(
      "[addMinimizeButtonHandler] Impossível criar botão de minimizar"
    );
    return false;
  }

  // Remover handlers antigos para evitar duplicação
  const newBtn = minimizeButton.cloneNode(true);
  if (minimizeButton.parentNode) {
    minimizeButton.parentNode.replaceChild(newBtn, minimizeButton);
  }
  minimizeButton = newBtn;

  // Adicionar evento de clique com logs para depuração
  minimizeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[minimizeButton] Clique detectado");

    // Alternar estado minimizado do banner
    const isMinimized = banner.classList.contains(UI_CONFIG.CLASSES.MINIMIZED);

    // Usar a função de toggle do bannerUI.js se disponível
    if (typeof toggleMinimizedState === "function") {
      toggleMinimizedState(banner, !isMinimized);
    } else {
      // Implementação local como fallback
      if (isMinimized) {
        banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
        minimizeButton.setAttribute("aria-expanded", "true");
      } else {
        banner.classList.add(UI_CONFIG.CLASSES.MINIMIZED);
        minimizeButton.setAttribute("aria-expanded", "false");
      }
    }

    console.log(
      `[minimizeButton] Banner ${isMinimized ? "expandido" : "minimizado"}`
    );
  });

  console.log(
    "[addMinimizeButtonHandler] Handler adicionado com sucesso ao botão"
  );
  return true;
}

/**
 * Atualização da função de toggle para garantir compatibilidade
 */
function toggleMinimizedState(banner, minimize) {
  if (!banner) return;

  // Obter o botão usando o ID correto
  const minimizeBtn =
    banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`) ||
    banner.querySelector(".minimize-button");

  if (minimize) {
    banner.classList.add(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "false");
      minimizeBtn.setAttribute(
        "aria-label",
        "Expandir instruções de navegação"
      );
    }
  } else {
    banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "true");
      minimizeBtn.setAttribute(
        "aria-label",
        "Minimizar instruções de navegação"
      );
    }
  }
}
