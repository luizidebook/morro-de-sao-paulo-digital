// voiceSystem.js - Gerenciamento de voz do assistente

/**
 * Sistema de voz para o Morro Digital
 * Fornece funções para sintetizar voz em diferentes idiomas
 */

let voiceConfig = {
  isMuted: false,
  volume: 0.8,
  rate: 1.0,
  pitch: 1.0,
  selectedVoice: null,
  lang: "pt-BR",
};

// Carrega configurações salvas
function loadVoiceSettings() {
  const saved = localStorage.getItem("voiceConfig");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      voiceConfig = { ...voiceConfig, ...parsed };
    } catch (e) {
      console.error("Erro ao carregar configurações de voz:", e);
    }
  }
}

// Salva configurações atuais
function saveVoiceSettings() {
  localStorage.setItem("voiceConfig", JSON.stringify(voiceConfig));
}

/**
 * Inicializa as configurações de voz
 * @param {string} lang Idioma preferido (ex: "pt-BR", "en-US")
 */
export function initVoice(lang = "pt-BR") {
  loadVoiceSettings();
  if (lang) voiceConfig.lang = lang;

  // Verificar se há preferência salva para o estado mudo
  const savedVoiceEnabled = localStorage.getItem("voice-enabled");
  if (savedVoiceEnabled !== null) {
    voiceConfig.isMuted = savedVoiceEnabled === "false";
    console.log(
      `[voiceSystem] Voz ${
        voiceConfig.isMuted ? "desativada" : "ativada"
      } (carregado da preferência)`
    );
  }

  // Carrega vozes disponíveis
  if (window.speechSynthesis) {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Em alguns navegadores, as vozes são carregadas assincronamente
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        selectBestVoice(voices);
      };
    } else {
      selectBestVoice(voices);
    }
  }

  // Cria o botão seletor de voz se ainda não existir
  createVoiceSelectorButton();

  console.log(
    `[voiceSystem] Sistema de voz inicializado (${voiceConfig.lang})`
  );
}

/**
 * Seleciona a melhor voz disponível para o idioma atual
 * @param {Array} voices Lista de vozes disponíveis
 */
function selectBestVoice(voices) {
  // Procura primeiro por vozes premium/enhanced para o idioma
  let preferred = voices.find(
    (v) => v.lang.includes(voiceConfig.lang) && v.localService === false
  );

  // Caso não encontre, procura por qualquer voz do idioma
  if (!preferred) {
    preferred = voices.find((v) => v.lang.includes(voiceConfig.lang));
  }

  // Se ainda não encontrou, usa qualquer voz disponível
  if (!preferred && voices.length > 0) {
    preferred = voices[0];
  }

  if (preferred) {
    voiceConfig.selectedVoice = preferred.name;
    console.log(`[voiceSystem] Voz selecionada: ${preferred.name}`);
  }

  saveVoiceSettings();
}

/**
 * Fala o texto fornecido usando a voz configurada
 * @param {string} text Texto a ser falado
 */
export function speak(text) {
  // Verificar novamente o localStorage para garantir que temos o valor mais recente
  const voiceEnabled = localStorage.getItem("voice-enabled") !== "false";
  const isMuted = !voiceEnabled || voiceConfig.isMuted;

  if (!window.speechSynthesis || isMuted || !text) {
    console.log(
      `[voiceSystem] speak() - Voz desativada ou sem texto: isMuted=${isMuted}, text=${!!text}`
    );
    return;
  }

  console.log(
    `[voiceSystem] speak() - Sintetizando: "${text.substring(0, 30)}..."`
  );

  // Limpa o texto de tags HTML e caracteres especiais
  const cleanedText = cleanTextForSpeech(text);

  // Verificar o idioma atual
  const isHebrew =
    voiceConfig.lang.startsWith("he") || document.documentElement.lang === "he";

  // Verificar se estamos usando o fallback para Google TTS em hebraico
  const savedVoice = localStorage.getItem("assistant-voice");

  if (
    (savedVoice === "google-hebrew-tts" || isHebrew) &&
    voiceConfig.lang.startsWith("he")
  ) {
    console.log("[voiceSystem] Usando suporte especial para hebraico");
    // Usar o módulo de suporte a hebraico
    import("./hebrewVoiceSupport.js")
      .then((module) => {
        module.speakHebrew(cleanedText);
      })
      .catch((error) => {
        console.error(
          "[voiceSystem] Erro ao carregar suporte a hebraico:",
          error
        );
        // Falhou, tentar método normal
        speakWithDefaultSynthesis(cleanedText);
      });
    return;
  }

  // Método de síntese padrão
  speakWithDefaultSynthesis(cleanedText);
}

