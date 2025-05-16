/**
 * Módulo de Controles Unificados do Mapa
 * Integra controles para mapa 2D (Leaflet) e 3D (Mapbox GL)
 */

import { getMapInstance } from "./map-init.js";
import {
  clearMarkers,
  showLocationOnMap,
  showAllLocationsOnMap,
} from "./map-markers.js";
import { addRotationControl } from "./map-controls.js";

// Importar funcionalidades do modo 3D
import {
  initMapbox3D,
  enable3DMode,
  disable3DMode,
  getMapbox3DInstance,
  addMarker3D,
  clearMarkers3D,
  updateRouteIn3D,
  flyToLocation,
  is3DModeActive,
} from "./map-3d/map-3d.js";

// Importar controles de satélite
import {
  initSatelliteControls,
  toggleSatelliteControlPanel,
} from "./map-3d/satelite-controls/satellite-imagery-controls.js";

import {
  initSatelliteEnhancer,
  setSatelliteSource,
} from "./map-3d/satelite-controls/satellite-imagery-enhancer.js";

// Estado do módulo
let isInitialized = false;
let is3DEnabled = false;
let isSatelliteActive = false;
let currentSatelliteSource = "streets";
let is3DControlsVisible = false;

/**
 * Inicializa os controles unificados do mapa
 * @returns {Promise<boolean>} Sucesso da inicialização
 */
export async function initUnifiedControls() {
  if (isInitialized) {
    console.log("[map-unified-controls] Controles já inicializados");
    return true;
  }

  try {
    // Obter instância de mapa global se não fornecida
    // CORREÇÃO: Usar window.map se getMapInstance() não retornar um valor
    let mapInstance = getMapInstance();
    if (!mapInstance && window.map) {
      console.log("[map-unified-controls] Usando window.map como fallback");
      mapInstance = window.map;
    }

    if (!mapInstance) {
      console.error(
        "[map-unified-controls] Instância de mapa não encontrada. Tentando novamente em 1 segundo..."
      );
      // Tentar novamente após um intervalo
      return new Promise((resolve) => {
        setTimeout(() => {
          initUnifiedControls().then(resolve);
        }, 1000);
      });
    }

    console.log(
      "[map-unified-controls] Mapa encontrado, inicializando controles unificados"
    );

    // 1. Adicionar container para os controles unificados
    addControlsContainer();

    // 2. Carregar scripts do Mapbox GL de forma assíncrona
    await loadMapboxGLScripts();

    // 3. Pré-inicializar o módulo 3D (sem exibição)
    await preInitialize3DMode();

    // 4. Inicializar o módulo de satélite
    initSatelliteEnhancer();
    initSatelliteControls({
      initialSource: "streets",
      addControlButton: false,
      sources: ["streets", "google", "nasa"],
    });

    // 5. Adicionar controles à interface
    addMapControlButtons();

    isInitialized = true;
    console.log(
      "[map-unified-controls] Controles unificados inicializados com sucesso"
    );
    return true;
  } catch (error) {
    console.error(
      "[map-unified-controls] Erro ao inicializar controles unificados:",
      error
    );
    return false;
  }
}

/**
 * Carrega os scripts do Mapbox GL de forma assíncrona
 * @returns {Promise<void>}
 */
async function loadMapboxGLScripts() {
  if (window.mapboxgl) return;

  return new Promise((resolve, reject) => {
    // Carregar CSS do Mapbox GL
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css";
    document.head.appendChild(link);

    // Carregar JavaScript do Mapbox GL
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js";
    script.async = true;
    script.onload = () => {
      console.log("[map-unified-controls] Mapbox GL carregado com sucesso");
      resolve();
    };
    script.onerror = (err) => {
      console.error("[map-unified-controls] Erro ao carregar Mapbox GL:", err);
      reject(new Error("Falha ao carregar Mapbox GL"));
    };
    document.head.appendChild(script);
  });
}

/**
 * Adiciona container para os controles unificados
 */
function addControlsContainer() {
  // Verificar se o container já existe
  if (document.getElementById("unified-map-controls")) return;

  // Criar container para os controles
  const container = document.createElement("div");
  container.id = "unified-map-controls";
  container.className = "unified-map-controls";

  // Adicionar ao mapa
  const mapContainer =
    document.getElementById("map-container") || document.getElementById("map");
  if (mapContainer) {
    mapContainer.appendChild(container);
  } else {
    document.body.appendChild(container);
  }

  // Adicionar estilos
  addControlStyles();
}

/**
 * Adiciona estilos CSS para os controles unificados
 */
