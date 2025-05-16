/**
 * Controles para o aprimoramento de imagens de satélite
 * Adiciona uma interface de usuário para ajustar configurações de satélite
 */
import { mapbox3dInstance } from "../map-3d.js";
import * as satelliteEnhancer from "./satellite-imagery-enhancer.js";
import {
  addLoadingIndicator,
  removeLoadingIndicator,
} from "../../../utils/loadingIndicator.js";

// Estado do módulo
let controlContainer = null;
let controlsVisible = false;
let activeSource = "streets";
let activeResolution = "auto";
let isHighResActive = false;

// Definições de fontes de satélite disponíveis
const SATELLITE_SOURCES = [
  { id: "streets", name: "Ruas", description: "Satélite com nomes de ruas" },
  { id: "hd", name: "HD", description: "Alta definição (quando disponível)" },
  {
    id: "google",
    name: "Satélite",
    description: "Imagens do Google (experimental)",
  },
  {
    id: "esri",
    name: "ESRI",
    description: "ESRI World Imagery (experimental)",
  },
  {
    id: "nasa",
    name: "NASA (Super-Resolução)",
    description: "Imagens NASA GIBS com super-resolução ESRGAN",
  },
];

/**
 * Inicializa os controles de satélite
 * @param {Object} options - Opções de inicialização
 * @returns {boolean} Sucesso da inicialização
 */
export function initSatelliteControls(options = {}) {
  const {
    initialSource = "streets",
    addControlButton = false,
    autoInitEnhancer = true,
    // Nova opção para limitar fontes
    sources = ["streets", "google"],
  } = options;

  try {
    // Inicializar o enhancer primeiro
    if (autoInitEnhancer) {
      satelliteEnhancer.initSatelliteEnhancer();
    }

    if (addControlButton) {
      addSatelliteControlButton();
    }

    // Definir fonte inicial
    satelliteEnhancer.setSatelliteSource(initialSource);

    // Armazenar fontes permitidas para uso posterior
    window.allowedSatelliteSources = sources;

    console.log("[satellite-controls] Controles de satélite inicializados");
    return true;
  } catch (error) {
    console.error("[satellite-controls] Erro ao inicializar controles:", error);
    return false;
  }
}

/**
 * Adiciona botão de controle de satélite ao mapa 3D
 * @returns {boolean} Sucesso da operação
 */
