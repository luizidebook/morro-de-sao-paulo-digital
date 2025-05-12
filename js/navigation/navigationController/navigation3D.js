/**
 * Integração da visualização 3D com o sistema de navegação
 * Permite visualizar a navegação em modo 3D com perspectiva
 */
import { startNavigation } from "../navigationController/navigationController.js";
import {
  enable3DMode,
  disable3DMode,
  is3DModeActive,
  updateRouteIn3D,
  syncMapPosition,
  getMapbox3DInstance,
  loadMapboxGLScript,
  ensureMapbox3DContainer,
} from "../../map/map-3d.js";
import { navigationState } from "../navigationState/navigationStateManager.js";
// Estado da navegação 3D
let navigation3DActive = false;
let followUserMode = true;
let lastUserPosition = null;
let lastRouteData = null;
let lastUserHeading = 0;

/**
 * Habilita o modo de navegação 3D
 * @param {Object} options - Opções para a navegação 3D
 * @returns {boolean} Sucesso da operação
 */
export function enableNavigation3D(options = {}) {
  try {
    console.log("[enableNavigation3D] Ativando navegação em 3D");

    // Definir que queremos modo 3D, mesmo que falhe
    navigationState.is3DModeEnabled = true;

    // Tentar ativar o modo 3D
    if (!is3DModeActive()) {
      // Tenta inicializar o mapa 3D com várias tentativas
      let attempts = 0;
      const tryEnable = () => {
        attempts++;
        console.log(
          `[enableNavigation3D] Tentativa ${attempts} de ativar modo 3D`
        );

        const success = enable3DMode({
          pitch: options.pitch || 60,
          bearing: options.navigationHeading || lastUserHeading,
          animationDuration: 1000,
          hideBaseMap: true,
        });

        if (!success && attempts < 3) {
          console.log(
            `[enableNavigation3D] Tentativa ${attempts} falhou, tentando novamente em 500ms`
          );
          setTimeout(tryEnable, 500);
          return false;
        }

        return success;
      };

      const success = tryEnable();
      if (!success) {
        console.error(
          "[enableNavigation3D] Falha ao ativar modo 3D após múltiplas tentativas"
        );
        return false;
      }
    }

    // Marcar navegação 3D como ativa
    navigation3DActive = true;

    // Configurações específicas para navegação
    const mapbox = getMapbox3DInstance();
    if (mapbox) {
      // Ajustar pitch e bearing para melhor visualização de navegação
      mapbox.setPitch(options.pitch || 60);

      if (options.navigationHeading !== undefined) {
        mapbox.setBearing(options.navigationHeading);
        lastUserHeading = options.navigationHeading;
      }
    }

    // Se já temos dados de rota, exibi-los em 3D
    if (
      lastRouteData &&
      lastRouteData.features &&
      lastRouteData.features.length > 0
    ) {
      updateRouteDataIn3D(lastRouteData, options);
    }

    document.body.classList.add("navigation-3d-active");

    console.log("[enableNavigation3D] Navegação 3D ativada com sucesso");
    return true;
  } catch (error) {
    console.error("[enableNavigation3D] Erro ao ativar navegação 3D:", error);
    return false;
  }
}

// Adicionar em navigation3D.js
function monitorNavigationState() {
  const checkInterval = setInterval(() => {
    if (
      navigationState.isActive &&
      !isNavigation3DActive() &&
      navigationState.is3DModeEnabled
    ) {
      console.log("[monitorNavigationState] Reativando modo 3D");
      enableNavigation3D({
        navigationHeading: navigationState.lastUserHeading || 0,
        pitch: 60,
      });
    }
  }, 2000);

  return checkInterval;
}

// Iniciar monitoramento
const stateMonitorInterval = monitorNavigationState();

/**
 * Start navigation in 3D mode
 * @param {Object} destination - Destination object with coordinates
 * @returns {Promise} Promise that resolves when navigation begins
 */
