/**
 * assistant-core.js
 * Responsável pela lógica central do assistente virtual
 * Gerencia o estado, configurações e coordena outros módulos
 */

import {
  initializeVoiceSettings,
  speak,
  stopSpeaking,
} from "../voice/voiceSystem.js";

import {
  showAssistant,
  hideAssistant,
  clearAssistantMessages,
  appendMessage,
} from "./assistant-ui.js";

import { setupAdaptiveLayout } from "../utils/assistant-layout.js";
import {
  buildWelcomeMessage,
  markVisit,
} from "./assistant-messages/welcome.js";

// Estado central do assistente
export const assistantState = {
  config: {
    map: null,
    lang: "pt",
  },
  conversation: {
    lastTopic: null,
    preferences: {
      favoriteBeach: null,
      favoriteRestaurant: null,
    },
  },
  voice: {
    enabled: true,
    gender: "female",
    name: null,
  },
  ui: {
    isVisible: false,
    layoutController: null,
  },
};

/**
 * Detecta o idioma do navegador
 * @returns {string} Código do idioma detectado
 */
function detectBrowserLanguage() {
  const supportedLanguages = ["pt", "en", "es", "he"];
  const lang = (navigator.language || navigator.userLanguage || "pt").split(
    "-"
  )[0];
  if (supportedLanguages.includes(lang)) return lang;
  return "pt";
}

/**
 * Configura observadores de eventos para sincronização entre módulos
 */
function setupEventObservers() {
  // Observador de mudança de idioma
  document.addEventListener("languageChanged", (e) => {
    assistantState.config.lang = e.detail.language;
    console.log(
      `[assistant-core] Idioma do assistente sincronizado para: ${e.detail.language}`
    );

    // Verificar se é uma mudança inicial ou mudança manual
    if (e.detail.isInitialLoad) {
      console.log(
        "[assistant-core] Carga inicial de idioma detectada, pulando processamento adicional"
      );
      return;
    }

    // Só limpar mensagens e exibir feedback para alterações de idioma manuais
    console.log("[assistant-core] Alteração manual de idioma detectada");
    clearAssistantMessages();

    const languageChangeMessages = {
      pt: "Idioma do assistente alterado para Português. Como posso ajudar?",
      en: "Assistant language changed to English. How can I help?",
      es: "Idioma del asistente cambiado a Español. ¿Cómo puedo ayudar?",
      he: "?שפת העוזר שונתה לעברית. כיצד אוכל לעזור",
    };

    appendMessage(
      "assistant",
      languageChangeMessages[e.detail.language] || languageChangeMessages.en,
      {
        clear: true,
        avoidDuplicate: true,
        speakMessage: true,
        messageType: "language_change",
      }
    );
  });

  // Observador de mudança de estado de voz
  document.addEventListener("voice:muted:changed", (e) => {
    const isMuted = e.detail.muted;
    assistantState.voice.enabled = !isMuted;
    console.log(
      `[assistant-core] Estado de voz alterado: ${isMuted ? "mudo" : "ativo"}`
    );
  });
}

/**
 * Inicializa o assistente virtual
 * @param {Object} config Configurações iniciais
 */
export function initializeAssistant(config = {}) {
  const detectedLang = detectBrowserLanguage();

  // Atualizar configurações
  assistantState.config = {
    ...assistantState.config,
    ...config,
    lang: config.lang || detectedLang,
  };

  document.documentElement.lang = assistantState.config.lang;
  console.log(
    `[assistant-core] Inicializando assistente com idioma: ${assistantState.config.lang}`
  );

  // Configurar layout adaptativo
  assistantState.ui.layoutController = setupAdaptiveLayout();

  // Configurar observadores de eventos
  setupEventObservers();

  // Preparar a interface do usuário
  showAssistant();

  // Inicializar sistema de voz
  initializeVoiceSettings();
  applyVoiceSettings();

  // Verificar se é primeira visita
  const isFirstTime = !localStorage.getItem("visitedMorroDigital");

  // Construir mensagem de boas-vindas
  const welcomeMessage = buildWelcomeMessage(assistantState.config.lang);

  // Exibir o assistente com a mensagem inicial
  showAssistantWithMessage(welcomeMessage);

  // Marcar primeira visita
  if (isFirstTime) {
    markVisit();
  }

  // Chamar callback se fornecido
  if (config.onReady && typeof config.onReady === "function") {
    config.onReady();
  }
}

/**
 * Atualiza as configurações do assistente
 * @param {Object} settings Novas configurações
 */
