// Atualização no assistant.js para integrar boas-vindas multilíngues com detecção de idioma

import { processUserInput } from "./assistant-dialog/dialog.js";
import {
  buildWelcomeMessage,
  markVisit,
} from "./assistant-messages/welcome.js";
import {
  initVoice,
  cleanTextForSpeech,
  speak,
  initializeVoiceSettings, // Nova importação
} from "../utils/voice/voiceSystem.js";
import { setupAdaptiveLayout } from "../utils/assistant-layout.js";
import { hideAssistant } from "./assistant-ui/assistant-ui.js";
// Adicionar importações para o sistema de tradução
import {
  getGeneralText,
  formatText,
  currentLang,
} from "../i18n/translatePageContent.js";

// Atualizar importações relacionadas às mensagens
import {
  messages,
  getGreetingByTime,
  getLanguageChangeMessage,
} from "./assistant-messages/assistant-messages.js";

import { userLocation } from "../map/map-controls.js";

let assistantConfig = {
  map: null,
  lang: "pt", // Definido por padrão, mas pode mudar dinamicamente
};

export let conversationState = {
  lastTopic: null,
  preferences: {
    favoriteBeach: null,
    favoriteRestaurant: null,
  },
};

let assistantVoiceGender = "female";
let assistantVoiceName = null;

// Adicione essa variável no início do arquivo
let lastMessageSent = { text: "", timestamp: 0 };

// Remover a variável isInitialLoad global
// let isInitialLoad = true; <- REMOVER ESTA LINHA

// Função para detectar idioma do navegador de forma mais robusta
function detectBrowserLanguage() {
  // Lista de idiomas suportados pelo sistema
  const supportedLanguages = ["pt", "en", "es", "he"];

  const lang = (navigator.language || navigator.userLanguage || "pt").split(
    "-"
  )[0];

  // Verifica se o idioma está na lista de suportados
  if (supportedLanguages.includes(lang)) {
    console.log(`[detectBrowserLanguage] Idioma suportado detectado: ${lang}`);
    return lang;
  }

  // Fallback para português
  console.log(
    `[detectBrowserLanguage] Idioma não suportado: ${lang}, usando português como padrão`
  );
  return "pt";
}

// Adicionar integração com as configurações do modal

// Adicionar esta função para atualizar o assistente com base nas configurações
export function updateAssistantSettings(settings) {
  if (settings.language) {
    assistantConfig.lang = settings.language;
    console.log(
      `[assistant.js] Idioma do assistente atualizado para: ${settings.language}`
    );
  }

  if (settings.voice) {
    setAssistantVoiceName(settings.voice);
    console.log(
      `[assistant.js] Voz do assistente atualizada para: ${settings.voice}`
    );
  }

  // Atualizar outras configurações conforme necessário
}

// Modificar a função setupConfigObservers para usar um nome diferente para as mensagens de alteração de idioma

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

// Modificar a função initializeAssistant para garantir área de mensagens limpa antes da verificação

export function initializeAssistant(config) {
  const detectedLang = detectBrowserLanguage();
  assistantConfig = {
    ...assistantConfig,
    ...config,
    lang: config.lang || detectedLang,
  };

  console.log(
    `[assistant.js] initializeAssistant chamado com idioma: ${assistantConfig.lang}`
  );

  document.documentElement.lang = assistantConfig.lang;
  const layoutController = setupAdaptiveLayout();

  // CORREÇÃO IMPORTANTE: Configurar listeners ANTES de qualquer operação visual
  // Para evitar que eventos iniciais de idioma causem mensagens indesejadas
  setupConfigObservers();

  // Preparar o assistante mas não mostrar ainda
  showAssistant();
  setupAssistantEvents();

  // Inicializar configurações de voz
  initializeVoiceSettings();
  initVoice(assistantConfig.lang);
  applyVoiceSettings();

  // Verificar se é primeira visita
  const isFirstTime = !localStorage.getItem("visitedMorroDigital");
  console.log(
    `[assistant.js] É primeira visita? ${isFirstTime ? "SIM" : "NÃO"}`
  );

  // IMPORTANTE: Construir a mensagem de boas-vindas imediatamente
  const welcomeMessage = buildWelcomeMessage(assistantConfig.lang);
  console.log(
    `[assistant.js] Mensagem de boas-vindas gerada: "${welcomeMessage.substring(
      0,
      30
    )}..."`
  );

  // Remover qualquer timeout e mostrar o assistente imediatamente com a mensagem
  showAssistantWithMessage(welcomeMessage);

  // Marcar visita apenas se for primeira vez
  if (isFirstTime) {
    console.log(`[assistant.js] Marcando como visitado pela primeira vez`);
    markVisit();
  }

  if (config.onReady) {
    config.onReady();
  }
}

