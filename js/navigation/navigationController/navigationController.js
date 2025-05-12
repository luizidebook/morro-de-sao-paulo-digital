/**
 * Módulo de controle principal da navegação
 * Gerencia o fluxo completo de navegação, desde o início até o cancelamento,
 * bem como o monitoramento contínuo da posição do usuário.
 *
 * Versão unificada que combina as melhores partes de diferentes implementações.
 */

// Importações organizadas por categoria e ordem alfabética:
import { map, plotRouteOnMap, userLocation } from "../../map/map-controls.js";
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
import {
  updateRouteDisplay,
  updateNavigationInstructions,
  ensureCoordinatesInInstructions,
  monitorApproachingTurn,
  extractRouteCoordinates,
  findClosestPointOnRoute,
  determineNextPoint,
} from "../../navigation/navigationInstructions/routeProcessorUtils.js";
import { startRotationMonitor } from "../../map/map-rotation-monitor.js";
import {
  requestLocationPermission,
  getBestEffortLocation,
  isValidCoordinate,
} from "../navigationUserLocation/enhanced-geolocation.js";
import { startPositionTracking } from "../navigationUserLocation/user-location.js";
import {
  recalculationInProgress,
  formatDistance,
  isRecalculationInProgress, // Opcionalmente, pode importar a função também
} from "../navigationInstructions/routeProcessor.js";
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
import {
  enableNavigation3D,
  disableNavigation3D,
  updateRouteDataIn3D,
  updateUserPositionIn3D,
  isNavigation3DActive,
} from "./navigation3D.js";
import { hideNavigationLoading } from "../navigationUi/bannerUI.js";
// Adicionar ao estado de navegação
navigationState.is3DModeEnabled = false; // Controle se o modo 3D está habilitado

// Adicionar em navigationController.js
import {
  createUserMarker,
  updateUserMarker,
  pulseUserMarker,
  toggleAccuracyVisibility,
  updateUserMarkerDirection,
  calculateBearing,
} from "../navigationUserLocation/enhanced-user-marker.js";
// Adicionar em navigationController.js
import {
  initLocationSystem,
  getLocationSystemState,
  getLocationSystemReport,
  getBestLocation,
} from "../navigationUserLocation/enhanced-location-manager.js";
// Adicionar em navigationController.js
import {
  trackPosition,
  predictNextPosition,
  getCurrentOrPredictedPosition,
} from "../navigationUserLocation/movement-predictor.js";
// Em navigationController.js
// Evitar ambiguidade entre versões antigas e novas
import {
  updateUserMarker as enhancedUpdateMarker,
  createUserMarker as enhancedCreateMarker,
} from "../navigationUserLocation/enhanced-user-marker.js";

import {
  updateUserMarker as legacyUpdateMarker,
  createUserMarker as legacyCreateMarker,
} from "../navigationUserLocation/user-location.js";

// Função para decidir qual versão usar
function updateMarker(lat, lon, heading, accuracy) {
  // Usar versão avançada se disponível em produção
  if (window.useEnhancedNavigation) {
    return enhancedUpdateMarker(lat, lon, heading, accuracy);
  }

  // Fallback para sistema legado
  return legacyUpdateMarker(lat, lon, heading, accuracy);
}
// Adicionar em navigationController.js

/**
 * Usa localização prevista quando sinal GPS estiver fraco ou intermitente
 * @param {Object} options - Opções da predição
 */
function usePredictedLocationIfNeeded(options = {}) {
  const locationState = getLocationSystemState();

  // Verificar se sinal está fraco ou ausente
  if (
    locationState.signalQuality === "poor" ||
    locationState.signalQuality === "very-poor" ||
    locationState.signalQuality === "lost"
  ) {
    console.log("[Navigation] Usando posição prevista devido a sinal fraco");

    // Obter posição prevista
    const predicted = getCurrentOrPredictedPosition(1000);

    if (predicted && predicted.confidence > 0.6) {
      // Usar posição prevista para continuar a navegação
      updateRealTimeNavigation(predicted, { isEstimated: true });

      // Feedback visual diferenciado para usuário
      if (options.showFeedback) {
        pulseUserMarker("alert", 2000);
      }

      return true;
    }
  }

  return false;
}

