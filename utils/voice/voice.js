/**
 * voice.js
 * Módulo de configuração de vozes para o assistente
 */

import {
  initPremiumVoices,
  getBestPremiumVoice,
  setVoiceByName,
} from "./premiumVoices.js";

// Configurações globais de voz
let currentLanguage = "pt";
let currentVoice = null;
let voiceSelector = null;

/**
 * Cria o widget de seleção de voz
 */
export function createVoiceSelector() {
  // Verifica se o seletor já existe
  if (document.getElementById("assistant-voice-selector")) {
    return;
  }

  // Criar o widget de seleção de voz
  const selector = document.createElement("div");
  selector.id = "assistant-voice-selector";
  selector.className = "voice-selector-widget";

  selector.innerHTML = `
    <div class="voice-selector-header">
      <i class="fas fa-microphone-alt"></i>
      <span class="voice-title">Voz do Assistente</span>
    </div>
    <div class="voice-selector-content">
      <select id="voice-select">
        <option value="">Carregando vozes...</option>
      </select>
    </div>
  `;

  // Adiciona ao corpo do documento
  document.body.appendChild(selector);
  voiceSelector = document.getElementById("voice-select");

  // Configura o evento de alteração
  if (voiceSelector) {
    voiceSelector.addEventListener("change", (e) => {
      const selectedVoice = e.target.value;
      if (selectedVoice) {
        setVoiceByName(selectedVoice);
        currentVoice = selectedVoice;
      }
    });
  }
}

/**
 * Popula o seletor de vozes com as vozes disponíveis
 */