function addControlStyles() {
  if (document.getElementById("unified-controls-styles")) return;

  const style = document.createElement("style");
  style.id = "unified-controls-styles";
  style.textContent = `
    .unified-map-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .map-control-button {
      width: 40px;
      height: 40px;
      background: white;
      border: none;
      border-radius: 4px;
      box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .map-control-button:hover {
      background: #f0f0f0;
    }
    
    .map-control-button.active {
      background: #3b82f6;
      color: white;
    }
    
    .map-control-button svg {
      width: 24px;
      height: 24px;
    }
    
    .control-tooltip {
      position: absolute;
      right: 50px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    
    .map-control-button:hover .control-tooltip {
      opacity: 1;
    }
    
    /* Estilos para os controles 3D */
    .mode-3d-buttons {
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
      max-height: 210px;
      transition: max-height 0.3s ease;
    }
    
    .mode-3d-buttons.hidden {
      max-height: 0;
    }
    
    /* Botão 3D com texto */
    .button-3d-text {
      font-weight: bold;
      font-size: 14px;
    }
    
    /* Estilos para o painel de satélite */
    .satellite-control-panel {
      position: absolute;
      top: 70px;
      right: 10px;
      width: 300px;
      background: white;
      border-radius: 4px;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
      z-index: 999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #333;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
    
    .panel-header {
      padding: 10px 15px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
    }
    
    .close-button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0 5px;
    }
    
    .control-section {
      padding: 15px;
      border-bottom: 1px solid #eee;
    }
    
    .source-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    
    .source-button {
      padding: 10px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }
    
    .source-button:hover {
      background: #e5e5e5;
    }
    
    .source-button.active {
      background: #3b82f6;
      color: white;
      border-color: #2563eb;
    }
    
    /* Animação para clique nos botões 3D */
    @keyframes buttonClick {
      0% { transform: scale(1); }
      50% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    
    .map-control-button.clicked {
      animation: buttonClick 0.3s ease;
    }
    
    @media (max-width: 768px) {
      .unified-map-controls {
        top: auto;
        bottom: 50%;
        right: 10px;
      }
      
      .satellite-control-panel {
        width: 250px;
        top: auto;
        bottom: 170px;
        max-height: 300px;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Pré-inicializa o modo 3D sem exibi-lo
 * @returns {Promise<boolean>}
 */
async function preInitialize3DMode() {
  try {
    if (!window.mapboxgl) {
      console.warn(
        "[map-unified-controls] Mapbox GL não disponível para pré-inicialização 3D"
      );
      return false;
    }

    // Obter a instância do mapa Leaflet atual
    const mapInstance = getMapInstance() || window.map;
    if (!mapInstance) return false;

    // Obter o centro e zoom atuais
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();

    // Pré-inicializar o mapa 3D sem exibi-lo
    const mapbox3D = await initMapbox3D({
      center: [center.lng, center.lat],
      zoom: zoom,
      containerId: "map",
      originalMapInstance: mapInstance,
      visible: false,
    });

    if (mapbox3D) {
      console.log(
        "[map-unified-controls] Mapa 3D pré-inicializado com sucesso"
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "[map-unified-controls] Erro ao pré-inicializar modo 3D:",
      error
    );
    return false;
  }
}

/**
 * Adiciona os botões de controle do mapa
 */
function addMapControlButtons() {
  const container = document.getElementById("unified-map-controls");
  if (!container) return;

  // Limpar controles existentes
  container.innerHTML = "";

  // 1. Botão de camadas do mapa (substituindo o de satélite)
  const buttonLayers = document.createElement("button");
  buttonLayers.className = "map-control-button";
  buttonLayers.id = "toggle-map-layers";
  buttonLayers.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
      <line x1="8" y1="2" x2="8" y2="18"></line>
      <line x1="16" y1="6" x2="16" y2="22"></line>
    </svg>
    <span class="control-tooltip">Camadas do Mapa</span>
  `;
  buttonLayers.title = "Camadas do Mapa";
  buttonLayers.addEventListener("click", toggleMapLayersPanel);
  container.appendChild(buttonLayers);

  // 2. Botão de modo 3D com texto
  const button3D = document.createElement("button");
  button3D.className = "map-control-button";
  button3D.id = "toggle-3d-mode";
  button3D.innerHTML = `
    <span class="button-3d-text">3D</span>
    <span class="control-tooltip">Modo 3D</span>
  `;
  button3D.title = "Alternar modo 3D";
  button3D.addEventListener("click", toggle3DMode);
  container.appendChild(button3D);

  // Criar o container de botões do modo 3D (inicialmente oculto)
  const mode3DButtons = document.createElement("div");
  mode3DButtons.className = "mode-3d-buttons hidden";
  mode3DButtons.id = "mode-3d-buttons";

  // Botões de controle 3D
  const tiltUpButton = createControlButton(
    "tilt-up",
    "Aumentar inclinação",
    `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  `
  );

  const tiltDownButton = createControlButton(
    "tilt-down",
    "Diminuir inclinação",
    `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `
  );

  const rotateLeftButton = createControlButton(
    "rotate-left",
    "Girar para esquerda",
    `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 10 4 15 9 20"></polyline>
      <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
    </svg>
  `
  );

  const rotateRightButton = createControlButton(
    "rotate-right",
    "Girar para direita",
    `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 10 20 15 15 20"></polyline>
      <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
    </svg>
  `
  );

  // Adicionar eventos para os botões 3D
  tiltUpButton.addEventListener("click", () => {
    tiltUpButton.classList.add("clicked");
    setTimeout(() => tiltUpButton.classList.remove("clicked"), 300);

    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      const currentPitch = mapbox3D.getPitch();
      mapbox3D.easeTo({
        pitch: Math.min(currentPitch + 10, 80),
        duration: 300,
      });
    }
  });

  tiltDownButton.addEventListener("click", () => {
    tiltDownButton.classList.add("clicked");
    setTimeout(() => tiltDownButton.classList.remove("clicked"), 300);

    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      const currentPitch = mapbox3D.getPitch();
      mapbox3D.easeTo({ pitch: Math.max(currentPitch - 10, 0), duration: 300 });
    }
  });

  rotateLeftButton.addEventListener("click", () => {
    rotateLeftButton.classList.add("clicked");
    setTimeout(() => rotateLeftButton.classList.remove("clicked"), 300);

    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      const currentBearing = mapbox3D.getBearing();
      mapbox3D.easeTo({ bearing: currentBearing - 45, duration: 300 });
    }
  });

  rotateRightButton.addEventListener("click", () => {
    rotateRightButton.classList.add("clicked");
    setTimeout(() => rotateRightButton.classList.remove("clicked"), 300);

    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      const currentBearing = mapbox3D.getBearing();
      mapbox3D.easeTo({ bearing: currentBearing + 45, duration: 300 });
    }
  });

  // Adicionar botões ao container 3D
  mode3DButtons.appendChild(tiltUpButton);
  mode3DButtons.appendChild(tiltDownButton);
  mode3DButtons.appendChild(rotateLeftButton);
  mode3DButtons.appendChild(rotateRightButton);

  // Adicionar o container de botões 3D após o botão 3D
  container.appendChild(mode3DButtons);

  // 3. Botão de localização
  const buttonLocation = document.createElement("button");
  buttonLocation.className = "map-control-button";
  buttonLocation.id = "locate-user";
  buttonLocation.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    <span class="control-tooltip">Minha Localização</span>
  `;
  buttonLocation.title = "Encontrar minha localização";
  buttonLocation.addEventListener("click", locateUser);
  container.appendChild(buttonLocation);

  // 4. Botão de resetar mapa
  const buttonReset = document.createElement("button");
  buttonReset.className = "map-control-button";
  buttonReset.id = "reset-map";
  buttonReset.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
    <span class="control-tooltip">Resetar Mapa</span>
  `;
  buttonReset.title = "Resetar visualização do mapa";
  buttonReset.addEventListener("click", resetMapView);
  container.appendChild(buttonReset);

  // Criar um painel de camadas personalizado para o botão de camadas
  createMapLayersPanel();
}

