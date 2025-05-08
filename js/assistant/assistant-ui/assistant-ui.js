/**
 * assistant-ui.js
 *
 * Módulo que gerencia a interface do assistente virtual.
 * Responsável por:
 * - Criar e renderizar a interface do assistente
 * - Mostrar/ocultar o assistente
 * - Gerenciar eventos de interação na interface
 * - Renderizar mensagens e outros elementos visuais
 */

import { speak } from "../assistant-speech/assistant-speech.js";
import { setupAdaptiveLayout } from "../../utils/assistant-layout.js";
import { messages } from "../assistant-messages/assistant-messages.js";
// Estado da UI do assistente
const uiState = {
  isVisible: false,
  isMinimized: false,
  hasCarousel: false,
  activeView: "messages", // pode ser "messages", "settings"
};

/**
 * Cria a interface básica do assistente
 * @param {string} containerId - ID do elemento container
 */
export function createAssistantUI(containerId = "assistant-messages") {
  // Verificar se já existe
  let container = document.getElementById(containerId);

  // Se não existir, criar
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.className = "assistant-modal hidden";
    document.body.appendChild(container);
    console.log("[assistant-ui] Container do assistente criado");
  }

  // Limpar conteúdo e reconstruir estrutura básica
  container.innerHTML = `
    <button class="minimize-button" aria-label="Minimizar assistente">×</button>
    <div class="messages-area"></div>
    <div class="input-area">
      <input type="text" id="assistantInput" placeholder="Digite sua pergunta..." aria-label="Mensagem para o assistente">
      <button id="sendButton" aria-label="Enviar mensagem">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  // Esconder o assistente inicialmente
  container.classList.add("hidden");

  // Configurar observador para adaptar layout com base no conteúdo
  setupAdaptiveLayout();

  // Configurar eventos
  setupAssistantEvents();

  return container;
}

/**
 * Configurar eventos básicos da interface do assistente
 */
export function setupAssistantEvents() {
  const assistantMessages = document.getElementById("assistant-messages");
  const assistantInput = document.getElementById("assistantInput");
  const sendButton = document.getElementById("sendButton");
  const minimizeButton = assistantMessages
    ? assistantMessages.querySelector(".minimize-button")
    : null;

  if (!assistantMessages || !assistantInput || !sendButton || !minimizeButton) {
    console.error(
      "[setupAssistantEvents] Elementos do assistente não encontrados"
    );
    return;
  }

  // Limpar listeners antigos para evitar duplicação
  sendButton.onclick = null;
  assistantInput.onkeydown = null;
  minimizeButton.onclick = null;

  // Configurar o evento de clique no botão de enviar
  sendButton.onclick = handleSendMessage;

  // Configurar o evento de pressionar Enter no campo de texto
  assistantInput.onkeydown = function (e) {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Configurar o evento de clique no botão de minimizar
  minimizeButton.onclick = hideAssistant;

  // Permitir fechar o assistente com a tecla Escape
  document.removeEventListener("keydown", handleEscapeKey);
  document.addEventListener("keydown", handleEscapeKey);

  console.log("[assistant-ui] Eventos do assistente configurados");
}

/**
 * Função para lidar com a tecla Escape
 */
function handleEscapeKey(event) {
  if (event.key === "Escape") {
    const assistantMessages = document.getElementById("assistant-messages");
    if (assistantMessages && !assistantMessages.classList.contains("hidden")) {
      hideAssistant();
    }
  }
}

/**
 * Função global para lidar com o envio de mensagem
 * Esta função será sobrescrita pelo sistema principal
 */
let handleSendMessage = function () {
  const assistantInput = document.getElementById("assistantInput");
  const message = assistantInput.value.trim();

  if (message) {
    console.log("[assistant-ui] Mensagem enviada (handler padrão):", message);
    assistantInput.value = "";

    // Adicionar a mensagem do usuário à área de mensagens
    appendMessage("user", message);

    // Resposta padrão (substituída quando o sistema de diálogo é inicializado)
    setTimeout(() => {
      appendMessage(
        "assistant",
        "Desculpe, ainda não estou pronto para responder."
      );
    }, 500);
  }
};

/**
 * Define o manipulador de mensagens enviadas
 * @param {Function} handler - Função que processa as mensagens enviadas
 */
export function setMessageHandler(handler) {
  if (typeof handler !== "function") {
    console.error(
      "[assistant-ui] Handler inválido fornecido para setMessageHandler"
    );
    return;
  }

  handleSendMessage = function () {
    const assistantInput = document.getElementById("assistantInput");
    const message = assistantInput.value.trim();

    if (message) {
      console.log(
        "[assistant-ui] Mensagem enviada para processamento:",
        message
      );
      assistantInput.value = "";

      // Adicionar a mensagem do usuário à área de mensagens
      appendMessage("user", message);

      // Chamar o manipulador fornecido
      handler(message);
    }
  };

  console.log("[assistant-ui] Handler de mensagem personalizado configurado");
}

/**
 * Mostra o assistente na interface
 */
export function showAssistant() {
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) {
    console.error("[showAssistant] Container do assistente não encontrado");
    return;
  }

  // Remover classe hidden para mostrar o assistente
  assistantMessages.classList.remove("hidden");

  // Adicionar classe ao body para indicar que o modal está aberto
  document.body.classList.add("assistant-modal-open");

  // Focar no input para melhor experiência do usuário
  setTimeout(() => {
    const input = document.getElementById("assistantInput");
    if (input) {
      input.focus();
    }
  }, 100);

  uiState.isVisible = true;
  console.log("[assistant-ui] Assistente mostrado na interface");
}

/**
 * Mostra o assistente com uma mensagem inicial
 * @param {string} message - Mensagem a ser exibida
 */
export function showAssistantWithMessage(message) {
  // Primeiro mostrar o assistente
  showAssistant();

  // Adicionar a mensagem
  if (message) {
    appendMessage("assistant", message);
  }
}

/**
 * Oculta o assistente da interface e todos os elementos relacionados
 */
export function hideAssistant() {
  // Ocultar o conteúdo principal do assistente
  const assistantMessages = document.getElementById("assistant-messages");
  if (assistantMessages) {
    assistantMessages.classList.add("hidden");
  }

  // Certificar que qualquer carousel e componentes relacionados estão ocultos
  const carouselContainer = document.querySelector(".carousel-container");
  if (carouselContainer) {
    carouselContainer.classList.add("hidden");
  }

  const carouselFollowUp = document.querySelector(".carousel-follow-up");
  if (carouselFollowUp) {
    carouselFollowUp.classList.add("hidden");
  }

  // Remover classe do body que indica assistente ativo
  document.body.classList.remove("assistant-messages");
  document.body.classList.remove("assistant-active");

  // Atualizar o estado da interface
  uiState.isVisible = false;

  // Parar qualquer swiper que esteja ativo
  if (
    window.assistantSwiper &&
    typeof window.assistantSwiper.destroy === "function"
  ) {
    window.assistantSwiper.destroy(true, true);
  }

  console.log(
    "[assistant-ui] Assistente e componentes relacionados ocultados da interface"
  );
}

/**
 * Alterna a visibilidade do assistente
 * @returns {boolean} true se o assistente estiver visível após a alternância
 */
export function toggleAssistant() {
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) return false;

  const isHidden = assistantMessages.classList.contains("hidden");
  if (isHidden) {
    showAssistant();
  } else {
    hideAssistant();
  }

  return isHidden; // Retorna o novo estado (true = visível)
}

/**
 * Adiciona uma nova mensagem no painel de mensagens.
 * @param {string} sender - 'user' ou 'assistant'
 * @param {string} htmlContent - Conteúdo HTML da mensagem
 * @param {Object} options - Opções adicionais
 */
export function appendMessage(
  sender,
  htmlContent,
  {
    clear = false,
    avoidDuplicate = true,
    customClass = "",
    id = "",
    speakMessage = true,
    translationKey = "",
    translationParams = {},
    priority = "normal",
    messageType = "standard",
  } = {}
) {
  console.log("[appendMessage]", {
    sender,
    clear,
    messageType,
    content:
      htmlContent.substring(0, 30) + (htmlContent.length > 30 ? "..." : ""),
  });

  // Encontrar o container de mensagens adequado
  const messagesContainer = document.querySelector(
    "#assistant-messages .messages-area"
  );

  // Se o container não existir, tentar criá-lo
  if (!messagesContainer) {
    const parent = document.getElementById("assistant-messages");
    if (!parent) {
      console.error(
        "[appendMessage] Container pai #assistant-messages não encontrado"
      );
      return;
    }

    const newMessagesContainer = document.createElement("div");
    newMessagesContainer.className = "messages-area";

    const firstChild = parent.firstChild;
    if (firstChild) {
      parent.insertBefore(newMessagesContainer, firstChild.nextSibling);
    } else {
      parent.appendChild(newMessagesContainer);
    }

    console.log(`[appendMessage] Novo container de mensagens criado`);
    return appendMessage(sender, htmlContent, {
      clear,
      avoidDuplicate,
      customClass,
      id,
      speakMessage,
      translationKey,
      translationParams,
      priority,
      messageType,
    });
  }

  // Verificar duplicatas no container atual (evita mensagens repetidas)
  if (
    avoidDuplicate &&
    priority !== "high" &&
    messagesContainer.lastChild &&
    messagesContainer.lastChild.innerHTML === htmlContent
  ) {
    console.log("[appendMessage] Mensagem duplicada ignorada");
    return;
  }

  // Limpar mensagens existentes, se solicitado
  if (clear) {
    messagesContainer.innerHTML = "";
  }

  // Criar e adicionar o elemento de mensagem
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);

  if (customClass) messageElement.classList.add(customClass);
  if (id) messageElement.id = id;

  // Adicionar atributo data-message-type para facilitar identificação
  messageElement.setAttribute("data-message-type", messageType);

  messageElement.innerHTML = htmlContent;
  messagesContainer.appendChild(messageElement);

  // Rolar para a nova mensagem
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Falar a mensagem do assistente, se apropriado
  if (
    sender === "assistant" &&
    speakMessage &&
    messageType !== "language_change"
  ) {
    // Verificar se a síntese de voz está ativada
    const voiceEnabled = localStorage.getItem("voice-enabled") !== "false";
    if (voiceEnabled) {
      // Importar speak() dinamicamente para evitar dependência circular
      import("../assistant-speech/assistant-speech.js")
        .then((speechModule) => {
          speechModule.speak(htmlContent);
        })
        .catch((error) => {
          console.error(
            "[appendMessage] Erro ao importar módulo de fala:",
            error
          );
          // Fallback: usar a função speak diretamente se disponível globalmente
          if (typeof speak === "function") {
            speak(htmlContent);
          }
        });
    } else {
      console.log("[appendMessage] Síntese de voz desativada");
    }
  }

  return messageElement;
}

/**
 * Limpa mensagens do assistente com base em um filtro ou limpa tudo
 * @param {Function} filterFn - Função de filtro para selecionar quais mensagens remover
 */
export function clearAssistantMessages(filterFn) {
  // Selecionar a área de mensagens
  const messagesArea = document.querySelector(
    "#assistant-messages .messages-area"
  );

  if (!messagesArea) {
    console.warn(`[clearAssistantMessages] Área de mensagens não encontrada`);
    return;
  }

  // Se não houver função de filtro, limpar tudo
  if (!filterFn) {
    messagesArea.innerHTML = "";
    console.log(`[clearAssistantMessages] Todas as mensagens removidas`);
    return;
  }

  // Selecionar mensagens com base no filtro
  const msgs = messagesArea.querySelectorAll(".message");
  let count = 0;

  msgs.forEach((msg) => {
    if (filterFn(msg)) {
      msg.remove();
      count++;
    }
  });

  console.log(`[clearAssistantMessages] ${count} mensagens removidas`);
}

/**
 * Atualiza o estado visual da interface com base nas mensagens e conteúdo
 */
export function updateUIState() {
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) return;

  // Verificar se há um carrossel visível
  const hasCarousel =
    assistantMessages.querySelector(".carousel-container") !== null;
  uiState.hasCarousel = hasCarousel;

  // Atualizar classes com base no estado
  if (hasCarousel) {
    assistantMessages.classList.add("showing-carousel");
  } else {
    assistantMessages.classList.remove("showing-carousel");
  }

  // Atualizar outras propriedades visuais conforme necessário
  const adaptiveLayout = setupAdaptiveLayout();
  if (adaptiveLayout && adaptiveLayout.update) {
    adaptiveLayout.update();
  }
}

export default {
  createAssistantUI,
  setupAssistantEvents,
  showAssistant,
  hideAssistant,
  toggleAssistant,
  showAssistantWithMessage,
  clearAssistantMessages,
  updateUIState,
  setMessageHandler,
};
