/**
 * Demonstração da integração Mapbox-OSM para mapas 3D
 * Versão simplificada e corrigida
 */

import {
  initMapboxOSM,
  toggleMap3D,
  addOSMPoints,
  changeMapStyle,
  flyToLocation,
} from "./mapbox-osm-integration.js";

// Referência ao mapa
let map3d = null;
let isInitialized = false;

// Coordenadas de Morro de São Paulo
const MORRO_COORDS = {
  lat: -13.3775457,
  lng: -38.9159969,
};

/**
 * Inicializa o demo do mapa 3D OSM
 */
export async function initEnhanced3DMapDemo() {
  console.log("[demo-3d] Iniciando demonstração de mapa 3D aprimorado");

  if (isInitialized) {
    console.log("[demo-3d] Demo já inicializado, apenas ativando visualização");
    toggleMap3D(true);
    return true;
  }

  try {
    // Mostrar indicador de carregamento
    showLoadingIndicator();

    // Inicializar o mapa
    map3d = await initMapboxOSM({
      center: [MORRO_COORDS.lng, MORRO_COORDS.lat],
      zoom: 15,
      pitch: 45,
      bearing: 0,
      includeBuildings: true,
      includeTerreno: true,
    });

    if (!map3d) {
      console.error("[demo-3d] Falha ao inicializar mapa 3D");
      hideLoadingIndicator();
      return false;
    }

    // Esperar o mapa carregar
    map3d.on("load", async () => {
      console.log("[demo-3d] Mapa 3D carregado com sucesso");

      // Adicionar POIs do OSM
      await addOSMPoints();

      // Adicionar controles personalizados
      addCustomControls(map3d);

      // Marcar como inicializado
      isInitialized = true;

      // Ocultar indicador de carregamento
      hideLoadingIndicator();

      // Mostrar o mapa
      toggleMap3D(true);

      // Animar para visão inicial
      setTimeout(() => {
        flyToLocation(MORRO_COORDS.lat, MORRO_COORDS.lng, {
          zoom: 16,
          pitch: 60,
          bearing: -15,
        });
      }, 500);
    });

    return true;
  } catch (error) {
    console.error("[demo-3d] Erro ao inicializar demo:", error);
    hideLoadingIndicator();
    return false;
  }
}

/**
 * Adiciona controles personalizados ao mapa
 * @param {Object} map - Instância do mapa
 */
function addCustomControls(map) {
  // Criar container para controles se não existir
  let controlsContainer = document.querySelector(".mapbox-3d-controls");
  if (!controlsContainer) {
    controlsContainer = document.createElement("div");
    controlsContainer.className = "mapbox-3d-controls";
    document.getElementById("map-container").appendChild(controlsContainer);
  }

  // Botão para visualização de satélite
  addControlButton(controlsContainer, {
    icon: "🛰️",
    label: "Visualização de Satélite",
    onClick: () => changeMapStyle("satellite"),
    id: "satellite-view",
  });

  // Botão para visualização noturna
  addControlButton(controlsContainer, {
    icon: "🌃",
    label: "Modo Noturno",
    onClick: () => changeMapStyle("dark"),
    id: "night-view",
  });

  // Botão para visualização padrão
  addControlButton(controlsContainer, {
    icon: "🏙️",
    label: "Visualização Padrão",
    onClick: () => changeMapStyle("streets"),
    id: "streets-view",
    isActive: true,
  });

  // Botão para carregar POIs
  addControlButton(controlsContainer, {
    icon: "📍",
    label: "Carregar Pontos de Interesse",
    onClick: () => {
      showLoadingIndicator();
      addOSMPoints().then(() => {
        hideLoadingIndicator();
      });
    },
    id: "load-pois",
  });

  // Botão para sair do modo 3D
  addControlButton(controlsContainer, {
    icon: "❌",
    label: "Sair do Modo 3D",
    onClick: () => {
      toggleMap3D(false);

      // Tentar reativar o mapa Leaflet original
      const event = new CustomEvent("mapbox3d:disabled");
      document.dispatchEvent(event);
    },
    id: "exit-3d",
  });
}

/**
 * Adiciona um botão de controle
 * @param {HTMLElement} container - Container para o botão
 * @param {Object} options - Opções do botão
 */
function addControlButton(container, options) {
  const { icon, label, onClick, id, isActive = false } = options;

  // Verificar se o botão já existe
  let button = document.getElementById(id);
  if (!button) {
    button = document.createElement("button");
    button.id = id;
    button.className = "mapbox-3d-control-button";
    if (isActive) {
      button.className += " active";
    }
    button.innerHTML = icon;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    container.appendChild(button);
  }

  return button;
}

// Criar e gerenciar indicador de carregamento
let loadingIndicator = null;

function showLoadingIndicator() {
  if (loadingIndicator) return;

  loadingIndicator = document.createElement("div");
  loadingIndicator.className = "mapbox-loading-indicator";

  const spinner = document.createElement("div");
  spinner.className = "mapbox-loading-spinner";
  loadingIndicator.appendChild(spinner);

  const text = document.createElement("span");
  text.textContent = "Carregando mapa 3D...";
  loadingIndicator.appendChild(text);

  document.getElementById("map-container").appendChild(loadingIndicator);
}

function hideLoadingIndicator() {
  if (!loadingIndicator) return;

  loadingIndicator.remove();
  loadingIndicator = null;
}

// Adicionar estilos CSS necessários
function addRequiredStyles() {
  const styleId = "mapbox-osm-styles";

  // Verificar se os estilos já foram adicionados
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #mapbox-3d-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 399;
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      background-color: transparent;
    }
    
    .mapbox-3d-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 400;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .mapbox-3d-control-button {
      background: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      width: 32px;
      height: 32px;
      box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .mapbox-3d-control-button:hover {
      background: #f0f0f0;
    }
    
    .mapbox-3d-control-button.active {
      background: #3B82F6;
      color: white;
    }
    
    .mapbox-loading-indicator {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.8);
      padding: 10px 20px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 500;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .mapbox-loading-spinner {
      width: 16px;
      height: 16px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3B82F6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(style);
}

// Adicionar estilos necessários
addRequiredStyles();

// Auto-inicializar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  // Adicionar botão para ativar o modo 3D
  const mapContainer = document.getElementById("map-container");
  if (mapContainer) {
    const activate3DButton = document.createElement("button");
    activate3DButton.id = "activate-3d";
    activate3DButton.className = "map-control-button";
    activate3DButton.innerHTML = "3D";
    activate3DButton.title = "Ativar Modo 3D";
    activate3DButton.style.position = "absolute";
    activate3DButton.style.bottom = "10px";
    activate3DButton.style.left = "10px";
    activate3DButton.style.zIndex = "300";
    activate3DButton.addEventListener("click", initEnhanced3DMapDemo);
    mapContainer.appendChild(activate3DButton);
  }
});

// Expor para uso no botão 3D existente
window.initEnhanced3DMapDemo = initEnhanced3DMapDemo;