export function startNavigationIn3DMode(destination) {
  try {
    console.log("[startNavigationIn3DMode] Preparing for 3D navigation");

    // First ensure container exists
    const container = ensureMapbox3DContainer();
    if (!container) {
      console.error(
        "[startNavigationIn3DMode] Failed to create 3D map container"
      );
    }

    // Pre-load Mapbox GL JS before starting navigation
    return loadMapboxGLScript()
      .then((mapboxgl) => {
        console.log(
          "[startNavigationIn3DMode] Mapbox GL JS loaded, starting navigation"
        );

        // Set global 3D mode flag
        if (typeof window.navigationState !== "undefined") {
          window.navigationState.is3DModeEnabled = true;
        }

        // Start navigation with 3D-specific params
        return startNavigation(destination, {
          enable3D: true,
          useImmersiveMode: true,
          // Short delay to ensure route initialization completes before 3D activation
          delayFor3DActivation: 1500,
        }).then((result) => {
          // After navigation starts, force 3D mode again
          setTimeout(() => {
            enable3DMode({
              pitch: 60,
              animationDuration: 1000,
              hideBaseMap: true,
              navigationHeading: window.lastUserHeading || 0,
            });
          }, 2000);

          return result;
        });
      })
      .catch((error) => {
        console.error(
          "[startNavigationIn3DMode] Error loading Mapbox GL:",
          error
        );
        // Fallback to normal navigation
        return startNavigation(destination);
      });
  } catch (error) {
    console.error("[startNavigationIn3DMode] General error:", error);
    return startNavigation(destination);
  }
}

/**
 * Alterna o modo de navegação imersiva/3D
 * @param {boolean} enable - Se deve ativar (true) ou desativar (false) o modo 3D
 * @returns {boolean} - Status atual do modo 3D após a operação
 */
export function toggleImmersiveNavigation(enable = true) {
  try {
    // Atualiza o estado de navegação
    navigationState.is3DModeEnabled = enable;

    if (enable) {
      // Se estamos ativando o modo 3D
      if (!navigation3DActive) {
        // Ativar navegação 3D se ainda não estiver ativa
        enableNavigation3D({
          pitch: 60,
          navigationHeading: lastUserHeading,
        });
      } else {
        // Apenas atualizar a visualização 3D
        applyImmersiveView();
      }

      // Atualizar interface
      updateUIForImmersiveMode();
    } else {
      // Se estamos desativando o modo 3D
      disableNavigation3D();

      // Restaurar interface padrão
      updateUIForNormalMode();
    }

    // Atualizar controles
    updateNavigationControls();

    return navigationState.is3DModeEnabled;
  } catch (error) {
    console.error("[toggleImmersiveNavigation] Erro:", error);
    return navigation3DActive;
  }
}
/**
 * Desativa o modo de navegação 3D
 * @returns {boolean} Sucesso da operação
 */
export function disableNavigation3D() {
  try {
    console.log("[disableNavigation3D] Desativando navegação 3D");

    // Desativar modo 3D
    disable3DMode();

    // Marcar navegação 3D como inativa
    navigation3DActive = false;

    document.body.classList.remove("navigation-3d-active");

    console.log("[disableNavigation3D] Navegação 3D desativada com sucesso");
    return true;
  } catch (error) {
    console.error(
      "[disableNavigation3D] Erro ao desativar navegação 3D:",
      error
    );
    return false;
  }
}

/**
 * Atualiza a visualização da rota em 3D
 * @param {Object} routeData - Dados GeoJSON da rota
 * @param {Object} options - Opções adicionais
 */
export function updateRouteDataIn3D(routeData, options = {}) {
  try {
    if (!routeData || !routeData.features || routeData.features.length === 0) {
      console.warn("[updateRouteDataIn3D] Dados de rota inválidos ou vazios");
      return;
    }

    // Salvar dados da rota
    lastRouteData = routeData;

    // Verificar se o modo 3D está ativo
    if (!is3DModeActive() || !navigation3DActive) {
      console.log(
        "[updateRouteDataIn3D] Modo 3D não está ativo, ignorando atualização"
      );
      return;
    }

    // Extrair coordenadas da rota
    const feature = routeData.features[0];
    if (!feature.geometry || !feature.geometry.coordinates) {
      console.warn("[updateRouteDataIn3D] Geometria da rota inválida");
      return;
    }

    const coordinates = feature.geometry.coordinates;

    // Configurações de visualização
    const routeOptions = {
      routeColor: options.routeColor || "#3b82f6",
      routeWidth: options.routeWidth || 5,
      routeOpacity: options.routeOpacity || 0.8,
      animate: options.animate !== false,
    };

    // Se temos informação sobre a parte completada da rota
    if (options.progress && options.progress > 0 && options.progress < 100) {
      const splitIndex = Math.floor(
        (options.progress / 100) * coordinates.length
      );
      routeOptions.completedRouteCoordinates = coordinates.slice(0, splitIndex);
    }

    // Atualizar rota no mapa 3D
    updateRouteIn3D(coordinates, routeOptions);

    console.log(
      "[updateRouteDataIn3D] Rota atualizada em 3D com",
      coordinates.length,
      "pontos"
    );
  } catch (error) {
    console.error("[updateRouteDataIn3D] Erro ao atualizar rota 3D:", error);
  }
}

