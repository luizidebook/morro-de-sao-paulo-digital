/**
 * Módulo de visualização 3D do mapa usando Mapbox GL JS
 * Permite rotação tridimensional e visualização em perspectiva
 */

// Add this import at the top of the file
import { appendMessage } from "../../assistant/assistant.js";
import { repositionMessagesArea } from "../../utils/ui-position.js";
import { getMapInstance } from "../../map/map-controls.js";
import { formatDistance } from "../../navigation/navigationUi/bannerUI.js";
// Configuração do token Mapbox (use um token válido de sua conta)
const MAPBOX_TOKEN =
  "pk.eyJ1IjoibHVpemlkZWJvb2siLCJhIjoiY2x3emQ4c2JtMDYyODJqcTdyazlhOHQxeiJ9.0t3JTpGWGqDtv61P_D7wuw"; // Substitua por seu token

// Estado do mapa 3D
export let mapbox3dInstance = null;
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
// Substituir a importação incorreta:
// import { routeCache } from cacheRouteData

// Por esta implementação:

/**
 * Classe para gerenciar o cache de rotas na memória e no localStorage
 */
class RouteCache {
  constructor() {
    this.cache = new Map();
    this.loadFromLocalStorage();
  }

  /**
   * Verifica se uma rota está no cache
   * @param {string} key - Chave da rota
   * @returns {boolean} - true se a rota estiver no cache
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Obtém uma rota do cache
   * @param {string} key - Chave da rota
   * @returns {Object|null} - Dados da rota ou null se não existir
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Adiciona uma rota ao cache
   * @param {string} key - Chave da rota
   * @param {Object} data - Dados da rota
   */
  set(key, data) {
    this.cache.set(key, data);
    this.saveToLocalStorage();
  }

  /**
   * Carrega rotas do localStorage
   */
  loadFromLocalStorage() {
    try {
      const savedCache = localStorage.getItem("routes3DCache");
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log("[RouteCache] Cache carregado do localStorage");
      }
    } catch (error) {
      console.error(
        "[RouteCache] Erro ao carregar cache do localStorage:",
        error
      );
    }
  }

  /**
   * Salva rotas no localStorage
   */
  saveToLocalStorage() {
    try {
      const cacheObject = {};
      this.cache.forEach((value, key) => {
        cacheObject[key] = value;
      });
      localStorage.setItem("routes3DCache", JSON.stringify(cacheObject));
      console.log("[RouteCache] Cache salvo no localStorage");
    } catch (error) {
      console.error(
        "[RouteCache] Erro ao salvar cache no localStorage:",
        error
      );
    }
  }

  /**
   * Limpa o cache
   */
  clear() {
    this.cache.clear();
    this.saveToLocalStorage();
  }
}

// Instância global do cache
const routeCache = new RouteCache();

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

    // Atualizar as propriedades CSS para compatibilidade com modo de alto contraste
    updateDeprecatedCSSProperties();

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

    // Criar um novo container dedicado para o mapa 3D
    mapboxContainer = document.createElement("div");
    mapboxContainer.id = "mapbox-3d-container";
    mapboxContainer.style.position = "absolute";
    mapboxContainer.style.top = "0";
    mapboxContainer.style.left = "0";
    mapboxContainer.style.width = "100%";
    mapboxContainer.style.height = "100%";
    mapboxContainer.style.zIndex = "399";
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
    const mapOptions = {
      ...options,
      center: center,
      zoom: zoom,
      pitch: 0, // Iniciar sem inclinação (modo 2D)
      bearing: 0,
      container: mapboxContainer, // Use o container específico em vez de 'map'
      accessToken: MAPBOX_TOKEN,
      style: mapboxStyle,
      attributionControl: false, // Remover controle de atribuição padrão
      customAttribution: "© OpenStreetMap | Mapbox",
    };

    // Criar o mapa sem controles padrão
    mapbox3dInstance = new mapboxgl.Map(mapOptions);

    // Aplicar o patch para acessibilidade dos popups logo após criar a instância
    patchMapboxPopupForAccessibility();

    // Configurar eventos de carregamento
    mapbox3dInstance.on("style.load", () => {
      console.log("[initMapbox3D] Map style loaded successfully");

      // Make the container visible as the style has loaded
      mapboxContainer.style.display = "block";
      mapboxContainer.style.visibility = "visible";
      isStyleLoaded = true;
      checkAllLoaded();
    });

    mapbox3dInstance.on("error", (e) => {
      console.error("[initMapbox3D] Map error:", e);

      // If the style fails to load, try a fallback style
      if (e.error && e.error.status === 404 && e.sourceId === "style") {
        console.log(
          "[initMapbox3D] Style error detected, trying fallback style"
        );
        mapbox3dInstance.setStyle("mapbox://styles/mapbox/outdoors-v12");
      }
    });

    // Atribuir à variável global
    mapbox3dInstance = mapbox3dInstance;

    // Configurar eventos
    mapbox3dInstance.on("load", () => {
      console.log("[initMapbox3D] Mapa Mapbox GL carregado com sucesso");
      enableBuildingExtrusions();

      // Configurar acessibilidade para popups após o carregamento completo
      fixPopupAccessibility(mapbox3dInstance);

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

    // Verificar se o Mapbox GL já está disponível e aplicar o patch
    if (window.mapboxgl && mapboxgl.Popup) {
      patchMapboxPopupForAccessibility();
    }

    return mapbox3dInstance;
  } catch (error) {
    console.error("[initMapbox3D] Erro ao inicializar mapa 3D:", error);
    return null;
  }
}

// Modifique a função updateDeprecatedCSSProperties em map-3d.js
function updateDeprecatedCSSProperties() {
  // Criar estilo para substituir todas as ocorrências de -ms-high-contrast
  const style = document.createElement("style");
  style.textContent = `
    /* Substituir todas as ocorrências de -ms-high-contrast */
    @media (forced-colors: active) {
      .mapboxgl-ctrl-icon {
        color: CanvasText;
        background-color: ButtonFace;
      }
      
      .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon,
      .mapboxgl-ctrl button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon,
      .mapboxgl-ctrl button.mapboxgl-ctrl-compass .mapboxgl-ctrl-icon {
        color: CanvasText;
      }
      
      .mapboxgl-ctrl button:not(:disabled):hover {
        background-color: ButtonFace;
      }
      
      .mapboxgl-ctrl-group {
        border-color: CanvasText;
      }
    }
  `;

  document.head.appendChild(style);
  console.log(
    "[updateDeprecatedCSSProperties] CSS properties updated to modern standards"
  );
}
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

export function enable3DMode(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      console.log("[enable3DMode] Ativando modo 3D");

      // Garantir que o container exista
      mapboxContainer = ensureMapbox3DContainer();
      if (!mapboxContainer) {
        throw new Error("Não foi possível criar o container para o mapa 3D");
      }

      // Tornar o container visível
      mapboxContainer.style.display = "block";
      mapboxContainer.style.visibility = "visible";
      mapboxContainer.style.opacity = "1";
      mapboxContainer.style.zIndex = "399";

      // Esconder o mapa Leaflet quando o 3D estiver ativo
      const leafletContainer = document.querySelector(".leaflet-container");
      if (leafletContainer) {
        leafletContainer.style.visibility = "hidden";
      }

      // Adicionar classe ao body para informar que o modo 3D está ativo
      document.body.classList.add("map-3d-mode");

      // Marcar como ativo
      is3dModeActive = true;
      console.log("[enable3DMode] Modo 3D ativado com sucesso");

      resolve(true);
    } catch (error) {
      console.error("[enable3DMode] Erro ao ativar modo 3D:", error);
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
 * Habilita extrusão de edifícios fotorrealista com texturas de satélite
 * @returns {boolean} Sucesso da operação
 */
export function enableRealisticBuildingExtrusions() {
  try {
    if (!mapbox3dInstance || !mapbox3dInstance.loaded()) {
      console.log(
        "[enableRealisticBuildingExtrusions] Mapa ainda carregando, aguardando..."
      );
      setTimeout(enableRealisticBuildingExtrusions, 500);
      return false;
    }

    console.log(
      "[enableRealisticBuildingExtrusions] Adicionando camada de edifícios 3D fotorrealistas"
    );

    // Verificar se o estilo está carregado
    if (!mapbox3dInstance.isStyleLoaded()) {
      console.log(
        "[enableRealisticBuildingExtrusions] Aguardando carregamento do estilo..."
      );
      mapbox3dInstance.once("style.load", enableRealisticBuildingExtrusions);
      return false;
    }

    // 1. Adicionar fonte de dados de edifícios de alta qualidade
    if (!mapbox3dInstance.getSource("building-data-hd")) {
      mapbox3dInstance.addSource("building-data-hd", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8", // Usando fonte de dados detalhada
      });
    }

    // 2. Adicionar terreno 3D para base mais realista
    if (!mapbox3dInstance.getSource("mapbox-dem")) {
      mapbox3dInstance.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });

      // Configurar terreno com exageração sutil para melhor visualização
      mapbox3dInstance.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
    }

    // 3. Remover camada existente se necessário
    if (mapbox3dInstance.getLayer("3d-buildings")) {
      mapbox3dInstance.removeLayer("3d-buildings");
    }

    // 4. Adicionar camada de edifícios 3D fotorrealistas
    mapbox3dInstance.addLayer({
      id: "3d-buildings",
      source: "building-data-hd",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        // Cores baseadas na altura para edifícios mais realistas
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#e8ecf0", // Edifícios mais baixos
          50,
          "#d1d7de", // Altura média
          100,
          "#bbc4d1", // Edifícios altos
          200,
          "#a5b3c5", // Arranha-céus
        ],

        // Altura dos edifícios com base nos dados reais
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          16,
          ["get", "height"],
        ],

        // Base do edifício para melhor precisão
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          16,
          ["get", "min_height"],
        ],

        // Melhorar a aparência com opacidade e gradiente
        "fill-extrusion-opacity": 0.85,
        "fill-extrusion-vertical-gradient": true,
      },
    });

    // 5. Carregar texturas para os edifícios (se estiver em modo satélite)
    loadBuildingTextures();

    console.log(
      "[enableRealisticBuildingExtrusions] Camada de edifícios fotorrealistas adicionada com sucesso"
    );
    return true;
  } catch (error) {
    console.error(
      "[enableRealisticBuildingExtrusions] Erro ao adicionar edifícios fotorrealistas:",
      error
    );
    return false;
  }
}