/**
 * Atualiza a barra de progresso visual da navegação
 * @param {number} percentage - Porcentagem de progresso (0-100)
 * @returns {boolean} - Indica se a operação foi bem-sucedida
 */
export function updateProgressBar(percentage) {
  try {
    // Normalizar o valor para garantir que esteja entre 0-100
    let normalizedPercentage = Math.max(0, Math.min(100, percentage));

    // Garantir que seja sempre visível (mínimo 0.1%)
    normalizedPercentage = Math.max(0.1, normalizedPercentage);

    // Obter o elemento da barra de progresso
    const progressBarEl =
      document.getElementById("progress") ||
      document.querySelector(".progress-bar");

    if (!progressBarEl) {
      console.warn(
        "[updateProgressBar] Elemento de barra de progresso não encontrado"
      );
      return false;
    }

    // Atualizar a largura com valor percentual
    progressBarEl.style.width = `${normalizedPercentage}%`;

    // Atualizar atributos ARIA para acessibilidade
    progressBarEl.setAttribute(
      "aria-valuenow",
      Math.round(normalizedPercentage)
    );

    // Atualizar o texto de progresso se existir
    const progressTextEl = document.getElementById("progress-text");
    if (progressTextEl) {
      progressTextEl.textContent = `${Math.round(normalizedPercentage)}%`;
    }

    console.log(
      `[updateProgressBar] Progresso atualizado para ${normalizedPercentage.toFixed(
        1
      )}%`
    );
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
 * Inicializa os componentes avançados de localização
 * Deve ser chamado durante o início da navegação
 */
function initAdvancedLocationComponents() {
  // Inicializar sistema de localização avançado
  initLocationSystem({
    autoStart: true,
    adaptivePrecision: true,
    onLocationUpdate: handleLocationUpdate,
    onSignalLost: handleSignalLoss,
    onSignalRecovered: handleSignalRecovered,
  });

  console.log("[Navigation] Sistema de localização avançado inicializado");
}

/**
 * Manipula atualizações de localização do sistema avançado
 * @param {Object} location - Nova localização recebida
 */
function handleLocationUpdate(location) {
  if (!location) return;

  // Registrar posição para previsão de movimento
  trackPosition(location);

  // Atualizar navegação em tempo real
  if (navigationState.isActive) {
    updateRealTimeNavigation(location);
  }

  // Atualizar estatísticas de desempenho se necessário
  if (navigationState.performance) {
    navigationState.performance.locationUpdates =
      (navigationState.performance.locationUpdates || 0) + 1;
  }
}

/**
 * Manipula eventos de perda de sinal
 * @param {number} duration - Duração da perda de sinal em ms
 */
function handleSignalLoss(duration) {
  console.warn(
    `[Navigation] Sinal perdido por ${Math.round(duration / 1000)}s`
  );

  // Notificar usuário
  showNotification("Sinal GPS fraco", "Tentando recuperar sua localização...");

  // Visual feedback
  pulseUserMarker("alert", 3000);

  // Tentar usar posição prevista
  const predictedPosition = getCurrentOrPredictedPosition();
  if (predictedPosition && navigationState.isActive) {
    updateRealTimeNavigation(predictedPosition, { isEstimated: true });
  }
}

/**
 * Manipula recuperação do sinal
 * @param {Object} location - Nova localização recebida
 * @param {string} quality - Qualidade do sinal ('good', 'fair', etc)
 */
function handleSignalRecovered(location, quality) {
  console.log(`[Navigation] Sinal recuperado com qualidade: ${quality}`);

  // Notificar usuário
  showNotification("Sinal GPS recuperado", "", 2000);

  // Visual feedback
  pulseUserMarker("normal", 2000);
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
 * @param {Object} destination - Destino para navegação
 * @param {Object} options - Opções adicionais para a navegação
 * @param {boolean} options.enable3D - Se deve ativar o modo 3D
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export async function startNavigation(destination, options = {}) {
  try {
    console.group("[startNavigation] Iniciando fluxo de navegação");
    function initializeNavigationState(route, instructions) {
      navigationState.isActive = true;
      navigationState.route = route;
      navigationState.instructions = instructions;
      navigationState.currentStepIndex = 0; // Inicializar com o primeiro passo
      navigationState.totalDistance = calculateTotalRouteDistance(route);
      options = {
        enable3D: true, // Forçar modo 3D como padrão
        ...options,
      };
    }
    // Verificar se navigationState existe
    if (!navigationState) {
      console.error("[startNavigation] Estado de navegação não inicializado");
      return false;
    }

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
    navigationState.routeProgress = 0;
    navigationState.instructions = [];
    navigationState.routeData = null;
    navigationState.lastProcessedPosition = null;
    navigationState.lastUpdateTime = Date.now();
    navigationState.notifiedTurns = {};
    navigationState.is3DModeEnabled = options.enable3D || false;

    // Inicializar objeto de desempenho para diagnóstico
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

    // Inicializar sistema avançado de localização
    if (typeof initAdvancedLocationComponents === "function") {
      initAdvancedLocationComponents();
      console.log("3. Sistema de localização avançado inicializado");
    }

    // Verificar se temos localização do usuário
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.log("[startNavigation] Obtendo localização atual do usuário");

      // Mostrar notificação
      showNotification(
        getGeneralText("locating", navigationState.lang) ||
          "Obtendo sua localização...",
        "info"
      );

      try {
        // Obter localização via sistema avançado ou padrão
        const location =
          typeof getBestLocation === "function"
            ? await getBestLocation({
                maxWaitTime: 10000,
                desiredAccuracy: 50,
                timeoutStrategy: "best-available",
              })
            : await getCurrentLocation();

        if (!location) {
          throw new Error("Não foi possível obter sua localização");
        }

        // Atualizar localização global
        userLocation = location;

        // Armazenar localização em variáveis globais para compatibilidade
        window.userLocation = location;

        // Criar marcador do usuário se não existir
        if (!window.userMarker && typeof createUserMarker === "function") {
          createUserMarker(
            location.latitude,
            location.longitude,
            location.heading || 0,
            location.accuracy || 15
          );
        }

        console.log("4. Localização obtida:", {
          lat: location.latitude,
          lon: location.longitude,
          precisao: location.accuracy,
        });

        // Continuar com inicialização da rota
        return await initializeRouteWithLocation(
          location,
          destination,
          options
        );
      } catch (error) {
        console.error("[startNavigation] Erro ao obter localização:", error);

        // Notificar usuário
        showNotification(
          getGeneralText("location_error", navigationState.lang) ||
            "Não foi possível determinar sua localização",
          "error"
        );

        // Limpar estado
        navigationState.isActive = false;
        hideNavigationLoading();

        return false;
      }
    }

    // Se já temos localização, inicializar rota
    console.log("4. Utilizando localização existente:", {
      lat: userLocation.latitude,
      lon: userLocation.longitude,
    });

    return await initializeRouteWithLocation(
      userLocation,
      destination,
      options
    );
  } catch (error) {
    console.error("[startNavigation] Erro crítico:", error);

    // Limpar estado em caso de falha
    if (navigationState) {
      navigationState.isActive = false;
    }

    hideNavigationLoading();

    // Notificar erro
    showNotification(
      getGeneralText("navigation_error", navigationState.lang) ||
        "Erro ao iniciar navegação",
      "error"
    );

    return false;
  } finally {
    console.groupEnd();
  }
}

/**
 * Inicializa a rota com uma localização conhecida do usuário
 * @param {Object} userLocation - Localização do usuário
 * @param {Object} destination - Destino para navegação
 * @param {Object} options - Opções adicionais para a navegação
 * @returns {Promise<boolean>} - Sucesso da operação
 */
async function initializeRouteWithLocation(
  userLocation,
  destination,
  options = {}
) {
  try {
    // Validar dados de entrada
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      throw new Error("Localização do usuário inválida");
    }

    if (!destination || (!destination.latitude && !destination.lat)) {
      throw new Error("Destino inválido");
    }

    // Normalizar destino para evitar inconsistências
    const destLat = destination.latitude || destination.lat;
    const destLon = destination.longitude || destination.lon || destination.lng;

    // Mostrar indicador de carregamento com texto específico
    showNavigationLoading(
      getGeneralText("calculating_route", navigationState.lang) ||
        "Calculando rota..."
    );

    // Calcular rota
    const routeData = await plotRouteOnMap(
      userLocation.latitude,
      userLocation.longitude,
      destLat,
      destLon,
      "foot-walking", // ou outro perfil conforme contexto
      destination.name
    );

    // Validar rota
    if (!routeData || !routeData.features || routeData.features.length === 0) {
      throw new Error("Não foi possível calcular a rota");
    }

    console.log("5. Rota calculada com sucesso");
    // Após o cálculo da rota bem-sucedido:
    if (routeData) {
      // Sempre definir 3D como habilitado
      navigationState.is3DModeEnabled = true;

      // Garantir que a função seja chamada e esperar pela conclusão
      try {
        if (typeof enableNavigation3D === "function") {
          console.log("[initializeRouteWithLocation] Ativando navegação em 3D");
          await enableNavigation3D({
            navigationHeading: calculateInitialHeading(routeData),
            pitch: 60,
            animate: true,
          });

          // Verificar se foi ativado corretamente
          if (!isNavigation3DActive()) {
            console.warn(
              "[initializeRouteWithLocation] Falha na ativação 3D, tentando novamente"
            );
            // Segunda tentativa após um pequeno delay
            setTimeout(() => {
              enableNavigation3D({
                navigationHeading: calculateInitialHeading(routeData),
                pitch: 60,
              });
            }, 300);
          }
        } else {
          console.error(
            "[initializeRouteWithLocation] Função enableNavigation3D não disponível"
          );
        }
      } catch (err) {
        console.error(
          "[initializeRouteWithLocation] Erro ao ativar modo 3D:",
          err
        );
      }
    }

    // Salvar dados da rota
    navigationState.routeData = routeData;
    setLastRouteData(routeData);

    try {
      // Processar instruções da rota
      const processedInstructions = await processRouteInstructions(
        routeData,
        navigationState.lang
      );

      if (!processedInstructions || !Array.isArray(processedInstructions)) {
        throw new Error("Falha ao processar instruções da rota");
      }

      // Normalizar instruções e salvá-las
      const normalizedInstructions = normalizeInstructions(
        processedInstructions
      );
      navigationState.instructions = normalizedInstructions;

      // Calcular distância total
      const totalDistance = routeData.properties?.summary?.distance || 0;
      navigationState.totalRouteDistance = totalDistance;

      // Inicializar dados de progresso
      navigationState.progress = {
        totalDistance: totalDistance,
        completedDistance: 0,
        percentage: 0,
        lastUpdated: Date.now(),
      };

      // Criar interface de navegação
      createNavigationBanner();
      showInstructionBanner(true);
      addMinimizeButtonHandler();

      // Resetar barra de progresso
      updateProgressBar(0);

      console.log("6. Interface de navegação criada");

      // Exibir primeira instrução
      if (normalizedInstructions.length > 0) {
        displayNavigationStep(normalizedInstructions[0], true);
      }

      // Adicionar controles e iniciar monitoramentos
      addNavigationControls();
      startPositionTracking();
      monitorUserState();
      document.body.classList.add("navigation-active");

      // Configurar atualizações e checagens
      setupRealTimeUpdates();
      setupBannerIntegrityCheck();
      setupInitialMarkerOrientation();

      // Centralizar mapa
      updateMapWithUserLocation();

      // Se o modo 3D está habilitado nas opções ou no estado
      const use3D = options.enable3D || navigationState.is3DModeEnabled;

      if (use3D) {
        navigationState.is3DModeEnabled = true;

        // Ativar navegação 3D após o cálculo da rota
        if (routeData && typeof enableNavigation3D === "function") {
          console.log("[startNavigation] Ativando navegação em 3D");
          try {
            enableNavigation3D({
              navigationHeading: calculateInitialHeading(routeData),
              pitch: 60,
            });
          } catch (err3d) {
            console.error("[startNavigation] Erro ao ativar modo 3D:", err3d);
            // Continuar sem 3D em caso de erro
            navigationState.is3DModeEnabled = false;
          }
        }
      }

      // Inicializar navegação em tempo real com posição atual
      updateRealTimeNavigation(userLocation);

      hideNavigationLoading();
      console.log("7. Navegação iniciada completamente");

      // Efeito visual para confirmação
      if (typeof pulseUserMarker === "function") {
        pulseUserMarker("normal", 2000);
      }

      return true;
    } catch (instructionsError) {
      console.error(
        "[initializeRouteWithLocation] Erro ao processar instruções:",
        instructionsError
      );
      throw new Error("Falha ao processar instruções da rota");
    }
  } catch (error) {
    console.error("[initializeRouteWithLocation] Erro:", error);

    // Limpar estado em caso de falha
    navigationState.isActive = false;
    hideNavigationLoading();

    // Notificar usuário sobre erro específico
    showNotification(error.message || "Erro ao iniciar navegação", "", "error");

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
 * @param {Object} options - Opções de cancelamento
 * @param {boolean} options.showConfirmation - Se deve mostrar confirmação
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export async function cancelNavigation(showConfirmation = true) {
  console.log("[cancelNavigation] Finalizando navegação...");

  // Se confirmação é necessária, perguntar ao usuário
  if (showConfirmation) {
    const confirmed = await confirmAction(
      getGeneralText("cancel_navigation_confirm", navigationState.lang) ||
        "Deseja realmente cancelar a navegação?"
    );

    if (!confirmed) {
      console.log("[cancelNavigation] Cancelamento abortado pelo usuário");
      return false;
    }
  }

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

  // 5. Se o modo 3D está ativo, desativá-lo
  if (navigationState.is3DModeEnabled && isNavigation3DActive()) {
    disableNavigation3D();
  }

  navigationState.is3DModeEnabled = false;

  // 6. Resetar rotação do mapa
  resetMapRotation();

  // 7. Esconder banner de instruções
  hideInstructionBanner();

  // 8. Remover classe do body
  document.body.classList.remove("navigation-active");

  // 9. Notificar o usuário
  showNotification(
    getGeneralText("navigation_stop", navigationState.lang) ||
      "Navegação finalizada",
    "info"
  );

  // 10. Enviar mensagem para o assistente
  appendMessage(
    "assistant",
    "Navegação guiada finalizada. Se precisar de outra rota, é só pedir! 🏁"
  );

  // Limpar todos os intervalos e timers
  if (navigationState.updateInterval) {
    clearInterval(navigationState.updateInterval);
    navigationState.updateInterval = null;
  }

  // Limpar watchers de posição adicionais
  if (window.geoLocationWatchId) {
    navigator.geolocation.clearWatch(window.geoLocationWatchId);
    window.geoLocationWatchId = null;
  }

  // Resetar flags importantes
  recalculationInProgress = false;

  // Limpar objetos de rota no mapa
  if (window.completedRoute && map) {
    map.removeLayer(window.completedRoute);
    window.completedRoute = null;
  }

  if (window.routeArrows && map) {
    map.removeLayer(window.routeArrows);
    window.routeArrows = null;
  }

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

    // NOVA CORREÇÃO: Remover classe rotating do ícone de instrução
    const iconEl = document.getElementById(UI_CONFIG.IDS.INSTRUCTION_ARROW);
    if (iconEl && iconEl.classList.contains(UI_CONFIG.CLASSES.ROTATING)) {
      iconEl.classList.remove(UI_CONFIG.CLASSES.ROTATING);
      console.log(
        "[displayNavigationStep] Classe rotating removida do ícone de instrução"
      );
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
 * Determina o tipo de instrução baseado no texto da instrução
 * @param {string} instruction - Texto da instrução
 * @returns {number} - Código do tipo de instrução
 */
export function getInstructionType(instruction) {
  if (!instruction) return 0;

  const lowerText = instruction.toLowerCase();

  // Códigos comuns para tipos de instrução
  if (lowerText.includes("turn right")) return 1;
  if (lowerText.includes("turn left")) return 2;
  if (lowerText.includes("straight") || lowerText.includes("continue"))
    return 0;
  if (lowerText.includes("slight right")) return 6;
  if (lowerText.includes("slight left")) return 7;
  if (lowerText.includes("sharp right")) return 3;
  if (lowerText.includes("sharp left")) return 4;
  if (lowerText.includes("u-turn")) return 5;
  if (lowerText.includes("roundabout")) return 8;
  if (lowerText.includes("exit")) return 9;
  if (lowerText.includes("arrive") || lowerText.includes("destination"))
    return 10;

  // Tipo padrão: siga em frente
  return 0;
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
 * Atualiza a navegação em tempo real
 * @param {Object} position - Posição atual do usuário
 */
export function updateRealTimeNavigation(position) {
  if (!position || !navigationState.isActive) {
    return;
  }

  try {
    // Acessar o currentStepIndex do navigationState
    const currentStepIndex = navigationState.currentStepIndex || 0;

    // Atualizar instruções com o índice correto
    updateNavigationInstructions(position);

    // Atualizar direção do marcador
    try {
      const nextPoint = determineNextPoint(
        position,
        navigationState.instructions,
        currentStepIndex // Usar a variável agora definida corretamente
      );

      if (nextPoint) {
        updateUserMarkerDirection(position, nextPoint);
      }
    } catch (error) {
      console.error(
        "[updateRealTimeNavigation] Erro ao atualizar direção do marcador:",
        error
      );
    }

    // Atualizar distância restante e progresso
    const remainingDistance = calculateRouteRemainingDistance({
      posição: `${position.latitude}, ${position.longitude}`,
      passoAtual: currentStepIndex,
      totalPassos: navigationState.instructions
        ? navigationState.instructions.length
        : 0,
    });

    // Atualizar barra de progresso se tivermos informações válidas
    if (navigationState.totalDistance && remainingDistance) {
      const progress = Math.max(
        0,
        Math.min(
          100,
          ((navigationState.totalDistance - remainingDistance) /
            navigationState.totalDistance) *
            100
        )
      );
      updateProgressBar(progress);
    }
  } catch (error) {
    console.error("[updateRealTimeNavigation] Erro geral:", error);
  }
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
 * Formata uma duração em segundos para um texto legível
 * @param {number} seconds - Duração em segundos
 * @returns {string} - Texto formatado (exemplo: "5 min" ou "30 s")
 */
export function formatDuration(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return "0 min";
  }

  // Garantir que os segundos são um número positivo
  seconds = Math.abs(Math.round(Number(seconds)));

  // Se for menor que 60 segundos
  if (seconds < 60) {
    return `${seconds} s`;
  }

  // Converter para minutos
  const minutes = Math.round(seconds / 60);

  // Se for menor que 60 minutos
  if (minutes < 60) {
    return `${minutes} min`;
  }

  // Converter para horas e minutos
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  } else {
    return `${hours} h ${remainingMinutes} min`;
  }
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
 * Calcula a distância entre dois pontos em metros
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

  return R * c; // Distância em metros
}

/**
 * Mostra a rota no mapa 3D
 */
export function showRoute3D(options) {
  const { startLat, startLon, endLat, endLon } = options;

  // Verificar se a distância excede o limite permitido
  const distance = calculateDistance(startLat, startLon, endLat, endLon);
  if (distance > 100000) {
    // Limite de 100 km
    console.warn("[showRoute3D] Distância excede o limite permitido pela API");
    appendMessage(
      "assistant",
      "A rota solicitada excede o limite de distância permitido. Por favor, escolha um destino mais próximo.",
      { speakMessage: true }
    );
    return;
  }

  // Chamar a API de rotas
  getDirectionsRoute(startLat, startLon, endLat, endLon)
    .then((data) => {
      if (!data || !data.routes || !data.routes.length) {
        console.warn("[showRoute3D] Nenhuma rota retornada pela API");
        return;
      }

      // Adicionar rota ao mapa
      const route = data.routes[0];
      addRouteToMap(route.geometry.coordinates);
    })
    .catch((error) => {
      console.error("[showRoute3D] Erro ao obter rota:", error);
    });
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
 * Estima o tempo restante com base na distância e velocidade média de caminhada
 * @param {number} distance - Distância em metros
 * @param {number} [speed=1.4] - Velocidade média em m/s (padrão: 5 km/h = 1.4 m/s para caminhada)
 * @returns {number} - Tempo estimado em segundos
 */
export function estimateRemainingTime(distance, speed = 1.4) {
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

/**
 * Calcula o rumo inicial da rota para orientação do mapa 3D
 * @param {Object} routeData - Dados GeoJSON da rota
 * @returns {number} - Rumo inicial em graus (0-360)
 */
function calculateInitialHeading(routeData) {
  try {
    if (!routeData || !routeData.features || !routeData.features.length) {
      return 0;
    }

    const coordinates = routeData.features[0].geometry.coordinates;

    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    // Pegar os dois primeiros pontos da rota
    const [startLon, startLat] = coordinates[0];
    const [endLon, endLat] = coordinates[1];

    // Verificar se temos coordenadas válidas
    if (
      typeof startLat !== "number" ||
      typeof startLon !== "number" ||
      typeof endLat !== "number" ||
      typeof endLon !== "number"
    ) {
      return 0;
    }

    // Converter para radianos
    const startLatRad = (startLat * Math.PI) / 180;
    const startLonRad = (startLon * Math.PI) / 180;
    const endLatRad = (endLat * Math.PI) / 180;
    const endLonRad = (endLon * Math.PI) / 180;

    // Calcular o ângulo usando fórmula de bearing
    const y = Math.sin(endLonRad - startLonRad) * Math.cos(endLatRad);
    const x =
      Math.cos(startLatRad) * Math.sin(endLatRad) -
      Math.sin(startLatRad) *
        Math.cos(endLatRad) *
        Math.cos(endLonRad - startLonRad);

    // Converter para graus e normalizar para 0-360
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    console.log(
      `[calculateInitialHeading] Rumo inicial calculado: ${bearing.toFixed(1)}°`
    );
    return bearing;
  } catch (error) {
    console.error(
      "[calculateInitialHeading] Erro ao calcular rumo inicial:",
      error
    );
    return 0;
  }
}
/**
 * Alterna entre navegação 2D e 3D
 * @returns {boolean} - Estado atual do modo 3D (true se ativado)
 */
export function toggle3DNavigationMode() {
  if (!navigationState.isActive) {
    console.warn("[toggle3DNavigationMode] Não há navegação ativa");
    return false;
  }

  try {
    if (isNavigation3DActive()) {
      disableNavigation3D();
      navigationState.is3DModeEnabled = false;
      console.log("[toggle3DNavigationMode] Modo 3D desativado");
      return false;
    } else {
      // Obter dados para orientação inicial
      let navigationHeading = 0;

      // Tentar obter direção da posição atual
      if (navigationState.lastKnownUserPosition?.heading) {
        navigationHeading = navigationState.lastKnownUserPosition.heading;
      }
      // Ou calcular da rota se disponível
      else if (navigationState.routeData) {
        navigationHeading = calculateInitialHeading(navigationState.routeData);
      }

      const success = enableNavigation3D({
        navigationHeading: navigationHeading,
        pitch: 60,
      });

      navigationState.is3DModeEnabled = success;
      console.log(
        `[toggle3DNavigationMode] Modo 3D ${
          success ? "ativado" : "falha ao ativar"
        }`
      );
      return success;
    }
  } catch (error) {
    console.error("[toggle3DNavigationMode] Erro ao alternar modo 3D:", error);
    navigationState.is3DModeEnabled = false;
    return false;
  }
}
