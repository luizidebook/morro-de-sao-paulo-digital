// Responsável por inicialização, config, idioma, observers

import {
  showAssistant,
  showAssistantWithMessage,
  setupAssistantEvents,
} from "../assistant-ui/assistant-ui.js";
import {
  buildWelcomeMessage,
  markVisit,
} from "../assistant-messages/welcome.js";
import {
  initVoice,
  initializeVoiceSettings, // Nova importação
} from "../../utils/voice/voiceSystem.js";
import {
  appendMessage,
  clearAssistantMessages,
} from "../assistant-messages/assistant-messages.js";

let assistantConfig = {
  map: null,
  lang: "pt",
};

export { assistantConfig };

function detectBrowserLanguage() {
  const supportedLanguages = ["pt", "en", "es", "he"];
  const lang = (navigator.language || navigator.userLanguage || "pt").split(
    "-"
  )[0];
  if (supportedLanguages.includes(lang)) return lang;
  return "pt";
}

export function updateAssistantSettings(settings) {
  if (settings.language) assistantConfig.lang = settings.language;
  if (settings.voice) setAssistantVoiceName(settings.voice);
}

function setupConfigObservers() {
  document.addEventListener("languageChanged", (e) => {
    assistantConfig.lang = e.detail.language;
    console.log(
      `[assistant.js] Idioma do assistente sincronizado para: ${e.detail.language}`
    );

    // CORREÇÃO CRÍTICA: Verificar se é uma mudança inicial ou mudança manual
    if (e.detail.isInitialLoad) {
      console.log(
        "[assistant.js] Carga inicial de idioma detectada, pulando completamente qualquer processamento adicional"
      );
      return; // Sair completamente sem fazer nada mais
    }

    // Só limpar mensagens e exibir feedback para alterações de idioma manuais
    console.log(
      "[assistant.js] Alteração manual de idioma detectada, exibindo mensagem"
    );
    clearAssistantMessages(); // Limpar mensagens anteriores

    // CORREÇÃO: Mudança de nome de "welcomeMessages" para "languageChangeMessages"
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
        messageType: "language_change", // Identificar explicitamente o tipo de mensagem
      }
    );
  });

  // Adicionar listener para mudanças no estado mudo da voz
  document.addEventListener("voice:muted:changed", (e) => {
    const isMuted = e.detail.muted;
    console.log(
      `[assistant.js] Estado de voz alterado: ${isMuted ? "mudo" : "ativo"}`
    );
  });
}

export function initializeAssistant(config) {
  const detectedLang = detectBrowserLanguage();
  assistantConfig = {
    ...assistantConfig,
    ...config,
    lang: config.lang || detectedLang,
  };
  document.documentElement.lang = assistantConfig.lang;
  setupConfigObservers();
  showAssistant();
  setupAssistantEvents();
  initializeVoiceSettings();
  initVoice(assistantConfig.lang);
  applyVoiceSettings();
  const isFirstTime = !localStorage.getItem("visitedMorroDigital");
  const welcomeMessage = buildWelcomeMessage(assistantConfig.lang);
  showAssistantWithMessage(welcomeMessage);
  if (isFirstTime) markVisit();
  if (config.onReady) config.onReady();
}

/**
 * Aplica configurações de voz salvas
 */
export function applyVoiceSettings() {
  // Carregar configurações salvas
  const savedVoice = localStorage.getItem("assistant-voice");
  const savedSpeed = parseFloat(localStorage.getItem("voice-speed") || "1.0");

  // Aplicar às próximas falas
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find((v) => v.name === savedVoice);

  if (selectedVoice) {
    assistantVoiceName = selectedVoice.name;
    console.log(`[assistant.js] Voz aplicada: ${selectedVoice.name}`);
  }

  // Configurar taxa de fala
  console.log(`[assistant.js] Velocidade de fala aplicada: ${savedSpeed}`);
  // Configurar no sistema de voz
}
