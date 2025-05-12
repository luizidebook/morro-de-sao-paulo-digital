/**
 * Gerenciador de Posicionamento de Mensagens
 * Monitora ações que devem reposicionar a área de mensagens
 */

import { repositionMessagesArea } from "./ui-position.js";

// Lista de ações que devem acionar o reposicionamento
const REPOSITION_ACTIONS = [
  "showRoute",
  "showLocationOnMap",
  "showNearbyPlaces",
  "startNavigation",
  "showWeather",
  "showCarousel",
];

// Lista de ações que devem restaurar a posição
const RESTORE_ACTIONS = [
  "cancelNavigation",
  "hideLocationDetails",
  "closeCarousel",
  "resetView",
];

/**
 * Inicializa o monitoramento de ações para posicionamento automático
 */
export function initMessagesPositionManager() {
  console.log(
    "[MessagesPositionManager] Inicializando gerenciador de posição de mensagens"
  );

  // Monitorar eventos personalizados disparados por funções de navegação
  document.addEventListener("navigation:action", (event) => {
    if (!event.detail || !event.detail.action) return;

    const { action } = event.detail;

    // Manter sempre a posição consistente
    const messagesArea = document.getElementById("assistant-messages");
    if (messagesArea) {
      // Garantir posição consistente
      messagesArea.style.left = "50%";
      messagesArea.style.top = "40%";
      messagesArea.style.transform = "translateX(-50%)";
    }

    if (REPOSITION_ACTIONS.includes(action)) {
      console.log(
        `[MessagesPositionManager] Ação '${action}' detectada, reposicionando mensagens`
      );
      repositionMessagesArea(true, true);
    } else if (RESTORE_ACTIONS.includes(action)) {
      console.log(
        `[MessagesPositionManager] Ação '${action}' detectada, restaurando posição original`
      );
      repositionMessagesArea(false, true);
    }
  });

  // Verificar também quando a navegação é ativada
  document.addEventListener("navigation:started", () => {
    repositionMessagesArea(true, true);
  });

  document.addEventListener("navigation:ended", () => {
    repositionMessagesArea(false, true);
  });

  // Verificar quando o carrossel é mostrado
  document.addEventListener("carousel:shown", () => {
    repositionMessagesArea(true, true);
  });

  document.addEventListener("carousel:hidden", () => {
    repositionMessagesArea(false, true);
  });

  // Hook no estado de mudança de mensagem
  const originalAddMessage = window.addAssistantMessage || null;
  if (typeof originalAddMessage === "function") {
    window.addAssistantMessage = function (message, options) {
      // Se qualquer mensagem sendo adicionada contém informações de navegação
      // ou localização, reposicionar a área
      if (
        message &&
        (message.includes("rota") ||
          message.includes("navegação") ||
          message.includes("localização") ||
          message.includes("mapa"))
      ) {
        setTimeout(() => repositionMessagesArea(true), 100);
      }

      return originalAddMessage(message, options);
    };
  }

  // Monitorar mudanças no DOM para detectar quando os componentes são adicionados
  observeMessagesAreaChanges();

  console.log("[MessagesPositionManager] Gerenciador inicializado");
}

/**
 * Monitora mudanças na área de mensagens
 */
function observeMessagesAreaChanges() {
  // Função que verifica se o conteúdo indica que deve ser reposicionado
  function checkContentForRepositioning(element) {
    if (!element) return false;

    // Verificar se contém elementos indicadores de navegação ou mapa
    const hasMapElements = element.querySelector(
      ".leaflet-container, .map-embed, .location-info"
    );
    const hasNavigationElements = element.querySelector(
      ".navigation-instruction, .route-info, .direction-icon"
    );
    const hasCarouselElements = element.querySelector(
      ".carousel-container, .swiper-container"
    );

    return hasMapElements || hasNavigationElements || hasCarouselElements;
  }

  // Observador para a área de mensagens
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Verificar se algum dos nós adicionados indica conteúdo que requer reposicionamento
        const shouldReposition = Array.from(mutation.addedNodes).some(
          (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return checkContentForRepositioning(node);
            }
            return false;
          }
        );

        if (shouldReposition) {
          console.log(
            "[MessagesPositionManager] Conteúdo detectado que requer reposicionamento"
          );
          repositionMessagesArea(true);
        }
      }
    }
  });

  // Tentar encontrar a área de mensagens
  const messagesArea = document.querySelector(
    "#assistant-messages .messages-area"
  );
  if (messagesArea) {
    observer.observe(messagesArea, { childList: true, subtree: true });
  } else {
    // Se não encontrar, configurar um observador para o body para detectar quando for criada
    const bodyObserver = new MutationObserver((mutations) => {
      const messagesArea = document.querySelector(
        "#assistant-messages .messages-area"
      );
      if (messagesArea) {
        observer.observe(messagesArea, { childList: true, subtree: true });
        bodyObserver.disconnect();
      }
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
}

// Exportar função de inicialização
export default initMessagesPositionManager;
