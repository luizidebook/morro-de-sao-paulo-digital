/**
 * ============================================================
 * Morro Digital - assistant-manager.js
 * ============================================================
 * Este arquivo centraliza e reexporta as funções dos módulos do assistente,
 * servindo como ponto único de importação para outros módulos do projeto.
 *
 * RESUMO DOS MÓDULOS E FUNÇÕES:
 *
 * --- assistant-core.js ---
 * - initializeAssistant(config): Inicializa o assistente virtual.
 * - updateAssistantSettings(settings): Atualiza configurações do assistente.
 * - assistantConfig: Objeto de configuração global do assistente.
 *
 * --- assistant-messages.js ---
 * - appendMessage(sender, htmlContent, options): Adiciona uma mensagem ao painel do assistente.
 * - showWelcomeMessage(): Exibe mensagem de boas-vindas do assistente.
 *
 * --- assistant-voice.js ---
 * - setAssistantVoiceName(name): Define o nome da voz do assistente.
 * - loadVoicePreferences(): Carrega preferências de voz do localStorage.
 * - setupVoiceSelector(): Configura o seletor de vozes na interface.
 * - applyVoiceSettings(): Aplica configurações de voz salvas.
 *
 * --- assistant-state.js ---
 * - conversationState: Estado da conversa do assistente.
 * - assistantVoiceGender: Gênero da voz do assistente.
 * - assistantVoiceName: Nome da voz do assistente.
 *
 * ============================================================
 */

// --- assistant-state.js ---
export let conversationState = {
  lastTopic: null,
  preferences: {
    favoriteBeach: null,
    favoriteRestaurant: null,
  },
};

export let assistantVoiceGender = "female";
export let assistantVoiceName = null;

// --- assistant-core.js ---
export {
  initializeAssistant,
  updateAssistantSettings,
  assistantConfig,
} from "./assistant-core/assistant-core.js";

// --- assistant-messages.js ---
export {
  appendMessage,
  showWelcomeMessage,
} from "./assistant-messages/assistant-messages.js";

// --- assistant-ui.js ---
export {
  showAssistant,
  showAssistantWithMessage,
  clearAssistantMessages,
} from "./assistant-ui/assistant-ui.js";
