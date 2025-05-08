/**
 * assistant-speech.js
 *
 * Módulo centralizado que gerencia todas as funcionalidades relacionadas à fala do assistente.
 * Responsável por:
 * - Síntese de voz (text-to-speech)
 * - Controle de fala (pausar, parar, ajustar velocidade)
 * - Gerenciamento de vozes disponíveis
 * - Suporte a múltiplos idiomas
 * - Integração com serviços avançados como Azure TTS
 */

// Importando o suporte a vozes específicas para hebraico (se disponível)
import { googleTranslateTTS } from "../../utils/voice/hebrewVoiceSupport.js";

// Estado global do sistema de fala
const speechState = {
  isSpeaking: false,
  isPaused: false,
  currentUtterance: null,
  queue: [],
  muted: false,
  voicePreferences: {
    voiceName: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: "pt-BR", // Idioma padrão
  },
  hebrewMode: false,
};

/**
 * Inicializa o sistema de fala
 * @param {Object} options - Opções de inicialização
 */
export function initSpeech(options = {}) {
  console.log("[assistant-speech] Inicializando sistema de fala");

  // Carregar preferências salvas
  loadVoicePreferences();

  // Sobrescrever com opções fornecidas
  if (options.voiceName)
    speechState.voicePreferences.voiceName = options.voiceName;
  if (options.rate !== undefined)
    speechState.voicePreferences.rate = options.rate;
  if (options.pitch !== undefined)
    speechState.voicePreferences.pitch = options.pitch;
  if (options.volume !== undefined)
    speechState.voicePreferences.volume = options.volume;
  if (options.language)
    speechState.voicePreferences.language = options.language;
  if (options.muted !== undefined) speechState.muted = options.muted;

  // Verificar suporte a fala
  if (typeof window.speechSynthesis === "undefined") {
    console.warn(
      "[assistant-speech] API de síntese de fala não suportada neste navegador"
    );
    return false;
  }

  // Cancelar qualquer fala pendente
  window.speechSynthesis.cancel();

  // Carregar vozes disponíveis
  loadVoicesWhenAvailable();

  // Inicializar ouvintes de eventos
  setupSpeechEvents();

  // Verificar e sincronizar com o localStorage
  syncWithLocalStorage();

  console.log("[assistant-speech] Sistema de fala iniciado com sucesso");
  console.log("[assistant-speech] Configurações:", {
    voiceName: speechState.voicePreferences.voiceName,
    rate: speechState.voicePreferences.rate,
    language: speechState.voicePreferences.language,
    muted: speechState.muted,
  });

  return true;
}

/**
 * Sincroniza o estado com o localStorage
 */
function syncWithLocalStorage() {
  try {
    // Sincronizar estado mudo com localStorage
    const voiceEnabled = localStorage.getItem("voice-enabled");
    if (voiceEnabled !== null) {
      const shouldBeMuted = voiceEnabled === "false";
      if (speechState.muted !== shouldBeMuted) {
        console.log(
          `[assistant-speech] Sincronizando estado mudo com localStorage: ${shouldBeMuted}`
        );
        speechState.muted = shouldBeMuted;
      }
    } else {
      // Se não existir configuração no localStorage, criar uma
      localStorage.setItem(
        "voice-enabled",
        speechState.muted ? "false" : "true"
      );
    }

    // Atualizar elementos da UI se existirem
    const voiceToggle = document.getElementById("voice-enabled-toggle");
    if (voiceToggle) {
      voiceToggle.checked = !speechState.muted;
    }
  } catch (error) {
    console.error(
      "[assistant-speech] Erro ao sincronizar com localStorage:",
      error
    );
  }
}
/**
 * Configura eventos relacionados à fala
 */
function setupSpeechEvents() {
  // Capturar evento de troca de idioma
  document.addEventListener("languageChanged", (e) => {
    const newLang = e.detail.language;
    setLanguage(newLang);
    console.log(`[assistant-speech] Idioma alterado para: ${newLang}`);
  });

  // Adicionar ouvinte para eventos de mudança de voz
  document.addEventListener("voice:changed", (e) => {
    const voiceDetails = e.detail;
    if (voiceDetails && voiceDetails.name) {
      setVoice(voiceDetails.name);
    }
  });
}