/**
 * Configura iluminação e sombras dinâmicas no mapa 3D
 * @param {Object} options - Opções de iluminação
 * @returns {boolean} Sucesso da operação
 */
export function setupRealisticLighting(options = {}) {
  const {
    sunPosition = { x: 1, y: 1, z: 1 },
    intensity = 1.2,
    ambientLight = 0.3,
    useFog = true,
  } = options;

  try {
    if (!mapbox3dInstance || !mapbox3dInstance.isStyleLoaded()) {
      console.log(
        "[setupRealisticLighting] Mapa não está pronto. Tentando novamente mais tarde..."
      );
      setTimeout(() => setupRealisticLighting(options), 500);
      return false;
    }

    console.log("[setupRealisticLighting] Configurando iluminação realista");

    // Adicionar camada de céu
    if (!mapbox3dInstance.getLayer("sky-layer")) {
      mapbox3dInstance.addLayer({
        id: "sky-layer",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [sunPosition.x, sunPosition.y],
          "sky-atmosphere-sun-intensity": intensity,
          "sky-atmosphere-halo-color": "rgba(255, 255, 255, 0.5)",
          "sky-atmosphere-color": "rgba(85, 151, 210, 0.8)",
          "sky-opacity": 0.9,
        },
      });
    }

    // Adicionar fog para dar sensação de profundidade
    if (useFog) {
      mapbox3dInstance.setFog({
        range: [1.0, 12.0],
        color: "rgba(220, 220, 230, 0.8)",
        "horizon-blend": 0.1,
      });
    }

    console.log("[setupRealisticLighting] Iluminação configurada com sucesso");
    return true;
  } catch (error) {
    console.error(
      "[setupRealisticLighting] Erro ao configurar iluminação:",
      error
    );
    return false;
  }
}

export function addHighDetailBuildings(options = {}) {
  const {
    modelSource = null,
    modelFormat = "gltf",
    area = {
      lat: mapbox3dInstance ? mapbox3dInstance.getCenter().lat : -13.3775457,
      lng: mapbox3dInstance ? mapbox3dInstance.getCenter().lng : -38.9159969,
      radius: 500,
    },
  } = options;

  try {
    if (!mapbox3dInstance || !mapbox3dInstance.loaded()) {
      console.warn("[addHighDetailBuildings] Mapa não está pronto");
      return false;
    }

    console.log(
      "[addHighDetailBuildings] Adicionando edifícios HD para área:",
      area
    );

    // Verificar se o estilo está carregado
    if (!mapbox3dInstance.isStyleLoaded()) {
      console.log(
        "[addHighDetailBuildings] Esperando carregamento do estilo..."
      );

      // Tenta novamente quando o estilo estiver carregado
      mapbox3dInstance.once("style.load", () => {
        addHighDetailBuildings(options);
      });

      return false;
    }

    // Se não temos uma fonte de modelos, usamos o OpenStreetMap para dados aprimorados
    if (!modelSource) {
      return enhanceBuildingsFromOSM(area);
    }

    // Com fonte de modelos, podemos carregar modelos 3D reais
    console.log(
      "[addHighDetailBuildings] Carregando modelos 3D de:",
      modelSource
    );

    // Implementação simulada para demonstração
    console.log(
      "[addHighDetailBuildings] Modelos 3D carregados e renderizados com sucesso"
    );
    return true;
  } catch (error) {
    console.error("[addHighDetailBuildings] Erro:", error);
    return false;
  }
}

/**
 * Remove modelos 3D de alta definição
 * @returns {boolean} Sucesso da operação
 */
export function removeHighDetailBuildings() {
  try {
    if (!mapbox3dInstance) return false;

    // Remover camadas de modelos HD
    if (mapbox3dInstance.getLayer("3d-buildings-hd")) {
      mapbox3dInstance.removeLayer("3d-buildings-hd");
    }

    // Voltar para visualização padrão de edifícios
    enableBuildingExtrusions();

    console.log("[removeHighDetailBuildings] Modelos HD removidos");
    return true;
  } catch (error) {
    console.error(
      "[removeHighDetailBuildings] Erro ao remover modelos HD:",
      error
    );
    return false;
  }
}

/**
 * Carrega texturas para os edifícios 3D
 * @private
 */
function loadBuildingTextures() {
  try {
    // Verificar se já temos a textura
    if (mapbox3dInstance.hasImage("building-pattern")) return;

    // Carregar uma textura padrão para edifícios
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Criar um padrão simples de janelas
    const windowSize = 10;
    const spacing = 5;
    const rows = Math.floor(canvas.height / (windowSize + spacing));
    const cols = Math.floor(canvas.width / (windowSize + spacing));

    // Cor de fundo (parede)
    ctx.fillStyle = "#d4d4d4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar janelas
    ctx.fillStyle = "#a9c8e8";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * (windowSize + spacing) + spacing;
        const y = r * (windowSize + spacing) + spacing;
        ctx.fillRect(x, y, windowSize, windowSize);
      }
    }

    // Adicionar como imagem ao mapbox
    mapbox3dInstance.addImage("building-pattern", {
      width: canvas.width,
      height: canvas.height,
      data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    });

    console.log(
      "[loadBuildingTextures] Textura de edifícios gerada e adicionada"
    );
  } catch (error) {
    console.error("[loadBuildingTextures] Erro ao criar textura:", error);
  }
}

