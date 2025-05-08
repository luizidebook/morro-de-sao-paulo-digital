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
import { isValidCoordinate } from "../navigationUtils/distanceCalculator.js";

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
  positionWatcherId,
  startPositionTracking,
  updateUserMarker,
  userLocation,
  updateUserMarkerDirection,
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
    navigationState.isPaused = false;
    navigationState.currentStepIndex = 0;
    navigationState.arrivalNotified = false;
    navigationState.deviationDetected = false;
    navigationState.instructions = [];
    navigationState.routeData = null;
    navigationState.lastProcessedPosition = null;
    navigationState.lastUpdateTime = Date.now();

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
    // Na função startNavigation, após processar instruções:

    // Esperar explicitamente que o processamento de instruções complete
    const processedInstructions = await processRouteInstructions(
      routeData,
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

    // VERIFICAR: Imprimir estrutura das instruções para diagnóstico
    console.log("[startNavigation] Verificando estrutura das instruções:");
    processedInstructions.forEach((instruction, idx) => {
      const hasValidCoords =
        ((instruction.latitude !== undefined && !isNaN(instruction.latitude)) ||
          (instruction.lat !== undefined && !isNaN(instruction.lat))) &&
        ((instruction.longitude !== undefined &&
          !isNaN(instruction.longitude)) ||
          (instruction.lon !== undefined && !isNaN(instruction.lon)) ||
          (instruction.lng !== undefined && !isNaN(instruction.lng)));

      console.log(
        `Passo ${idx}: "${instruction.original}" - Coords válidas: ${
          hasValidCoords ? "✓" : "✗"
        }`
      );

      // Se não tiver coordenadas válidas, tentar extrair do texto
      if (!hasValidCoords && instruction.original) {
        // Tente extrair de outras propriedades ou conteúdo geométrico
        const fixedCoords = extractCoordinatesFromGeometry(routeData, idx);
        if (fixedCoords) {
          instruction.latitude = fixedCoords.latitude;
          instruction.longitude = fixedCoords.longitude;
          console.log(
            `   Coordenadas recuperadas: Lat ${fixedCoords.latitude}, Lon ${fixedCoords.longitude}`
          );
        }
      }
    });

    // MODIFICAR: Normalizar as instruções antes de armazenar
    const normalizedInstructions = normalizeInstructions(processedInstructions);

    // VERIFICAR: Confirmar que as instruções estão normalizadas corretamente
    const validInstructions = normalizedInstructions.filter(
      (instr) =>
        instr.latitude !== undefined &&
        !isNaN(instr.latitude) &&
        instr.longitude !== undefined &&
        !isNaN(instr.longitude)
    );

    if (validInstructions.length < normalizedInstructions.length * 0.5) {
      console.error(
        "[startNavigation] Menos de 50% das instruções têm coordenadas válidas!"
      );
      console.log("[startNavigation] Tentativa de recuperação...");

      // Tentar extrair coordenadas diretamente da geometria da rota
      const fixedInstructions = extractCoordinatesFromRoute(
        routeData,
        normalizedInstructions
      );
      if (fixedInstructions && fixedInstructions.length > 0) {
        navigationState.instructions = fixedInstructions;
        console.log(
          `5. Instruções recuperadas e processadas: ${fixedInstructions.length}`
        );
      } else {
        showNotification(
          getGeneralText("route_error", navigationState.lang),
          "error"
        );
        return false;
      }
    } else {
      // Usar instruções normalizadas
      navigationState.instructions = normalizedInstructions;
      console.log(
        `5. Instruções processadas: ${normalizedInstructions.length}`
      );
    }
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

    setupRealTimeUpdates();
    setupBannerIntegrityCheck();
    setupInitialMarkerOrientation();

    console.groupEnd();
    return true;
  } catch (error) {
    console.error("[startNavigation] Erro crítico:", error);
    console.groupEnd();
    return false;
  }
}