/**
 * Salva a voz escolhida
 */
function setAssistantVoiceName(name) {
  assistantVoiceName = name;
  localStorage.setItem("assistantVoiceName", name);
}

/**
 * Carrega preferências de voz
 */
function loadVoicePreferences() {
  const storedName = localStorage.getItem("assistantVoiceName");
  if (storedName) assistantVoiceName = storedName;
}

// Função para configurar o seletor de vozes
function setupVoiceSelector() {
  const voiceSelect = document.getElementById("voice-select");
  if (!voiceSelect) return;

  function populateVoices() {
    // Obter a lista de vozes disponíveis
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = "";

    // Filtrar vozes por idioma baseado na linguagem do usuário
    const lang =
      document.getElementById("language-select")?.value ||
      document.documentElement.lang ||
      "pt";
    const langPrefix = lang.substring(0, 2).toLowerCase();

    // Primeiro adicionar vozes do idioma atual
    const langVoices = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith(langPrefix)
    );

    // Adicionar outras vozes depois
    const otherVoices = voices.filter(
      (voice) => !voice.lang.toLowerCase().startsWith(langPrefix)
    );

    // Combinar ambas as listas
    const sortedVoices = [...langVoices, ...otherVoices];

    // Criar opções para o select
    sortedVoices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (voice.lang.toLowerCase().startsWith(langPrefix)) {
        option.textContent += " ✓"; // Marcar vozes do idioma atual
      }
      voiceSelect.appendChild(option);
    });

    // Selecionar a voz salva ou a padrão
    const savedVoice = localStorage.getItem("assistant-voice");
    if (savedVoice) {
      const option = Array.from(voiceSelect.options).find(
        (opt) => opt.value === savedVoice
      );
      if (option) option.selected = true;
    } else if (langVoices.length > 0) {
      // Se não tiver voz salva, selecionar a primeira do idioma atual
      const firstLangOption = Array.from(voiceSelect.options).find((opt) =>
        opt.textContent.includes(" ✓")
      );
      if (firstLangOption) firstLangOption.selected = true;
    }
  }

  // Configurar o evento de mudança para salvar a voz escolhida
  voiceSelect.addEventListener("change", () => {
    const selectedVoice = voiceSelect.value;
    localStorage.setItem("assistant-voice", selectedVoice);

    // Feedback de áudio com a nova voz
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Voz alterada");

    // Encontrar a voz selecionada
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.name === selectedVoice);
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  });

  // Inicializar as vozes
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  populateVoices();
}

/**
 * Configura os eventos de interação do assistente
 */