// Função auxiliar para síntese padrão
function speakWithDefaultSynthesis(cleanedText) {
  // Cancelar qualquer fala em andamento
  window.speechSynthesis.cancel();

  // Cria e configura o objeto de fala
  const utterance = new SpeechSynthesisUtterance(cleanedText);

  // Aplicar configurações salvas
  const savedVoice =
    localStorage.getItem("assistant-voice") || voiceConfig.selectedVoice;
  const savedSpeed = parseFloat(
    localStorage.getItem("voice-speed") || voiceConfig.rate
  );

  // Aplicar velocidade
  utterance.rate = savedSpeed;

  // Aplicar volume e tom
  utterance.volume = voiceConfig.volume;
  utterance.pitch = voiceConfig.pitch;

  // Definir idioma
  utterance.lang = voiceConfig.lang;

  // Definir a voz
  if (savedVoice && savedVoice !== "google-hebrew-tts") {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((v) => v.name === savedVoice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      console.warn(`[voiceSystem] Voz não encontrada: ${savedVoice}`);
    }
  }

  // Falar o texto
  window.speechSynthesis.speak(utterance);
}

/**
 * Limpa o texto de tags HTML e formata para fala
 * @param {string} text Texto com possíveis tags HTML
 * @returns {string} Texto limpo para fala
 */