/**
 * Aguarda vozes disponíveis e executa callback quando estiverem prontas
 */
function loadVoicesWhenAvailable() {
  const synth = window.speechSynthesis;

  // Função que carrega as vozes
  const loadVoices = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      console.log(`[assistant-speech] ${voices.length} vozes disponíveis`);
      selectBestVoiceForLanguage();
    }
  };

  // Se as vozes já estiverem disponíveis
  if (synth.getVoices().length > 0) {
    loadVoices();
  }

  // Se as vozes ainda não estiverem disponíveis, aguardar pelo evento
  if ("onvoiceschanged" in synth) {
    synth.onvoiceschanged = loadVoices;
  }
}

/**
 * Converte texto para fala usando a API padrão do navegador
 * @param {string} text - Texto a ser sintetizado
 * @param {Object} options - Opções adicionais (voz, velocidade, etc)
 * @returns {Promise<void>} - Promise que resolve quando a fala termina
 */
export function speak(text, options = {}) {
  return new Promise((resolve, reject) => {
    // Verificar se está mudo
    if (speechState.muted) {
      console.log("[assistant-speech] Sistema mudo, ignorando fala");
      resolve();
      return;
    }

    // Se texto estiver vazio ou for inválido
    if (!text || typeof text !== "string" || text.trim() === "") {
      console.warn("[assistant-speech] Texto vazio ou inválido");
      resolve();
      return;
    }

    // Limpar HTML e preparar texto para fala
    text = cleanTextForSpeech(text);

    // Verificar se é hebraico para usar TTS especializado
    if (isHebrewText(text) || speechState.hebrewMode) {
      speakHebrew(text).then(resolve).catch(reject);
      return;
    }

    // Cancelar fala atual se necessário
    if (speechState.isSpeaking && options.interrupt !== false) {
      stopSpeaking();
    }

    // Criar nova utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Configurar voz e parâmetros
    configureUtterance(utterance, options);

    // Configurar callbacks
    utterance.onend = () => {
      speechState.isSpeaking = false;
      speechState.currentUtterance = null;
      processQueue();
      resolve();
    };

    utterance.onerror = (event) => {
      console.error("[assistant-speech] Erro na síntese de fala:", event);
      speechState.isSpeaking = false;
      speechState.currentUtterance = null;
      processQueue();
      reject(new Error(event.error));
    };

    // Se já estiver falando, enfileirar (exceto se for para interromper)
    if (speechState.isSpeaking && options.interrupt === false) {
      speechState.queue.push({ utterance, resolve, reject });
      console.log(
        "[assistant-speech] Fala enfileirada:",
        text.substring(0, 30) + "..."
      );
      return;
    }

    // Iniciar fala
    try {
      speechState.isSpeaking = true;
      speechState.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      console.log(
        "[assistant-speech] Iniciando fala:",
        text.substring(0, 30) + "..."
      );
    } catch (error) {
      console.error("[assistant-speech] Erro ao iniciar fala:", error);
      speechState.isSpeaking = false;
      speechState.currentUtterance = null;
      reject(error);
    }
  });
}

/**
 * Configura os parâmetros da utterance
 * @param {SpeechSynthesisUtterance} utterance - Objeto utterance
 * @param {Object} options - Opções de configuração
 */