function setupAssistantEvents() {
  const assistantMessages = document.getElementById("assistant-messages");
  const assistantInput = document.getElementById("assistantInput");
  const sendButton = document.getElementById("sendButton");
  const minimizeButton = assistantMessages
    ? assistantMessages.querySelector(".minimize-button")
    : null;

  console.log("[assistant.js] setupAssistantEvents chamado");
  console.log("[assistant.js] assistantMessages:", assistantMessages);
  console.log("[assistant.js] assistantInput:", assistantInput);
  console.log("[assistant.js] sendButton:", sendButton);
  console.log("[assistant.js] minimizeButton:", minimizeButton);

  if (!assistantMessages || !assistantInput || !sendButton || !minimizeButton) {
    console.error(
      "[setupAssistantEvents] Elementos do assistente não encontrados no DOM."
    );
    return;
  }

  // Remova listeners antigos antes de adicionar novos (boa prática)
  sendButton.onclick = null;
  assistantInput.onkeydown = null;
  minimizeButton.onclick = null;

  // Modificar a função sendMessage dentro de setupAssistantEvents

  const sendMessage = async () => {
    const message = assistantInput.value.trim();
    if (!message) return;

    // Limpar o campo de input imediatamente
    assistantInput.value = "";

    try {
      // Mostrar mensagem do usuário
      appendMessage("user", message, { clear: false });

      // Processar a entrada do usuário
      const response = await processUserInput(message, assistantConfig.lang);

      // Verificar se a resposta é válida antes de usar
      if (response && response.text) {
        appendMessage("assistant", response.text); // Já vai falar automaticamente

        // Executar action com um pequeno delay, se existir
        if (response.action && typeof response.action === "function") {
          setTimeout(() => {
            response.action();
          }, 50);
        }
      } else {
        // Verificar se temos pelo menos uma ação
        if (
          response &&
          response.action &&
          typeof response.action === "function"
        ) {
          console.log(
            "[sendMessage] Executando action mesmo sem texto de resposta"
          );
          response.action();
          return; // Não mostrar mensagem genérica se executamos uma ação
        }

        console.warn(
          "[sendMessage] Resposta inválida ou incompleta:",
          response
        );
        appendMessage(
          "assistant",
          "Desculpe, não consegui processar sua mensagem adequadamente."
        );
      }
    } catch (error) {
      console.error("[assistant.js] Erro ao processar mensagem:", error);
      appendMessage(
        "assistant",
        "Desculpe, tive um problema ao processar sua mensagem."
      );
    }
  };
}

/**
 * Adiciona uma nova mensagem no painel de mensagens ou no banner de navegação.
 * Gerencia automaticamente onde a mensagem deve ser exibida com base no modo atual.
 *
 * @param {string} sender - 'user' ou 'assistant'
 * @param {string} htmlContent - Conteúdo HTML da mensagem
 * @param {Object} options - Opções adicionais
 */