/**
 * Cria um botão de controle com o estilo padrão
 * @param {string} id - ID do botão
 * @param {string} title - Título do botão (tooltip)
 * @param {string} innerHTML - HTML interno do botão
 * @returns {HTMLButtonElement} Botão criado
 */
function createControlButton(id, title, innerHTML) {
  const button = document.createElement("button");
  button.className = "map-control-button";
  button.id = id;
  button.title = title;
  button.innerHTML = innerHTML;
  return button;
}

/**
 * Cria o painel de camadas do mapa com controles adaptáveis
 */
function createMapLayersPanel() {
  // Remover painel anterior se existir
  const existingPanel = document.getElementById("map-layers-panel");
  if (existingPanel) {
    existingPanel.parentNode.removeChild(existingPanel);
  }

  // Criar novo painel
  const panel = document.createElement("div");
  panel.id = "map-layers-panel";
  panel.className = "satellite-control-panel";
  panel.style.display = "none"; // Inicialmente oculto

  // Cabeçalho
  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <h3>Camadas do Mapa</h3>
    <button class="close-button" aria-label="Fechar painel">&times;</button>
  `;
  header
    .querySelector(".close-button")
    .addEventListener("click", toggleMapLayersPanel);
  panel.appendChild(header);

  // Seção de fontes
  const sourceSection = document.createElement("div");
  sourceSection.className = "control-section";
  sourceSection.innerHTML = "<h4>Escolha a visualização</h4>";

  const sourceButtons = document.createElement("div");
  sourceButtons.className = "source-buttons";

  // Array de fontes disponíveis
  const sources = [
    {
      id: "streets",
      label: "Mapa Padrão",
      description: "Mapa de ruas padrão com informações detalhadas",
    },
    {
      id: "google",
      label: "Satélite Google",
      description: "Imagens de satélite de alta resolução",
    },
    {
      id: "nasa",
      label: "Satélite NASA",
      description: "Imagens da NASA com recursos especiais",
    },
  ];

  // Criar botões para cada fonte
  sources.forEach((source) => {
    const button = document.createElement("button");
    button.className = `source-button ${
      source.id === currentSatelliteSource ? "active" : ""
    }`;
    button.dataset.source = source.id;

    button.innerHTML = `
      <div>
        <div class="source-label">${source.label}</div>
        <div class="source-description">${source.description}</div>
      </div>
    `;

    button.addEventListener("click", () => changeMapSource(source.id));
    sourceButtons.appendChild(button);
  });

  sourceSection.appendChild(sourceButtons);
  panel.appendChild(sourceSection);

  // Seção de opções 3D (visível apenas se o modo 3D estiver ativo)
  const options3DSection = document.createElement("div");
  options3DSection.className = "control-section options-3d";
  options3DSection.style.display = is3DEnabled ? "block" : "none";
  options3DSection.innerHTML = `
    <h4>Opções 3D</h4>
    <div class="option-sliders">
      <div class="option-slider">
        <label for="building-height">Altura dos Edifícios</label>
        <input type="range" id="building-height" min="0" max="2" step="0.1" value="1">
      </div>
      <div class="option-slider">
        <label for="terrain-exaggeration">Exagero do Terreno</label>
        <input type="range" id="terrain-exaggeration" min="0.5" max="2" step="0.1" value="1">
      </div>
    </div>
  `;

  // Adicionar eventos para os controles deslizantes 3D
  options3DSection.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.addEventListener("input", (e) => {
      if (!is3DEnabled) return;

      const mapbox3D = getMapbox3DInstance();
      if (!mapbox3D) return;

      if (e.target.id === "building-height") {
        // Ajustar altura dos edifícios
        adjustBuildingHeight(parseFloat(e.target.value));
      } else if (e.target.id === "terrain-exaggeration") {
        // Ajustar exageração do terreno
        adjustTerrainExaggeration(parseFloat(e.target.value));
      }
    });
  });

  panel.appendChild(options3DSection);

  // Seção de opções de satélite (visível quando o satélite está ativo)
  const satelliteSection = document.createElement("div");
  satelliteSection.className = "control-section satellite-options";
  satelliteSection.style.display = isSatelliteActive ? "block" : "none";
  satelliteSection.innerHTML = `<h4>Opções de Satélite</h4>`;

  // Adicionar controles dinâmicos de satélite (baseados nas capacidades)
  import("./map-3d/satelite-controls/satellite-imagery-enhancer.js")
    .then((module) => {
      if (typeof module.getSatelliteEnhancementControls === "function") {
        // Obter controles adaptados às capacidades
        const satelliteControls = module.getSatelliteEnhancementControls();

        // Criar elementos de controle
        const controlsContainer = document.createElement("div");
        controlsContainer.className = "satellite-enhancement-controls";

        // Processar cada controle
        satelliteControls.forEach((control) => {
          const controlItem = document.createElement("div");
          controlItem.className = "enhancement-control-item";

          if (control.type === "toggle") {
            // Criar toggle switch
            controlItem.innerHTML = `
              <div class="control-header">
                <label for="${control.id}">${control.label}</label>
                <div class="toggle-switch">
                  <input type="checkbox" id="${control.id}" ${
              control.defaultValue ? "checked" : ""
            }>
                  <span class="toggle-slider"></span>
                </div>
              </div>
            `;

            // Adicionar evento
            const toggle = controlItem.querySelector(`#${control.id}`);
            toggle.addEventListener("change", (e) => {
              if (typeof control.onChange === "function") {
                control.onChange(e.target.checked);
              }
            });
          } else if (control.type === "slider") {
            // Criar slider
            controlItem.innerHTML = `
              <div class="control-header">
                <label for="${control.id}">${control.label}</label>
                <span class="slider-value">${control.defaultValue}</span>
              </div>
              <input type="range" id="${control.id}" 
                min="${control.min}" max="${control.max}" 
                step="${control.step}" value="${control.defaultValue}">
            `;

            // Adicionar evento
            const slider = controlItem.querySelector(`#${control.id}`);
            slider.addEventListener("input", (e) => {
              // Atualizar valor exibido
              controlItem.querySelector(".slider-value").textContent =
                e.target.value;

              if (typeof control.onChange === "function") {
                control.onChange(e.target.value);
              }
            });
          }

          controlsContainer.appendChild(controlItem);
        });

        // Adicionar controles à seção de satélite
        satelliteSection.appendChild(controlsContainer);
      }
    })
    .catch((error) => {
      console.warn(
        "[map-unified-controls] Erro ao carregar controles de satélite:",
        error
      );

      // Adicionar mensagem de fallback
      satelliteSection.innerHTML += `
        <div class="enhancement-fallback">
          <p>Opções avançadas de satélite não estão disponíveis.</p>
        </div>
      `;
    });

  panel.appendChild(satelliteSection);

  // Adicionar ao DOM
  document.body.appendChild(panel);

  // Adicionar estilos específicos para os novos controles
  addSatelliteControlStyles();
}