// Adicionar nova função

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

  // Tentar outras fontes se não disponível
  if (!routePoints && window.currentRoute && window.currentRoute.getLatLngs) {
    routePoints = window.currentRoute.getLatLngs();
  }

  // Tentar extrair de navigationState se necessário
  if (
    (!routePoints || routePoints.length === 0) &&
    navigationState.instructions
  ) {
    routePoints = navigationState.instructions
      .map((instruction) => ({
        lat: instruction.latitude || instruction.lat,
        lng: instruction.longitude || instruction.lon || instruction.lng,
      }))
      .filter((point) => point.lat && point.lng);
  }

  if (!routePoints || routePoints.length === 0) {
    console.warn(
      "[setupInitialMarkerOrientation] Pontos da rota indisponíveis"
    );
    return;
  }

  // Atualizar orientação do marcador
  console.log(
    "[setupInitialMarkerOrientation] Configurando orientação inicial do marcador"
  );
  updateUserMarkerDirection(userLocation, routePoints, true);
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
  try {
    // Validate the navigation state
    if (!navigationState.isActive || !navigationState.instructions) {
      return false;
    }

    // Get current user position
    const currentPos = userPos || userLocation;
    if (
      !currentPos ||
      !isValidCoordinate(currentPos.latitude, currentPos.longitude)
    ) {
      console.warn("[updateRealTimeNavigation] Invalid user position");
      return false;
    }
    // Find next step coordinates
    const nextStep = navigationState.instructions[currentStep];
    const nextStepLat = nextStep.latitude || nextStep.lat;
    const nextStepLon = nextStep.longitude || nextStep.lon || nextStep.lng;

    // Calculate bearing to next step
    const bearing = calculateBearing(
      parseFloat(currentPos.latitude),
      parseFloat(currentPos.longitude),
      parseFloat(nextStepLat),
      parseFloat(nextStepLon)
    );
    // The SVG is pointing up (north), so we need to add 180 to make it point
    // in the direction of travel. This is the ONLY place we should adjust the angle.
    const correctedBearing = (bearing + 180) % 360;

    // 1. Update user marker with correct orientation
    updateUserMarker(
      currentPos.latitude,
      currentPos.longitude,
      correctedBearing, // Use corrected bearing
      currentPos.accuracy || 15
    );

    console.log(
      `[updateRealTimeNavigation] User marker oriented toward next step: ${correctedBearing.toFixed(
        1
      )}° (original: ${bearing.toFixed(1)}°)`
    );

    // 2. Rotate map if rotation is enabled
    if (navigationState.isRotationEnabled) {
      rotateMap(bearing); // Use original bearing for map rotation
    }

    // 3. Center map on user with appropriate offset
    centerMapOnUser(
      currentPos.latitude,
      currentPos.longitude,
      bearing, // Original bearing for calculating offset
      null // Use current zoom
    );

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
    if (
      shouldUpdateStep ||
      navigationState.currentStepIndex !== nextStepIndex
    ) {
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

      console.log(
        "[updateRealTimeNavigation] Banner atualizado com métricas:",
        {
          distância: currentInstruction.remainingDistance,
          tempo: currentInstruction.estimatedTime,
          progresso: currentInstruction.progress + "%",
        }
      );

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

    return true;
  } catch (error) {
    console.error("[updateRealTimeNavigation] Error:", error);
    return false;
  }
}

// Add this to your navigationState initialization if not already present
export function initNavigationState() {
  // Initialize navigation state if not already done
  if (!window.navigationState) {
    window.navigationState = {
      isActive: false,
      isRotationEnabled: true, // Enable rotation by default
      destination: null,
      instructions: [],
      currentStep: 0,
      // other properties...
    };
  }
  return window.navigationState;
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

function setupRealTimeUpdates() {
  // Limpar intervalo existente se houver
  if (navigationState.updateInterval) {
    clearInterval(navigationState.updateInterval);
  }

  // Intervalo para atualização das métricas
  navigationState.updateInterval = setInterval(() => {
    if (!navigationState.isActive) {
      clearInterval(navigationState.updateInterval);
      return;
    }

    if (userLocation) {
      try {
        // Obter pontos da rota para orientação do marcador
        let routePoints = null;

        // Primeiro, tentar obter de lastRoutePoints (o mais atualizado)
        if (window.lastRoutePoints && Array.isArray(window.lastRoutePoints)) {
          routePoints = window.lastRoutePoints;
        }
        // Depois, tentar extrair da rota atual
        else if (
          window.currentRoute &&
          typeof window.currentRoute.getLatLngs === "function"
        ) {
          routePoints = window.currentRoute.getLatLngs();
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
        }

        // Se conseguimos obter pontos da rota, atualizar direção do marcador
        if (routePoints && routePoints.length > 0) {
          const direction = updateUserMarkerDirection(
            userLocation,
            routePoints
          );

          // Se temos um heading válido (seja do dispositivo ou calculado da rota)
          const heading = userLocation.heading || direction;

          if (heading !== undefined && heading !== null) {
            // 1. Atualizar o marcador do usuário com a direção
            updateUserMarker(
              userLocation.latitude,
              userLocation.longitude,
              heading,
              userLocation.accuracy || 15
            );

            // 2. Se a rotação automática estiver ativa, rotacionar o mapa
            if (navigationState.isRotationEnabled) {
              setMapRotation(heading);
            }

            // 3. Centralizar o mapa na posição do usuário (com offset apropriado)
            centerMapOnUser(userLocation.latitude, userLocation.longitude);
          }
        }

        // Continuar com a atualização normal de navegação
        updateRealTimeNavigation(userLocation);
      } catch (error) {
        console.warn(
          "[setupRealTimeUpdates] Erro ao atualizar direção:",
          error
        );
      }
    }
  }, 1000); // A cada 1 segundo para maior fluidez

  console.log("[setupRealTimeUpdates] Monitoramento em tempo real iniciado");
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
