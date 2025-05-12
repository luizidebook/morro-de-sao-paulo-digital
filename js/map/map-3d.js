/**
 * Módulo de visualização 3D do mapa usando Mapbox GL JS
 * Permite rotação tridimensional e visualização em perspectiva
 */

// Add this import at the top of the file
import { initComplete, updateLoadingMessage } from "../utils/init-manager.js";

// Configuração do token Mapbox (use um token válido de sua conta)
const MAPBOX_TOKEN =
  "pk.eyJ1IjoibHVpemlkZWJvb2siLCJhIjoiY2x3emQ4c2JtMDYyODJqcTdyazlhOHQxeiJ9.0t3JTpGWGqDtv61P_D7wuw"; // Substitua por seu token

// Estado do mapa 3D
let mapbox3dInstance = null;
let is3dModeActive = false;
let originalMapInstance = null;
let mapboxContainer = null;

// Track loading state
let isMapLoaded = false;
let isStyleLoaded = false;
let isBuildingsAdded = false;

/**
 * Estilo do mapa Mapbox
 * @type {string}
 */
let mapboxStyle = "mapbox://styles/mapbox/streets-v12"; // Use a standard style URL

let buildingsLayerAdded = false;

/**
 * Inicializa o mapa Mapbox GL 3D
 * @param {Object} options - Opções de inicialização
 * @param {Array} options.center - Coordenadas centrais [lng, lat]
 * @param {number} options.zoom - Nível de zoom inicial
 * @param {string} options.containerId - ID do container do mapa
 * @param {Object} options.originalMapInstance - Instância original do mapa Leaflet
 * @returns {Object} Instância do mapa Mapbox GL
 */
export function initMapbox3D(options = {}) {
  try {
    console.log("[initMapbox3D] Iniciando configuração do mapa 3D");

    // Verificar se o Mapbox GL JS está disponível
    if (!window.mapboxgl) {
      console.error(
        "[initMapbox3D] Mapbox GL JS não está carregado. Carregando script..."
      );
      return loadMapboxGLScript().then(() => initMapbox3D(options));
    }

    const {
      center = [-38.9159969, -13.3775457], // Coordenadas de Morro de São Paulo
      zoom = 15,
      containerId = "map",
      originalMapInstance: mapOriginalInstance = null, // Renamed parameter to avoid conflict
    } = options;

    // Salvar referência ao mapa Leaflet original
    if (mapOriginalInstance) {
      originalMapInstance = mapOriginalInstance; // Here we assign to the global variable
    }

    // Verificar se já existe uma instância 3D
    if (mapbox3dInstance) {
      console.log("[initMapbox3D] Instância 3D já existe, retornando...");
      return mapbox3dInstance;
    }

    // Configurar o token Mapbox
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Obter o container existente
    const mapContainerElement = document.getElementById(containerId);
    if (!mapContainerElement) {
      console.error(
        `[initMapbox3D] Container com ID '${containerId}' não encontrado!`
      );
      return null;
    }

    // Criar um novo container para o mapa 3D
    mapboxContainer = document.createElement("div");
    mapboxContainer.id = "mapbox-3d-container";
    mapboxContainer.style.position = "absolute";
    mapboxContainer.style.top = "0";
    mapboxContainer.style.left = "0";
    mapboxContainer.style.width = "100%";
    mapboxContainer.style.height = "100%";
    mapboxContainer.style.zIndex = "399"; // Abaixo dos controles mas acima do mapa base
    mapboxContainer.style.display = "block"; // Changed from 'none' to 'block'
    mapContainerElement.appendChild(mapboxContainer);

    // Inicializar o mapa Mapbox GL
    console.log(
      "[initMapbox3D] Criando instância Mapbox GL com centro:",
      center
    );

    // Reset loading states
    isMapLoaded = false;
    isStyleLoaded = false;
    isBuildingsAdded = false;

    const mapbox = new mapboxgl.Map({
      container: mapboxContainer,
      style: mapboxStyle,
      center: center,
      zoom: zoom,
      pitch: 0, // Iniciar sem inclinação
      bearing: 0, // Sem rotação inicial
      antialias: true,
      attributionControl: false, // Já existe no mapa base
    });

    // Add these event listeners:
    mapbox.on("style.load", () => {
      console.log("[initMapbox3D] Map style loaded successfully");

      // Make the container visible as the style has loaded
      mapboxContainer.style.display = "block";
      mapboxContainer.style.visibility = "visible";
      isStyleLoaded = true;
      checkAllLoaded();
    });

    mapbox.on("error", (e) => {
      console.error("[initMapbox3D] Map error:", e);

      // If the style fails to load, try a fallback style
      if (e.error && e.error.status === 404 && e.sourceId === "style") {
        console.log(
          "[initMapbox3D] Style error detected, trying fallback style"
        );
        mapbox.setStyle("mapbox://styles/mapbox/outdoors-v12");
      }
    });

    // Atribuir à variável global
    mapbox3dInstance = mapbox;

    // Adicionar controles de navegação
    mapbox3dInstance.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-right"
    );

    // Configurar eventos
    mapbox3dInstance.on("load", () => {
      console.log("[initMapbox3D] Mapa Mapbox GL carregado com sucesso");
      enableBuildingExtrusions();

      // Notificar sistema
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("mapbox3d:loaded"));
      }
      isMapLoaded = true;
      checkAllLoaded();
    });

    // Configurar gestos para mobile
    mapbox3dInstance.touchZoomRotate.enable();
    mapbox3dInstance.touchPitch.enable();

    console.log("[initMapbox3D] Mapa 3D inicializado com sucesso");
    return mapbox3dInstance;
  } catch (error) {
    console.error("[initMapbox3D] Erro ao inicializar mapa 3D:", error);
    return null;
  }
}