export function addSatelliteControlButton() {
  try {
    if (!mapbox3dInstance) {
      console.warn("[satellite-controls] Mapa não inicializado");
      return false;
    }

    // Verificar se os controles 3D já estão prontos
    const controls3dContainer = document.querySelector(
      ".mapboxgl-ctrl-top-right"
    );
    if (!controls3dContainer) {
      console.warn(
        "[satellite-controls] Container de controles 3D não encontrado"
      );

      // Tentar novamente após um intervalo
      setTimeout(() => addSatelliteControlButton(), 1000);
      return false;
    }

    // Verificar se o botão já existe
    if (document.querySelector(".satellite-controls-button")) {
      return true;
    }

    // Criar container para o botão
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "mapboxgl-ctrl mapboxgl-ctrl-group";

    // Criar botão
    const satelliteButton = document.createElement("button");
    satelliteButton.className = "mapboxgl-ctrl-icon satellite-controls-button";
    satelliteButton.type = "button";
    satelliteButton.setAttribute("aria-label", "Controles de Satélite");
    satelliteButton.title = "Controles de Satélite";

    // Icone do botão
    satelliteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.6,10.5c0,0,1.5-5.4,9-5.4s9,5.4,9,5.4"></path>
        <path d="M13.5,6.8c0,0,0.5-2.7,4.5-2.7s4.5,2.7,4.5,2.7"></path>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <path d="M3.6,13.5c0,0,1.5,5.4,9,5.4s9-5.4,9-5.4"></path>
        <path d="M13.5,17.2c0,0,0.5,2.7,4.5,2.7s4.5-2.7,4.5-2.7"></path>
      </svg>
    `;

    // Adicionar evento de clique
    satelliteButton.addEventListener("click", toggleSatelliteControlPanel);

    // Adicionar à UI
    buttonContainer.appendChild(satelliteButton);
    controls3dContainer.appendChild(buttonContainer);

    // Criar painel de controle (inicialmente oculto)
    createControlPanel();

    return true;
  } catch (error) {
    console.error(
      "[satellite-controls] Erro ao adicionar botão de controle:",
      error
    );
    return false;
  }
}

/**
 * Cria o painel de controle de satélite
 */
function createControlPanel() {
  // Remover painel anterior se existir
  const existingPanel = document.getElementById("satellite-control-panel");
  if (existingPanel) {
    existingPanel.parentNode.removeChild(existingPanel);
  }

  // Criar novo painel
  const panel = document.createElement("div");
  panel.id = "satellite-control-panel";
  panel.className = "satellite-control-panel";
  panel.style.display = "none"; // Inicialmente oculto

  // Cabeçalho
  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <h3>Controles de Imagens de Satélite</h3>
    <button class="close-button" aria-label="Fechar painel">&times;</button>
  `;
  header
    .querySelector(".close-button")
    .addEventListener("click", toggleSatelliteControlPanel);
  panel.appendChild(header);

  // Selecionar fonte
  const sourceContainer = document.createElement("div");
  sourceContainer.className = "control-section";
  sourceContainer.innerHTML = `
    <h4>Fonte de imagens</h4>
    <div class="source-buttons"></div>
  `;

  const sourceButtons = sourceContainer.querySelector(".source-buttons");
  // Verificar quais fontes estão permitidas
  const allowedSources = window.allowedSatelliteSources || [
    "streets",
    "google",
  ];

  // Adicionar botões apenas para as fontes permitidas
  SATELLITE_SOURCES.forEach((source) => {
    if (allowedSources.includes(source.id) || source.id === "nasa") {
      const button = document.createElement("button");
      button.className = `source-button ${
        source.id === activeSource ? "active" : ""
      }`;
      button.dataset.source = source.id;
      button.setAttribute("aria-label", source.name);
      button.title = source.description;
      button.textContent = source.name;
      if (source.id === "nasa") {
        button.addEventListener("click", () => {
          satelliteEnhancer.initNasaGibsMap();

          // Fecha o painel após ativar o modo NASA
          if (controlContainer) controlContainer.style.display = "none";
          controlsVisible = false;
        });
      } else {
        button.addEventListener("click", () => {
          changeSatelliteSource(source.id);
        });
      }
      sourceButtons.appendChild(button);
    }
  });

  panel.appendChild(sourceContainer);

  // Controles de melhoria
  const enhancementContainer = document.createElement("div");
  enhancementContainer.className = "control-section";
  enhancementContainer.innerHTML = `
    <h4>Ajustes de imagem</h4>
    <div class="slider-control">
      <label for="brightness-slider">Brilho</label>
      <input type="range" id="brightness-slider" min="-0.5" max="0.5" step="0.05" value="0">
      <span class="slider-value">0</span>
    </div>
    <div class="slider-control">
      <label for="contrast-slider">Contraste</label>
      <input type="range" id="contrast-slider" min="-0.5" max="0.5" step="0.05" value="0">
      <span class="slider-value">0</span>
    </div>
    <div class="slider-control">
      <label for="saturation-slider">Saturação</label>
      <input type="range" id="saturation-slider" min="-0.5" max="0.5" step="0.05" value="0">
      <span class="slider-value">0</span>
    </div>
    <div class="slider-control">
      <label for="gamma-slider">Gamma</label>
      <input type="range" id="gamma-slider" min="0.8" max="1.2" step="0.05" value="1">
      <span class="slider-value">1</span>
    </div>
    <div class="control-buttons">
      <button id="apply-enhancements-button">Aplicar melhorias</button>
      <button id="reset-enhancements-button">Resetar</button>
    </div>
  `;

  // Configurar eventos dos sliders
  enhancementContainer
    .querySelectorAll('input[type="range"]')
    .forEach((slider) => {
      const valueDisplay = slider.nextElementSibling;
      slider.addEventListener("input", () => {
        valueDisplay.textContent = slider.value;
      });
    });

  // Botões de controle
  enhancementContainer
    .querySelector("#apply-enhancements-button")
    .addEventListener("click", () => {
      const brightness = parseFloat(
        document.getElementById("brightness-slider").value
      );
      const contrast = parseFloat(
        document.getElementById("contrast-slider").value
      );
      const saturation = parseFloat(
        document.getElementById("saturation-slider").value
      );
      const gamma = parseFloat(document.getElementById("gamma-slider").value);

      satelliteEnhancer.configureEnhancements({
        brightness,
        contrast,
        saturation,
        gamma,
      });
      satelliteEnhancer.applyEnhancements();
    });

  enhancementContainer
    .querySelector("#reset-enhancements-button")
    .addEventListener("click", () => {
      // Resetar controles
      document.getElementById("brightness-slider").value = 0;
      document.getElementById("contrast-slider").value = 0;
      document.getElementById("saturation-slider").value = 0;
      document.getElementById("gamma-slider").value = 1;

      // Atualizar valores exibidos
      enhancementContainer
        .querySelectorAll(".slider-value")
        .forEach((valueDisplay, index) => {
          valueDisplay.textContent = index < 3 ? "0" : "1";
        });

      // Remover melhorias
      satelliteEnhancer.removeEnhancements();
    });
  panel.appendChild(enhancementContainer);

  // Rodapé com créditos
  const footer = document.createElement("div");
  footer.className = "panel-footer";
  footer.innerHTML = `
    <p>Imagens de satélite fornecidas por Google e NASA.</p>
    <button id="clear-cache-button">Limpar cache</button>
  `;

  footer.querySelector("#clear-cache-button").addEventListener("click", () => {
    satelliteEnhancer.clearSatelliteCache();
    alert("Cache de imagens de satélite limpo com sucesso!");
  });

  panel.appendChild(footer);

  // Adicionar estilos
  addSatelliteControlStyles();

  // Adicionar ao DOM
  document.body.appendChild(panel);
  controlContainer = panel;

  return panel;
}

/**
 * Adiciona estilos CSS para controles de satélite
 */
function addSatelliteControlStyles() {
  if (document.getElementById("satellite-control-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "satellite-control-styles";
  style.textContent = `
    .satellite-controls-button svg {
      width: 24px;
      height: 24px;
      stroke: #333;
    }
    
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
    
    .control-section h4 {
      margin: 0 0 10px;
      font-size: 14px;
    }
    
    .source-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    
    .source-button {
      padding: 8px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .source-button:hover {
      background: #e5e5e5;
    }
    
    .source-button.active {
      background: #0078ff;
      color: white;
      border-color: #0055cc;
    }
    
    .slider-control {
      margin-bottom: 12px;
      display: grid;
      grid-template-columns: 1fr 3fr 40px;
      align-items: center;
      gap: 10px;
    }
    
    .slider-control label {
      font-size: 13px;
    }
    
    .slider-control input[type="range"] {
      width: 100%;
    }
    
    .slider-value {
      text-align: right;
      font-size: 13px;
    }
    
    .control-buttons {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    .control-buttons button {
      flex: 1;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #ccc;
      background: #f5f5f5;
      transition: all 0.2s;
    }
    
    .control-buttons button:hover {
      background: #e5e5e5;
    }
    
    #apply-enhancements-button {
      background: #0078ff;
      color: white;
      border-color: #0055cc;
    }
    
    #apply-enhancements-button:hover {
      background: #0066dd;
    }
    
    .resolution-options {
      display: flex;
      gap: 8px;
      margin-bottom: 15px;
    }
    
    .resolution-button {
      flex: 1;
      padding: 8px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .resolution-button:hover {
      background: #e5e5e5;
    }
    
    .resolution-button.active {
      background: #0078ff;
      color: white;
      border-color: #0055cc;
    }
    
    .resolution-actions {
      display: flex;
      gap: 10px;
    }
    
    .resolution-actions button {
      flex: 1;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #ccc;
      background: #f5f5f5;
      transition: all 0.2s;
    }
    
    .resolution-actions button:hover:not([disabled]) {
      background: #e5e5e5;
    }
    
    .resolution-actions button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .primary-button {
      background: #0078ff !important;
      color: white;
      border-color: #0055cc !important;
    }
    
    .primary-button:hover {
      background: #0066dd !important;
    }
    
    .panel-footer {
      padding: 10px 15px;
      font-size: 12px;
      color: #777;
    }
    
    .panel-footer p {
      margin: 0 0 10px;
    }
    
    #clear-cache-button {
      padding: 6px 10px;
      font-size: 12px;
      background: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
    }
    
    #clear-cache-button:hover {
      background: #e5e5e5;
    }
    
    /* Adaptações para dispositivos móveis */
    @media (max-width: 768px) {
      .satellite-control-panel {
        width: calc(100% - 20px);
        max-width: 400px;
        left: 10px;
        right: 10px;
        margin: 0 auto;
      }
    }
  `;

  document.head.appendChild(style);
}

// Na função toggleSatelliteControlPanel
export function toggleSatelliteControlPanel() {
  if (!controlContainer) {
    controlContainer = createControlPanel();
  }

  controlsVisible = !controlsVisible;
  controlContainer.style.display = controlsVisible ? "block" : "none";

  // Atualizar classe do botão (procura em vários seletores possíveis)
  const button =
    document.querySelector(".satellite-imagery-control") ||
    document.querySelector(".satellite-controls-button") ||
    document.querySelector(".map-layers-control");

  if (button) {
    button.classList.toggle("active", controlsVisible);
    console.log(
      "[toggleSatelliteControlPanel] Botão encontrado e atualizado:",
      button
    );
  } else {
    console.warn("[toggleSatelliteControlPanel] Botão não encontrado");
  }
}

/**
 * Muda a fonte de imagens de satélite
 * @param {string} sourceId - ID da fonte
 */
async function changeSatelliteSource(sourceId) {
  try {
    const loader = addLoadingIndicator(`Carregando imagens de satélite...`);

    // Atualizar botões
    const buttons = document.querySelectorAll(".source-button");
    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.source === sourceId);
    });

    // Atualizar fonte ativa
    activeSource = sourceId;

    // Remover overlay de alta resolução se ativo
    if (isHighResActive) {
      satelliteEnhancer.removeHighResolutionOverlay();
      isHighResActive = false;
      document.getElementById("remove-overlay-button").disabled = true;
      document.getElementById("enhance-button").textContent =
        "Melhorar resolução";
    }

    // Aplicar nova fonte
    await satelliteEnhancer.setSatelliteSource(sourceId);

    removeLoadingIndicator(loader);
  } catch (error) {
    console.error("[satellite-controls] Erro ao alterar fonte:", error);
    removeLoadingIndicator(loader);
  }
}

// Exportar como módulo único
export default {
  initSatelliteControls,
  addSatelliteControlButton,
  toggleSatelliteControlPanel,
};