/**
 * Adiciona estilos CSS para os controles de satélite
 */
function addSatelliteControlStyles() {
  if (document.getElementById("satellite-control-styles")) return;

  const style = document.createElement("style");
  style.id = "satellite-control-styles";
  style.textContent = `
    .satellite-enhancement-controls {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 10px;
    }
    
    .enhancement-control-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    /* Estilo para toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 20px;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      border-radius: 34px;
      transition: .4s;
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 2px;
      background-color: white;
      border-radius: 50%;
      transition: .4s;
    }
    
    input:checked + .toggle-slider {
      background-color: #3b82f6;
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(18px);
    }
    
    /* Valor do slider */
    .slider-value {
      font-size: 12px;
      color: #666;
      font-weight: bold;
    }
    
    /* Estilo para sliders */
    .enhancement-control-item input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 5px;
      background: #ddd;
      outline: none;
    }
    
    .enhancement-control-item input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 0 5px rgba(0,0,0,0.2);
    }
    
    .enhancement-control-item input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 0 5px rgba(0,0,0,0.2);
    }
  `;

  document.head.appendChild(style);
}

/**
 * Atualiza a visibilidade das seções do painel de camadas
 * baseado no estado atual do mapa
 */
function updateLayersPanelSections() {
  const panel = document.getElementById("map-layers-panel");
  if (!panel) return;

  // Atualizar seção 3D
  const options3DSection = panel.querySelector(".options-3d");
  if (options3DSection) {
    options3DSection.style.display = is3DEnabled ? "block" : "none";
  }

  // Atualizar seção de satélite
  const satelliteSection = panel.querySelector(".satellite-options");
  if (satelliteSection) {
    satelliteSection.style.display = isSatelliteActive ? "block" : "none";
  }
}