function configureUtterance(utterance, options) {
  // Aplicar preferências padrão
  utterance.rate = speechState.voicePreferences.rate;
  utterance.pitch = speechState.voicePreferences.pitch;
  utterance.volume = speechState.voicePreferences.volume;
  utterance.lang = speechState.voicePreferences.language;

  // Sobrescrever com opções específicas
  if (options.rate) utterance.rate = options.rate;
  if (options.pitch) utterance.pitch = options.pitch;
  if (options.volume) utterance.volume = options.volume;
  if (options.language) utterance.lang = options.language;

  // Selecionar voz apropriada
  const voices = window.speechSynthesis.getVoices();

  // Prioridade de seleção de voz:
  // 1. Voz especificada nas opções
  // 2. Voz salva nas preferências
  // 3. Melhor voz disponível para o idioma atual

  let selectedVoice = null;

  if (options.voiceName) {
    selectedVoice = voices.find((v) => v.name === options.voiceName);
  }

  if (!selectedVoice && speechState.voicePreferences.voiceName) {
    selectedVoice = voices.find(
      (v) => v.name === speechState.voicePreferences.voiceName
    );
  }

  if (!selectedVoice) {
    // Buscar vozes para o idioma atual
    const langPrefix = utterance.lang.split("-")[0].toLowerCase();
    const matchingVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(langPrefix)
    );

    if (matchingVoices.length > 0) {
      // Prefere vozes femininas se disponíveis
      const femaleVoice = matchingVoices.find(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("feminina")
      );
      selectedVoice = femaleVoice || matchingVoices[0];
    }
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
}

/**
 * Processa a fila de falas pendentes
 */
function processQueue() {
  if (speechState.queue.length === 0) return;

  const nextItem = speechState.queue.shift();

  try {
    speechState.isSpeaking = true;
    speechState.currentUtterance = nextItem.utterance;
    window.speechSynthesis.speak(nextItem.utterance);
    console.log("[assistant-speech] Processando próximo item da fila");
  } catch (error) {
    console.error("[assistant-speech] Erro ao processar fila:", error);
    speechState.isSpeaking = false;
    speechState.currentUtterance = null;
    nextItem.reject(error);
    processQueue();
  }
}

/**
 * Fala texto em hebraico usando serviço especializado
 * @param {string} text - Texto em hebraico
 * @returns {Promise<void>} - Promise que resolve quando terminar
 */
function speakHebrew(text) {
  return new Promise((resolve, reject) => {
    try {
      console.log("[assistant-speech] Usando TTS especializado para hebraico");
      if (typeof googleTranslateTTS === "function") {
        googleTranslateTTS(text)
          .then(resolve)
          .catch((error) => {
            console.error(
              "[assistant-speech] Erro no TTS especializado para hebraico:",
              error
            );
            // Fallback para TTS padrão
            fallbackSpeakHebrew(text).then(resolve).catch(reject);
          });
      } else {
        console.warn(
          "[assistant-speech] Função googleTranslateTTS não encontrada, usando fallback"
        );
        fallbackSpeakHebrew(text).then(resolve).catch(reject);
      }
    } catch (error) {
      console.error(
        "[assistant-speech] Erro ao sintetizar voz hebraica:",
        error
      );
      reject(error);
    }
  });
}

/**
 * Fallback para falar hebraico usando as vozes do navegador
 * @param {string} text - Texto em hebraico
 */
function fallbackSpeakHebrew(text) {
  return new Promise((resolve, reject) => {
    // Criar nova utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "he-IL";

    // Procurar por vozes em hebraico
    const voices = window.speechSynthesis.getVoices();
    const hebrewVoice = voices.find((v) => v.lang.startsWith("he"));

    if (hebrewVoice) {
      utterance.voice = hebrewVoice;
    }

    // Configurar callbacks
    utterance.onend = () => {
      speechState.isSpeaking = false;
      speechState.currentUtterance = null;
      resolve();
    };

    utterance.onerror = (event) => {
      console.error(
        "[assistant-speech] Erro no fallback para hebraico:",
        event
      );
      speechState.isSpeaking = false;
      speechState.currentUtterance = null;
      reject(new Error(event.error));
    };

    // Iniciar fala
    try {
      speechState.isSpeaking = true;
      speechState.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error(
        "[assistant-speech] Erro no fallback para hebraico:",
        error
      );
      speechState.isSpeaking = false;
      reject(error);
    }
  });
}

/**
 * Para imediatamente qualquer fala em andamento
 */