// Add this function right after loadMapboxGLScript

/**
 * Ensures the container for the 3D map exists
 * @returns {HTMLElement|null} The container element or null if it couldn't be created
 */
export function ensureMapbox3DContainer() {
  // Check if container already exists
  let container = document.getElementById("mapbox-3d-container");

  // If the container exists, return it
  if (container) {
    console.log("[ensureMapbox3DContainer] Container already exists");
    return container;
  }

  console.log("[ensureMapbox3DContainer] Creating container for 3D map");

  // Create a new container with proper styling
  container = document.createElement("div");
  container.id = "mapbox-3d-container";
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = "399"; // Below controls but above base map
  container.style.visibility = "hidden"; // Initially hidden
  container.style.opacity = "0"; // Start transparent for smooth transition
  container.style.transition = "opacity 0.5s ease-in-out"; // Smooth transition
  container.classList.add("mapbox-3d-container");

  // Find the map container to append to
  const mapContainer =
    document.getElementById("map-container") ||
    document.getElementById("map") ||
    document.querySelector(".map-container");

  if (mapContainer) {
    mapContainer.appendChild(container);
    console.log("[ensureMapbox3DContainer] Container added to map container");

    // Force a reflow to ensure the container is properly positioned
    container.getBoundingClientRect();

    return container;
  } else {
    // Fallback to body if map container not found
    document.body.appendChild(container);
    console.log("[ensureMapbox3DContainer] Container added to body (fallback)");
    return container;
  }
}

export function loadMapboxGLScript() {
  return new Promise((resolve, reject) => {
    // Se já carregado, resolver imediatamente
    if (window.mapboxgl) {
      console.log("[loadMapboxGLScript] Mapbox GL JS já carregado");
      return resolve(window.mapboxgl);
    }

    // Caso contrário, carregar o script
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js";
    script.async = true;

    script.onload = () => {
      console.log("[loadMapboxGLScript] Mapbox GL JS carregado com sucesso");
      // Carregar também o CSS necessário
      const link = document.createElement("link");
      link.href = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css";
      link.rel = "stylesheet";
      document.head.appendChild(link);

      // Garantir que a API esteja inicializada
      setTimeout(() => resolve(window.mapboxgl), 200);
    };

    script.onerror = (error) => {
      console.error(
        "[loadMapboxGLScript] Erro ao carregar Mapbox GL JS:",
        error
      );
      reject(error);
    };

    document.head.appendChild(script);
  });
}