/**
 * Alterna a exibição do painel de camadas do mapa
 */
function toggleMapLayersPanel() {
  const panel = document.getElementById("map-layers-panel");
  if (!panel) {
    createMapLayersPanel();
    setTimeout(toggleMapLayersPanel, 10);
    return;
  }

  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";

  // Atualizar estado do botão
  const button = document.getElementById("toggle-map-layers");
  if (button) {
    button.classList.toggle("active", !isVisible);
  }

  // Atualizar seção de opções 3D com base no estado atual
  const options3DSection = panel.querySelector(".options-3d");
  if (options3DSection) {
    options3DSection.style.display = is3DEnabled ? "block" : "none";
  }

  // Atualizar botões ativos
  const sourceButtons = panel.querySelectorAll(".source-button");
  sourceButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.source === currentSatelliteSource
    );
  });
}

/**
 * Alterna o modo 3D e exibe/oculta os botões de controle 3D
 */
function toggle3DMode() {
  const button = document.getElementById("toggle-3d-mode");
  const buttons3dContainer = document.getElementById("mode-3d-buttons");

  // Verifica se os botões 3D estão atualmente visíveis
  const areControlsVisible =
    buttons3dContainer && !buttons3dContainer.classList.contains("hidden");

  if (!is3DEnabled) {
    // Ativar modo 3D
    toggleMode3D();
    button.classList.add("active");

    // Mostrar botões de controle 3D
    if (buttons3dContainer) {
      buttons3dContainer.classList.remove("hidden");
      is3DControlsVisible = true;
    }
  } else {
    if (areControlsVisible) {
      // Se os controles estão visíveis, apenas ocultá-los mantendo o modo 3D ativo
      if (buttons3dContainer) {
        buttons3dContainer.classList.add("hidden");
        is3DControlsVisible = false;
      }
    } else {
      // Se os controles já estão ocultos e clicou novamente, desativar o modo 3D
      toggleMode3D();
      button.classList.remove("active");

      // Garantir que os botões de controle 3D estejam ocultos
      if (buttons3dContainer) {
        buttons3dContainer.classList.add("hidden");
        is3DControlsVisible = false;
      }
    }
  }
}

/**
 * Altera a fonte do mapa
 * @param {string} source - ID da fonte (streets, google, nasa)
 */
async function changeMapSource(source) {
  try {
    // Esconder o painel após selecionar
    toggleMapLayersPanel();

    // Mostrar indicador de carregamento
    const loadingIndicator = showLoadingIndicator(
      `Carregando visualização ${source}...`
    );

    // Atualizar estado
    currentSatelliteSource = source;
    isSatelliteActive = source !== "streets";

    // Atualizar botão de camadas
    const layersButton = document.getElementById("toggle-map-layers");
    if (layersButton) {
      layersButton.classList.toggle("active", isSatelliteActive);
    }

    // Aplicar a fonte selecionada com tratamento de erro e timeout
    try {
      await Promise.race([
        applyMapSource(source),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout ao carregar fonte")),
            10000
          )
        ),
      ]);

      console.log(
        `[map-unified-controls] Fonte do mapa alterada para: ${source}`
      );
    } catch (error) {
      console.error("[map-unified-controls] Erro ao carregar fonte:", error);
      // Mostrar notificação de erro
      showNotification(
        "Erro ao carregar visualização. Tente novamente.",
        "error"
      );
    } finally {
      // Esconder indicador de carregamento
      hideLoadingIndicator(loadingIndicator);
    }
  } catch (error) {
    console.error(
      "[map-unified-controls] Erro ao alterar fonte do mapa:",
      error
    );
  }
}

/**
 * Aplica a fonte do mapa selecionada
 * @param {string} source - ID da fonte
 * @returns {Promise<void>}
 */