export function appendMessage(
  sender,
  htmlContent,
  {
    clear = true,
    area = "messages",
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
  // Verificar se está em modo de navegação
  const isNavigationActive =
    document.body.classList.contains("navigation-active");
  console.log("[appendMessage] Modo de navegação ativo?", isNavigationActive);

  // Verificar se a mensagem é importante o suficiente para sobrepor regras padrão
  const isHighPriority =
    priority === "navigation-override" || priority === "high";

  // Determinar se deve usar o banner de navegação ou o assistente normal
  let shouldUseBanner = false;
  let shouldUseAssistant = false;

  if (isNavigationActive) {
    // Em modo de navegação:
    // - Use o banner para todas as mensagens padrão
    // - Use o assistente apenas para mensagens de alta prioridade
    shouldUseBanner =
      area === "navigation" || messageType === "navigation" || !isHighPriority;
    shouldUseAssistant = isHighPriority && priority === "navigation-override";
  } else {
    // Fora do modo de navegação:
    // - Sempre use o assistente normal
    // - Nunca use o banner
    shouldUseAssistant = true;
    shouldUseBanner = false;
  }

  console.log("[appendMessage] Destino da mensagem:", {
    usarBanner: shouldUseBanner,
    usarAssistente: shouldUseAssistant,
    conteudo:
      htmlContent.substring(0, 30) + (htmlContent.length > 30 ? "..." : ""),
  });

  // Processamento de fala - ocorre independentemente da área de exibição
  if (sender === "assistant" && speakMessage) {
    const voiceEnabled = localStorage.getItem("voice-enabled") !== "false";
    if (voiceEnabled) {
      console.log(
        "[appendMessage] Sintetizando voz:",
        htmlContent.substring(0, 30) + "..."
      );
      // Pequeno delay para evitar problemas de timing com a atualização da UI
      setTimeout(() => {
        speak(htmlContent);
      }, 50);
    } else {
      console.log("[appendMessage] Voz desativada, ignorando síntese.");
    }
  }

  // Se não devemos usar nenhuma área para exibição visual, sair
  if (!shouldUseBanner && !shouldUseAssistant) {
    console.log(
      "[appendMessage] Mensagem não exibida visualmente devido às regras do modo atual"
    );
    return;
  }

  // PARTE 1: Exibição no banner de navegação
  if (shouldUseBanner) {
    try {
      // Tentar importar o módulo do banner dinamicamente para evitar dependência circular
      import("../navigation/navigationUi/bannerUI.js")
        .then((bannerUI) => {
          // Verificar se o banner existe e criar se necessário
          if (!bannerUI.bannerExists()) {
            console.log(
              "[appendMessage] Criando banner de navegação para mensagens"
            );
            bannerUI.createNavigationBanner();
            bannerUI.addNavigationInteractions();
            bannerUI.showInstructionBanner(true);
          }

          // Formatar a mensagem para o banner
          const instruction = {
            instruction: htmlContent, // Texto principal
            details: messageType === "navigation_details" ? htmlContent : "",
            remainingDistance:
              messageType === "navigation_distance" ? htmlContent : "",
            estimatedTime: messageType === "navigation_time" ? htmlContent : "",
          };

          // Atualizar o banner com a mensagem
          bannerUI.updateInstructionBanner(instruction);
          console.log(
            "[appendMessage] Mensagem exibida no banner de navegação"
          );
        })
        .catch((err) => {
          console.error(
            "[appendMessage] Erro ao carregar banner de navegação:",
            err
          );
          // Fallback para mostrar no assistente normal em caso de erro
          displayInAssistant();
        });
    } catch (error) {
      console.error(
        "[appendMessage] Erro ao processar exibição no banner:",
        error
      );
      // Fallback para mostrar no assistente normal em caso de erro
      displayInAssistant();
    }
    return;
  }

  // PARTE 2: Exibição no assistente normal
  if (shouldUseAssistant) {
    displayInAssistant();
  }

  // Função auxiliar para exibir no assistente normal
  function displayInAssistant() {
    // Verificação de duplicatas
    if (avoidDuplicate && priority !== "high") {
      const now = Date.now();
      if (
        htmlContent === lastMessageSent.text &&
        now - lastMessageSent.timestamp < 2000
      ) {
        console.log(
          "[appendMessage] Mensagem duplicada evitada:",
          htmlContent.substring(0, 30) + "..."
        );
        return;
      }
      lastMessageSent = { text: htmlContent, timestamp: now };
    }

    // Encontrar o container de mensagens
    const containerSelector = "#assistant-messages .messages-area";
    let messagesContainer = document.querySelector(containerSelector);

    if (!messagesContainer) {
      console.log(
        `[appendMessage] Container não encontrado: ${containerSelector}, criando novo`
      );
      const parent = document.getElementById("assistant-messages");

      if (!parent) {
        console.error(
          "[appendMessage] Container pai #assistant-messages não encontrado!"
        );
        return;
      }

      messagesContainer = document.createElement("div");
      messagesContainer.className = "messages-area";

      const firstChild = parent.firstChild;
      if (firstChild) {
        parent.insertBefore(messagesContainer, firstChild.nextSibling);
      } else {
        parent.appendChild(messagesContainer);
      }

      console.log(
        `[appendMessage] Novo container criado para mensagens padrão`
      );
    }

    // Verificar duplicatas no container atual
    if (
      avoidDuplicate &&
      priority !== "high" &&
      messagesContainer.lastChild &&
      messagesContainer.lastChild.innerHTML === htmlContent
    ) {
      console.log("[appendMessage] Mensagem duplicada ignorada no assistente.");
      return;
    }

    // Limpar mensagens existentes se necessário
    if (clear) {
      console.log(`[appendMessage] Limpando mensagens em ${containerSelector}`);
      messagesContainer.innerHTML = "";
    }

    // Criar e adicionar o elemento de mensagem
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", sender);

    if (customClass) messageElement.classList.add(customClass);
    if (id) messageElement.id = id;

    // Adicionar um atributo data-message-type para facilitar identificação
    messageElement.setAttribute("data-message-type", messageType);
    messageElement.innerHTML = htmlContent;
    messagesContainer.appendChild(messageElement);

    // Rolar para a nova mensagem
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    console.log("[appendMessage] Mensagem exibida no assistente normal");
  }
}

/**
 * Mostra o assistente virtual na interface
 */
export function showAssistant() {
  // NÃO mostrar imediatamente - apenas preparar o elemento
  const assistantMessages = document.getElementById("assistant-messages");
  console.log("[assistant.js] showAssistant chamado, preparando elementos");

  // Manter oculto até que a mensagem esteja pronta
  if (assistantMessages) {
    assistantMessages.classList.add("prepared");
  }
}

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

  console.log("[assistant.js] Assistente preparado com mensagem pré-carregada");

  // AGORA mostrar o assistente com a mensagem já carregada
  assistantMessages.classList.remove("hidden");

  // Focar no input após exibir
  setTimeout(() => {
    const input = document.getElementById("assistantInput");
    if (input) input.focus();
  }, 300);

  // Iniciar síntese de voz se estiver ativada
  const voiceEnabled = localStorage.getItem("voice-enabled") !== "false";
  if (voiceEnabled) {
    console.log("[assistant.js] Sintetizando voz para mensagem pré-carregada");
    speak(message);
  }
}