export function cleanTextForSpeech(text) {
  if (!text) return "";

  // Remove tags HTML
  let cleaned = text.replace(/<[^>]*>/g, " ");

  // Substitui caracteres especiais
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");

  // Remove espaços extras
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Ativa/desativa o modo mudo
 * @param {boolean} muted Estado mudo (true/false)
 */
export function setMuted(muted) {
  // Garantir que o valor seja um booleano
  muted = Boolean(muted);
  voiceConfig.isMuted = muted;

  console.log(
    `[voiceSystem] setMuted(${muted}): Voz ${muted ? "desativada" : "ativada"}`
  );

  // Salvar no localStorage como string - IMPORTANTE: manter consistência entre arquivos
  localStorage.setItem("voice-enabled", muted ? "false" : "true"); // Observe a inversão: mudo=true → habilitado=false

  // DEBUG: Verificar se o valor foi salvo corretamente
  console.log(
    `[voiceSystem] voice-enabled no localStorage após setMuted: ${localStorage.getItem(
      "voice-enabled"
    )}`
  );

  // Verificar se o valor do checkbox está sincronizado
  const voiceToggle = document.getElementById("voice-enabled-toggle");
  if (voiceToggle) {
    const shouldBeChecked = !muted;
    if (voiceToggle.checked !== shouldBeChecked) {
      console.log(
        `[voiceSystem] Sincronizando checkbox: ${voiceToggle.checked} → ${shouldBeChecked}`
      );
      voiceToggle.checked = shouldBeChecked;
    }
  } else {
    console.log(
      "[voiceSystem] Elemento voice-enabled-toggle não encontrado no DOM"
    );
  }

  saveVoiceSettings();

  // Para qualquer fala em andamento se estiver mutando
  if (muted) window.speechSynthesis.cancel();

  // Atualiza o ícone do botão se existir
  updateVoiceSelectorButton();

  // Disparar evento para outros módulos saberem da mudança
  document.dispatchEvent(
    new CustomEvent("voice:muted:changed", {
      detail: { muted: voiceConfig.isMuted },
    })
  );

  return voiceConfig.isMuted;
}

/**
 * Verifica se a voz está em modo mudo
 * @returns {boolean} Estado do modo mudo
 */
export function isMuted() {
  // Verificar diretamente o localStorage para garantir consistência
  return localStorage.getItem("voice-enabled") === "false";
}

/**
 * Alterna entre modo mudo e com som
 * @returns {boolean} Novo estado do modo mudo
 */
export function toggleMute() {
  setMuted(!voiceConfig.isMuted);
  return voiceConfig.isMuted;
}

/**
 * Cria o botão seletor de voz na interface
 */
function createVoiceSelectorButton() {
  // Verifica se já existe
  let btn = document.getElementById("assistant-voice-selector");
  if (btn) return;

  // Cria o botão
  btn = document.createElement("button");
  btn.id = "assistant-voice-selector";
  btn.className = "assistant-voice-selector";
  btn.title = "Configurações de voz";

  // Define o ícone baseado no estado atual
  updateVoiceSelectorButton(btn);

  // Adiciona o evento de clique
  btn.addEventListener("click", showVoiceOptions);

  // Adiciona ao corpo do documento
  document.body.appendChild(btn);
}

/**
 * Atualiza o ícone do botão seletor de voz
 * @param {HTMLElement} btn Botão a ser atualizado (opcional)
 */
function updateVoiceSelectorButton(btn) {
  btn = btn || document.getElementById("assistant-voice-selector");
  if (!btn) return;

  if (voiceConfig.isMuted) {
    btn.innerHTML = `<i class="fas fa-volume-mute"></i>`;
  } else {
    btn.innerHTML = `<i class="fas fa-volume-up"></i>`;
  }
}

/**
 * Mostra as opções de configuração de voz
 */
function showVoiceOptions() {
  // Verifica se já existe um painel aberto e o remove
  const existingPanel = document.getElementById("voice-options-panel");
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  // Obtém vozes disponíveis
  const voices = window.speechSynthesis.getVoices();

  // Cria o painel de opções
  const panel = document.createElement("div");
  panel.id = "voice-options-panel";
  panel.className = "voice-options-panel";

  // Conteúdo do painel
  panel.innerHTML = `
    <div class="voice-options-header">
      <h3>Configurações de Voz</h3>
      <button class="voice-close-btn">&times;</button>
    </div>
    <div class="voice-options-content">
      <label class="voice-option">
        <span>Voz:</span>
        <select id="voice-selector">
          ${voices
            .filter((v) => v.lang.includes(voiceConfig.lang.substr(0, 2)))
            .map(
              (v) =>
                `<option value="${v.name}" ${
                  v.name === voiceConfig.selectedVoice ? "selected" : ""
                }>${v.name} (${v.lang})</option>`
            )
            .join("")}
        </select>
      </label>
      
      <label class="voice-option">
        <span>Volume:</span>
        <input type="range" id="voice-volume" min="0" max="1" step="0.1" value="${
          voiceConfig.volume
        }">
      </label>
      
      <label class="voice-option">
        <span>Velocidade:</span>
        <input type="range" id="voice-rate" min="0.5" max="2" step="0.1" value="${
          voiceConfig.rate
        }">
      </label>
      
      <label class="voice-option">
        <span>Tonalidade:</span>
        <input type="range" id="voice-pitch" min="0.5" max="2" step="0.1" value="${
          voiceConfig.pitch
        }">
      </label>
      
      <label class="voice-option">
        <span>Mudo:</span>
        <input type="checkbox" id="voice-muted" ${
          voiceConfig.isMuted ? "checked" : ""
        }>
      </label>
      
      <button id="test-voice-btn">Testar Voz</button>
    </div>
  `;

  // Adiciona ao corpo do documento
  document.body.appendChild(panel);

  // Posicionamento relativo ao botão
  const btnRect = document
    .getElementById("assistant-voice-selector")
    .getBoundingClientRect();

  panel.style.top = btnRect.bottom + 5 + "px";
  panel.style.right = window.innerWidth - btnRect.right + "px";

  // Adiciona eventos aos controles
  document
    .getElementById("voice-selector")
    .addEventListener("change", function () {
      voiceConfig.selectedVoice = this.value;
      saveVoiceSettings();
    });

  document
    .getElementById("voice-volume")
    .addEventListener("input", function () {
      voiceConfig.volume = parseFloat(this.value);
      saveVoiceSettings();
    });

  document.getElementById("voice-rate").addEventListener("input", function () {
    voiceConfig.rate = parseFloat(this.value);
    saveVoiceSettings();
  });

  document.getElementById("voice-pitch").addEventListener("input", function () {
    voiceConfig.pitch = parseFloat(this.value);
    saveVoiceSettings();
  });

  document
    .getElementById("voice-muted")
    .addEventListener("change", function () {
      setMuted(this.checked);
    });

  document
    .getElementById("test-voice-btn")
    .addEventListener("click", function () {
      speak("Olá! Assim é como sua voz assistente soará.");
    });

  document
    .querySelector(".voice-close-btn")
    .addEventListener("click", function () {
      panel.remove();
    });

  // Fecha o painel quando clicar fora dele
  document.addEventListener("click", function closePanel(e) {
    if (
      !panel.contains(e.target) &&
      e.target.id !== "assistant-voice-selector"
    ) {
      panel.remove();
      document.removeEventListener("click", closePanel);
    }
  });
}

/**
 * Inicializa as configurações de voz com parâmetros específicos
 */
export function initializeVoiceSettings() {
  // Já carrega configurações salvas
  loadVoiceSettings();

  // Cria ou atualiza o botão seletor
  createVoiceSelectorButton();
}

// Funções para reconhecimento de voz
let recognition = null;

/**
 * Inicia o reconhecimento de voz
 * @param {Function} callback Função para receber o texto reconhecido
 */
export function startVoiceRecognition(callback) {
  if (
    !("webkitSpeechRecognition" in window) &&
    !("SpeechRecognition" in window)
  ) {
    alert("Reconhecimento de voz não é suportado neste navegador.");
    if (callback) callback("");
    return;
  }

  // Cria a instância de reconhecimento
  if (!recognition) {
    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
  }

  // Configura com base nas preferências salvas
  recognition.lang = voiceConfig.lang;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    console.log("[voiceSystem] Voz reconhecida:", transcript);
    if (callback) callback(transcript);
  };

  recognition.onerror = function (event) {
    console.error("[voiceSystem] Erro no reconhecimento:", event.error);
    if (callback) callback("");
  };

  recognition.onend = function () {
    console.log("[voiceSystem] Reconhecimento finalizado");
    if (!recognition.resultReceived) {
      if (callback) callback("");
    }
  };

  recognition.resultReceived = false;
  recognition.start();

  console.log("[voiceSystem] Reconhecimento de voz iniciado");
}