/**
 * Atualiza a posição do usuário na visualização 3D
 * @param {Object} userPosition - Posição do usuário {latitude, longitude, heading}
 * @param {Object} options - Opções adicionais
 */
export function updateUserPositionIn3D(userPosition, options = {}) {
  try {
    if (!userPosition || !userPosition.latitude || !userPosition.longitude) {
      console.warn("[updateUserPositionIn3D] Posição do usuário inválida");
      return;
    }

    // Salvar última posição
    lastUserPosition = {
      latitude: userPosition.latitude,
      longitude: userPosition.longitude,
      heading: userPosition.heading || 0,
    };

    lastUserHeading = userPosition.heading || lastUserHeading;

    // Verificar se o modo 3D está ativo
    if (!is3DModeActive() || !navigation3DActive) {
      return;
    }

    const mapbox = getMapbox3DInstance();
    if (!mapbox) return;

    // Se estamos seguindo o usuário, atualizar a visualização
    if (followUserMode) {
      // Calcular o ângulo de visão baseado na direção do usuário
      const bearing = userPosition.heading || lastUserHeading;

      mapbox.easeTo({
        center: [userPosition.longitude, userPosition.latitude],
        bearing: bearing,
        duration: 500,
        pitch: options.pitch || 60,
      });
    }

    // Adicionar ou atualizar marcador do usuário no mapa 3D
    updateUserMarkerIn3D(userPosition, options);

    console.log("[updateUserPositionIn3D] Posição do usuário atualizada em 3D");
  } catch (error) {
    console.error(
      "[updateUserPositionIn3D] Erro ao atualizar posição 3D:",
      error
    );
  }
}

/**
 * Atualiza o marcador do usuário no mapa 3D
 * @param {Object} position - Posição do usuário
 * @param {Object} options - Opções adicionais
 */
function updateUserMarkerIn3D(position, options = {}) {
  try {
    const mapbox = getMapbox3DInstance();
    if (!mapbox) return;

    // ID do marcador do usuário no Mapbox
    const MARKER_ID = "user-location-marker";
    const SOURCE_ID = "user-location-source";

    // Criar fonte de dados GeoJSON se não existir
    if (!mapbox.getSource(SOURCE_ID)) {
      mapbox.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [position.longitude, position.latitude],
          },
          properties: {
            bearing: position.heading || 0,
          },
        },
      });

      // Adicionar camada do marcador
      mapbox.addLayer({
        id: MARKER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": "triangle-15",
          "icon-size": 1.5,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": "#ff0000",
          "icon-halo-color": "#ffffff",
          "icon-halo-width": 2,
        },
      });

      console.log("[updateUserMarkerIn3D] Marcador do usuário criado em 3D");
    } else {
      // Atualizar posição e direção do marcador
      mapbox.getSource(SOURCE_ID).setData({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          bearing: position.heading || 0,
        },
      });
    }

    // Atualizar também a precisão GPS (círculo)
    updateAccuracyCircleIn3D(position, options);
  } catch (error) {
    console.error(
      "[updateUserMarkerIn3D] Erro ao atualizar marcador 3D:",
      error
    );
  }
}

/**
 * Atualiza o círculo de precisão GPS no mapa 3D
 * @param {Object} position - Posição do usuário
 * @param {Object} options - Opções adicionais
 */