function applyMapSource(source) {
  return new Promise((resolve, reject) => {
    try {
      if (is3DEnabled) {
        // Modo 3D - usar API do Mapbox
        if (source === "nasa") {
          // Para NASA, usar função específica
          import("./map-3d/satelite-controls/satellite-imagery-enhancer.js")
            .then((module) => {
              if (typeof module.initNasaGibsMap === "function") {
                module.initNasaGibsMap().then(resolve).catch(reject);
              } else {
                setSatelliteSource(source).then(resolve).catch(reject);
              }
            })
            .catch(reject);
        } else {
          setSatelliteSource(source).then(resolve).catch(reject);
        }
      } else {
        // Modo 2D - usar Leaflet
        const leafletMap = getMapInstance() || window.map;
        if (!leafletMap) {
          return reject(new Error("Mapa Leaflet não encontrado"));
        }

        // Remover camadas existentes
        leafletMap.eachLayer((layer) => {
          if (layer instanceof L.TileLayer) {
            leafletMap.removeLayer(layer);
          }
        });

        // Adicionar camada apropriada
        if (source === "streets") {
          // Mapa padrão OpenStreetMap
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(leafletMap);
        } else if (source === "google") {
          // Satélite Google (ESRI)
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { attribution: "&copy; ESRI" }
          ).addTo(leafletMap);
        } else if (source === "nasa") {
          // Para NASA em 2D, podemos usar o GIBS NASA
          L.tileLayer(
            "https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{time}/250m/{z}/{y}/{x}.jpg",
            {
              attribution:
                "&copy; NASA Earth Observing System Data and Information System",
              subdomains: ["a", "b", "c"],
              time: getTodayDateString(),
              maxZoom: 8,
            }
          ).addTo(leafletMap);
        }

        // Resolver a Promise após um pequeno delay para garantir que os ladrilhos comecem a carregar
        setTimeout(resolve, 300);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Mostra indicador de carregamento
 * @param {string} message - Mensagem a exibir
 * @returns {HTMLElement} - Elemento do indicador
 */
function showLoadingIndicator(message) {
  const indicator = document.createElement("div");
  indicator.className = "map-loading-indicator";
  indicator.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${message}</div>
  `;

  // Aplicar estilos
  Object.assign(indicator.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0, 0, 0, 0.7)",
    color: "white",
    padding: "15px 20px",
    borderRadius: "8px",
    zIndex: "9999",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });

  // Adicionar ao DOM
  document.body.appendChild(indicator);
  return indicator;
}

/**
 * Esconde indicador de carregamento
 * @param {HTMLElement} indicator - Elemento do indicador
 */
function hideLoadingIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    // Fade out
    indicator.style.opacity = "0";
    indicator.style.transition = "opacity 0.3s";

    // Remover após transição
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }
}

/**
 * Mostra uma notificação na interface
 * @param {string} message - Mensagem
 * @param {string} type - Tipo de notificação (success, error, warning)
 */
function showNotification(message, type = "info") {
  // Verificar se já existe uma função global
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }

  // Criar elemento de notificação
  const notification = document.createElement("div");
  notification.className = `map-notification ${type}`;
  notification.textContent = message;

  // Aplicar estilos
  Object.assign(notification.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background:
      type === "error"
        ? "#f44336"
        : type === "success"
        ? "#4caf50"
        : type === "warning"
        ? "#ff9800"
        : "#2196f3",
    color: "white",
    padding: "10px 20px",
    borderRadius: "4px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.3s",
  });

  // Adicionar ao DOM
  document.body.appendChild(notification);

  // Animar entrada
  setTimeout(() => {
    notification.style.opacity = "1";
  }, 10);

  // Remover após alguns segundos
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

/**
 * Obtém a data atual no formato YYYY-MM-DD para uso com APIs da NASA
 * @returns {string} - Data formatada
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Alterna entre o modo 2D e 3D
 */
async function toggleMode3D() {
  const button = document.getElementById("toggle-3d-mode");

  if (is3DEnabled) {
    // Desativar modo 3D
    try {
      await disable3DMode();
      is3DEnabled = false;
      button.classList.remove("active");
      console.log("[map-unified-controls] Modo 3D desativado");

      // Restaurar marcadores e rotas no mapa 2D
      restoreMarkersAndRoutes();

      // Importante: Sincronizar referências de mapa após desativar 3D
      const leafletMap = getMapInstance() || window.map;
      if (leafletMap) {
        window.map = leafletMap;
        import("./map-mode-adapter.js")
          .then((module) => {
            if (typeof module.syncMapReferences === "function") {
              module.syncMapReferences(leafletMap);
            }
          })
          .catch((err) =>
            console.error("[toggleMode3D] Erro ao importar adaptador:", err)
          );
      }

      // Ocultar botões de controle 3D
      const mode3DButtons = document.getElementById("mode-3d-buttons");
      if (mode3DButtons) {
        mode3DButtons.classList.add("hidden");
        is3DControlsVisible = false;
      }
    } catch (error) {
      console.error("[map-unified-controls] Erro ao desativar modo 3D:", error);
    }
  } else {
    // Ativar modo 3D
    try {
      // Obter estado atual do mapa (marcadores, rotas, etc)
      const mapState = captureCurrentMapState();

      // Ativar modo 3D
      await enable3DMode();
      is3DEnabled = true;
      button.classList.add("active");
      console.log("[map-unified-controls] Modo 3D ativado");

      // Transferir marcadores e rotas para o mapa 3D
      transferMarkersAndRoutesTo3D(mapState);

      // Importante: Sincronizar referências de mapa após ativar 3D
      const mapbox3D = getMapbox3DInstance();
      if (mapbox3D) {
        import("./map-mode-adapter.js")
          .then((module) => {
            if (typeof module.syncMapReferences === "function") {
              module.syncMapReferences(mapbox3D);
            }
          })
          .catch((err) =>
            console.error("[toggleMode3D] Erro ao importar adaptador:", err)
          );
      }
    } catch (error) {
      console.error("[map-unified-controls] Erro ao ativar modo 3D:", error);
    }
  }
}

/**
 * Captura o estado atual do mapa 2D (marcadores, rotas, etc)
 * @returns {Object} Estado do mapa
 */
function captureCurrentMapState() {
  const leafletMap = getMapInstance() || window.map;
  if (!leafletMap) return {};

  // Capturar centro e zoom
  const center = leafletMap.getCenter();
  const zoom = leafletMap.getZoom();

  // Capturar marcadores
  const currentMarkers = [];
  leafletMap.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      const position = layer.getLatLng();
      const popup = layer._popup ? layer._popup.getContent() : null;
      const options = layer.options || {};

      currentMarkers.push({
        lat: position.lat,
        lng: position.lng,
        popup: popup,
        options: options,
      });
    }
  });

  // Capturar rotas
  const currentRoutes = [];
  leafletMap.eachLayer((layer) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const latlngs = layer.getLatLngs();
      const options = layer.options || {};

      // Converter para formato simples
      const routePoints = latlngs.map((latlng) => ({
        lat: latlng.lat,
        lng: latlng.lng,
      }));

      currentRoutes.push({
        points: routePoints,
        options: options,
      });
    }
  });

  return {
    center: { lat: center.lat, lng: center.lng },
    zoom: zoom,
    markers: currentMarkers,
    routes: currentRoutes,
  };
}

/**
 * Transfere marcadores e rotas do mapa 2D para o mapa 3D
 * @param {Object} mapState - Estado do mapa 2D
 */
function transferMarkersAndRoutesTo3D(mapState) {
  if (!is3DModeActive() || !mapState) return;

  const mapbox3D = getMapbox3DInstance();
  if (!mapbox3D) return;

  try {
    // Limpar marcadores existentes no mapa 3D
    clearMarkers3D();

    // Adicionar marcadores ao mapa 3D
    mapState.markers.forEach((marker) => {
      addMarker3D(marker.lat, marker.lng, {
        popupContent: marker.popup,
        className: marker.options.className,
        title: marker.options.title,
      });
    });

    // Adicionar rotas ao mapa 3D
    mapState.routes.forEach((route) => {
      // Converter para formato esperado pelo mapa 3D
      const coordinates = route.points.map((point) => [point.lng, point.lat]);

      updateRouteIn3D(coordinates, {
        routeColor: route.options.color || "#3b82f6",
        routeWidth: route.options.weight || 5,
        routeOpacity: route.options.opacity || 0.8,
      });
    });

    console.log(
      "[map-unified-controls] Marcadores e rotas transferidos para o mapa 3D"
    );
  } catch (error) {
    console.error(
      "[map-unified-controls] Erro ao transferir marcadores e rotas para 3D:",
      error
    );
  }
}

/**
 * Restaura marcadores e rotas do mapa 3D para o mapa 2D
 */
function restoreMarkersAndRoutes() {
  console.log(
    "[map-unified-controls] Restaurando marcadores e rotas para o mapa 2D"
  );

  // Garantir que temos uma instância válida do mapa
  const leafletMap = getMapInstance() || window.map;
  if (!leafletMap) {
    console.error(
      "[map-unified-controls] Não foi possível obter instância do mapa para restauração"
    );
    return;
  }

  // Importante: Atualizar a referência global para o mapa
  window.map = leafletMap;

  // Carregar módulos necessários para trabalhar com o mapa 2D
  Promise.all([import("./map-markers.js"), import("./map-init.js")])
    .then(([markersModule, initModule]) => {
      // Verificar se temos funções necessárias
      if (
        typeof markersModule.clearMarkers === "function" &&
        typeof markersModule.showAllLocationsOnMap === "function"
      ) {
        try {
          // Limpar marcadores existentes no mapa 2D
          markersModule.clearMarkers();

          // Recuperar dados de localização (isso depende da estrutura do seu aplicativo)
          import("../locations/locations.js")
            .then((locationsModule) => {
              if (locationsModule.getAllLocations) {
                const locations = locationsModule.getAllLocations();

                // Adicionar pequeno atraso para garantir que o mapa 2D esteja pronto
                setTimeout(() => {
                  try {
                    markersModule.showAllLocationsOnMap(locations);
                    console.log(
                      "[map-unified-controls] Marcadores restaurados com sucesso no mapa 2D"
                    );
                  } catch (error) {
                    console.error(
                      "[map-unified-controls] Erro ao mostrar localizações:",
                      error
                    );
                  }
                }, 100);
              }
            })
            .catch((err) => {
              console.warn(
                "[map-unified-controls] Não foi possível carregar localizações:",
                err
              );
            });
        } catch (error) {
          console.error(
            "[map-unified-controls] Erro ao limpar marcadores:",
            error
          );
        }
      }
    })
    .catch((err) => {
      console.error(
        "[map-unified-controls] Erro ao importar módulos para restauração:",
        err
      );
    });
}

/**
 * Alterna a visualização de satélite (função mantida para compatibilidade)
 */
function toggleSatelliteView() {
  const button = document.getElementById("toggle-satellite");

  if (isSatelliteActive) {
    // Desativar visualização de satélite
    changeMapSource("streets");
  } else {
    // Ativar visualização de satélite
    // Abrir o painel de camadas
    toggleMapLayersPanel();
  }
}

/**
 * Localiza o usuário no mapa
 */
function locateUser() {
  const buttonLocation = document.getElementById("locate-user");
  buttonLocation.classList.add("active");

  // Exibir indicador de carregamento
  buttonLocation.innerHTML = `
    <div class="location-spinner"></div>
  `;

  if (is3DEnabled) {
    // Modo 3D - usar API do browser e mover o mapa 3D
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Adicionar marcador e mover o mapa
        flyToLocation(latitude, longitude, {
          zoom: 16,
          pitch: 60,
          bearing: 0,
          duration: 2000,
        });

        // Adicionar marcador se necessário
        addMarker3D(latitude, longitude, {
          title: "Sua localização",
          popupContent: "<h3>Sua localização</h3>",
          className: "user-location-marker",
          isUserMarker: true,
        });

        // Restaurar botão
        restoreLocationButton(buttonLocation);
      },
      (error) => {
        console.error(
          "[map-unified-controls] Erro ao obter localização:",
          error
        );
        restoreLocationButton(buttonLocation);
        showLocationError();
      }
    );
  } else {
    // Modo 2D - usar API do Leaflet para localização
    const leafletMap = getMapInstance() || window.map;
    if (leafletMap) {
      import("./map-controls.js")
        .then((module) => {
          if (typeof module.setupGeolocation === "function") {
            module.setupGeolocation(leafletMap);
            setTimeout(() => restoreLocationButton(buttonLocation), 2000);
          } else if (typeof module.requestAndTrackUserLocation === "function") {
            module.requestAndTrackUserLocation(
              () => restoreLocationButton(buttonLocation),
              () => {
                restoreLocationButton(buttonLocation);
                showLocationError();
              }
            );
          } else {
            // Fallback usando API do navegador
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;

                // Mover mapa e adicionar marcador
                leafletMap.setView([latitude, longitude], 16);

                // Adicionar marcador
                L.marker([latitude, longitude], {
                  title: "Sua localização",
                  icon: L.divIcon({
                    html: `<i class="fas fa-dot-circle" style="color: #3b82f6; font-size: 24px;"></i>`,
                    className: "user-location-marker",
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                  }),
                })
                  .addTo(leafletMap)
                  .bindPopup("<h3>Sua localização</h3>")
                  .openPopup();

                restoreLocationButton(buttonLocation);
              },
              (error) => {
                console.error(
                  "[map-unified-controls] Erro ao obter localização:",
                  error
                );
                restoreLocationButton(buttonLocation);
                showLocationError();
              }
            );
          }
        })
        .catch((err) => {
          console.error(
            "[map-unified-controls] Erro ao importar módulo de controles:",
            err
          );
          restoreLocationButton(buttonLocation);
        });
    }
  }
}

/**
 * Restaura o botão de localização ao estado original
 * @param {HTMLElement} button - Botão de localização
 */
function restoreLocationButton(button) {
  setTimeout(() => {
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span class="control-tooltip">Minha Localização</span>
    `;
    button.classList.remove("active");
  }, 1000);
}

/**
 * Mostra erro ao obter localização
 */
function showLocationError() {
  alert(
    "Não foi possível obter sua localização. Verifique se você permitiu o acesso à localização no navegador."
  );
}

/**
 * Reseta a visualização do mapa para o estado inicial
 */
function resetMapView() {
  if (is3DEnabled) {
    // Resetar mapa 3D
    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      mapbox3D.flyTo({
        center: [-38.9159969, -13.3775457],
        zoom: 15,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    }
  } else {
    // Resetar mapa 2D
    const leafletMap = getMapInstance() || window.map;
    if (leafletMap) {
      leafletMap.setView([-13.3775457, -38.9159969], 15, { animate: true });
    }
  }

  console.log("[map-unified-controls] Visualização do mapa resetada");
}

// Exportar funções públicas
export { toggleMode3D, toggleSatelliteView, locateUser, resetMapView };