// Adicionar novas funções para atualização dinâmica

/**
 * Atualiza o idioma do sistema de voz
 * @param {string} lang Código do idioma (ex: 'pt', 'en', 'es', 'he')
 */
export function updateVoiceLanguage(lang) {
  // Converter para formato completo de locale se necessário
  const localeMap = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    he: "he-IL",
  };

  voiceConfig.lang = localeMap[lang] || lang;

  // Procurar por vozes adequadas para o novo idioma
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.substring(0, 2).toLowerCase();

  // Primeiro tentar encontrar uma voz específica para o idioma exato
  let matchingVoice = voices.find(
    (voice) => voice.lang.toLowerCase() === voiceConfig.lang.toLowerCase()
  );

  // Se não encontrar uma voz específica, procurar por qualquer voz do mesmo idioma
  if (!matchingVoice) {
    matchingVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(langPrefix)
    );
  }

  if (matchingVoice) {
    voiceConfig.selectedVoice = matchingVoice.name;
    localStorage.setItem("assistant-voice", matchingVoice.name);
    console.log(
      `[voiceSystem] Voz atualizada para o idioma ${lang}: ${matchingVoice.name}`
    );
  } else {
    console.log(`[voiceSystem] Nenhuma voz encontrada para o idioma: ${lang}`);
  }

  // Salvar as configurações
  saveVoiceSettings();
  console.log(
    `[voiceSystem] Idioma de voz atualizado para: ${voiceConfig.lang}`
  );
}

/**
 * Atualiza a velocidade da fala
 * @param {number} rate Taxa de velocidade (0.5 - 2.0)
 */
export function updateVoiceRate(rate) {
  voiceConfig.rate = rate;
  saveVoiceSettings();
  console.log(`[voiceSystem] Velocidade da voz atualizada para: ${rate}`);
}

/**
 * Define a voz selecionada
 * @param {string} voiceName Nome da voz a ser utilizada
 */
export function setSelectedVoice(voiceName) {
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.name === voiceName);

  if (voice) {
    voiceConfig.selectedVoice = voiceName;
    // Atualizar também o idioma com base na voz selecionada
    if (voice.lang) {
      voiceConfig.lang = voice.lang;
    }
    saveVoiceSettings();
    console.log(`[voiceSystem] Voz selecionada: ${voiceName} (${voice.lang})`);
    return true;
  }

  console.warn(`[voiceSystem] Voz não encontrada: ${voiceName}`);
  return false;
}