// Replace the enable3DMode function

/**
 * Habilita o modo 3D e mostra o mapa Mapbox
 * @param {Object} options - Opções para ativação do modo 3D
 * @returns {Promise} Promise that resolves when the mode is enabled
 */
export function enable3DMode(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      console.log("[enable3DMode] Ativando modo 3D");

      // Ensure the container exists before continuing
      mapboxContainer = ensureMapbox3DContainer();
      if (!mapboxContainer) {
        console.error("[enable3DMode] Failed to create 3D map container");
        reject(new Error("Failed to create 3D map container"));
        return;
      }

      // Load Mapbox GL JS if not already loaded
      if (!window.mapboxgl) {
        loadMapboxGLScript()
          .then(() => {
            console.log(
              "[enable3DMode] Mapbox GL JS loaded, retrying enable3DMode"
            );
            enable3DMode(options).then(resolve).catch(reject);
          })
          .catch((error) => {
            console.error("[enable3DMode] Failed to load Mapbox GL JS:", error);
            reject(error);
          });
        return;
      }

      // Se ainda não temos uma instância, criar uma
      if (!mapbox3dInstance) {
        // Obter instância do mapa Leaflet se não fornecida
        let leafletMapInstance = null;

        if (options.mapInstance) {
          leafletMapInstance = options.mapInstance;
        } else if (typeof window.getMapInstance === "function") {
          leafletMapInstance = window.getMapInstance();
        } else if (window.map) {
          leafletMapInstance = window.map;
        }

        // Check if we got a valid Leaflet map instance
        if (
          !leafletMapInstance ||
          typeof leafletMapInstance.getCenter !== "function"
        ) {
          console.log(
            "[enable3DMode] Leaflet map not found or invalid. Using default coordinates."
          );

          // Use default coordinates if the map isn't available
          const defaultCenter = [-38.9159969, -13.3775457]; // Morro de São Paulo coordinates
          const defaultZoom = 15;

          // Initialize with default values
          const mapboxOptions = {
            center: defaultCenter,
            zoom: defaultZoom,
            containerId: "map",
          };

          console.log(
            "[enable3DMode] Initializing 3D map with default options:",
            mapboxOptions
          );
          mapbox3dInstance = initMapbox3D(mapboxOptions);
        } else {
          // Valid map instance found, use its current view
          const center = leafletMapInstance.getCenter();
          const zoom = leafletMapInstance.getZoom();

          // Initialize 3D map with current view
          const mapboxOptions = {
            center: [center.lng, center.lat],
            zoom: zoom,
            containerId: leafletMapInstance._container.id,
            originalMapInstance: leafletMapInstance,
          };

          console.log(
            "[enable3DMode] Initializing 3D map with options from Leaflet:",
            mapboxOptions
          );
          mapbox3dInstance = initMapbox3D(mapboxOptions);
        }

        // Make globally available
        window.mapbox3dInstance = mapbox3dInstance;

        // If initialization failed, return false
        if (!mapbox3dInstance) {
          console.error("[enable3DMode] Failed to initialize 3D map");
          reject(new Error("Failed to initialize 3D map"));
          return;
        }
      }

      // Make container visible with proper sequence
      mapboxContainer.style.display = "block";

      // Use requestAnimationFrame for smooth transitions
      requestAnimationFrame(() => {
        mapboxContainer.style.visibility = "visible";

        requestAnimationFrame(() => {
          mapboxContainer.style.opacity = "1";
          mapboxContainer.classList.add("active");

          // Force a map resize to ensure proper rendering
          if (mapbox3dInstance) {
            mapbox3dInstance.resize();
            console.log(
              "[enable3DMode] Forced map resize for proper rendering"
            );
          }
        });
      });

      // Set active state
      is3dModeActive = true;
      console.log("[enable3DMode] 3D mode activated successfully");

      // Resolve the promise - loading state is tracked separately
      resolve(true);
    } catch (error) {
      console.error("[enable3DMode] Error activating 3D mode:", error);
      reject(error);
    }
  });
}

/**
 * Desativa o modo 3D e retorna para o mapa normal
 * @returns {boolean} Sucesso da operação
 */
