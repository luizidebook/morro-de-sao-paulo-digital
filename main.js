// main.js - Arquivo principal de inicialização do site Morro Digital

// Importações de módulos
import { initializeMap } from "./js/map/map-controls.js";
import { initializeAssistant } from "./js/assistant/assistant.js";
import { translatePageContent } from "./js/i18n/translatePageContent.js";
import {
  setupAssistantInteractions,
  createAssistantUI,
} from "./js/assistant/assistant-ui/interface.js";
import { processUserInput } from "./js/assistant/assistant-dialog/dialog.js";
import { appendMessage } from "./js/assistant/assistant.js";
import { showWeatherWidget } from "./js/utils/weather-info.js";
import { setupQuickActionButtonsEvents } from "./js/utils/quick-actions.js";
import { assistantMood } from "./js/assistant/assistant-mood/assistantMood.js";
import { setupNavigationUIObserver } from "./js/utils/ui-position.js";
import initMessagesPositionManager from "./js/utils/messages-position-manager.js";
// Adicionar ao arquivo principal de mapas ou ao script de inicialização

// Importar os módulos 3D
import { initMap3DControls } from "./js/map/map-controls-3d.js";
import { loadMapboxGLScript } from "./js/map/map-3d.js";

// Add this import near the other imports

function initApp() {
  console.log("[Morro Digital] Sistema iniciando...");

  // Ensure the loading overlay is visible with correct text
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    const loadingText = loadingOverlay.querySelector(".loading-text");
    if (loadingText) {
      loadingText.textContent = "Carregando Morro Digital...";
    }
    loadingOverlay.classList.remove("fade-out");
  }

  // First call autoInit3DMode to start loading the map while we set up other things
  autoInit3DMode();

  setLanguage();

  // Configurar observador de UI para navegação
  setupNavigationUIObserver();

  // Monitorar eventos de minimização/maximização do banner para sincronizar UI
  document.addEventListener("banner:minimizing", (e) => {
    const { banner } = e.detail;
    import("./js/utils/ui-position.js").then((module) => {
      module.syncUIWithBannerTransition(banner, true);
    });
  });

  document.addEventListener("banner:maximizing", (e) => {
    const { banner } = e.detail;
    import("./js/utils/ui-position.js").then((module) => {
      module.syncUIWithBannerTransition(banner, false);
    });
  });
  console.log("[initApp] Observador de UI para navegação configurado");

  // Inicializar gerenciador de posicionamento de mensagens
  initMessagesPositionManager();

  createAssistantUI("assistant-messages");
  console.log("[initApp] createAssistantUI executado");

  // Verificar se o botão antigo existe e removê-lo
  const oldVoiceSelector = document.getElementById("assistant-voice-selector");
  if (oldVoiceSelector) {
    oldVoiceSelector.remove();
    console.log("[initApp] Botão de voz antigo removido");
  }

  setupUIElements();
  console.log("[initApp] setupUIElements executado");

  showWeatherWidget();

  // Adicionar após a declaração da função showWeatherWidget
  document.addEventListener("languageChanged", async () => {
    // Atualizar o widget quando o idioma for alterado
    if (typeof updateWidget === "function") {
      await updateWidget();
    }
  });
  initializeAssistant({
    map: map,
    lang: language,
    onReady: () =>
      console.log(`[Assistente] Pronto para interação no idioma: ${language}`),
  });
  console.log("[initApp] initializeAssistant executado");

  setupAssistantInteractions(async (message) => {
    console.log("[setupAssistantInteractions] Mensagem recebida:", message);
    const response = await processUserInput(message);
    if (response.text) {
      console.log("[setupAssistantInteractions] appendMessage:", response.text);
      appendMessage("assistant", response.text);
    }
    if (response.action) {
      console.log("[setupAssistantInteractions] Executando action");
      response.action();
    }
  });

  console.log("[initApp] initPerformanceOptimizations executado");

  // Configurar eventos dos botões de ação rápida
  const quickActions = setupQuickActionButtonsEvents();
  window.quickActions = quickActions; // Exportar para acesso global se necessário

  console.log("[initApp] Eventos dos botões de ação rápida configurados");

  // Inicializar sistema de humor do assistente
  assistantMood.initialize();
  console.log("[initApp] Sistema de humor do assistente inicializado");

  // Escutar por mudanças de idioma para atualizar componentes dinâmicos
  document.addEventListener("languageChanged", function (e) {
    const newLang = e.detail.language;
    console.log(
      `[main.js] Idioma alterado para: ${newLang}, atualizando componentes...`
    );

    // Atualizar elementos dinâmicos que não têm atributos data-i18n
    updateDynamicElements(newLang);
    // Outras inicializações
  });
}

// Replace the existing initializeMap3DControls function

/**
 * Initialize 3D map controls with proper checks
 */
function initializeMap3DControls() {
  // Only try to initialize controls once map is ready
  document.addEventListener(
    "mapbox3d:ready",
    () => {
      import("./js/map/map-controls-3d.js")
        .then((module) => {
          if (typeof module.initMap3DControls === "function") {
            // Get map instance
            const mapbox3d = window.mapbox3dInstance;
            const leafletMap = window.map;

            module.initMap3DControls({
              mapInstance: leafletMap,
              mapbox3dInstance: mapbox3d,
            });
            console.log("[main] 3D controls initialized successfully");

            // Now that everything is ready, hide the loading overlay
            setTimeout(() => {
              if (typeof window.hideLoadingOverlay === "function") {
                window.hideLoadingOverlay();
              } else {
                const loadingOverlay =
                  document.getElementById("loading-overlay");
                if (loadingOverlay) {
                  loadingOverlay.classList.add("fade-out");
                }
              }
            }, 500); // Small delay to ensure map is visible
          }
        })
        .catch((error) => {
          console.error("[main] Error loading 3D controls:", error);
          // Hide loading on error
          if (typeof window.hideLoadingOverlay === "function") {
            window.hideLoadingOverlay();
          }
        });
    },
    { once: true }
  ); // Only run once
}

