/**
 * Voice Assistant Module
 * Gerencia as funcionalidades do assistente de voz, incluindo:
 * - Interface para seleção/controle de voz
 * - Gerenciamento de estado e preferências
 * - Integração com o sistema de voz principal
 */
import { speak, stopSpeaking, initializeVoiceSettings } from "./voiceSystem.js";

// Estado do assistente de voz
const voiceAssistantState = {
  enabled: true,
  volume: 0.8,
  speed: 1.0,
  selectedVoice: null,
  isExpanded: false,
};

/**
 * Inicializa o assistente de voz e cria sua interface
 * @param {Object} options - Opções de inicialização
 */
export function initVoiceAssistant(options = {}) {
  // Carregar preferências salvas
  loadVoicePreferences();

  // Criar o seletor de voz
  createVoiceSelector();

  // Inicializar configurações de voz do sistema
  initializeVoiceSettings({
    voiceName: voiceAssistantState.selectedVoice,
    volume: voiceAssistantState.volume,
    rate: voiceAssistantState.speed,
  });

  console.log("[voiceAssistant] Assistente de voz inicializado");
}

/**
 * Cria o widget seletor de voz na interface
 */
function createVoiceSelector() {
  // Verificar se já existe
  if (document.getElementById("assistant-voice-selector")) {
    return;
  }

  // Criar o container do seletor de voz
  const container = document.createElement("div");
  container.id = "assistant-voice-selector";
  container.className = "voice-selector-widget";

  // Botão principal do seletor
  const mainButton = document.createElement("button");
  mainButton.className = "voice-button";
  mainButton.innerHTML = '<i class="fas fa-microphone"></i>';
  mainButton.title = "Configurações de voz";

  // Painel de controles (inicialmente oculto)
  const controlsPanel = document.createElement("div");
  controlsPanel.className = "voice-controls hidden";
  controlsPanel.innerHTML = `
    <div class="voice-control-header">Configurações de voz</div>
    <div class="voice-control-item">
      <label for="voice-enabled">Voz ativa</label>
      <input type="checkbox" id="voice-enabled" ${
        voiceAssistantState.enabled ? "checked" : ""
      }>
    </div>
    <div class="voice-control-item">
      <label for="voice-volume">Volume</label>
      <input type="range" id="voice-volume" min="0" max="1" step="0.1" value="${
        voiceAssistantState.volume
      }">
    </div>
    <div class="voice-control-item">
      <label for="voice-speed">Velocidade</label>
      <input type="range" id="voice-speed" min="0.5" max="2" step="0.1" value="${
        voiceAssistantState.speed
      }">
    </div>
    <div class="voice-control-item">
      <label for="voice-selector">Voz</label>
      <select id="voice-selector"></select>
    </div>
    <div class="voice-control-actions">
      <button id="test-voice-btn">Testar</button>
    </div>
  `;

  // Adicionar ao container e ao documento
  container.appendChild(mainButton);
  container.appendChild(controlsPanel);
  document.body.appendChild(container);

  // Configurar eventos
  setupVoiceSelectorEvents(mainButton, controlsPanel);

  // Preencher seletor de vozes quando disponível
  populateVoiceSelector();
}

/**
 * Configura os eventos de interação do seletor de voz
 */
function setupVoiceSelectorEvents(mainButton, controlsPanel) {
  // Toggle do painel de controle
  mainButton.addEventListener("click", () => {
    voiceAssistantState.isExpanded = !voiceAssistantState.isExpanded;
    if (voiceAssistantState.isExpanded) {
      controlsPanel.classList.remove("hidden");
    } else {
      controlsPanel.classList.add("hidden");
    }
  });

  // Controle de habilitado/desabilitado
  const enabledCheckbox = controlsPanel.querySelector("#voice-enabled");
  enabledCheckbox.addEventListener("change", (e) => {
    voiceAssistantState.enabled = e.target.checked;
    saveVoicePreferences();
  });

  // Controle de volume
  const volumeSlider = controlsPanel.querySelector("#voice-volume");
  volumeSlider.addEventListener("change", (e) => {
    voiceAssistantState.volume = parseFloat(e.target.value);
    saveVoicePreferences();
    initializeVoiceSettings({ volume: voiceAssistantState.volume });
  });

  // Controle de velocidade
  const speedSlider = controlsPanel.querySelector("#voice-speed");
  speedSlider.addEventListener("change", (e) => {
    voiceAssistantState.speed = parseFloat(e.target.value);
    saveVoicePreferences();
    initializeVoiceSettings({ rate: voiceAssistantState.speed });
  });

  // Seleção de voz
  const voiceSelector = controlsPanel.querySelector("#voice-selector");
  voiceSelector.addEventListener("change", (e) => {
    voiceAssistantState.selectedVoice = e.target.value;
    saveVoicePreferences();
    initializeVoiceSettings({ voiceName: voiceAssistantState.selectedVoice });
  });

  // Botão de teste
  const testButton = controlsPanel.querySelector("#test-voice-btn");
  testButton.addEventListener("click", () => {
    stopSpeaking();
    speak("Olá! Este é um teste do assistente de voz.");
  });

  // Fechar ao clicar fora
  document.addEventListener("click", (e) => {
    if (
      voiceAssistantState.isExpanded &&
      !controlsPanel.contains(e.target) &&
      e.target !== mainButton
    ) {
      controlsPanel.classList.add("hidden");
      voiceAssistantState.isExpanded = false;
    }
  });
}

/**
 * Preenche o seletor de vozes com as vozes disponíveis no navegador
 */
function populateVoiceSelector() {
  const voiceSelector = document.getElementById("voice-selector");
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
      if (voice.name === voiceAssistantState.selectedVoice) {
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

/**
 * Salva as preferências do usuário no localStorage
 */
function saveVoicePreferences() {
  try {
    localStorage.setItem(
      "voiceAssistant",
      JSON.stringify({
        enabled: voiceAssistantState.enabled,
        volume: voiceAssistantState.volume,
        speed: voiceAssistantState.speed,
        selectedVoice: voiceAssistantState.selectedVoice,
      })
    );
  } catch (error) {
    console.error("[voiceAssistant] Erro ao salvar preferências:", error);
  }
}

/**
 * Carrega as preferências salvas no localStorage
 */
function loadVoicePreferences() {
  try {
    const saved = localStorage.getItem("voiceAssistant");
    if (saved) {
      const preferences = JSON.parse(saved);
      Object.assign(voiceAssistantState, preferences);
    }
  } catch (error) {
    console.error("[voiceAssistant] Erro ao carregar preferências:", error);
  }
}

/**
 * Verifica se o assistente de voz está habilitado
 */
export function isVoiceAssistantEnabled() {
  return voiceAssistantState.enabled;
}

/**
 * Ativa ou desativa o assistente de voz
 * @param {boolean} enabled - Estado de ativação
 */
export function setVoiceAssistantEnabled(enabled) {
  voiceAssistantState.enabled = enabled;
  saveVoicePreferences();

  // Atualizar checkbox se existir
  const checkbox = document.getElementById("voice-enabled");
  if (checkbox) {
    checkbox.checked = enabled;
  }
}