/**
 * Limpa mensagens do assistente com base em um filtro ou limpa tudo
 * @param {Function} filterFn - Função de filtro para selecionar quais mensagens remover
 * @param {string} area - Área a ser limpa (não utilizada, mantida por compatibilidade)
 */
export function clearAssistantMessages(filterFn) {
  // Simplificar para usar apenas o seletor da área de mensagens principal
  const selector = "#assistant-messages .messages-area";
  const messagesArea = document.querySelector(selector);

  if (!messagesArea) {
    console.warn(`[clearAssistantMessages] Área de mensagens não encontrada`);
    return;
  }

  // Se não houver função de filtro, limpar todas as mensagens
  if (!filterFn) {
    console.log(
      `[clearAssistantMessages] Limpando todas as mensagens do assistente`
    );
    messagesArea.innerHTML = "";
    return;
  }

  // Selecionar apenas mensagens do assistente
  const msgs = messagesArea.querySelectorAll(".message.assistant");
  let count = 0;

  // Remover apenas as mensagens que correspondem ao filtro
  msgs.forEach((msg) => {
    if (filterFn(msg)) {
      msg.remove();
      count++;
    }
  });

  console.log(
    `[clearAssistantMessages] Removidas ${count} mensagens do assistente`
  );
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
    assistantVoiceName = selectedVoice.name;
    console.log(`[assistant.js] Voz aplicada: ${selectedVoice.name}`);
  }

  // Configurar taxa de fala
  console.log(`[assistant.js] Velocidade de fala aplicada: ${savedSpeed}`);
  // Configurar no sistema de voz
}

// Modificar a função para exibir mensagem de boas-vindas
export function showWelcomeMessage() {
  // Usar o sistema de mensagens para obter a saudação apropriada
  const welcomeMessage = getGreetingByTime();

  console.log(
    `[assistant.js] Exibindo mensagem de boas-vindas em: ${currentLang}`
  );
  appendMessage("assistant", welcomeMessage, {
    clear: true,
    avoidDuplicate: true,
    speakMessage: true,
  });
}

// Atualizar idioma do assistente quando o idioma da página mudar
document.addEventListener("languageChanged", function (e) {
  const newLang = e.detail.language;
  console.log(
    `[assistant.js] Idioma do assistente sincronizado para: ${newLang}`
  );

  // Verificar se é carga inicial - CRÍTICO!
  if (e.detail.isInitialLoad) {
    console.log(
      "[assistant.js] Carga inicial de idioma, não exibindo mensagem de alteração"
    );
    return;
  }

  // Limpar mensagens existentes para evitar confusão de idiomas
  clearAssistantMessages();

  // Mostrar nova mensagem de boas-vindas no novo idioma usando o sistema de mensagens
  appendMessage("assistant", getLanguageChangeMessage(newLang), {
    clear: true,
    avoidDuplicate: true,
    speakMessage: true, // True apenas para alterações manuais
    messageType: "language_change", // Marcar como mensagem de idioma para controle
  });
});

// Exportar também como parte do objeto default (se estiver usando export default em algum lugar)
const assistant = {
  initializeAssistant,
  showAssistant,
  appendMessage,
  // outras funções...
};

export default assistant;

// No final do arquivo - garantir exportações:
export { hideAssistant };