function populateVoiceSelector() {
  if (!voiceSelector) return;

  // Limpa o seletor
  voiceSelector.innerHTML = "";

  // Obtém todas as vozes disponíveis
  const voices = speechSynthesis.getVoices();
  const langVoices = voices.filter(
    (voice) =>
      voice.lang.startsWith(currentLanguage) ||
      (currentLanguage === "pt" && voice.lang.startsWith("pt-BR"))
  );

  if (langVoices.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma voz disponível";
    voiceSelector.appendChild(option);
    return;
  }

  // Adiciona as vozes filtradas
  langVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name}`;

    // Marca a voz premium
    if (isPremiumVoice(voice.name)) {
      option.textContent += " ★";
    }

    voiceSelector.appendChild(option);

    // Seleciona a voz atual, se definida
    if (currentVoice && voice.name === currentVoice) {
      option.selected = true;
    }
  });

  // Seleciona a melhor voz disponível se nenhuma estiver definida
  if (!currentVoice) {
    const bestVoice = getBestPremiumVoice(currentLanguage);
    if (bestVoice) {
      const option = [...voiceSelector.options].find(
        (o) => o.value === bestVoice.name
      );
      if (option) {
        option.selected = true;
        setVoiceByName(bestVoice.name);
        currentVoice = bestVoice.name;
      }
    }
  }
}

/**
 * Verifica se uma voz é premium
 * @param {string} voiceName - Nome da voz
 * @returns {boolean} - true se for premium
 */
function isPremiumVoice(voiceName) {
  const premiumNames = ["Google", "Microsoft", "Amazon", "Neural"];

  return premiumNames.some((name) => voiceName.includes(name));
}

/**
 * Inicializa o módulo de voz
 * @param {string} lang - Idioma (pt, en, es)
 */
export function initVoice(lang = "pt") {
  currentLanguage = lang;

  // Inicializa as vozes premium
  initPremiumVoices();

  // Cria o seletor de voz
  createVoiceSelector();

  // Aguarda o carregamento das vozes
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceSelector;
  } else {
    // Tenta carregar as vozes diretamente
    setTimeout(populateVoiceSelector, 1000);
  }

  // Restaura a voz selecionada anteriormente
  const savedVoice = localStorage.getItem("selectedVoice");
  if (savedVoice) {
    currentVoice = savedVoice;
  }
}

/**
 * Muda o idioma da voz
 * @param {string} lang - Novo idioma
 */
export function changeVoiceLanguage(lang) {
  if (currentLanguage !== lang) {
    currentLanguage = lang;
    populateVoiceSelector();
  }
}

/**
 * Processa entrada de voz
 */

// voice/speech-recognition.js
export class VoiceProcessor {
  constructor(config = {}) {
    this.config = this._mergeWithDefaultConfig(config);
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.selectedVoice = null;
    this.initialized = false;
  }

  async initialize() {
    // Verificar suporte a API de reconhecimento de voz
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn(
        "API de reconhecimento de voz não suportada neste navegador"
      );
      return this;
    }

    // Configurar reconhecimento de voz
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = this.config.language || "pt-BR";

    // Configurar event listeners
    this.recognition.onresult = this._handleRecognitionResult.bind(this);
    this.recognition.onerror = this._handleRecognitionError.bind(this);
    this.recognition.onend = this._handleRecognitionEnd.bind(this);

    // Carregar vozes disponíveis para síntese
    await this._loadVoices();

    this.initialized = true;
    return this;
  }

  startListening(callback, errorCallback) {
    if (!this.initialized) {
      console.warn("VoiceProcessor não inicializado");
      return false;
    }

    if (!this.recognition) {
      console.warn("API de reconhecimento de voz não disponível");
      return false;
    }

    this.onResultCallback = callback;
    this.onErrorCallback = errorCallback;

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error("Erro ao iniciar reconhecimento de voz:", error);
      return false;
    }
  }

  stopListening() {
    if (!this.isListening || !this.recognition) return false;

    try {
      this.recognition.stop();
      this.isListening = false;
      return true;
    } catch (error) {
      console.error("Erro ao parar reconhecimento de voz:", error);
      return false;
    }
  }

  async speak(text, options = {}) {
    if (!this.initialized) await this.initialize();

    if (!this.synthesis) {
      console.warn("API de síntese de voz não disponível");
      return false;
    }

    // Se já estiver falando, parar
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    // Criar nova instância de fala
    const utterance = new SpeechSynthesisUtterance(text);

    // Configurar parâmetros
    utterance.voice = this.selectedVoice;
    utterance.lang = options.lang || this.config.language || "pt-BR";
    utterance.rate = options.rate || this.config.rate || 1.0;
    utterance.pitch = options.pitch || this.config.pitch || 1.0;
    utterance.volume = options.volume || this.config.volume || 1.0;

    // Falar o texto
    this.synthesis.speak(utterance);

    return new Promise((resolve) => {
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
    });
  }

  setLanguage(language) {
    if (this.recognition) {
      this.recognition.lang = language;
    }

    this.config.language = language;

    // Atualizar voz selecionada para o idioma
    this._selectVoiceForLanguage(language);

    return this;
  }

  // Métodos internos
  _handleRecognitionResult(event) {
    if (!event.results || !event.results.length) return;

    const transcript = event.results[0][0].transcript;
    const confidence = event.results[0][0].confidence;

    console.log(
      `Reconhecimento de voz: "${transcript}" (confiança: ${confidence.toFixed(
        2
      )})`
    );

    if (this.onResultCallback && typeof this.onResultCallback === "function") {
      this.onResultCallback(transcript, confidence);
    }
  }

  _handleRecognitionError(event) {
    console.error("Erro no reconhecimento de voz:", event.error);

    if (this.onErrorCallback && typeof this.onErrorCallback === "function") {
      this.onErrorCallback(event.error);
    }

    this.isListening = false;
  }

  _handleRecognitionEnd() {
    this.isListening = false;
  }

  async _loadVoices() {
    // Verificar se vozes já estão disponíveis
    if (this.synthesis.getVoices().length > 0) {
      this.voices = this.synthesis.getVoices();
      this._selectVoiceForLanguage(this.config.language);
      return;
    }

    // Se não estiverem disponíveis, aguardar evento onvoiceschanged
    return new Promise((resolve) => {
      this.synthesis.onvoiceschanged = () => {
        this.voices = this.synthesis.getVoices();
        this._selectVoiceForLanguage(this.config.language);
        resolve();
      };
    });
  }

  _selectVoiceForLanguage(language) {
    // Mapeamento de código de idioma para código de voz
    const langMap = {
      pt: "pt-BR",
      en: "en-US",
      es: "es-ES",
      he: "he-IL",
    };

    const langCode = langMap[language] || language;

    // Buscar voz para o idioma
    let voice = this.voices.find((v) => v.lang === langCode);

    // Se não encontrar exatamente, procurar voz que comece com o código
    if (!voice) {
      voice = this.voices.find((v) =>
        v.lang.startsWith(langCode.split("-")[0])
      );
    }

    // Se ainda não encontrar, usar primeira voz disponível
    if (!voice && this.voices.length > 0) {
      voice = this.voices[0];
    }

    this.selectedVoice = voice;
  }

  _mergeWithDefaultConfig(config) {
    const defaultConfig = {
      language: "pt-BR",
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      enabled: true,
    };

    return { ...defaultConfig, ...config };
  }
}

export function handleVoiceInput() {
  console.log("Entrada de voz solicitada");

  if (
    !("webkitSpeechRecognition" in window) &&
    !("SpeechRecognition" in window)
  ) {
    addMessageToUI(
      "Desculpe, seu navegador não suporta reconhecimento de voz. Por favor, digite sua pergunta.",
      "assistant"
    );
    return;
  }

  addMessageToUI("Estou ouvindo...", "assistant");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const speechText = event.results[0][0].transcript;
    console.log("Texto reconhecido:", speechText);

    // Mostrar o que foi entendido
    showUserMessage(speechText);

    // Processar a mensagem
    setTimeout(() => {
      processUserMessage(speechText);
    }, 500);
  };

  recognition.onerror = (event) => {
    console.error(`Erro de reconhecimento: ${event.error}`);
    addMessageToUI(
      "Desculpe, não consegui entender. Pode tentar novamente ou digitar sua pergunta?",
      "assistant"
    );
  };

  recognition.start();
}

/**
 * Configura o reconhecimento e síntese de voz do assistente
 */
export function setupVoiceRecognition(config) {
  const { language, onResult, onError } = config;

  // Verificar suporte do navegador
  if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
    console.warn(
      "Assistente: Reconhecimento de voz não suportado neste navegador"
    );
    throw new Error("Reconhecimento de voz não suportado");
  }

  // Inicializar reconhecimento de voz
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // Mapear códigos de idioma para os formatos aceitos pelo SpeechRecognition
  const languageMap = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    he: "he-IL", // Adicionar código para hebraico
  };

  // Configurar
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = language || "pt-BR";

  // Flag para controlar estado
  let listening = false;

  // Eventos
  recognition.onresult = (event) => {
    const result = event.results[0][0].transcript;
    console.log("Assistente: Reconhecimento de voz recebido", result);

    if (typeof onResult === "function") {
      onResult(result, "voice");
    }

    // Parar de ouvir após processar o resultado
    listening = false;
  };

  recognition.onerror = (event) => {
    console.error("Assistente: Erro no reconhecimento de voz", event.error);
    listening = false;

    if (typeof onError === "function") {
      onError(event.error);
    }
  };

  recognition.onend = () => {
    listening = false;
  };

  // Métodos
  function start() {
    if (listening) return false;

    try {
      recognition.start();
      listening = true;
      console.log("Assistente: Reconhecimento de voz iniciado");
      return true;
    } catch (error) {
      console.error("Assistente: Erro ao iniciar reconhecimento de voz", error);
      listening = false;
      if (typeof onError === "function") {
        onError(error);
      }
      return false;
    }
  }

  function stop() {
    if (!listening) return false;

    try {
      recognition.stop();
      listening = false;
      console.log("Assistente: Reconhecimento de voz interrompido");
      return true;
    } catch (error) {
      console.error(
        "Assistente: Erro ao interromper reconhecimento de voz",
        error
      );
      return false;
    }
  }

  function isListening() {
    return listening;
  }

  function setLanguage(lang) {
    const mappedLang = languageMap[lang] || "pt-BR";
    recognition.lang = mappedLang;
    currentLanguage = lang;

    // Ajustar mensagens baseadas no idioma
    const messages = {
      pt: {
        start: "Escutando...",
        end: "Parei de escutar",
        error: "Erro ao reconhecer voz",
      },
      en: {
        start: "Listening...",
        end: "Stopped listening",
        error: "Voice recognition error",
      },
      es: {
        start: "Escuchando...",
        end: "Dejé de escuchar",
        error: "Error al reconocer la voz",
      },
      he: {
        start: "...מקשיב",
        end: "הפסקתי להקשיב",
        error: "שגיאה בזיהוי קול",
      },
    };

    voiceMessages = messages[lang] || messages["pt"];
  }

  // API pública
  return {
    start,
    stop,
    isListening,
    setLanguage,
  };
}

// Função modificada para garantir carregamento de vozes
async function initializeVoices() {
  return new Promise((resolve) => {
    const synthesis = window.speechSynthesis;

    // Se já tiver vozes, retornar imediatamente
    let voices = synthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Definir timeout para caso o evento nunca dispare
    let voicesLoaded = false;
    const timeoutId = setTimeout(() => {
      if (!voicesLoaded) {
        // Se o timeout expirar, retornar o que tiver ou array vazio
        console.warn("Timeout ao carregar vozes do navegador");
        resolve(synthesis.getVoices() || []);
      }
    }, 3000);

    // Escutar evento de carregamento de vozes
    synthesis.onvoiceschanged = () => {
      voicesLoaded = true;
      clearTimeout(timeoutId);
      voices = synthesis.getVoices();
      resolve(voices);
    };
  });
}

// Modificar a função speakMessage
async function speakMessage(text) {
  if (!config.enableVoice) return;

  try {
    // Cancelar qualquer fala em andamento
    window.speechSynthesis.cancel();

    // Garantir carregamento de vozes
    const voices = await initializeVoices();

    const utterance = new SpeechSynthesisUtterance(text);

    // Mapear idiomas para códigos
    const voiceLanguageMap = {
      pt: "pt-BR",
      en: "en-US",
      es: "es-ES",
      he: "he-IL",
    };

    const langCode = voiceLanguageMap[config.language] || "pt-BR";
    utterance.lang = langCode;

    // Encontrar voz para o idioma (busca progressiva)
    let voiceForLanguage = voices.find((voice) => voice.lang === langCode);

    // Se não encontrar correspondência exata, tente pela primeira parte do código
    if (!voiceForLanguage) {
      const langPrefix = langCode.split("-")[0];
      voiceForLanguage = voices.find((voice) =>
        voice.lang.startsWith(langPrefix)
      );
    }

    // Se ainda não encontrar, tente qualquer voz que inclua o código
    if (!voiceForLanguage && config.language === "he") {
      voiceForLanguage = voices.find((voice) => voice.lang.includes("he"));
    }

    // Aplicar voz encontrada
    if (voiceForLanguage) {
      utterance.voice = voiceForLanguage;
    }

    // Ajustes específicos para idioma hebraico
    if (config.language === "he") {
      utterance.rate = 0.9; // Mais lento para hebraico
      utterance.pitch = 1.1; // Leve ajuste de tom
    }

    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Assistente: Erro ao sintetizar voz", error);
  }
}