export function disable3DMode() {
  try {
    console.log("[disable3DMode] Desativando modo 3D");

    if (!mapboxContainer || !is3dModeActive) {
      console.log("[disable3DMode] Modo 3D não está ativo");
      return true;
    }

    // Ocultar container Mapbox
    mapboxContainer.style.display = "none";

    // Restaurar visibilidade do mapa base Leaflet
    const leafletContainer = document.querySelector(".leaflet-container");
    if (leafletContainer) {
      leafletContainer.style.visibility = "visible";
    }

    // Remover classe do body
    document.body.classList.remove("map-3d-mode");

    // Marcar como inativo
    is3dModeActive = false;

    console.log("[disable3DMode] Modo 3D desativado com sucesso");
    return true;
  } catch (error) {
    console.error("[disable3DMode] Erro ao desativar modo 3D:", error);
    return false;
  }
}

/**
 * Adiciona a camada de extrusão de edifícios ao mapa 3D
 */
export function enableBuildingExtrusions() {
  try {
    if (!mapbox3dInstance || !mapbox3dInstance.loaded()) {
      console.log(
        "[enableBuildingExtrusions] Mapa ainda carregando, aguardando..."
      );
      // Tentar novamente em breve
      setTimeout(enableBuildingExtrusions, 500);
      return;
    }

    console.log(
      "[enableBuildingExtrusions] Adicionando camada de edifícios 3D"
    );

    // Check if we already have a source for 3D buildings
    if (!mapbox3dInstance.getSource("building-data")) {
      // Add a new source for building data instead of using 'composite'
      mapbox3dInstance.addSource("building-data", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });
    }

    // Verify the source was added before continuing
    if (!mapbox3dInstance.getSource("building-data")) {
      console.error(
        "[enableBuildingExtrusions] Falha ao adicionar fonte de dados de edifícios"
      );
      return;
    }

    // Check if the layer already exists
    if (mapbox3dInstance.getLayer("3d-buildings")) {
      console.log(
        "[enableBuildingExtrusions] Camada de edifícios 3D já existe"
      );
      return;
    }

    // Add the 3D buildings layer
    mapbox3dInstance.addLayer({
      id: "3d-buildings",
      source: "building-data",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#d1d5db",
          50,
          "#a3b1c6",
          100,
          "#8596ac",
          200,
          "#667892",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.8,
      },
    });

    // Mark buildings as added
    buildingsLayerAdded = true;
    console.log(
      "[enableBuildingExtrusions] Camada de edifícios 3D adicionada com sucesso"
    );
    isBuildingsAdded = true;
    checkAllLoaded();
  } catch (error) {
    console.error(
      "[enableBuildingExtrusions] Erro ao adicionar camada de edifícios 3D:",
      error
    );
  }
}

/**
 * Sincroniza a posição entre os mapas Mapbox e Leaflet
 * Útil ao alternar entre os modos 2D e 3D
 * @param {Object} options - Opções de sincronização
 */
export function syncMapPosition(options = {}) {
  try {
    const {
      source = "mapbox", // 'mapbox' ou 'leaflet'
      animate = true,
    } = options;

    // Obter instância do mapa Leaflet
    const leafletMapInstance =
      options.leafletInstance ||
      (typeof getMapInstance === "function" ? getMapInstance() : null) ||
      window.map;

    if (!leafletMapInstance) {
      console.error(
        "[syncMapPosition] Instância do mapa Leaflet não encontrada"
      );
      return;
    }

    if (!mapbox3dInstance) {
      console.error(
        "[syncMapPosition] Instância do mapa Mapbox não encontrada"
      );
      return;
    }

    if (source === "mapbox") {
      // Sincronizar Mapbox -> Leaflet
      const center = mapbox3dInstance.getCenter();
      const zoom = mapbox3dInstance.getZoom();

      console.log(
        `[syncMapPosition] Sincronizando Mapbox -> Leaflet: Centro [${center.lng.toFixed(
          6
        )}, ${center.lat.toFixed(6)}], Zoom ${zoom.toFixed(2)}`
      );

      if (animate) {
        leafletMapInstance.flyTo([center.lat, center.lng], zoom);
      } else {
        leafletMapInstance.setView([center.lat, center.lng], zoom, {
          animate: false,
        });
      }
    } else {
      // Sincronizar Leaflet -> Mapbox
      const center = leafletMapInstance.getCenter();
      const zoom = leafletMapInstance.getZoom();

      console.log(
        `[syncMapPosition] Sincronizando Leaflet -> Mapbox: Centro [${center.lng.toFixed(
          6
        )}, ${center.lat.toFixed(6)}], Zoom ${zoom.toFixed(2)}`
      );

      if (animate) {
        mapbox3dInstance.flyTo({
          center: [center.lng, center.lat],
          zoom: zoom,
        });
      } else {
        mapbox3dInstance.jumpTo({
          center: [center.lng, center.lat],
          zoom: zoom,
        });
      }
    }
  } catch (error) {
    console.error(
      "[syncMapPosition] Erro ao sincronizar posição do mapa:",
      error
    );
  }
}