function updateAccuracyCircleIn3D(position, options = {}) {
  try {
    const mapbox = getMapbox3DInstance();
    if (!mapbox) return;

    const CIRCLE_SOURCE_ID = "user-accuracy-source";
    const CIRCLE_LAYER_ID = "user-accuracy-circle";

    // Pular se não temos informação de precisão
    if (!position.accuracy) return;

    // Criar fonte de dados GeoJSON para o círculo se não existir
    if (!mapbox.getSource(CIRCLE_SOURCE_ID)) {
      mapbox.addSource(CIRCLE_SOURCE_ID, {
        type: "geojson",
        data: createAccuracyCircleGeoJSON(position),
      });

      // Adicionar camada do círculo de precisão
      mapbox.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "fill",
        source: CIRCLE_SOURCE_ID,
        paint: {
          "fill-color": "rgba(59, 130, 246, 0.2)",
          "fill-outline-color": "rgba(59, 130, 246, 0.6)",
        },
      });

      console.log(
        "[updateAccuracyCircleIn3D] Círculo de precisão criado em 3D"
      );
    } else {
      // Atualizar dados do círculo
      mapbox
        .getSource(CIRCLE_SOURCE_ID)
        .setData(createAccuracyCircleGeoJSON(position));
    }
  } catch (error) {
    console.error(
      "[updateAccuracyCircleIn3D] Erro ao atualizar círculo de precisão 3D:",
      error
    );
  }
}
function ensureContainer() {
  // Verificar se o container existe
  let container = document.getElementById("mapbox-3d-container");

  // Se não existir, criar
  if (!container) {
    console.log("[ensureContainer] Criando container para o mapa 3D");
    container = document.createElement("div");
    container.id = "mapbox-3d-container";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.right = "0";
    container.style.bottom = "0";
    container.style.zIndex = "5";

    const mapContainer = document.getElementById("map-container");
    if (mapContainer) {
      mapContainer.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
  }

  return container;
}

/**
 * Cria um objeto GeoJSON representando um círculo para a precisão GPS
 * @param {Object} position - Posição com {longitude, latitude, accuracy}
 * @returns {Object} Objeto GeoJSON do círculo
 */
function createAccuracyCircleGeoJSON(position) {
  const accuracyInKm = position.accuracy / 1000;

  // Criar polígono circular
  const points = 64; // Número de pontos no círculo
  const coords = [];

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = Math.cos(angle) * accuracyInKm;
    const dy = Math.sin(angle) * accuracyInKm;

    // Converter desvio em km para coordenadas (aproximação simples)
    const lon =
      position.longitude +
      dx / (111.32 * Math.cos(position.latitude * (Math.PI / 180)));
    const lat = position.latitude + dy / 110.574;

    coords.push([lon, lat]);
  }

  // Fechar o polígono
  coords.push(coords[0]);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  };
}

/**
 * Define se o mapa 3D deve seguir o usuário durante a navegação
 * @param {boolean} follow - Ativar ou desativar modo de seguir usuário
 */
export function setFollow3DMode(follow) {
  followUserMode = follow;
  console.log(
    `[setFollow3DMode] Modo de seguir usuário: ${
      follow ? "ativado" : "desativado"
    }`
  );
}

/**
 * Verifica se a navegação 3D está ativa
 * @returns {boolean} Estado da navegação 3D
 */
export function isNavigation3DActive() {
  return navigation3DActive;
}

// Adicionar ao arquivo navigation3D.js
function applyImmersiveView() {
  try {
    if (!map) return;

    // Salvar estado anterior
    navigationState.previousMapState = {
      zoom: map.getZoom(),
      center: map.getCenter(),
      pitch: map.getPitch ? map.getPitch() : 0,
      bearing: map.getBearing ? map.getBearing() : 0,
    };

    // Aplicar configurações 3D
    if (typeof map.setPitch === "function") {
      map.setPitch(60); // Ângulo de inclinação 3D
    }

    // Ajustar bearing baseado na direção do usuário
    if (typeof map.setBearing === "function") {
      const userHeading = navigationState.lastUserHeading || 0;
      map.setBearing(userHeading);
    }

    // Aumentar zoom
    map.setZoom(Math.min(19, map.getZoom() + 1));
  } catch (error) {
    console.error("[applyImmersiveView] Erro:", error);
  }
}