export function updateAssistantSettings(settings = {}) {
  if (settings.language) {
    assistantState.config.lang = settings.language;
    console.log(
      `[assistant-core] Idioma atualizado para: ${settings.language}`
    );
  }

  if (settings.voice) {
    setAssistantVoiceName(settings.voice);
    console.log(`[assistant-core] Voz atualizada para: ${settings.voice}`);
  }

  // Propagar alterações para outros módulos
  if (settings.language || settings.voice) {
    applyVoiceSettings();
  }
}

/**
 * Define o nome da voz do assistente
 * @param {string} name Nome da voz
 */
export function setAssistantVoiceName(name) {
  assistantState.voice.name = name;
  localStorage.setItem("assistantVoiceName", name);
}

/**
 * Aplica configurações de voz salvas
 */
function applyVoiceSettings() {
  // Carregar configurações salvas
  const savedVoice = localStorage.getItem("assistant-voice");
  const savedSpeed = parseFloat(localStorage.getItem("voice-speed") || "1.0");

  // Aplicar às próximas falas
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find((v) => v.name === savedVoice);

  if (selectedVoice) {
    assistantState.voice.name = selectedVoice.name;
    console.log(`[assistant-core] Voz aplicada: ${selectedVoice.name}`);
  }

  // Configurar taxa de fala
  console.log(`[assistant-core] Velocidade de fala aplicada: ${savedSpeed}`);
  initializeVoiceSettings({
    voiceName: assistantState.voice.name,
    rate: savedSpeed,
  });
}

/**
 * Exibe o assistente com uma mensagem pré-carregada
 * @param {string} message A mensagem a ser exibida
 */
export function showAssistantWithMessage(message) {
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) return;

  // Garantir que a área de mensagens existe
  let messagesArea = assistantMessages.querySelector(".messages-area");
  if (!messagesArea) {
    messagesArea = document.createElement("div");
    messagesArea.className = "messages-area";
    assistantMessages.appendChild(messagesArea);
  }

  // Limpar quaisquer mensagens existentes
  messagesArea.innerHTML = "";

  // Adicionar a mensagem
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", "assistant");
  messageElement.innerHTML = message;
  messagesArea.appendChild(messageElement);

  console.log(
    "[assistant-core] Assistente preparado com mensagem pré-carregada"
  );

  // Mostrar o assistente com a mensagem já carregada
  assistantMessages.classList.remove("hidden");

  // Focar no input após exibir
  setTimeout(() => {
    const input = document.getElementById("assistantInput");
    if (input) input.focus();
  }, 300);

  // Iniciar síntese de voz se estiver ativada
  if (assistantState.voice.enabled) {
    console.log(
      "[assistant-core] Sintetizando voz para mensagem pré-carregada"
    );
    speak(message);
  }
}

/**
 * Exibe uma mensagem de boas-vindas do assistente
 */
export function showWelcomeMessage() {
  // Importar dinamicamente para evitar dependência circular
  import("./assistant-messages/welcome.js").then((module) => {
    const welcomeMessage = module.getGreetingByTime(assistantState.config.lang);

    appendMessage("assistant", welcomeMessage, {
      clear: true,
      avoidDuplicate: true,
      speakMessage: true,
    });
  });
}

/**
 * Verifica se o assistente de voz está habilitado
 * @returns {boolean} Estado de ativação do assistente de voz
 */
export function isVoiceEnabled() {
  return assistantState.voice.enabled;
}

/**
 * Ativa ou desativa o assistente de voz
 * @param {boolean} enabled Estado de ativação
 */
export function setVoiceEnabled(enabled) {
  assistantState.voice.enabled = enabled;
  localStorage.setItem("voice-enabled", enabled ? "true" : "false");

  // Atualizar checkbox se existir
  const checkbox = document.getElementById("voice-enabled");
  if (checkbox) {
    checkbox.checked = enabled;
  }

  // Disparar evento para notificar outros componentes
  document.dispatchEvent(
    new CustomEvent("voice:muted:changed", {
      detail: { muted: !enabled },
    })
  );
}

/**
 * Acessa o estado atual do assistente
 * @returns {Object} Estado atual do assistente
 */
export function getAssistantState() {
  return { ...assistantState };
}

/**
 * Processa uma entrada do usuário e retorna uma resposta
 * @param {string} message Mensagem do usuário
 * @returns {Promise<Object>} Resposta do assistente
 */
export async function processUserInput(message) {
  // Importar dinamicamente o módulo de diálogo para evitar dependência circular
  try {
    const dialogModule = await import("./assistant-dialog/dialog.js");
    return await dialogModule.processUserInput(message);
  } catch (error) {
    console.error(
      "[assistant-core] Erro ao processar entrada do usuário:",
      error
    );
    return { text: "Desculpe, ocorreu um erro ao processar sua mensagem." };
  }
}
