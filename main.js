// main.js - Arquivo principal de inicialização do site Morro Digital

// Importações de módulos
import { initializeMap } from "./js/map/map-controls.js";
import { initializeAssistant } from "./js/assistant/assistant.js";
import { translatePageContent } from "./js/i18n/translatePageContent.js";
import { initPerformanceOptimizations } from "./js/analytics/performance.js";
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
import { initMessagesPositionManager } from "./js/utils/messages-position-manager.js";
import { initUnifiedControls } from "./js/map/map-unified-controls.js";

export let userLocation = {};
export let userPopup = null;
export let mapInstance = null;

// Variáveis globais
let language;
let map; // Variável global para o mapa

window.addEventListener("DOMContentLoaded", () => {
  console.log("[Morro Digital] Sistema iniciando...");
  initApp();
});

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

function initApp() {
  setLanguage();
  map = initializeMap("map", {
    // Remover o 'let' aqui
    zoom: 15,
    offsetTopPx: 0,
    centerLat: -13.3775457,
    centerLng: -38.9159969,
    zoomControl: false,
  });
  mapInstance = map; // Disponibilizar globalmente
  console.log("[initApp] Mapa inicializado:", map);
  // Configurar observador de UI para navegação
  setupNavigationUIObserver();

  // Adicionar após a linha 113 (onde o setupNavigationUIObserver é chamado)

  // Inicializar controles unificados do mapa após mapa básico estar pronto
  initUnifiedControls().then((success) => {
    console.log(
      "[initApp] Controles unificados de mapa inicializados:",
      success
    );
  });

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

  initPerformanceOptimizations();
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
  });
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

// que o mapa está completamente renderizado
function initMapControls() {
  // Tentar até 3 vezes com intervalo de 1s entre tentativas
  let attempts = 0;
  const maxAttempts = 3;

  function tryInit() {
    attempts++;
    initUnifiedControls().then((success) => {
      if (success) {
        console.log(
          "[initApp] Controles unificados de mapa inicializados com sucesso"
        );
      } else if (attempts < maxAttempts) {
        console.log(
          `[initApp] Tentativa ${attempts} falhou, tentando novamente em 1s...`
        );
        setTimeout(tryInit, 1000);
      } else {
        console.warn(
          "[initApp] Não foi possível inicializar controles unificados após várias tentativas"
        );
      }
    });
  }

  // Iniciar a primeira tentativa após pequeno delay para garantir que o mapa esteja pronto
  setTimeout(tryInit, 500);
}

// Inicializar controles
initMapControls();