/**
 * Reverte o mapa para a visualização normal/2D
 */
function revertToNormalView() {
  try {
    // Verificar se o mapa existe
    if (!map) {
      console.error("[revertToNormalView] Mapa não inicializado");
      return;
    }

    // Restaurar configuração anterior se disponível
    if (navigationState.previousMapState) {
      if (typeof map.setPitch === "function") {
        map.setPitch(0); // Voltar para visão plana
      }

      if (typeof map.setBearing === "function") {
        map.setBearing(0); // Resetar a orientação do mapa para o norte
      }

      map.setZoom(navigationState.previousMapState.zoom);

      // Não restauramos o centro aqui porque queremos manter
      // o mapa centralizado na posição atual do usuário
    } else {
      // Configuração padrão se não houver estado anterior
      if (typeof map.setPitch === "function") map.setPitch(0);
      if (typeof map.setBearing === "function") map.setBearing(0);
    }

    console.log("[revertToNormalView] Visualização normal restaurada");
  } catch (error) {
    console.error(
      "[revertToNormalView] Erro ao reverter para visualização normal:",
      error
    );
  }
}

// Adicionar ao arquivo navigation3D.js
function updateUIForImmersiveMode() {
  try {
    // Adicionar classes CSS para modo 3D
    document.body.classList.add("immersive-mode");

    const navigationBanner = document.getElementById("navigation-banner");
    if (navigationBanner) {
      navigationBanner.classList.add("immersive");
    }

    // Atualizar botão 3D
    const toggle3DButton = document.getElementById("toggle-3d-mode");
    if (toggle3DButton) {
      toggle3DButton.classList.add("active");
      toggle3DButton.setAttribute("aria-pressed", "true");
    }
  } catch (error) {
    console.error("[updateUIForImmersiveMode] Erro:", error);
  }
}

// Adicionar ao arquivo navigation3D.js ou navigationController.js
function updateNavigationControls() {
  try {
    const is3DMode = navigationState.is3DModeEnabled;

    // Atualizar botões e controles
    const modeToggle = document.getElementById("toggle-3d-mode");
    if (modeToggle) {
      modeToggle.classList.toggle("active", is3DMode);
      modeToggle.setAttribute("aria-pressed", is3DMode ? "true" : "false");
      modeToggle.title = is3DMode ? "Desativar modo 3D" : "Ativar modo 3D";
    }

    // Atualizar outros controles relevantes
    document.body.classList.toggle("navigation-3d-active", is3DMode);
  } catch (error) {
    console.error("[updateNavigationControls] Erro:", error);
  }
}

// Adicionar ao arquivo navigation3D.js
function updateUIForNormalMode() {
  try {
    // Remover classes CSS de modo 3D
    document.body.classList.remove("immersive-mode");

    const navigationBanner = document.getElementById("navigation-banner");
    if (navigationBanner) {
      navigationBanner.classList.remove("immersive");
    }

    // Atualizar botão 3D
    const toggle3DButton = document.getElementById("toggle-3d-mode");
    if (toggle3DButton) {
      toggle3DButton.classList.remove("active");
      toggle3DButton.setAttribute("aria-pressed", "false");
    }
  } catch (error) {
    console.error("[updateUIForNormalMode] Erro:", error);
  }
}

/**
 * Ajusta a perspectiva da câmera com base no modo de navegação
 * @param {boolean} is3DMode - Se está no modo 3D
 */
function adjustCameraPerspective(is3DMode) {
  try {
    if (!map) return;

    if (is3DMode) {
      // No modo 3D, a câmera deve estar mais próxima e inclinada
      // para dar uma sensação de imersão

      // Se o usuário estiver se movendo, ajustar a direção da câmera
      // para seguir a direção do movimento
      if (navigationState.lastUserHeading !== undefined) {
        if (typeof map.setBearing === "function") {
          map.setBearing(navigationState.lastUserHeading);
        }
      }
    } else {
      // No modo 2D, voltamos para uma visão de cima
      if (typeof map.setPitch === "function") {
        map.setPitch(0);
      }
    }
  } catch (error) {
    console.error(
      "[adjustCameraPerspective] Erro ao ajustar perspectiva da câmera:",
      error
    );
  }
}