export function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
    speechState.isSpeaking = false;
    speechState.currentUtterance = null;
    speechState.queue = [];
    console.log("[assistant-speech] Fala interrompida");
  } catch (error) {
    console.error("[assistant-speech] Erro ao interromper fala:", error);
  }
}

/**
 * Pausa a fala atual
 */
export function pauseSpeaking() {
  try {
    if (speechState.isSpeaking && !speechState.isPaused) {
      window.speechSynthesis.pause();
      speechState.isPaused = true;
      console.log("[assistant-speech] Fala pausada");
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao pausar fala:", error);
  }
}

/**
 * Continua a fala após pausa
 */
export function resumeSpeaking() {
  try {
    if (speechState.isSpeaking && speechState.isPaused) {
      window.speechSynthesis.resume();
      speechState.isPaused = false;
      console.log("[assistant-speech] Fala retomada");
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao retomar fala:", error);
  }
}

/**
 * Ativa ou desativa o modo mudo
 * @param {boolean} muted - Se o sistema deve estar mudo
 */
export function setMuted(muted) {
  const wasMuted = speechState.muted;
  speechState.muted = muted;

  // Se estiver mudando de estado
  if (wasMuted !== muted) {
    // Disparar evento para atualizar a interface
    const event = new CustomEvent("voice:muted:changed", {
      detail: { muted },
    });
    document.dispatchEvent(event);

    // Se estiver ativando o mudo, parar fala atual
    if (muted && speechState.isSpeaking) {
      stopSpeaking();
    }

    // Salvar a preferência
    try {
      localStorage.setItem("voice-enabled", muted ? "false" : "true");
    } catch (error) {
      console.error("[assistant-speech] Erro ao salvar estado mudo:", error);
    }

    console.log(
      `[assistant-speech] Modo mudo ${muted ? "ativado" : "desativado"}`
    );
  }
}

/**
 * Verifica se o sistema está mudo
 * @returns {boolean} - Estado mudo
 */
export function isMuted() {
  return speechState.muted;
}

/**
 * Define o idioma para síntese de voz
 * @param {string} lang - Código do idioma (ex: 'pt', 'en', 'es', 'he')
 */
export function setLanguage(lang) {
  // Converter código curto para formato completo
  const langMap = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    he: "he-IL",
  };

  const fullLang = langMap[lang] || "pt-BR";

  // Definir no estado
  speechState.voicePreferences.language = fullLang;

  // Verificar se é hebraico para ativar modo especial
  speechState.hebrewMode = lang === "he";

  // Selecionar melhor voz para o idioma
  selectBestVoiceForLanguage();

  // Salvar preferência
  try {
    speechState.voicePreferences.language = fullLang;
    saveVoicePreferences();
  } catch (error) {
    console.error("[assistant-speech] Erro ao salvar idioma:", error);
  }

  console.log(`[assistant-speech] Idioma de fala alterado para: ${fullLang}`);
}

/**
 * Seleciona a melhor voz disponível para o idioma atual
 */
function selectBestVoiceForLanguage() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  // Obter código do idioma (primeiros 2 caracteres)
  const langPrefix = speechState.voicePreferences.language
    .split("-")[0]
    .toLowerCase();

  // Filtrar vozes que correspondem ao idioma
  const matchingVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langPrefix)
  );

  if (matchingVoices.length > 0) {
    // Tentar encontrar uma voz feminina
    const femaleVoice = matchingVoices.find(
      (v) =>
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("feminina") ||
        v.name.toLowerCase().includes("mulher")
    );

    // Usar voz feminina ou primeira disponível
    const bestVoice = femaleVoice || matchingVoices[0];

    // Atualizar preferência
    speechState.voicePreferences.voiceName = bestVoice.name;
    saveVoicePreferences();

    console.log(
      `[assistant-speech] Melhor voz selecionada para ${langPrefix}: ${bestVoice.name}`
    );
  } else {
    console.warn(
      `[assistant-speech] Nenhuma voz encontrada para o idioma ${langPrefix}`
    );
  }
}