// Replace the existing autoInit3DMode function
function autoInit3DMode() {
  // Use the existing loading overlay instead of creating a new one
  const loadingOverlay = document.getElementById("loading-overlay");

  // Make sure it's visible but do NOT change the text
  if (loadingOverlay) {
    loadingOverlay.classList.remove("fade-out");
    // Don't modify the loading text - keep "Carregando Morro Digital..."
  }

  // Import the 3D functionality (don't show a new loading indicator)
  import("./js/map/auto-3d.js")
    .then((module) => {
      // Explicitly call the function with false to prevent showing another loading indicator
      if (typeof module.autoEnable3DMode === "function") {
        module.autoEnable3DMode(false);
      }

      // Controls will be initialized via the mapbox3d:ready event
      initializeMap3DControls();
    })
    .catch((error) => {
      console.error("[autoInit3DMode] Error:", error);
      // Hide the loading overlay on error
      if (typeof window.hideLoadingOverlay === "function") {
        window.hideLoadingOverlay();
      }
    });
}

export let userLocation = {};
export let userPopup = null;
export let mapInstance = null;

// Variáveis globais
let language;
let map; // Variável global para o mapa

// Função para detectar o idioma do navegador e definir o idioma da página
function setLanguage() {
  const userLang = navigator.language || navigator.userLanguage;
  language = userLang.split("-")[0];
  document.documentElement.lang = language;

  // Garantir que a flag isInitialLoad seja true
  translatePageContent(language, true);
  console.log("[Morro Digital] Idioma definido:", language);
}

// Modificar a função setupUIElements para remover o handler duplicado

function setupUIElements() {
  // Botão flutuante do assistente
  const assistantButton = document.querySelector(".action-button.primary");
  console.log("[setupUIElements] assistantButton:", assistantButton);

  if (assistantButton) {
    // IMPORTANTE: NÃO adicionar listener de click aqui
    // O evento será gerenciado exclusivamente pelo quick-actions.js
    console.log(
      "[setupUIElements] Não adicionando handler ao assistantButton - será gerenciado por quick-actions.js"
    );
  }

  // Botão de minimizar no balão do assistente
  const minimizeButton = document.querySelector(
    "#assistant-messages .minimize-button"
  );
  console.log("[setupUIElements] minimizeButton:", minimizeButton);
  if (minimizeButton) {
    // MODIFICADO: Removido o listener daqui também - será gerenciado por quick-actions.js
    console.log(
      "[setupUIElements] Não adicionando handler ao minimizeButton - será gerenciado por quick-actions.js"
    );
  }

  // Remover botão de voz antigo
  const oldVoiceSelector = document.getElementById("assistant-voice-selector");
  if (oldVoiceSelector) {
    oldVoiceSelector.remove();
    console.log("[setupUIElements] Botão de voz antigo removido");
  }

  // Remover TODOS os botões voice-selector (abordagem mais agressiva)
  document
    .querySelectorAll(".assistant-voice-selector, #assistant-voice-selector")
    .forEach((el) => {
      el.remove();
      console.log("[setupUIElements] Removido botão:", el.id || el.className);
    });

  // Remover via timer para garantir que pegamos botões adicionados dinamicamente
  const cleanupInterval = setInterval(() => {
    const voiceButtons = document.querySelectorAll(
      ".assistant-voice-selector, #assistant-voice-selector"
    );
    if (voiceButtons.length > 0) {
      voiceButtons.forEach((btn) => btn.remove());
      console.log("[cleanup] Removidos botões de voz residuais");
    } else {
      clearInterval(cleanupInterval);
    }
  }, 500);

  setTimeout(() => clearInterval(cleanupInterval), 5000); // Limpar após 5 segundos
}

/**
 * Atualiza elementos dinâmicos que precisam ser traduzidos mas não usam data-i18n
 * @param {string} lang Código do idioma
 */
function updateDynamicElements(lang) {
  // Atualizar título da página
  const titleTexts = {
    pt: "Morro de São Paulo Digital",
    en: "Morro de São Paulo Digital Guide",
    es: "Morro de São Paulo Guía Digital",
    he: "מורו דה סאו פאולו - מדריך דיגיטלי",
  };
  document.title = titleTexts[lang] || titleTexts.pt;

  // Atualizar outros elementos dinâmicos como popups, mensagens de erro, etc.
  // que podem ter sido gerados após o carregamento inicial

  // Exemplo: atualizar mensagens temporárias
  const toastMessages = document.querySelectorAll(".toast-message");
  if (toastMessages.length > 0) {
    // Código para atualizar mensagens temporárias
  }

  // Atualizar avisos de notificação
  const notificationBadges = document.querySelectorAll(".notification-badge");
  if (notificationBadges.length > 0) {
    // Código para atualizar avisos
  }

  // Se houver mapas abertos com legendas
  if (map && typeof map.getContainer === "function") {
    // Atualizar controles e legendas do mapa
  }

  // Se houver gráficos ou visualizações de dados
  const charts = document.querySelectorAll(".chart-container");
  if (charts.length > 0) {
    // Código para atualizar legendas e rótulos de gráficos
  }
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("[Morro Digital] Sistema iniciando...");

  initApp();
});