/**
 * Verifica se o modo 3D está ativo
 * @returns {boolean} Estado do modo 3D
 */
export function is3DModeActive() {
  return is3dModeActive;
}

/**
 * Atualiza a rota no mapa 3D
 * @param {Array} routeCoordinates - Coordenadas da rota no formato [[lng, lat], [lng, lat], ...]
 * @param {Object} options - Opções adicionais
 */
export function updateRouteIn3D(routeCoordinates, options = {}) {
  if (!mapbox3dInstance || !is3dModeActive) {
    console.log("[updateRouteIn3D] Modo 3D não está ativo");
    return;
  }

  try {
    const {
      routeColor = "#3b82f6", // Cor da rota
      routeWidth = 5, // Largura da linha
      routeOpacity = 0.8, // Opacidade
      routeElevation = 5, // Elevação da rota em metros
      completedRouteColor = "#bbbbbb", // Cor da parte percorrida
      animate = true, // Animar câmera para seguir a rota
    } = options;

    console.log(
      "[updateRouteIn3D] Atualizando rota 3D com",
      routeCoordinates.length,
      "pontos"
    );

    // Verificar se o mapa já está carregado
    if (!mapbox3dInstance.isStyleLoaded()) {
      console.log("[updateRouteIn3D] Estilo ainda carregando, aguardando...");
      mapbox3dInstance.once("style.load", () =>
        updateRouteIn3D(routeCoordinates, options)
      );
      return;
    }

    // Verificar se as fontes/camadas já existem e removê-las
    if (mapbox3dInstance.getSource("route-source")) {
      mapbox3dInstance.removeLayer("route-line");
      mapbox3dInstance.removeSource("route-source");
      console.log("[updateRouteIn3D] Camada de rota anterior removida");
    }

    if (mapbox3dInstance.getSource("completed-route-source")) {
      mapbox3dInstance.removeLayer("completed-route-line");
      mapbox3dInstance.removeSource("completed-route-source");
    }

    // Criar fonte de dados com a rota
    mapbox3dInstance.addSource("route-source", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routeCoordinates,
        },
      },
    });

    // Adicionar camada para a rota
    mapbox3dInstance.addLayer({
      id: "route-line",
      type: "line",
      source: "route-source",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": routeColor,
        "line-width": routeWidth,
        "line-opacity": routeOpacity,
      },
    });

    // Se temos dados sobre a parte completada da rota
    if (
      options.completedRouteCoordinates &&
      options.completedRouteCoordinates.length > 0
    ) {
      mapbox3dInstance.addSource("completed-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: options.completedRouteCoordinates,
          },
        },
      });

      mapbox3dInstance.addLayer({
        id: "completed-route-line",
        type: "line",
        source: "completed-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": completedRouteColor,
          "line-width": routeWidth - 1,
          "line-opacity": routeOpacity - 0.2,
          "line-dasharray": [2, 2],
        },
      });
    }

    // Animar câmera para seguir a rota
    if (animate && routeCoordinates.length > 1) {
      // Calcular um bounding box que inclua toda a rota
      const bounds = routeCoordinates.reduce(
        (bounds, coord) => {
          return [
            [
              Math.min(bounds[0][0], coord[0]),
              Math.min(bounds[0][1], coord[1]),
            ],
            [
              Math.max(bounds[1][0], coord[0]),
              Math.max(bounds[1][1], coord[1]),
            ],
          ];
        },
        [
          [routeCoordinates[0][0], routeCoordinates[0][1]],
          [routeCoordinates[0][0], routeCoordinates[0][1]],
        ]
      );

      mapbox3dInstance.fitBounds(bounds, {
        padding: 50,
        duration: 1000,
        pitch: options.pitch || 60,
        bearing: options.bearing || 0,
      });
    }

    console.log("[updateRouteIn3D] Rota 3D atualizada com sucesso");
  } catch (error) {
    console.error("[updateRouteIn3D] Erro ao atualizar rota 3D:", error);
  }
}