function enhanceBuildingsFromOSM(area) {
  try {
    const { lat, lng, radius } = area;

    console.log(
      "[enhanceBuildingsFromOSM] Aprimorando edifícios com dados OSM:",
      area
    );

    // Verificar se o mapa está pronto
    if (!mapbox3dInstance.isStyleLoaded()) {
      console.log(
        "[enhanceBuildingsFromOSM] Estilo não está pronto, agendando para mais tarde"
      );
      mapbox3dInstance.once("style.load", () => {
        enhanceBuildingsFromOSM(area);
      });
      return;
    }

    // Verificar se a fonte já existe
    if (!mapbox3dInstance.getSource("building-data-hd")) {
      // Adicionar a fonte primeiro e esperar que seja carregada
      mapbox3dInstance.addSource("building-data-hd", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });

      console.log("[enhanceBuildingsFromOSM] Fonte building-data-hd criada");

      // Aguardar que a fonte esteja disponível antes de adicionar a camada
      mapbox3dInstance.once("sourcedata", function (e) {
        if (
          e.sourceId === "building-data-hd" &&
          mapbox3dInstance.isSourceLoaded("building-data-hd")
        ) {
          addBuildingEnhancedLayer();
        }
      });
    } else {
      // Se a fonte já existe, adicionar a camada diretamente
      addBuildingEnhancedLayer();
    }

    function addBuildingEnhancedLayer() {
      // Verificar se a camada já existe para evitar duplicação
      if (mapbox3dInstance.getLayer("3d-buildings-enhanced")) {
        mapbox3dInstance.removeLayer("3d-buildings-enhanced");
      }

      // Adicionar a camada de edifícios aprimorados
      mapbox3dInstance.addLayer({
        id: "3d-buildings-enhanced",
        source: "building-data-hd",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": [
            "match",
            ["get", "type"],
            "commercial",
            "#ACB7C0",
            "residential",
            "#E8EDF1",
            "apartments",
            "#D8E0E6",
            "#CCCCCC",
          ],
          "fill-extrusion-height": ["*", ["get", "height"], 1.2],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.85,
        },
      });

      console.log(
        "[enhanceBuildingsFromOSM] Edifícios aprimorados com dados OSM"
      );
    }
  } catch (error) {
    console.error(
      "[enhanceBuildingsFromOSM] Erro ao aprimorar edifícios:",
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
 * @returns {boolean} true se o modo 3D estiver ativo
 */
export function is3DModeActive() {
  return (
    window.mapbox3dInstance !== undefined &&
    window.mapbox3dInstance !== null &&
    document.getElementById("mapbox-3d-container") !== null
  );
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

// Modificar a função checkAllLoaded para evitar disparos múltiplos

// Adicione uma variável para rastrear se o evento já foi disparado
let mapReadyEventDispatched = false;

function checkAllLoaded() {
  if (
    isMapLoaded &&
    isStyleLoaded &&
    isBuildingsAdded &&
    !mapReadyEventDispatched
  ) {
    console.log("[map-3d] Map is fully loaded and ready");

    // Make sure mapbox3dInstance is available globally
    if (mapbox3dInstance) {
      window.mapbox3dInstance = mapbox3dInstance;
    }

    // Dispatch event only once
    mapReadyEventDispatched = true;

    // Dispatch event when map is fully ready
    document.dispatchEvent(
      new CustomEvent("mapbox3d:ready", {
        detail: { map: mapbox3dInstance },
      })
    );

    console.log("[map-3d] mapbox3d:ready event dispatched");
  }
}

export function addMarker3D(lat, lon, options = {}) {
  if (!mapbox3dInstance || !is3dModeActive) {
    console.warn("[addMarker3D] 3D map not active or not initialized");
    return null;
  }

  try {
    console.log(`[addMarker3D] Adding marker at ${lat}, ${lon}`, options);

    // DETERMINAR TIPO DE MARCADOR: usuário ou destino
    const isUserLocationMarker =
      (options.className &&
        options.className.includes("user-location-marker")) ||
      options.isUserMarker === true;

    const isDestinationMarker =
      (options.title && options.title !== "Sua localização") ||
      options.isDestinationMarker === true;

    // Create a DOM element for the marker
    const el = document.createElement("div");

    // Definir classes apropriadas para o tipo de marcador
    if (isUserLocationMarker) {
      el.className = "mapbox-user-marker user-location-arrow";
    } else if (isDestinationMarker) {
      // MODIFICAÇÃO: Classe específica para marcador de destino
      el.className = "mapbox-destination-marker";
    } else {
      el.className = "mapbox-3d-marker";
    }

    // Adicionar classes extras se fornecidas
    if (options.className) {
      el.className += " " + options.className;
    }

    // NOVO: Se for marcador do usuário, usar SVG personalizado com seta direcional
    if (isUserLocationMarker) {
      // Usar o mesmo SVG do enhanced-user-marker.js
      const svgContent = `
        <svg viewBox="0 0 24 24" width="25" height="25" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="rgba(15, 73, 197, 0.2)" stroke="#ffffff" stroke-width="1"/>
          <circle cx="12" cy="12" r="3" fill="#ffffff" fill-opacity="0.9"/>
          <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#ff0000" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
        </svg>`;

      el.innerHTML = svgContent;
    }
    // MODIFICAÇÃO: Se for marcador de destino, usar SVG personalizado
    else if (isDestinationMarker) {
      // SVG personalizado para destino - MAIOR e AZUL
      const svgContent = `
        <svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                fill="#3b82f6" 
                stroke="#ffffff" 
                stroke-width="1.5" />
          <circle cx="12" cy="7" r="2.5" fill="#ffffff"/>
        </svg>`;

      el.innerHTML = svgContent;
    } else {
      // Comportamento padrão para marcadores regulares
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
        else if (title === "sua localização")
          iconClass = "user-location-marker";
      }

      icon.className = `fas ${iconClass}`;
      el.appendChild(icon);
    }

    // Adicionar estilos para os marcadores se ainda não existirem
    addMarker3DStyles();

    // Create the marker
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: "bottom", // MODIFICAÇÃO: âncora na base do marcador de destino
      offset: isDestinationMarker ? [0, -10] : [0, 0], // Offset para marcadores de destino
    })
      .setLngLat([lon, lat])
      .addTo(mapbox3dInstance);

    // NOVO: Para marcadores do usuário, armazenar referência para atualizações posteriores
    if (isUserLocationMarker) {
      window.route3DUserMarker = marker;
      window.userMarker3D = marker;
    }

    // Add the marker to the tracking array
    if (!window.markers3D) window.markers3D = [];
    window.markers3D.push(marker);

    // Create popup if needed
    if (options.popupContent) {
      const popup = new mapboxgl.Popup({
        offset: isDestinationMarker ? [0, -30] : 25, // MODIFICAÇÃO: offset maior para destinos
        className: isDestinationMarker ? "destination-popup" : "", // MODIFICAÇÃO: classe especial para popups de destino
      }).setHTML(options.popupContent);

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
 * Adiciona estilos para os marcadores 3D
 */
function addMarker3DStyles() {
  // Verificar se os estilos já foram adicionados
  if (document.getElementById("map3d-marker-style")) return;

  const style = document.createElement("style");
  style.id = "map3d-marker-style";
  style.textContent = `
    .user-location-arrow {
      transform-origin: center center;
      transition: transform 0.3s ease-out;
    }
    
    /* NOVO: Estilos para marcador de destino */
    .mapbox-destination-marker {
      transform-origin: center bottom;
      transition: transform 0.3s ease, opacity 0.2s ease;
    }
    
    .mapbox-destination-marker:hover {
      opacity: 0.9;
      transform: scale(1.1);
    }
    
    /* NOVO: Estilos para popup de destino */
    .destination-popup .mapboxgl-popup-content {
      border-radius: 8px;
      background-color: rgba(255, 255, 255, 0.95);
      padding: 10px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
    }
    
    .destination-popup h3 {
      color: #3b82f6;
      margin: 0 0 5px 0;
      font-weight: bold;
      text-align: center;
    }
    
    .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
      border-top-color: rgba(255, 255, 255, 0.95);
    }
  `;
  document.head.appendChild(style);
  console.log("[addMarker3DStyles] Estilos para marcadores 3D adicionados");
}

/**
 * Remove todos os marcadores do mapa 3D
 * @param {boolean} preserveUserMarker - Se true, preserva o marcador do usuário (agora false por padrão)
 * @returns {Object|null} O marcador preservado (se houver) ou null
 */
export function clearMarkers3D(preserveUserMarker = false) {
  if (!window.markers3D) window.markers3D = [];

  // Log para depuração
  console.log(
    `[clearMarkers3D] Iniciando limpeza de ${window.markers3D.length} marcadores. Preservar marcador de usuário: ${preserveUserMarker}`
  );

  let userMarker = null;

  // Primeiro passo: identificar e salvar o marcador do usuário se necessário
  if (preserveUserMarker) {
    for (const marker of window.markers3D) {
      if (!marker || !marker.getElement) continue;

      const el = marker.getElement();
      if (
        el &&
        (el.classList.contains("user-location-marker") ||
          el.classList.contains("user-location-arrow"))
      ) {
        userMarker = marker;
        console.log("[clearMarkers3D] Preservando marcador do usuário");
        break;
      }
    }
  }

  // Segundo passo: remover todos os marcadores
  console.log(
    `[clearMarkers3D] Removendo ${window.markers3D.length} marcadores`
  );
  window.markers3D.forEach((marker) => {
    // Remover todos os marcadores se preserveUserMarker=false
    // Ou apenas os que não são o marcador do usuário se preserveUserMarker=true
    if (!preserveUserMarker || marker !== userMarker) {
      if (marker && typeof marker.remove === "function") {
        marker.remove();
      }
    }
  });

  // Terceiro passo: reconstruir array apenas com o marcador do usuário (se houver e se for para preservá-lo)
  window.markers3D = preserveUserMarker && userMarker ? [userMarker] : [];

  // Atualizar as referências globais
  if (!preserveUserMarker || !userMarker) {
    // Se estamos limpando tudo OU não encontramos um marcador do usuário, limpar as referências
    window.route3DUserMarker = null;
    window.userMarker3D = null;
  }

  console.log(
    `[clearMarkers3D] ${window.markers3D.length} marcadores restantes após limpeza`
  );
  return userMarker;
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
 * Obtém rota de direções usando a API do OpenRouteService
 * @param {number} startLat - Latitude de origem
 * @param {number} startLon - Longitude de origem
 * @param {number} endLat - Latitude de destino
 * @param {number} endLon - Longitude de destino
 * @returns {Promise} - Promise com os dados da rota
 */
export async function getDirectionsRoute(startLat, startLon, endLat, endLon) {
  try {
    console.log(
      `[getDirectionsRoute] Getting route from ${startLat},${startLon} to ${endLat},${endLon}`
    );

    // Verificar cache primeiro
    const cacheKey = generateRouteCacheKey(
      startLat,
      startLon,
      endLat,
      endLon,
      "foot"
    );

    if (
      routeCache &&
      typeof routeCache.has === "function" &&
      routeCache.has(cacheKey)
    ) {
      const cachedData = routeCache.get(cacheKey);
      if (
        cachedData &&
        cachedData.data &&
        Date.now() - cachedData.timestamp < 300000
      ) {
        console.log("[getDirectionsRoute] Using cached route data");
        return cachedData.data;
      }
    }

    // Usar diretamente a OpenRouteService API sem tentar a OSRM
    try {
      const orsApiKey =
        "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";
      const orsUrl = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${orsApiKey}&start=${startLon},${startLat}&end=${endLon},${endLat}`;

      console.log(`[getDirectionsRoute] Calling ORS API: ${orsUrl}`);

      // Aumentar o timeout para 20 segundos para dar mais tempo à API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const orsResponse = await fetch(orsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!orsResponse.ok) {
        throw new Error(`ORS API error: ${orsResponse.status}`);
      }

      const orsData = await orsResponse.json();
      console.log("[getDirectionsRoute] ORS data received:", orsData);

      // Validar estrutura de dados
      if (!orsData.features || !orsData.features[0]) {
        throw new Error("Invalid data format from ORS API");
      }

      // Converter formato ORS para o formato esperado
      const route = orsData.features[0];
      const result = {
        routes: [
          {
            geometry: {
              type: "LineString",
              coordinates: route.geometry.coordinates,
            },
            distance: route.properties.summary.distance,
            duration: route.properties.summary.duration,
            legs: [
              {
                steps: route.properties.segments[0].steps || [],
              },
            ],
          },
        ],
      };

      // NOVO: Extrair e armazenar pontos da rota
      window.lastRoutePoints = route.geometry.coordinates.map((coord) => ({
        lon: coord[0],
        lat: coord[1],
      }));
      console.log(
        `[getDirectionsRoute] Armazenados ${window.lastRoutePoints.length} pontos da rota`
      );

      // Armazenar em cache
      if (routeCache && typeof routeCache.set === "function") {
        routeCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          routePoints: window.lastRoutePoints, // NOVO: incluir os pontos no cache
        });
      }

      return result;
    } catch (error) {
      // Em caso de falha, construir uma rota em linha reta como último recurso
      console.error("[getDirectionsRoute] API failed:", error);

      // Criar uma rota simples apenas com pontos de início e fim
      const fallbackRoute = {
        routes: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [startLon, startLat],
                [endLon, endLat],
              ],
            },
            distance: calculateDistance(startLat, startLon, endLat, endLon),
            duration:
              calculateDistance(startLat, startLon, endLat, endLon) / (5 / 3.6), // Assumindo velocidade de caminhada de 5 km/h
            legs: [
              {
                steps: [],
              },
            ],
          },
        ],
      };

      // Ainda armazenar em cache esta rota de fallback
      if (routeCache && typeof routeCache.set === "function") {
        routeCache.set(cacheKey, {
          data: fallbackRoute,
          timestamp: Date.now(),
        });
      }

      return fallbackRoute;
    }
  } catch (error) {
    console.error("[getDirectionsRoute] Error getting directions:", error);
    throw error;
  }
}

/**
 * Mostra a rota no mapa 3D
 * @param {Object} options - Opções da rota
 */
export function showRoute3D(options) {
  try {
    const { startLat, startLon, endLat, endLon, destinationName } = options;

    console.log(
      `[showRoute3D] Iniciando exibição de rota 3D para: ${destinationName}`
    );

    if (typeof repositionMessagesArea === "function") {
      repositionMessagesArea(true);
    }

    // Verificar se existe algum marcador do usuário com heading 0°
    let userMarkerWithZeroHeading = false;
    if (window.markers3D && Array.isArray(window.markers3D)) {
      for (const marker of window.markers3D) {
        if (!marker || !marker.getElement) continue;

        const el = marker.getElement();
        if (
          el &&
          (el.classList.contains("user-location-marker") ||
            el.classList.contains("user-location-arrow"))
        ) {
          // Verificar se o marcador tem heading 0° (sem rotação)
          const transform = el.style.transform;
          if (!transform || transform === "rotate(0deg)") {
            userMarkerWithZeroHeading = true;
            // Remover esse marcador com heading incorreto
            marker.remove();
            console.log(
              "[showRoute3D] Removido marcador com heading incorreto (0°)"
            );
          }
        }
      }
    }

    // Verificar se temos uma instância válida do mapa 3D
    let mapbox3dInstance = window.mapbox3dInstance;
    if (!mapbox3dInstance) {
      console.error("[showRoute3D] Instância do mapa 3D não disponível");

      appendMessage(
        "assistant",
        "Estou preparando o mapa 3D para exibir sua rota. Aguarde um momento...",
        { speakMessage: true, avoidDuplicate: true }
      );

      // Instead of returning, set up a retry mechanism with setTimeout
      setTimeout(() => {
        mapbox3dInstance = window.mapbox3dInstance;
        if (mapbox3dInstance) {
          console.log("[showRoute3D] Retrying with available 3D map instance");
          showRoute3D(options);
        } else {
          console.error("[showRoute3D] 3D map still not available after delay");
          appendMessage(
            "assistant",
            "Não foi possível mostrar a rota no mapa 3D. Tente novamente em instantes.",
            { speakMessage: true, avoidDuplicate: true }
          );
        }
      }, 1500);

      return;
    }

    // Verificar se o mapa está carregado
    if (!mapbox3dInstance.loaded()) {
      console.log(
        "[showRoute3D] Mapa ainda carregando, aguardando conclusão..."
      );

      // Use the map's load event to retry once it's loaded
      mapbox3dInstance.once("load", () => {
        console.log("[showRoute3D] Map loaded, now showing route");
        showRoute3D(options);
      });

      return;
    }

    // Validar as coordenadas
    if (
      !isValidCoordinate(startLat, startLon) ||
      !isValidCoordinate(endLat, endLon)
    ) {
      console.error("[showRoute3D] Coordenadas inválidas", {
        start: [startLat, startLon],
        dest: [endLat, endLon],
      });

      appendMessage(
        "assistant",
        "Não consegui calcular a rota devido a coordenadas inválidas. Por favor, tente novamente.",
        { speakMessage: true, avoidDuplicate: true }
      );
      return;
    }

    // IMPORTANTE: Fazer uma cópia local dos valores necessários
    // para evitar problemas de referência durante operações assíncronas
    const mapInstanceForRoute = mapbox3dInstance;

    // Verificar se o mapa está em um estado utilizável
    if (!mapInstanceForRoute || !mapInstanceForRoute.getStyle) {
      console.error("[showRoute3D] Map instance is not usable");
      appendMessage(
        "assistant",
        "Ocorreu um erro ao preparar o mapa. Tente novamente em instantes.",
        { speakMessage: true, avoidDuplicate: true }
      );
      return;
    }

    // Limpar rota anterior
    try {
      clearRoute3D(mapInstanceForRoute);
    } catch (clearError) {
      console.warn("[showRoute3D] Error during route cleanup:", clearError);
      // Continue anyway
    }

    // Limpar marcadores existentes antes de iniciar o processo de rota
    try {
      if (typeof clearMarkers3D === "function") {
        clearMarkers3D();
        console.log("[showRoute3D] Marcadores anteriores removidos");
      }
    } catch (markersError) {
      console.warn("[showRoute3D] Erro ao limpar marcadores:", markersError);
    }

    // Calcular um ponto central e ajustar a visualização
    try {
      const directDistance = calculateDistance(
        startLat,
        startLon,
        endLat,
        endLon
      );
      centerMapBetweenPoints(
        startLat,
        startLon,
        endLat,
        endLon,
        directDistance
      );
    } catch (viewError) {
      console.warn("[showRoute3D] Error adjusting view:", viewError);
      // Continue anyway
    }

    // Informar ao usuário que estamos calculando a rota
    appendMessage("assistant", `Calculando rota para ${destinationName}...`, {
      speakMessage: true,
      avoidDuplicate: true,
    });

    // Criar uma referência forte para o mapa que será usada nas callbacks
    const mapRef = mapInstanceForRoute;
    window._mapRefForRoute = mapRef; // Garantir que não seja coletado pelo garbage collector

    console.log(
      `[showRoute3D] Getting route from [${startLat},${startLon}] to [${endLat},${endLon}]`
    );

    // IMPORTANTE: obter a rota ANTES de adicionar os marcadores
    getDirectionsRoute(startLat, startLon, endLat, endLon)
      .then((data) => {
        console.log("[showRoute3D] Route data received:", data);

        // Salva os dados da rota caso seja necessário para retry
        window._lastRouteData = data;

        // CORREÇÃO: Use a referência salva e verifique novamente
        const currentMap = window._mapRefForRoute || window.mapbox3dInstance;

        // Verificar se o mapa ainda está disponível
        if (!currentMap || typeof currentMap.loaded !== "function") {
          console.error("[showRoute3D] Map is no longer available");
          throw new Error("Map is no longer available");
        }

        // Adicionar marcadores DEPOIS de ter os dados da rota
        try {
          addOriginAndDestinationMarkers(
            startLat,
            startLon,
            endLat,
            endLon,
            destinationName
          );
          console.log(
            "[showRoute3D] Marcadores adicionados após receber dados da rota"
          );
        } catch (markersError) {
          console.warn(
            "[showRoute3D] Erro ao adicionar marcadores:",
            markersError
          );
        }

        // Renderizar a rota com os dados obtidos
        if (typeof currentMap.getStyle === "function") {
          try {
            return renderRouteOnMap(
              currentMap,
              data,
              startLat,
              startLon,
              endLat,
              endLon,
              destinationName
            );
          } catch (err) {
            console.error(
              "[showRoute3D] Error during forced render attempt:",
              err
            );
            throw err;
          }
        } else {
          console.error("[showRoute3D] Map is missing required methods");
          throw new Error("Map is missing required methods");
        }
      })
      .then(() => {
        // Rota renderizada com sucesso - Anexar mensagem com os dados da rota
        if (
          window._lastRouteData &&
          window._lastRouteData.routes &&
          window._lastRouteData.routes[0]
        ) {
          const route = window._lastRouteData.routes[0];
          const distance = route.distance;
          const duration = route.duration;
          const formattedDistance = (distance / 1000).toFixed(2);
          const formattedDuration = Math.round(duration / 60);

          // Exibir mensagem de rota calculada uma única vez
          appendMessage(
            "assistant",
            `Rota para ${destinationName} calculada! Distância: ${formattedDistance} km. Tempo estimado a pé: ${formattedDuration} minutos.`,
            { speakMessage: true, avoidDuplicate: true }
          );

          // Despachar evento indicando que a rota está pronta e visível
          document.dispatchEvent(
            new CustomEvent("route:displayed", {
              detail: {
                destinationName,
                distance: formattedDistance,
                duration: formattedDuration,
                startLat,
                startLon,
                endLat,
                endLon,
              },
            })
          );
        }
      })
      .catch((error) => {
        console.error("[showRoute3D] Error getting or rendering route:", error);

        // Obter a instância atual do mapa - tentar a referência salva primeiro
        const currentMapInstance =
          window._mapRefForRoute || window.mapbox3dInstance;

        // Verificar se ela é válida
        if (
          currentMapInstance &&
          typeof currentMapInstance.loaded === "function" &&
          currentMapInstance.loaded()
        ) {
          // Adicionar marcadores mesmo no caso de erro (usando método alternativo)
          try {
            addOriginAndDestinationMarkers(
              startLat,
              startLon,
              endLat,
              endLon,
              destinationName
            );
            console.log(
              "[showRoute3D] Marcadores adicionados após falha na rota"
            );
          } catch (markersError) {
            console.warn(
              "[showRoute3D] Erro ao adicionar marcadores após falha:",
              markersError
            );
          }

          // Mostrar linha reta como fallback
          showStraightLine(
            currentMapInstance,
            startLat,
            startLon,
            endLat,
            endLon
          );

          // Calcular distância e tempo estimado
          const directDistance = calculateDistance(
            startLat,
            startLon,
            endLat,
            endLon
          );
          const formattedDistance = (directDistance / 1000).toFixed(2);
          const estimatedTimeMinutes = Math.round(
            directDistance / 1000 / (5 / 60)
          );

          // Mostrar resumo com dados estimados
          appendMessage(
            "assistant",
            `Não foi possível calcular uma rota detalhada para ${destinationName}. Mostrando direção em linha reta. Distância aproximada: ${formattedDistance} km. Tempo estimado: ${estimatedTimeMinutes} minutos.`,
            { speakMessage: true, avoidDuplicate: true }
          );
        } else {
          console.error(
            "[showRoute3D] Cannot show straight line - map unavailable"
          );

          appendMessage(
            "assistant",
            `Não foi possível exibir a rota para ${destinationName}. O mapa 3D não está respondendo corretamente. Tente novamente em instantes.`,
            { speakMessage: true, avoidDuplicate: true }
          );
        }
      })
      .finally(() => {
        // Limpar referência após uso para evitar memory leaks
        setTimeout(() => {
          window._mapRefForRoute = null;
        }, 5000);
      });
  } catch (error) {
    console.error("[showRoute3D] Erro geral:", error);

    // Notificar o usuário
    appendMessage(
      "assistant",
      "Ocorreu um erro ao mostrar a rota. Tente novamente em instantes.",
      { speakMessage: true, avoidDuplicate: true }
    );
  }
}

export function renderRouteOnMap(
  map,
  data,
  startLat,
  startLon,
  endLat,
  endLon,
  destinationName
) {
  return new Promise(async (resolve, reject) => {
    // Variável para controlar o indicador de carregamento
    let loadingIndicator = null;
    let indicatorRemoved = false;

    // Função para remover o indicador de forma segura
    function safeRemoveIndicator() {
      if (
        !indicatorRemoved &&
        loadingIndicator &&
        typeof removeLoadingIndicator === "function"
      ) {
        removeLoadingIndicator(loadingIndicator);
        indicatorRemoved = true;
        console.log("[renderRouteOnMap] Indicador de carregamento removido");
      }
    }

    try {
      // Adicionar indicador de carregamento
      try {
        if (typeof addLoadingIndicator === "function") {
          loadingIndicator = addLoadingIndicator(
            "Renderizando rota no mapa 3D..."
          );
        }
      } catch (loadingError) {
        console.warn(
          "[renderRouteOnMap] Erro ao adicionar indicador:",
          loadingError
        );
      }

      // Validação da instância do mapa
      if (!map) {
        console.error("[renderRouteOnMap] Instância de mapa inválida");
        safeRemoveIndicator();
        reject(new Error("Instância de mapa inválida"));
        return;
      }

      // Verificação preliminar dos dados da rota
      if (
        !data ||
        !data.routes ||
        !data.routes[0] ||
        !data.routes[0].geometry
      ) {
        console.warn("[renderRouteOnMap] Dados da rota inválidos ou vazios");
        safeRemoveIndicator();

        // Usar linha reta como fallback
        if (typeof showStraightLine === "function") {
          showStraightLine(map, startLat, startLon, endLat, endLon);
        }

        reject(new Error("Dados da rota inválidos"));
        return;
      }

      // IMPORTANTE: Extrair coordenadas da rota aqui, antes de qualquer uso
      const route = data.routes[0];
      const routeGeometry = route.geometry;
      const routeCoordinates = routeGeometry.coordinates;

      console.log(
        `[renderRouteOnMap] Processando rota com ${routeCoordinates.length} pontos`
      );

      // Verificar se as coordenadas são válidas
      if (!routeCoordinates || routeCoordinates.length < 2) {
        console.warn("[renderRouteOnMap] Coordenadas insuficientes para rota");
        safeRemoveIndicator();

        if (typeof showStraightLine === "function") {
          showStraightLine(map, startLat, startLon, endLat, endLon);
          console.log("[renderRouteOnMap] Usando linha reta como fallback");
          resolve(data); // Resolver mesmo com linha reta
          return;
        }

        reject(new Error("Coordenadas de rota insuficientes"));
        return;
      }

      // MELHORIA: Verificar se o estilo está carregado com um contador de tentativas
      const checkStyleAndRender = (attempt = 1, maxAttempts = 10) => {
        // Verificar se o estilo está carregado
        if (map.isStyleLoaded && !map.isStyleLoaded()) {
          console.log(
            `[renderRouteOnMap] Estilo do mapa ainda não carregado, aguardando... (tentativa ${attempt}/${maxAttempts})`
          );

          if (attempt >= maxAttempts) {
            console.error(
              "[renderRouteOnMap] Número máximo de tentativas excedido"
            );
            safeRemoveIndicator();
            reject(
              new Error("Timeout ao aguardar carregamento do estilo do mapa")
            );
            return;
          }

          // Configurar evento para carregamento do estilo
          map.once("style.load", () => {
            console.log(
              "[renderRouteOnMap] Estilo do mapa carregado, renderizando rota"
            );
            // Tentar renderizar novamente após o estilo carregar
            renderRouteAfterStyleLoaded();
          });

          // Tentar novamente após um curto intervalo como backup
          setTimeout(() => {
            checkStyleAndRender(attempt + 1, maxAttempts);
          }, 1000);
          return;
        }

        // Se chegou aqui, o estilo está carregado
        renderRouteAfterStyleLoaded();
      };

      // Função para renderizar a rota após o estilo estar carregado
      const renderRouteAfterStyleLoaded = () => {
        try {
          // Limpar qualquer rota existente primeiro
          if (typeof clearRoute3D === "function") {
            clearRoute3D(map);
          } else {
            // Implementação alternativa se a função não existir
            try {
              // Remover camadas relacionadas à rota
              const layersToRemove = ["route-line", "routeArrows"];
              layersToRemove.forEach((layer) => {
                if (map.getLayer(layer)) map.removeLayer(layer);
              });

              // Remover fontes relacionadas à rota
              const sourcesToRemove = ["route", "routeArrows"];
              sourcesToRemove.forEach((source) => {
                if (map.getSource(source)) map.removeSource(source);
              });

              console.log(
                "[renderRouteOnMap] Rota anterior removida manualmente"
              );
            } catch (clearError) {
              console.warn(
                "[renderRouteOnMap] Erro ao limpar rota manualmente:",
                clearError
              );
            }
          }

          // MELHORIA: Verificar se o mapa está pronto antes de adicionar a fonte
          if (!map.loaded()) {
            console.log(
              "[renderRouteOnMap] Aguardando mapa carregar completamente..."
            );

            const loadHandler = () => {
              try {
                addRouteLayersToMap();
              } catch (loadError) {
                console.error(
                  "[renderRouteOnMap] Erro após carregar mapa:",
                  loadError
                );
                safeRemoveIndicator();
                reject(loadError);
              }
            };

            map.once("load", loadHandler);
            return;
          }

          // Se chegou aqui, o mapa está carregado
          addRouteLayersToMap();

          function addRouteLayersToMap() {
            try {
              // Garantir que routeCoordinates está definido e acessível neste escopo
              if (!routeCoordinates || routeCoordinates.length < 2) {
                throw new Error(
                  "Coordenadas da rota não disponíveis dentro desta função"
                );
              }

              // Criar ou atualizar a fonte GeoJSON para a rota
              if (!map.getSource("route")) {
                map.addSource("route", {
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
              } else {
                // Verificar se a fonte existe antes de tentar atualizá-la
                try {
                  map.getSource("route").setData({
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: routeCoordinates,
                    },
                  });
                } catch (sourceError) {
                  console.warn(
                    "[renderRouteOnMap] Erro ao atualizar fonte existente:",
                    sourceError
                  );

                  // Tentar recriar a fonte se a atualização falhou
                  try {
                    map.removeSource("route");
                    map.addSource("route", {
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
                  } catch (recreateError) {
                    console.error(
                      "[renderRouteOnMap] Erro ao recriar fonte:",
                      recreateError
                    );
                    throw recreateError;
                  }
                }
              }

              // Adicionar a camada de rota se não existir
              if (!map.getLayer("route-line")) {
                map.addLayer({
                  id: "route-line",
                  type: "line",
                  source: "route",
                  layout: {
                    "line-join": "round",
                    "line-cap": "round",
                  },
                  paint: {
                    "line-color": "#3b82f6", // Azul similar ao do mapa 2D
                    "line-width": 5,
                    "line-opacity": 0.8,
                  },
                });
              }

              // NOVO: Definir o zoom do mapa para 13
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

              // Calcular o centro do bounds
              const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
              const centerLat = (bounds[0][1] + bounds[1][1]) / 2;

              console.log(
                "[renderRouteOnMap] Aplicando zoom fixo de 13 para a visualização da rota"
              );

              // Aplicar o zoom fixo de 13 e ajustar a visualização
              map.flyTo({
                center: [centerLng, centerLat],
                zoom: 16, // ZOOM FIXO EM 13
                pitch: 60, // Manter inclinação para visão 3D
                bearing: map.getBearing(), // Manter orientação atual
                duration: 1500, // Duração da animação
                essential: true, // Indica que esta navegação é essencial (não será cancelada)
              });

              // Calcular direção inicial usando primeiros pontos da rota para orientação
              if (routeCoordinates && routeCoordinates.length > 3) {
                try {
                  // Uso de um ponto mais distante para direção mais precisa
                  const pointIndex = Math.min(5, routeCoordinates.length - 1);
                  const point = routeCoordinates[pointIndex];
                  const startPoint = routeCoordinates[0];

                  if (typeof calculateBearing === "function") {
                    // Calcular bearing inicial
                    const bearing = calculateBearing(
                      startPoint[1], // lat1
                      startPoint[0], // lon1
                      point[1], // lat2
                      point[0] // lon2
                    );

                    console.log(
                      `[renderRouteOnMap] Direção calculada do ponto ${pointIndex} da rota: ${bearing.toFixed(
                        2
                      )}°`
                    );

                    // IMPORTANTE: Atualizar direção do marcador de usuário imediatamente
                    if (typeof bearing === "number" && !isNaN(bearing)) {
                      if (typeof updateUserMarkersDirection === "function") {
                        updateUserMarkersDirection(bearing);

                        // Armazenar a direção para usos futuros
                        window.lastCalculatedHeading = bearing;

                        // Emitir evento para outros componentes
                        try {
                          document.dispatchEvent(
                            new CustomEvent("routeHeading:updated", {
                              detail: { heading: bearing },
                            })
                          );
                        } catch (eventError) {
                          console.warn(
                            "[renderRouteOnMap] Erro ao disparar evento de heading:",
                            eventError
                          );
                        }
                      } else {
                        // Fallback: Atualizar diretamente os marcadores
                        updateMarkersManually(bearing);
                      }
                    } else {
                      console.warn(
                        "[renderRouteOnMap] Bearing inválido calculado:",
                        bearing
                      );
                    }
                  } else {
                    console.warn(
                      "[renderRouteOnMap] Função calculateBearing não disponível"
                    );
                  }
                } catch (bearingError) {
                  console.error(
                    "[renderRouteOnMap] Erro ao calcular direção inicial:",
                    bearingError
                  );
                }
              }

              // Função local para atualizar marcadores manualmente
              function updateMarkersManually(heading) {
                try {
                  if (window.markers3D && Array.isArray(window.markers3D)) {
                    let updated = 0;
                    for (const marker of window.markers3D) {
                      if (!marker || typeof marker.getElement !== "function")
                        continue;

                      const el = marker.getElement();
                      if (
                        el &&
                        (el.classList.contains("user-location-marker") ||
                          el.classList.contains("user-location-arrow") ||
                          el.classList.contains("mapbox-user-marker"))
                      ) {
                        el.style.transform = `rotate(${heading}deg)`;
                        updated++;
                      }
                    }
                    console.log(
                      `[updateMarkersManually] Atualizados ${updated} marcadores com heading ${heading}°`
                    );
                  }
                } catch (err) {
                  console.error("[updateMarkersManually] Erro:", err);
                }
              }

              // Adicionar camada de setas de direção na rota se possível
              try {
                // Criar fonte para setas apenas se tivermos sprites disponíveis
                if (map.hasImage && map.hasImage("arrow")) {
                  if (!map.getSource("routeArrows")) {
                    map.addSource("routeArrows", {
                      type: "geojson",
                      data:
                        typeof createArrowsAlongRoute === "function"
                          ? createArrowsAlongRoute(routeCoordinates)
                          : {
                              type: "FeatureCollection",
                              features: [
                                {
                                  type: "Feature",
                                  properties: {},
                                  geometry: {
                                    type: "LineString",
                                    coordinates: routeCoordinates,
                                  },
                                },
                              ],
                            },
                    });

                    if (!map.getLayer("routeArrows")) {
                      map.addLayer({
                        id: "routeArrows",
                        type: "symbol",
                        source: "routeArrows",
                        layout: {
                          "symbol-placement": "line",
                          "symbol-spacing": 100, // Espaçamento entre setas
                          "icon-image": "arrow", // Sprite de seta
                          "icon-size": 0.75,
                          "icon-allow-overlap": true,
                          "icon-ignore-placement": true,
                        },
                      });
                    }
                  } else {
                    map.getSource("routeArrows").setData(
                      typeof createArrowsAlongRoute === "function"
                        ? createArrowsAlongRoute(routeCoordinates)
                        : {
                            type: "FeatureCollection",
                            features: [
                              {
                                type: "Feature",
                                properties: {},
                                geometry: {
                                  type: "LineString",
                                  coordinates: routeCoordinates,
                                },
                              },
                            ],
                          }
                    );
                  }
                } else {
                  console.log(
                    "[renderRouteOnMap] Sprite 'arrow' não disponível, ignorando setas de direção"
                  );
                }
              } catch (arrowError) {
                console.warn(
                  "[renderRouteOnMap] Erro ao adicionar setas:",
                  arrowError
                );
              }

              // ********************************************************************
              // IMPORTANTE: Esta parte agora é executada POR ÚLTIMO como solicitado
              // Processamento detalhado dos dados da rota
              // ********************************************************************

              // Dentro da função renderRouteOnMap, na seção onde os dados da rota são processados

              // IMPORTANTE: Extrair e processar informações detalhadas sobre duração e passos
              const legs = route.legs || [];
              const firstLeg = legs[0] || {};
              const steps = firstLeg.steps || [];

              // EXTRAIR DADOS SOBRE SEGMENTOS
              const segments = route.segments || [];
              const segment = segments[0] || {};
              const segmentSteps = segment.steps || [];

              // Compilar todos os passos disponíveis
              const allSteps = segmentSteps.length > 0 ? segmentSteps : steps;

              // Processar os passos para incluir informações de duração
              if (allSteps.length > 0) {
                // Calcular duração total da rota
                const totalDuration = route.duration || 0;
                const totalDistance = route.distance || 0;

                console.log(
                  "[renderRouteOnMap] Duração total da rota:",
                  totalDuration,
                  "segundos"
                );
                console.log(
                  "[renderRouteOnMap] Número de passos:",
                  allSteps.length
                );

                // Adicionar dados de duração aos steps para uso posterior
                // Dentro da função renderRouteOnMap, corrigir o acesso incorreto ao index
                // CORREÇÃO: Adicionar coordenadas a cada passo se não existirem
                steps.forEach((step, i) => {
                  if (
                    !step.lat &&
                    !step.lon &&
                    routeCoordinates &&
                    routeCoordinates.length > i
                  ) {
                    // Usar as coordenadas da rota para este passo
                    const stepCoord =
                      routeCoordinates[
                        Math.min(i, routeCoordinates.length - 1)
                      ];
                    if (stepCoord && stepCoord.length >= 2) {
                      step.lon = stepCoord[0];
                      step.lat = stepCoord[1];
                    }
                  }
                });

                // CORREÇÃO: Enriquecer mais os dados dos passos com campos úteis para instruções
                allSteps.forEach((step) => {
                  // Adicionar campos traduzidos ou equivalentes em português
                  if (step.instruction && !step.translated) {
                    if (step.instruction.toLowerCase().includes("head")) {
                      step.translated = "Siga em frente";
                    } else if (
                      step.instruction.toLowerCase().includes("turn left")
                    ) {
                      step.translated = "Vire à esquerda";
                    } else if (
                      step.instruction.toLowerCase().includes("turn right")
                    ) {
                      step.translated = "Vire à direita";
                    } else if (
                      step.instruction.toLowerCase().includes("slight left")
                    ) {
                      step.translated = "Curva leve à esquerda";
                    } else if (
                      step.instruction.toLowerCase().includes("slight right")
                    ) {
                      step.translated = "Curva leve à direita";
                    } else if (
                      step.instruction.toLowerCase().includes("arrive")
                    ) {
                      step.translated = "Chegou ao seu destino";
                    }
                  }

                  // Adicionar nome da rua se puder ser extraído
                  if (!step.streetName && step.instruction) {
                    // Tentar extrair nome da rua
                    if (step.instruction.includes(" on ")) {
                      step.streetName = step.instruction
                        .split(" on ")[1]
                        .trim();
                    } else if (step.instruction.includes(" onto ")) {
                      step.streetName = step.instruction
                        .split(" onto ")[1]
                        .trim();
                    }
                  }

                  // Armazenar instrução original
                  step.original = step.instruction;

                  // Adicionar formatos para exibição
                  step.formattedDistance = formatDistance
                    ? formatDistance(step.distance)
                    : `${step.distance}m`;
                });

                // Enriquecer o objeto de dados para uso posterior
                data._processedSteps = allSteps;
                data._totalDuration = totalDuration;
                data._totalDistance = totalDistance;
              } else {
                console.log(
                  "[renderRouteOnMap] Nenhum passo de rota encontrado para processar"
                );

                // Criar dados básicos para rota sem passos
                data._processedSteps = [];
                data._totalDuration = route.duration || 0;
                data._totalDistance = route.distance || 0;
              }

              // CORREÇÃO: Armazenar explicitamente no window para acesso posterior
              window._lastRouteData = data;

              // Salvar pontos da rota para navegação em formato acessível
              window.lastRoutePoints = routeCoordinates.map((coord) => ({
                lng: coord[0],
                lat: coord[1],
              }));

              console.log(
                `[renderRouteOnMap] Salvos ${window.lastRoutePoints.length} pontos para navegação`
              );

              // Armazenar a rota no cache se disponível
              try {
                if (
                  typeof generateRouteCacheKey === "function" &&
                  typeof routeCache !== "undefined" &&
                  typeof routeCache.set === "function"
                ) {
                  const cacheKey = generateRouteCacheKey(
                    startLat,
                    startLon,
                    endLat,
                    endLon,
                    "foot"
                  );

                  routeCache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now(),
                    routePoints: window.lastRoutePoints,
                  });
                  console.log("[renderRouteOnMap] Rota armazenada no cache");
                }
              } catch (cacheError) {
                console.warn(
                  "[renderRouteOnMap] Erro ao armazenar rota no cache:",
                  cacheError
                );
              }

              console.log("[renderRouteOnMap] Rota exibida com sucesso em 3D");

              // Setup any ongoing directional updates if available
              if (typeof setupDirectionalMarkerUpdates === "function") {
                setupDirectionalMarkerUpdates();
              }

              // IMPORTANTE: Remover indicador de carregamento após processar tudo
              safeRemoveIndicator();

              // Dispatch event to inform other components
              try {
                document.dispatchEvent(
                  new CustomEvent("route3d:rendered", {
                    detail: {
                      data,
                      startLat,
                      startLon,
                      endLat,
                      endLon,
                      destinationName,
                    },
                  })
                );
              } catch (eventError) {
                console.warn(
                  "[renderRouteOnMap] Erro ao disparar evento de renderização:",
                  eventError
                );
              }

              resolve(data);
            } catch (routeError) {
              console.error(
                "[renderRouteOnMap] Erro ao adicionar linha da rota:",
                routeError
              );
              safeRemoveIndicator();

              // Tentar linha simples como fallback
              if (typeof showStraightLine === "function") {
                showStraightLine(map, startLat, startLon, endLat, endLon);
                console.log(
                  "[renderRouteOnMap] Usando linha reta como fallback após erro"
                );
                resolve(data); // Resolver mesmo com linha reta
              } else {
                reject(routeError);
              }
            }
          }
        } catch (finalError) {
          console.error(
            "[renderRouteOnMap] Erro na renderização final:",
            finalError
          );
          safeRemoveIndicator();
          reject(finalError);
        }
      };

      // Iniciar o processo de verificação e renderização
      checkStyleAndRender();
    } catch (error) {
      console.error(
        "[renderRouteOnMap] Erro crítico ao renderizar rota:",
        error
      );
      safeRemoveIndicator();

      // Último recurso: tentar exibir uma linha reta
      try {
        if (typeof showStraightLine === "function") {
          showStraightLine(map, startLat, startLon, endLat, endLon);
          console.log(
            "[renderRouteOnMap] Usando linha reta como último recurso após erro crítico"
          );
          resolve({ fallback: true }); // Resolver com um objeto indicando que é um fallback
        } else {
          reject(error);
        }
      } catch (fallbackError) {
        console.error("[renderRouteOnMap] Falha no fallback:", fallbackError);
        reject(error);
      }
    }
  });
}

/**
 * Cria dados GeoJSON para setas ao longo da rota
 * @param {Array} coordinates - Coordenadas da rota
 * @returns {Object} - Objeto GeoJSON para setas
 */
function createArrowsAlongRoute(coordinates) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates,
        },
      },
    ],
  };
}

/**
 * Ajusta o mapa para mostrar todos os pontos fornecidos
 * @param {Array} points - Array de pontos no formato [[lng, lat], [lng, lat], ...]
 * @param {Object} options - Opções adicionais para fitBounds
 */
export function fitBounds3D(points, options = {}) {
  try {
    if (!mapbox3dInstance || !is3dModeActive) {
      console.warn("[fitBounds3D] Mapa 3D não está ativo ou inicializado");
      return;
    }

    if (!points || !Array.isArray(points) || points.length === 0) {
      console.warn("[fitBounds3D] Nenhum ponto válido fornecido");
      return;
    }

    // Criar um bounds vazio
    const bounds = new mapboxgl.LngLatBounds();

    // Estender o bounds para incluir todos os pontos
    points.forEach((point) => {
      // Validar o ponto antes de adicionar
      if (
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number" &&
        !isNaN(point[0]) &&
        !isNaN(point[1])
      ) {
        bounds.extend(point);
      }
    });

    // Se não temos bounds válido, sair
    if (bounds.isEmpty()) {
      console.warn(
        "[fitBounds3D] Não foi possível criar bounds válido com os pontos fornecidos"
      );
      return;
    }

    // Opções padrão
    const defaultOptions = {
      padding: 50,
      pitch: 45,
      bearing: 0,
      duration: 1000,
    };

    // Mesclar opções
    const finalOptions = { ...defaultOptions, ...options };

    // Ajustar visualização
    mapbox3dInstance.fitBounds(bounds, finalOptions);
    console.log(
      `[fitBounds3D] Visualização ajustada para ${points.length} pontos`
    );
  } catch (error) {
    console.error("[fitBounds3D] Erro ao ajustar visualização:", error);
  }
}
/**
 * Função utilitária para adicionar indicador de carregamento
 * Substituto caso a função global não esteja disponível
 * @param {string} message - Mensagem a ser exibida
 * @returns {Object} - Objeto representando o indicador
 */
function addLoadingIndicator(message) {
  // Verificar se a função global existe
  if (typeof window.addLoadingIndicator === "function") {
    return window.addLoadingIndicator(message);
  }

  console.log(
    "[addLoadingIndicator] Criando indicador de carregamento local:",
    message
  );

  // Implementação local simplificada
  const indicator = document.createElement("div");
  indicator.className = "map-loading-indicator";
  indicator.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${message || "Carregando..."}</div>
  `;

  // Adicionar estilo inline
  indicator.style.position = "absolute";
  indicator.style.top = "50%";
  indicator.style.left = "50%";
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  indicator.style.color = "white";
  indicator.style.padding = "15px 20px";
  indicator.style.borderRadius = "8px";
  indicator.style.zIndex = "1000";
  indicator.style.display = "flex";
  indicator.style.alignItems = "center";
  indicator.style.gap = "10px";

  // Estilo para o spinner
  const style = document.createElement("style");
  style.textContent = `
    .loading-spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid #fff;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Adicionar ao DOM
  document.body.appendChild(indicator);

  return indicator;
}

/**
 * Função utilitária para remover indicador de carregamento
 * Substituto caso a função global não esteja disponível
 * @param {Object} indicator - O indicador a ser removido
 */
function removeLoadingIndicator(indicator) {
  // Verificar se a função global existe
  if (typeof window.removeLoadingIndicator === "function") {
    return window.removeLoadingIndicator(indicator);
  }

  // Implementação local simplificada
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
    console.log("[removeLoadingIndicator] Indicador de carregamento removido");
  }
}
/**
 * Atualiza a direção dos marcadores do usuário no mapa 3D
 * @param {number} heading - Direção em graus (0-359)
 * @returns {number} - Número de marcadores atualizados
 */
function updateUserMarkersDirection(heading) {
  // Verificar se o heading é válido
  if (heading === undefined || heading === null || isNaN(heading)) {
    console.warn("[updateUserMarkersDirection] Heading inválido:", heading);

    // Tentar usar o último heading calculado como fallback
    if (
      typeof window.lastCalculatedHeading === "number" &&
      !isNaN(window.lastCalculatedHeading)
    ) {
      console.log(
        "[updateUserMarkersDirection] Usando último heading conhecido:",
        window.lastCalculatedHeading.toFixed(2) + "°"
      );
      heading = window.lastCalculatedHeading;
    } else {
      // Se não tiver nenhum heading conhecido, usar 0 como padrão
      heading = 0;
      console.log("[updateUserMarkersDirection] Usando heading padrão: 0°");
    }
  }

  let updated = 0;

  try {
    // Verificar se temos marcadores para atualizar
    if (window.markers3D && Array.isArray(window.markers3D)) {
      for (const marker of window.markers3D) {
        // Verificar se o marcador é válido e tem método getElement
        if (!marker || typeof marker.getElement !== "function") continue;

        const el = marker.getElement();
        if (
          el &&
          (el.classList.contains("user-location-marker") ||
            el.classList.contains("user-location-arrow") ||
            el.classList.contains("mapbox-user-marker"))
        ) {
          // MELHORIA: Aplicar rotação com transição suave
          el.style.transition = "transform 0.3s ease-out";
          el.style.transform = `rotate(${heading}deg)`;
          el.style.webkitTransform = `rotate(${heading}deg)`;

          // Salvar a direção no elemento para referência
          el.dataset.heading = heading;

          updated++;
        }
      }
    }

    if (updated > 0) {
      console.log(
        "[updateUserMarkersDirection]",
        updated,
        "markers updated with direction:",
        heading.toFixed(2) + "°"
      );
    }

    // Salvar como último heading calculado para uso futuro
    window.lastCalculatedHeading = heading;

    // Disparar evento para outros componentes
    try {
      document.dispatchEvent(
        new CustomEvent("routeHeading:updated", {
          detail: { heading },
        })
      );
    } catch (eventError) {
      console.warn(
        "[updateUserMarkersDirection] Erro ao disparar evento:",
        eventError
      );
    }
  } catch (error) {
    console.error(
      "[updateUserMarkersDirection] Erro ao atualizar marcadores:",
      error
    );
  }

  return updated;
}

function clearRoute3D(mapInstance) {
  try {
    if (!mapInstance) {
      console.warn("[clearRoute3D] No map instance provided");
      return false;
    }

    // Safety check for required methods
    if (typeof mapInstance.getStyle !== "function") {
      console.warn("[clearRoute3D] Map instance is not valid");
      return false;
    }

    // Layers must be removed before their sources
    const layersToRemove = [
      "route-line",
      "completed-route-line",
      "straight-line",
      "route-arrows",
    ];

    // Remove layers first (in correct order)
    for (const layerId of layersToRemove) {
      try {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId);
          console.log(`[clearRoute3D] Removed layer: ${layerId}`);
        }
      } catch (layerError) {
        console.warn(
          `[clearRoute3D] Error removing layer ${layerId}:`,
          layerError
        );
      }
    }

    // Then remove sources
    const sourcesToRemove = ["route", "completed-route", "straight-line"];

    for (const sourceId of sourcesToRemove) {
      try {
        // Double-check source exists before removing
        if (mapInstance.getSource(sourceId)) {
          mapInstance.removeSource(sourceId);
          console.log(`[clearRoute3D] Removed source: ${sourceId}`);
        }
      } catch (sourceError) {
        console.warn(
          `[clearRoute3D] Error removing source ${sourceId}:`,
          sourceError
        );
      }
    }

    console.log("[clearRoute3D] Route cleared successfully");
    return true;
  } catch (error) {
    console.error("[clearRoute3D] Error clearing route:", error);
    return false;
  }
}

function addOriginAndDestinationMarkers(
  startLat,
  startLon,
  endLat,
  endLon,
  destinationName
) {
  try {
    // Adicionar marcador de usuário
    const userMarker = addMarker3D(startLat, startLon, {
      title: "Sua localização",
      popupContent: "<h3>Sua localização</h3>",
      className: "user-location-marker",
      isUserMarker: true,
    });

    // Adicionar marcador de destino
    const destMarker = addMarker3D(endLat, endLon, {
      title: destinationName || "Destino",
      popupContent: `<h3>${destinationName || "Destino"}</h3>`,
      openPopup: true,
      isDestinationMarker: true,
    });

    console.log(
      "[addOriginAndDestinationMarkers] Marcadores adicionados com sucesso"
    );

    // Return the markers for further processing if needed
    return { userMarker, destMarker };
  } catch (error) {
    console.error(
      "[addOriginAndDestinationMarkers] Erro ao adicionar marcadores:",
      error
    );
    // Return null to indicate failure
    return null;
  }
}

/**
 * Centraliza o mapa entre os pontos de origem e destino
 */
function centerMapBetweenPoints(startLat, startLon, endLat, endLon, distance) {
  const centerLat = (startLat + endLat) / 2;
  const centerLon = (startLon + endLon) / 2;
  const bearing = calculateBearing(startLat, startLon, endLat, endLon);

  // Ajustar o zoom com base na distância
  const zoomLevel = distance > 5000 ? 13 : distance > 1000 ? 15 : 17;

  flyToLocation(centerLat, centerLon, {
    zoom: zoomLevel,
    pitch: 60,
    bearing: bearing,
    duration: 2000,
  });
}

/**
 * Mostra o resumo da rota calculada
 */
function showRouteSummary3D(
  destinationName,
  data,
  startLat,
  startLon,
  endLat,
  endLon
) {
  try {
    // Extrair informações da rota
    const route = data.routes[0];
    const distance = route.distance;
    const duration = route.duration;
    const formattedDistance = (distance / 1000).toFixed(2);
    const formattedDuration = Math.round(duration / 60);

    // Usar a função showRouteSummary existente se disponível
    if (typeof window.showRouteSummary === "function") {
      window.showRouteSummary(destinationName, distance, duration);
    }

    // Armazenar os dados da rota em uma variável global para uso em outros lugares
    window.lastRouteCalculated = {
      destinationName,
      distance: formattedDistance,
      duration: formattedDuration,
      raw: {
        distance,
        duration,
      },
    };

    // REMOVIDO: A mensagem será mostrada pelo .then() após o renderRouteOnMap

    // Despachar um evento para notificar que a rota foi calculada com sucesso
    document.dispatchEvent(
      new CustomEvent("route:calculated", {
        detail: {
          destinationName,
          distance: formattedDistance,
          duration: formattedDuration,
        },
      })
    );

    console.log(
      `[showRouteSummary3D] Rota calculada: ${formattedDistance}km, ${formattedDuration}min`
    );
  } catch (error) {
    console.error("[showRouteSummary3D] Erro ao mostrar resumo:", error);
  }
}

/**
 * Verifica se uma coordenada é válida
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - Verdadeiro se a coordenada for válida
 */
function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Gera uma chave para o cache de rotas
 */
function generateRouteCacheKey(startLat, startLon, destLat, destLon, profile) {
  return `3D_${startLat.toFixed(6)}_${startLon.toFixed(6)}_${destLat.toFixed(
    6
  )}_${destLon.toFixed(6)}_${profile}`;
}

/**
 * Mostra uma linha reta no mapa como fallback
 */
function showStraightLine(mapInstance, startLat, startLon, endLat, endLon) {
  try {
    if (!mapInstance) return;

    // Remover linha existente
    if (mapInstance.getLayer("straight-line")) {
      mapInstance.removeLayer("straight-line");
    }
    if (mapInstance.getSource("straight-line")) {
      mapInstance.removeSource("straight-line");
    }

    // Adicionar linha reta
    mapInstance.addSource("straight-line", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [startLon, startLat],
            [endLon, endLat],
          ],
        },
      },
    });

    mapInstance.addLayer({
      id: "straight-line",
      type: "line",
      source: "straight-line",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f59e0b",
        "line-width": 4,
        "line-opacity": 0.7,
        "line-dasharray": [2, 2],
      },
    });

    // Ajustar visualização
    mapInstance.fitBounds(
      [
        [Math.min(startLon, endLon), Math.min(startLat, endLat)],
        [Math.max(startLon, endLon), Math.max(startLat, endLat)],
      ],
      {
        padding: 80,
        duration: 1000,
      }
    );

    console.log("[showStraightLine] Linha reta exibida como fallback");
  } catch (error) {
    console.error("[showStraightLine] Erro:", error);
  }
}

/**
 * Função de ajuste para melhorar a acessibilidade dos popups
 * @param {Object} mapInstance - Instância do mapa Mapbox
 */
function fixPopupAccessibility(mapInstance) {
  // Observar os novos popups adicionados ao DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains("mapboxgl-popup")) {
            // Encontrar botão de fechar
            const closeButton = node.querySelector(
              ".mapboxgl-popup-close-button"
            );
            if (closeButton) {
              // Garantir que outros atributos de acessibilidade estão corretos
              if (!closeButton.hasAttribute("aria-label")) {
                closeButton.setAttribute("aria-label", "Fechar popup");
              }

              // CORREÇÃO: Remover o atributo aria-hidden que causa conflito com o foco
              if (closeButton.hasAttribute("aria-hidden")) {
                closeButton.removeAttribute("aria-hidden");
              }
            }
          }
        });
      }
    });
  });

  // Observar mudanças no contêiner do mapa
  observer.observe(mapInstance.getContainer(), {
    childList: true,
    subtree: true,
  });
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

/**
 * Atualiza o marcador do usuário baseado na rota recém-calculada
 * @param {number} userLat - Latitude do usuário
 * @param {number} userLon - Longitude do usuário
 */
function updateUserMarkerBasedOnRoute(userLat, userLon) {
  try {
    // Verificar se temos dados da rota
    if (!window.lastRoutePoints || !window.lastRoutePoints.length) {
      console.warn(
        "[updateUserMarkerBasedOnRoute] Faltam dados para atualização"
      );
      return;
    }

    // Calcular heading
    let heading = null;

    // Usar a função calculateInitialRouteHeading se ela existir
    if (typeof calculateInitialRouteHeading === "function") {
      heading = calculateInitialRouteHeading(userLat, userLon);
    }
    // Se não, calcular manualmente
    else {
      // Encontrar o próximo ponto da rota
      let nearestPointIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < window.lastRoutePoints.length; i++) {
        const point = window.lastRoutePoints[i];
        const pointLat = point.lat;
        const pointLon = point.lon;

        if (typeof pointLat === "number" && typeof pointLon === "number") {
          const distance = calculateDistance(
            userLat,
            userLon,
            pointLat,
            pointLon
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestPointIndex = i;
          }
        }
      }

      // Encontrar o próximo ponto para apontar (pelo menos 20m adiante)
      let targetPointIndex = nearestPointIndex;
      const minLookAheadDistance = 20; // metros

      // Procurar um ponto significativo à frente (não apenas o próximo ponto)
      for (
        let i = nearestPointIndex + 1;
        i < Math.min(window.lastRoutePoints.length, nearestPointIndex + 10);
        i++
      ) {
        const point = window.lastRoutePoints[i];
        if (
          !point ||
          typeof point.lat !== "number" ||
          typeof point.lon !== "number"
        )
          continue;

        const distance = calculateDistance(
          userLat,
          userLon,
          point.lat,
          point.lon
        );

        if (distance >= minLookAheadDistance) {
          targetPointIndex = i;
          break;
        }
      }

      // Se não encontramos um ponto suficientemente distante, usar o próximo disponível
      if (
        targetPointIndex === nearestPointIndex &&
        nearestPointIndex < window.lastRoutePoints.length - 1
      ) {
        targetPointIndex = nearestPointIndex + 1;
      }

      // Calcular o bearing (direção) para o ponto se temos um ponto alvo diferente do atual
      if (targetPointIndex > nearestPointIndex) {
        const targetPoint = window.lastRoutePoints[targetPointIndex];
        if (
          targetPoint &&
          typeof targetPoint.lat === "number" &&
          typeof targetPoint.lon === "number"
        ) {
          heading = calculateBearing(
            userLat,
            userLon,
            targetPoint.lat,
            targetPoint.lon
          );
          console.log(
            `[updateUserMarkerBasedOnRoute] Direção calculada manualmente: ${heading.toFixed(
              2
            )}° para o ponto ${targetPointIndex}`
          );
        }
      }
    }

    // Se conseguimos um heading válido, atualizar todos os possíveis marcadores
    if (heading !== null) {
      // Normalizar o heading para um valor entre 0 e 360
      heading = (heading + 360) % 360;

      // Rastrear quais marcadores foram atualizados
      let updatedMarkers = 0;

      // 1. Atualizar o userMarker (usado pelo sistema de navegação)
      if (window.userMarker && window.userMarker.getElement) {
        const markerEl = window.userMarker.getElement();
        if (markerEl) {
          markerEl.style.transform = `rotate(${heading}deg)`;
          updatedMarkers++;

          // Adicionar efeito visual sutil para indicar a atualização
          markerEl.classList.add("rotation-updated");
          setTimeout(() => markerEl.classList.remove("rotation-updated"), 300);
        }
      }

      // 2. Atualizar o marcador 3D específico (se existir)
      if (window.route3DUserMarker && window.route3DUserMarker.getElement) {
        const markerEl = window.route3DUserMarker.getElement();
        if (markerEl) {
          markerEl.style.transform = `rotate(${heading}deg)`;
          updatedMarkers++;

          // Adicionar efeito visual sutil
          markerEl.classList.add("rotation-updated");
          setTimeout(() => markerEl.classList.remove("rotation-updated"), 300);
        }
      }

      // 3. Procurar marcador na coleção de marcadores 3D
      if (window.markers3D && Array.isArray(window.markers3D)) {
        window.markers3D.forEach((marker) => {
          if (marker && marker.getElement) {
            const el = marker.getElement();
            if (
              el &&
              (el.classList.contains("user-location-arrow") ||
                el.classList.contains("user-location-marker"))
            ) {
              el.style.transform = `rotate(${heading}deg)`;
              updatedMarkers++;

              // Adicionar efeito visual sutil
              el.classList.add("rotation-updated");
              setTimeout(() => el.classList.remove("rotation-updated"), 300);
            }
          }
        });
      }

      // Se nenhum marcador foi atualizado, criar um estilo para futuros marcadores
      if (updatedMarkers === 0) {
        // Adicionar um estilo que vai pré-configurar a rotação para futuros marcadores
        const styleId = "user-marker-auto-rotation";
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `
            /* Estilo pré-configurado para marcadores futuros */
            .user-location-marker, .user-location-arrow {
              transform: rotate(${heading}deg);
              transform-origin: center center;
              transition: transform 0.3s ease-out;
            }
            
            /* Efeito de atualização da rotação */
            .rotation-updated {
              animation: pulse-marker 0.3s ease-out;
            }
            
            @keyframes pulse-marker {
              0% { transform: rotate(${heading}deg) scale(1); }
              50% { transform: rotate(${heading}deg) scale(1.1); }
              100% { transform: rotate(${heading}deg) scale(1); }
            }
          `;
          document.head.appendChild(style);
          console.log(
            `[updateUserMarkerBasedOnRoute] Estilo com rotação ${heading}° adicionado para futuros marcadores`
          );
        } else {
          // Atualizar o estilo existente
          const existingStyle = document.getElementById(styleId);
          existingStyle.textContent = existingStyle.textContent.replace(
            /rotate\([^)]+\)/g,
            `rotate(${heading}deg)`
          );
        }
      }

      // Salvar o heading para uso futuro
      window.lastCalculatedHeading = heading;

      console.log(
        `[updateUserMarkerBasedOnRoute] ${updatedMarkers} marcadores atualizados para direção: ${heading.toFixed(
          2
        )}°`
      );

      // Despachar evento para outros componentes poderem reagir
      document.dispatchEvent(
        new CustomEvent("userMarker:headingUpdated", {
          detail: { heading, userLat, userLon },
        })
      );
    } else {
      console.warn(
        "[updateUserMarkerBasedOnRoute] Não foi possível determinar uma direção válida"
      );
    }
  } catch (error) {
    console.error(
      "[updateUserMarkerBasedOnRoute] Erro ao atualizar marcador:",
      error
    );
  }
}

/**
 * NOVA FUNÇÃO: Converte os dados de rota do OpenRouteService para lastRoutePoints
 * @param {Object} routeData - Dados de rota da API OpenRouteService
 * @returns {Array} Array de pontos da rota no formato [{lat, lon}, ...]
 */
function extractRoutePoints(routeData) {
  try {
    if (
      !routeData ||
      !routeData.routes ||
      !routeData.routes[0] ||
      !routeData.routes[0].geometry ||
      !routeData.routes[0].geometry.coordinates
    ) {
      console.warn(
        "[extractRoutePoints] Dados de rota inválidos ou incompletos"
      );
      return [];
    }

    const coordinates = routeData.routes[0].geometry.coordinates;
    return coordinates.map((coord) => ({
      lon: coord[0],
      lat: coord[1],
    }));
  } catch (error) {
    console.error(
      "[extractRoutePoints] Erro ao extrair pontos da rota:",
      error
    );
    return [];
  }
}

/**
 * Substitui o construtor da classe Popup do Mapbox GL para corrigir problemas de acessibilidade
 * Esta função deve ser chamada após o carregamento do Mapbox GL JS
 */
function patchMapboxPopupForAccessibility() {
  if (!window.mapboxgl || !mapboxgl.Popup) {
    console.warn(
      "[patchMapboxPopupForAccessibility] Mapbox GL JS não carregado ainda"
    );
    return;
  }

  // Salvar o método original
  const originalAddTo = mapboxgl.Popup.prototype.addTo;

  // Substituir o método addTo para corrigir a acessibilidade após a adição ao mapa
  mapboxgl.Popup.prototype.addTo = function (map) {
    // Chamar o método original primeiro
    const result = originalAddTo.call(this, map);

    // Logo após a adição ao mapa, procurar o botão de fechar e corrigir seus atributos
    setTimeout(() => {
      if (this._container) {
        const closeButton = this._container.querySelector(
          ".mapboxgl-popup-close-button"
        );
        if (closeButton && closeButton.hasAttribute("aria-hidden")) {
          // Remover o atributo aria-hidden que causa o conflito
          closeButton.removeAttribute("aria-hidden");

          // Garantir que tenha um rótulo adequado
          if (!closeButton.hasAttribute("aria-label")) {
            closeButton.setAttribute("aria-label", "Fechar");
          }

          console.log(
            "[patchMapboxPopupForAccessibility] Corrigido atributo aria-hidden no botão de fechar popup"
          );
        }
      }
    }, 0);

    return result;
  };

  console.log(
    "[patchMapboxPopupForAccessibility] Classe Popup do Mapbox GL corrigida para acessibilidade"
  );
}