/**
 * Define a voz a ser usada por nome
 * @param {string} voiceName - Nome da voz
 */
export function setVoice(voiceName) {
  try {
    // Verificar se a voz existe
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.name === voiceName);

    if (voice) {
      speechState.voicePreferences.voiceName = voiceName;
      saveVoicePreferences();
      console.log(`[assistant-speech] Voz definida: ${voiceName}`);
      return true;
    } else {
      console.warn(`[assistant-speech] Voz não encontrada: ${voiceName}`);
      return false;
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao definir voz:", error);
    return false;
  }
}

/**
 * Define a velocidade de fala
 * @param {number} rate - Taxa de velocidade (0.1 a 10)
 */
export function setRate(rate) {
  try {
    if (typeof rate === "number" && rate >= 0.1 && rate <= 10) {
      speechState.voicePreferences.rate = rate;
      saveVoicePreferences();
      console.log(`[assistant-speech] Velocidade definida: ${rate}`);
      return true;
    } else {
      console.warn(`[assistant-speech] Valor de velocidade inválido: ${rate}`);
      return false;
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao definir velocidade:", error);
    return false;
  }
}

/**
 * Define o volume da fala
 * @param {number} volume - Volume (0 a 1)
 */
export function setVolume(volume) {
  try {
    if (typeof volume === "number" && volume >= 0 && volume <= 1) {
      speechState.voicePreferences.volume = volume;
      saveVoicePreferences();
      console.log(`[assistant-speech] Volume definido: ${volume}`);
      return true;
    } else {
      console.warn(`[assistant-speech] Valor de volume inválido: ${volume}`);
      return false;
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao definir volume:", error);
    return false;
  }
}

/**
 * Define o tom da voz
 * @param {number} pitch - Tom (0.1 a 2)
 */
export function setPitch(pitch) {
  try {
    if (typeof pitch === "number" && pitch >= 0.1 && pitch <= 2) {
      speechState.voicePreferences.pitch = pitch;
      saveVoicePreferences();
      console.log(`[assistant-speech] Tom definido: ${pitch}`);
      return true;
    } else {
      console.warn(`[assistant-speech] Valor de tom inválido: ${pitch}`);
      return false;
    }
  } catch (error) {
    console.error("[assistant-speech] Erro ao definir tom:", error);
    return false;
  }
}

/**
 * Obtém lista de vozes disponíveis
 * @returns {Array} - Lista de vozes
 */
export function getAvailableVoices() {
  try {
    return window.speechSynthesis.getVoices();
  } catch (error) {
    console.error("[assistant-speech] Erro ao obter vozes:", error);
    return [];
  }
}

/**
 * Verifica se o texto contém caracteres hebraicos
 * @param {string} text - Texto a ser verificado
 * @returns {boolean} - Verdadeiro se contém hebraico
 */
function isHebrewText(text) {
  // Expressão regular para caracteres hebraicos
  const hebrewRegex = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
  return hebrewRegex.test(text);
}

/**
 * Limpa o texto HTML para síntese de voz
 * @param {string} html - Texto com possíveis tags HTML
 * @returns {string} - Texto limpo
 */
export function cleanTextForSpeech(html) {
  if (!html) return "";

  try {
    // Criar elemento temporário
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Processar elementos específicos

    // Substituir <br> por espaços
    const brs = temp.querySelectorAll("br");
    brs.forEach((br) => br.replaceWith(" "));

    // Tratar listas
    const listItems = temp.querySelectorAll("li");
    listItems.forEach((li) => {
      li.prepend("• "); // Adicionar bullet point
    });

    // Obter texto sem HTML
    let text = temp.textContent || temp.innerText || "";

    // Limpar espaços extras
    text = text.replace(/\s+/g, " ").trim();

    // Garantir pontuação para pausas naturais
    if (text && !text.match(/[.,:;?!]$/)) {
      text += ".";
    }

    return text;
  } catch (error) {
    console.error("[assistant-speech] Erro ao limpar texto:", error);
    // Fallback simples: remover todas as tags
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

/**
 * Carrega preferências de voz salvas
 */
function loadVoicePreferences() {
  try {
    // Verificar estado mudo
    const voiceEnabled = localStorage.getItem("voice-enabled");
    if (voiceEnabled === "false") {
      speechState.muted = true;
    }

    // Outras preferências
    const savedVoice = localStorage.getItem("assistant-voice");
    const savedRate = parseFloat(localStorage.getItem("voice-speed") || "1.0");
    const savedVolume = parseFloat(
      localStorage.getItem("voice-volume") || "1.0"
    );
    const savedPitch = parseFloat(localStorage.getItem("voice-pitch") || "1.0");
    const savedLanguage =
      localStorage.getItem("voice-language") ||
      speechState.voicePreferences.language;

    if (savedVoice) speechState.voicePreferences.voiceName = savedVoice;
    if (!isNaN(savedRate)) speechState.voicePreferences.rate = savedRate;
    if (!isNaN(savedVolume)) speechState.voicePreferences.volume = savedVolume;
    if (!isNaN(savedPitch)) speechState.voicePreferences.pitch = savedPitch;
    if (savedLanguage) speechState.voicePreferences.language = savedLanguage;

    console.log("[assistant-speech] Preferências de voz carregadas");
  } catch (error) {
    console.error(
      "[assistant-speech] Erro ao carregar preferências de voz:",
      error
    );
  }
}

/**
 * Salva preferências de voz
 */
function saveVoicePreferences() {
  try {
    const prefs = speechState.voicePreferences;

    localStorage.setItem("assistant-voice", prefs.voiceName || "");
    localStorage.setItem("voice-speed", prefs.rate.toString());
    localStorage.setItem("voice-volume", prefs.volume.toString());
    localStorage.setItem("voice-pitch", prefs.pitch.toString());
    localStorage.setItem("voice-language", prefs.language);
    localStorage.setItem("voice-enabled", speechState.muted ? "false" : "true");

    console.log("[assistant-speech] Preferências de voz salvas");
  } catch (error) {
    console.error(
      "[assistant-speech] Erro ao salvar preferências de voz:",
      error
    );
  }
}

/**
 * Atualiza as configurações de voz
 * @param {Object} settings - Novas configurações
 */
export function updateVoiceSettings(settings = {}) {
  try {
    // Atualizar configurações fornecidas
    if (settings.voiceName)
      speechState.voicePreferences.voiceName = settings.voiceName;
    if (settings.rate !== undefined)
      speechState.voicePreferences.rate = settings.rate;
    if (settings.pitch !== undefined)
      speechState.voicePreferences.pitch = settings.pitch;
    if (settings.volume !== undefined)
      speechState.voicePreferences.volume = settings.volume;
    if (settings.language)
      speechState.voicePreferences.language = settings.language;
    if (settings.muted !== undefined) setMuted(settings.muted);

    // Salvar as novas preferências
    saveVoicePreferences();

    console.log(
      "[assistant-speech] Configurações de voz atualizadas:",
      settings
    );
    return true;
  } catch (error) {
    console.error(
      "[assistant-speech] Erro ao atualizar configurações de voz:",
      error
    );
    return false;
  }
}

/**
 * Obtém o estado atual do sistema de fala
 * @returns {Object} - Estado atual
 */
export function getSpeechState() {
  // Retorna uma cópia para evitar modificações diretas
  return {
    isSpeaking: speechState.isSpeaking,
    isPaused: speechState.isPaused,
    muted: speechState.muted,
    preferences: { ...speechState.voicePreferences },
    queueSize: speechState.queue.length,
    hebrewMode: speechState.hebrewMode,
  };
}

export default {
  initSpeech,
  speak,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  setMuted,
  isMuted,
  setLanguage,
  setVoice,
  setRate,
  setVolume,
  setPitch,
  getAvailableVoices,
  cleanTextForSpeech,
  updateVoiceSettings,
  getSpeechState,
};