/**
 * Obtém a instância atual do mapa Mapbox 3D
 * @returns {Object|null} Instância do mapa Mapbox ou null
 */
export function getMapbox3DInstance() {
  return mapbox3dInstance;
}

/**
 * Checks if the 3D map is fully loaded and rendered
 * @returns {boolean} True if the map is fully loaded
 */
export function isMap3DReady() {
  return isMapLoaded && isStyleLoaded && isBuildingsAdded;
}

// Modify the checkAllLoaded function to NOT update the loading message
function checkAllLoaded() {
  if (isMapLoaded && isStyleLoaded && isBuildingsAdded) {
    console.log("[map-3d] Map is fully loaded and ready");

    // Make sure mapbox3dInstance is available globally
    if (mapbox3dInstance) {
      window.mapbox3dInstance = mapbox3dInstance;
    }

    // Dispatch event when map is fully ready
    document.dispatchEvent(
      new CustomEvent("mapbox3d:ready", {
        detail: { map: mapbox3dInstance },
      })
    );

    console.log("[map-3d] mapbox3d:ready event dispatched");
  }
}
// Add these functions to the map-3d.js file

/**
 * Maps a location on the 3D map
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Options for the marker
 * @returns {Object} The created marker
 */
export function addMarker3D(lat, lon, options = {}) {
  if (!mapbox3dInstance || !is3dModeActive) {
    console.warn("[addMarker3D] 3D map not active or not initialized");
    return null;
  }

  try {
    console.log(`[addMarker3D] Adding marker at ${lat}, ${lon}`, options);

    // Create a DOM element for the marker
    const el = document.createElement("div");
    el.className = "mapbox-3d-marker";
    if (options.className) {
      el.className += " " + options.className;
    }

    // Create icon element
    const icon = document.createElement("i");

    // Determine icon based on title or options
    let iconClass = "fa-map-marker-alt";
    if (options.title) {
      const title = options.title.toLowerCase();
      if (title.includes("praia")) iconClass = "fa-umbrella-beach";
      else if (title.includes("restaurante")) iconClass = "fa-utensils";
      else if (title.includes("pousada") || title.includes("hotel"))
        iconClass = "fa-bed";
      else if (title.includes("atração") || title.includes("farol"))
        iconClass = "fa-mountain";
      else if (title.includes("loja") || title.includes("mercado"))
        iconClass = "fa-shopping-bag";
      else if (title.includes("hospital") || title.includes("polícia"))
        iconClass = "fa-ambulance";
      else if (title === "sua localização") iconClass = "fa-user-circle";
    }

    icon.className = `fas ${iconClass}`;
    el.appendChild(icon);

    // Create the marker
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lon, lat])
      .addTo(mapbox3dInstance);

    // Add the marker to the tracking array
    if (!window.markers3D) window.markers3D = [];
    window.markers3D.push(marker);

    // Create popup if needed
    if (options.popupContent) {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        options.popupContent
      );

      marker.setPopup(popup);

      if (options.openPopup) {
        marker.togglePopup();
      }
    }

    return marker;
  } catch (error) {
    console.error("[addMarker3D] Error adding marker:", error);
    return null;
  }
}

/**
 * Clears all 3D markers from the map
 */
