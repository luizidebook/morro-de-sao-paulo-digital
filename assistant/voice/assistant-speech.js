/**
 * assistant-speech.js
 *
 * Gerencia todas as funcionalidades de fala do assistente, incluindo:
 * - Síntese de voz
 * - Configuração e preferências de voz
 * - Integração com o sistema principal de voz
 */

import { speak, stopSpeaking, initializeVoiceSettings } from "./voiceSystem.js";

// Estado das configurações de voz
const speechState = {
  enabled: true,
  volume: 0.8,
  speed: 1.0,
  selectedVoice: null,
  isExpanded: false,
};

/**
 * Inicializa o sistema de fala do assistente
 * @param {Object} options - Opções de inicialização
 */
export function initSpeechSystem(options = {}) {
  // Carregar preferências salvas
  loadSpeechPreferences();

  // Inicializar configurações de voz no sistema
  initializeVoiceSettings({
    voiceName: speechState.selectedVoice,
    volume: speechState.volume,
    rate: speechState.speed,
  });

  console.log("[assistant-speech] Sistema de fala inicializado");
}

/**
 * Sintetiza fala a partir de um texto
 * @param {string} text - Texto para sintetizar
 */
export function speakText(text) {
  if (!isVoiceEnabled()) return;

  // Remove marcações HTML e caracteres especiais
  const cleanText = cleanTextForSpeech(text);
  speak(cleanText);
}

/**
 * Interrompe a fala atual
 */
export function stopSpeech() {
  stopSpeaking();
}

/**
 * Limpa o texto para ser falado, removendo HTML e normalizando
 * @param {string} text - Texto HTML para limpar
 * @returns {string} - Texto limpo
 */
export function cleanTextForSpeech(text) {
  // Remover todas as tags HTML
  let cleaned = text.replace(/<[^>]*>/g, " ");

  // Normalizar espaços em branco
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Substituir caracteres especiais comuns
  cleaned = cleaned
    .replace(/&amp;/g, "e")
    .replace(/&lt;/g, "menor que")
    .replace(/&gt;/g, "maior que")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return cleaned;
}

/**
 * Verifica se a voz do assistente está habilitada
 */
export function isVoiceEnabled() {
  return speechState.enabled;
}

/**
 * Ativa ou desativa a voz do assistente
 * @param {boolean} enabled - Estado de ativação
 */
export function setVoiceEnabled(enabled) {
  speechState.enabled = enabled;
  saveSpeechPreferences();
}

/**
 * Atualiza as configurações de voz
 * @param {Object} settings - Novas configurações
 */
export function updateVoiceSettings(settings = {}) {
  if (settings.voiceName !== undefined) {
    speechState.selectedVoice = settings.voiceName;
  }

  if (settings.volume !== undefined) {
    speechState.volume = settings.volume;
  }

  if (settings.speed !== undefined) {
    speechState.speed = settings.speed;
  }

  if (settings.enabled !== undefined) {
    speechState.enabled = settings.enabled;
  }

  saveSpeechPreferences();

  // Atualizar configurações no sistema de voz
  initializeVoiceSettings({
    voiceName: speechState.selectedVoice,
    volume: speechState.volume,
    rate: speechState.speed,
  });
}

/**
 * Salva as preferências do usuário no localStorage
 */
function saveSpeechPreferences() {
  try {
    localStorage.setItem(
      "voiceAssistant",
      JSON.stringify({
        enabled: speechState.enabled,
        volume: speechState.volume,
        speed: speechState.speed,
        selectedVoice: speechState.selectedVoice,
      })
    );
  } catch (error) {
    console.error("[assistant-speech] Erro ao salvar preferências:", error);
  }
}

/**
 * Carrega as preferências salvas no localStorage
 */
function loadSpeechPreferences() {
  try {
    const saved = localStorage.getItem("voiceAssistant");
    if (saved) {
      const preferences = JSON.parse(saved);
      Object.assign(speechState, preferences);
    }

    // Compatibilidade com outras chaves de armazenamento
    const voiceEnabled = localStorage.getItem("voice-enabled");
    if (voiceEnabled !== null) {
      speechState.enabled = voiceEnabled !== "false";
    }

    const voiceSpeed = localStorage.getItem("voice-speed");
    if (voiceSpeed !== null) {
      speechState.speed = parseFloat(voiceSpeed);
    }

    const voiceName = localStorage.getItem("assistant-voice");
    if (voiceName) {
      speechState.selectedVoice = voiceName;
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao carregar preferências:", error);
  }
}

/**
 * Preenche o seletor de vozes com as vozes disponíveis no navegador
 * @param {HTMLElement} voiceSelector - Elemento select para vozes
 */
export function populateVoiceSelector(voiceSelector) {
  if (!voiceSelector) return;

  // Função para preencher o seletor
  const fillVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    voiceSelector.innerHTML = "";

    // Opção padrão
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Selecione uma voz --";
    voiceSelector.appendChild(defaultOption);

    // Adicionar vozes disponíveis
    voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;

      // Selecionar se for a voz salva
      if (voice.name === speechState.selectedVoice) {
        option.selected = true;
      }

      voiceSelector.appendChild(option);
    });
  };

  // Preencher vozes imediatamente se disponíveis
  fillVoices();

  // Ou esperar pelo evento onvoiceschanged
  if ("onvoiceschanged" in speechSynthesis) {
    speechSynthesis.onvoiceschanged = fillVoices;
  }
}

export function getCurrentVoiceState() {
  return { ...speechState };
}