export function clearMarkers3D() {
  if (!window.markers3D) window.markers3D = [];

  console.log(`[clearMarkers3D] Removing ${window.markers3D.length} markers`);

  window.markers3D.forEach((marker) => {
    marker.remove();
  });

  window.markers3D = [];
}

/**
 * Flies to a location on the 3D map with animation
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Camera and animation options
 */
export function flyToLocation(lat, lon, options = {}) {
  if (!mapbox3dInstance || !is3dModeActive) {
    console.warn("[flyToLocation] 3D map not active or not initialized");
    return;
  }

  const defaultOptions = {
    zoom: 16,
    pitch: 60,
    bearing: -15,
    duration: 2000,
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    mapbox3dInstance.flyTo({
      center: [lon, lat],
      zoom: finalOptions.zoom,
      pitch: finalOptions.pitch,
      bearing: finalOptions.bearing,
      duration: finalOptions.duration,
      essential: true,
    });

    console.log(
      `[flyToLocation] Flying to ${lat}, ${lon} with options:`,
      finalOptions
    );
  } catch (error) {
    console.error("[flyToLocation] Error during flyTo:", error);
  }
}

/**
 * Shows a route on the 3D map
 * @param {Object} options - Route options with start and end coordinates
 */
export function showRoute3D(options) {
  if (!mapbox3dInstance || !is3dModeActive) {
    console.warn("[showRoute3D] 3D map not active or not initialized");
    return;
  }

  const { startLat, startLon, endLat, endLon, destinationName } = options;

  // First, check if we need to remove previous route
  if (mapbox3dInstance.getSource("route")) {
    mapbox3dInstance.removeLayer("route");
    mapbox3dInstance.removeSource("route");
  }

  // Clear existing markers
  clearMarkers3D();

  // Add origin and destination markers
  const originMarker = addMarker3D(startLat, startLon, {
    title: "Sua localização",
    popupContent: "<h3>Sua localização</h3>",
    className: "user-location-marker",
  });

  const destMarker = addMarker3D(endLat, endLon, {
    title: destinationName,
    popupContent: `<h3>${destinationName}</h3>`,
    openPopup: true,
  });

  // Center the map to see both markers
  const centerLat = (startLat + endLat) / 2;
  const centerLon = (startLon + endLon) / 2;

  // Calculate appropriate zoom level
  const distance = calculateDistance(startLat, startLon, endLat, endLon);
  const zoomLevel =
    distance < 1000 ? 16 : distance < 2000 ? 15 : distance < 5000 ? 14 : 13;

  // Fly to view both points
  flyToLocation(centerLat, centerLon, {
    zoom: zoomLevel,
    pitch: 60,
    bearing: calculateBearing(startLat, startLon, endLat, endLon),
  });

  // Use API to get actual route data
  getDirectionsRoute(startLat, startLon, endLat, endLon)
    .then((data) => {
      if (!data || !data.routes || !data.routes.length) {
        console.warn("[showRoute3D] No routes returned from API");
        return;
      }

      const route = data.routes[0];
      const coordinates = route.geometry.coordinates;

      // Add the route to the map
      if (!mapbox3dInstance.getSource("route")) {
        mapbox3dInstance.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: coordinates,
            },
          },
        });

        mapbox3dInstance.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 8,
            "line-opacity": 0.8,
          },
        });
      } else {
        mapbox3dInstance.getSource("route").setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
        });
      }

      console.log("[showRoute3D] Route displayed successfully");
    })
    .catch((error) => {
      console.error("[showRoute3D] Error getting directions:", error);
    });
}

/**
 * Get directions from the Mapbox Directions API
 * @param {number} startLat - Starting latitude
 * @param {number} startLon - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLon - Ending longitude
 * @returns {Promise<Object>} - Directions data
 */
async function getDirectionsRoute(startLat, startLon, endLat, endLon) {
  try {
    // Use the Mapbox Directions API - You'll need to replace ACCESS_TOKEN with your actual token
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&steps=true&access_token=${mapboxgl.accessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[getDirectionsRoute] API error:", error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[getDirectionsRoute] Error fetching directions:", error);
    return null;
  }
}

/**
 * Calculate distance between two points
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}
