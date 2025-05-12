//import { startVoiceRecognition } from "../../voice/voiceSystem.js";
import {
  translatePageContent,
  getGeneralText,
} from "../../i18n/translatePageContent.js";

// Adicionar importação do sistema de mensagens
import { messages } from "../assistant-messages/assistant-messages.js";

export function createAssistantUI(containerId = "assistant-messages") {
  // Adicionar estilo para o toggle switch
  const toggleStyle = document.createElement("style");
  toggleStyle.textContent = `
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
}
    
    input:checked + .toggle-slider {
      background-color: var(--primary, #4285f4);
    }
    
    input:focus + .toggle-slider {
      box-shadow: 0 0 1px var(--primary, #4285f4);
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }
    
    .voice-toggle-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `;

  document.head.appendChild(toggleStyle);

  const container = document.getElementById(containerId);

  // Se o container não existir, criá-lo
  if (!container) {
    const newContainer = document.createElement("div");
    newContainer.id = containerId;
    newContainer.className = "assistant-modal"; // Classe correta
    document.body.appendChild(newContainer);
    console.log("[interface.js] Container do assistente criado", newContainer);

    // Continuar com o container recém-criado
    createAssistantUI(containerId);
    return;
  }

  console.log(
    "[interface.js] createAssistantUI chamado. container:",
    container
  );
  if (!container) return;
  container.classList.remove("hidden");

  // Apenas limpa e mantém o botão de minimizar e área de mensagens
  container.innerHTML = `
    <button class="minimize-button" aria-label="Minimizar assistente">×</button>
    <div class="messages-area"></div>
  `;

  // Adicionar o painel de configurações ao body
  if (!document.getElementById("config-panel")) {
    const configPanel = document.createElement("div");
    configPanel.id = "config-panel";
    configPanel.className = "config-panel";

    // MODIFICAÇÃO AQUI: Use onclick diretamente no HTML do toggle
    configPanel.innerHTML = `
      <div class="config-panel-header">
        <h3>${messages.settings.title()}</h3>
        <button id="close-config-panel" class="close-config-button" aria-label="${messages.settings.close()}">×</button>
      </div>
      <div class="config-option">
        <label for="language-select">${messages.settings.language()}</label>
        <select id="language-select">
          <option value="pt">Português</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="he">עברית (Hebrew)</option>
        </select>
      </div>
      <div class="config-option">
        <label for="voice-select">${messages.settings.voice()}</label>
        <select id="voice-select">
          <option>Carregando vozes...</option>
        </select>
      </div>
      <div class="config-option">
        <label for="voice-speed">${messages.settings.voiceSpeed()}: <span id="speed-value">1.0</span>x</label>
        <input type="range" id="voice-speed" min="0.5" max="2" step="0.1" value="1.0">
      </div>
      <div class="config-option voice-toggle-option">
        <label for="voice-enabled-toggle">${messages.settings.voiceEnabled()}</label>
        <div class="toggle-switch" onclick="this.querySelector('input').click();">
          <input type="checkbox" id="voice-enabled-toggle" checked 
                 onchange="(function(e){
                   const enabled = e.target.checked;
                   localStorage.setItem('voice-enabled', enabled ? 'true' : 'false');
                   console.log('Toggle alterado para: ' + enabled);
                   
                   // Importar voiceSystem e aplicar estado - REMOVIDA a parte da notificação
                   import('../assistant-speech/assistant-speech.js').then(module => {
                     module.setMuted(!enabled);
                     // Removida a notificação daqui, deixando apenas a do sistema de mensagens
                   });
                 })(event)">
          <span class="toggle-slider"></span>
        </div>
      </div>
      <div class="config-option">
        <label for="theme-select">${messages.settings.theme()}</label>
        <select id="theme-select">
          <option value="light">${messages.settings.themeLight()}</option>
          <option value="dark">${messages.settings.themeDark()}</option>
          <option value="auto">${messages.settings.themeAuto()}</option>
        </select>
      </div>
    `;

    // Adicionar estilo para a notificação do toggle
    const notificationStyle = document.createElement("style");
    notificationStyle.textContent = `
      .voice-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        z-index: 9999;
      }
      
      .voice-notification.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(notificationStyle);

    document.body.appendChild(configPanel);

    // Inicializar o estado do toggle baseado no localStorage
    setTimeout(() => {
      const toggle = document.getElementById("voice-enabled-toggle");
      if (toggle) {
        toggle.checked = localStorage.getItem("voice-enabled") !== "false";
      }
    }, 100);
  }

  // Adicionar chamada para setup de redimensionamento
  const resizeManager = setupDynamicMessagesResize();

  // Exportar para o escopo global para diagnóstico
  window.assistantResizeManager = resizeManager;
}

export function setupAssistantInteractions(onUserMessage) {
  const input = document.getElementById("assistantInput");
  const sendButton = document.getElementById("sendButton");
  const voiceButton = document.getElementById("voiceButton");
  const configButton = document.getElementById("configButton");
  const configPanel = document.getElementById("config-panel");

  console.log("[interface.js] setupAssistantInteractions chamado");
  console.log("[interface.js] input:", input);
  console.log("[interface.js] sendButton:", sendButton);
  console.log("[interface.js] voiceButton:", voiceButton);
  console.log("[interface.js] configButton:", configButton);

  if (!input || !sendButton || !voiceButton || !configButton) {
    console.error("Elementos de interface do assistente não encontrados.");
    return;
  }

  const sendMessage = () => {
    const message = input.value.trim();
    if (message) {
      onUserMessage(message);
      input.value = "";
    }
  };

  sendButton.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  voiceButton.addEventListener("click", () => {
    // Feedback visual
    voiceButton.classList.add("listening");

    startVoiceRecognition((transcript) => {
      // Remover feedback visual
      voiceButton.classList.remove("listening");

      // Processar o texto reconhecido
      if (transcript) {
        input.value = transcript;
        onUserMessage(transcript);
      }
    });
  });

  // Configurar o botão de configurações
  configButton.addEventListener("click", () => {
    // Esconder o assistente antes de mostrar o painel de configurações
    const assistantMessages = document.getElementById("assistant-messages");
    if (assistantMessages && !assistantMessages.classList.contains("hidden")) {
      assistantMessages.classList.add("hidden");
      console.log(
        "[interface.js] Escondendo painel de mensagens do assistente"
      );
    }

    // Alternar o estado do botão e do painel de configurações
    configButton.classList.toggle("active");
    configPanel.classList.toggle("visible");

    // Configurar o botão de fechar (necessário fazer isso aqui para garantir que existe)
    const closeConfigBtn = document.getElementById("close-config-panel");
    if (closeConfigBtn) {
      closeConfigBtn.onclick = () => {
        // Fechar o painel de configurações
        configPanel.classList.remove("visible");
        configButton.classList.remove("active");

        // Mostrar novamente o assistente
        if (assistantMessages) {
          assistantMessages.classList.remove("hidden");
          console.log(
            "[interface.js] Mostrando novamente o painel de mensagens"
          );

          // Focar no input para melhor usabilidade
          const input = document.getElementById("assistantInput");
          if (input) setTimeout(() => input.focus(), 100);
        }
      };
    }

    // Fechar o painel quando clicar fora dele
    const closeConfigOnOutsideClick = (event) => {
      if (
        !configPanel.contains(event.target) &&
        event.target !== configButton
      ) {
        configPanel.classList.remove("visible");
        configButton.classList.remove("active");
        document.removeEventListener("click", closeConfigOnOutsideClick);

        // Mostrar novamente o assistente
        if (assistantMessages) {
          assistantMessages.classList.remove("hidden");
          console.log(
            "[interface.js] Mostrando novamente o painel de mensagens após clique fora"
          );
        }
      }
    };

    // Adicionar com um pequeno atraso para evitar fechar imediatamente
    setTimeout(() => {
      if (configPanel.classList.contains("visible")) {
        document.addEventListener("click", closeConfigOnOutsideClick);
      }
    }, 100);
  });

  // Configurar o seletor de velocidade da voz
  const voiceSpeed = document.getElementById("voice-speed");
  const speedValue = document.getElementById("speed-value");

  if (voiceSpeed && speedValue) {
    // Carregar valor salvo anteriormente
    const savedSpeed = localStorage.getItem("voice-speed") || "1.0";
    voiceSpeed.value = savedSpeed;
    speedValue.textContent = savedSpeed;

    voiceSpeed.addEventListener("input", (e) => {
      const speed = e.target.value;
      speedValue.textContent = speed;
      localStorage.setItem("voice-speed", speed);

      // Aplicar a velocidade ao sistema de voz
      import("../../voice/voiceSystem.js").then((voiceModule) => {
        voiceModule.updateVoiceRate(parseFloat(speed));

        // Dar feedback com a nova velocidade
        window.speechSynthesis.cancel();

        // Mensagem de feedback em vários idiomas
        const feedbackMessages = {
          pt: "Velocidade ajustada",
          en: "Speed adjusted",
          es: "Velocidad ajustada",
          he: "מהירות מותאמת",
        };

        const currentLang = document.documentElement.lang || "pt";
        const message = feedbackMessages[currentLang] || feedbackMessages.en;

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = parseFloat(speed);

        // Usar a voz selecionada
        const selectedVoice = localStorage.getItem("assistant-voice");
        if (selectedVoice) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find((v) => v.name === selectedVoice);
          if (voice) utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
      });
    });
  }

  // Configurar o seletor de tema
  const themeSelect = document.getElementById("theme-select");

  if (themeSelect) {
    // Carregar tema salvo
    const savedTheme = localStorage.getItem("app-theme") || "light";
    themeSelect.value = savedTheme;

    themeSelect.addEventListener("change", (e) => {
      const theme = e.target.value;
      localStorage.setItem("app-theme", theme);

      // Aplicar o tema
      document.documentElement.setAttribute("data-theme", theme);

      if (theme === "auto") {
        // Detectar preferência do sistema
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.documentElement.classList.toggle("dark-theme", prefersDark);
      } else {
        document.documentElement.classList.toggle(
          "dark-theme",
          theme === "dark"
        );
      }
    });

    // Aplicar o tema atual
    themeSelect.dispatchEvent(new Event("change"));
  }

  // Adicione depois da configuração dos outros seletores
  const languageSelect = document.getElementById("language-select");

  if (languageSelect) {
    // Carregar idioma salvo ou atual
    const currentLanguage =
      document.documentElement.lang ||
      localStorage.getItem("app-language") ||
      "pt";
    languageSelect.value = currentLanguage;

    // Modificação no listener de change do language-select para evitar fechamento automático
    languageSelect.addEventListener("change", (e) => {
      const newLanguage = e.target.value;
      console.log(`[interface.js] Idioma alterado para: ${newLanguage}`);

      // Salvar seleção
      localStorage.setItem("app-language", newLanguage);

      // Atualizar idioma da página
      document.documentElement.lang = newLanguage;

      // Atualizar traduções em toda a página
      translatePageContent(newLanguage);

      // IMPORTANTE: Recarregar vozes disponíveis para o novo idioma
      setupVoiceSelector(newLanguage);

      // Aplicar o idioma ao sistema de voz
      import("../../voice/voiceSystem.js").then((voiceModule) => {
        voiceModule.updateVoiceLanguage(newLanguage);
      });

      // Usar o sistema de tradução para obter a mensagem correta
      import("../assistant.js").then((assistantModule) => {
        // Mostrar o assistente se estiver oculto
        const assistantMessages = document.getElementById("assistant-messages");
        if (
          assistantMessages &&
          assistantMessages.classList.contains("hidden")
        ) {
          assistantMessages.classList.remove("hidden");
        }

        // Mostrar mensagem de que o idioma foi alterado usando o sistema de tradução
        assistantModule.appendMessage(
          "assistant",
          getGeneralText("language_changed_success", newLanguage),
          {
            speakMessage: true,
          }
        );
      });
    });
  }

  // Inicializar o seletor de vozes
  setupVoiceSelector();

  // Configurar o toggle de voz do assistente - CORREÇÃO COMPLETA
  const voiceEnabledToggle = document.getElementById("voice-enabled-toggle");
  if (voiceEnabledToggle) {
    // Remover qualquer listener anterior para evitar duplicação
    voiceEnabledToggle.removeEventListener("change", handleVoiceToggleChange);

    // Log detalhado do estado inicial
    console.log("[DEBUG] Estado do toggle antes de configurar:", {
      existeNoDOM: !!voiceEnabledToggle,
      estadoChecked: voiceEnabledToggle.checked,
      valorNoLocalStorage: localStorage.getItem("voice-enabled"),
      elementoHTML: voiceEnabledToggle.outerHTML,
    });

    // IMPORTANTE: Carregar o estado correto do localStorage
    // O valor padrão deve ser ativado (true) se não houver configuração
    const storedValue = localStorage.getItem("voice-enabled");
    const voiceEnabled = storedValue !== "false";

    // Forçar o estado do checkbox de acordo com o localStorage
    voiceEnabledToggle.checked = voiceEnabled;

    console.log("[DEBUG] Toggle após configuração inicial:", {
      valorNoLocalStorage: localStorage.getItem("voice-enabled"),
      interpretado: voiceEnabled,
      novoEstadoChecked: voiceEnabledToggle.checked,
    });

    // Aplicar o estado ao sistema de voz usando uma função de callback
    function applyVoiceState(muted) {
      import("../../utils/voice/voiceSystem.js").then((voiceModule) => {
        try {
          // Muted é o oposto de enabled
          voiceModule.setMuted(muted);
          console.log(
            `[VOICE] Estado da voz aplicado: ${muted ? "mudo" : "ativo"}`
          );
        } catch (e) {
          console.error("[VOICE ERROR] Falha ao aplicar estado da voz:", e);
        }
      });
    }

    // Aplicar o estado inicial (mudo = !habilitado)
    applyVoiceState(!voiceEnabled);

    // Função nomeada para evento de mudança - facilita remover depois
    function handleVoiceToggleChange(e) {
      // Obter o estado atual do checkbox
      const enabled = e.target.checked;

      console.log(
        `[TOGGLE] Mudança detectada: ${enabled ? "ATIVADO" : "DESATIVADO"}`
      );

      // Log detalhado para debugar o evento de change
      console.log("[DEBUG] Evento de change:", {
        tipo: e.type,
        alvo: e.target.id,
        checked: e.target.checked,
        valorAtual: localStorage.getItem("voice-enabled"),
      });

      // Salvar no localStorage como string explícita
      localStorage.setItem("voice-enabled", enabled ? "true" : "false");

      console.log(
        `[STORAGE] Valor salvo em localStorage: ${localStorage.getItem(
          "voice-enabled"
        )}`
      );

      // Aplicar o estado no sistema de voz (mudo = !habilitado)
      applyVoiceState(!enabled);

      // Mostrar feedback visual - UMA ÚNICA NOTIFICAÇÃO
      const messageText = enabled
        ? messages.system.voiceEnabled()
        : messages.system.voiceDisabled();
      showNotification(messageText, 2000);

      // Feedback de voz se a voz foi ativada
      if (enabled) {
        setTimeout(() => {
          try {
            import("../../voice/voiceSystem.js").then((voiceModule) => {
              voiceModule.speak(messageText);
            });
          } catch (err) {
            console.error("[TOGGLE ERROR] Erro ao dar feedback por voz:", err);
          }
        }, 200);
      }

      // Disparar evento personalizado para outros componentes
      document.dispatchEvent(
        new CustomEvent("voice:state:changed", {
          detail: { enabled: enabled, muted: !enabled },
        })
      );
    }

    // Adicionar o evento - IMPORTANTE: usar o addEventListener em vez de .onchange
    voiceEnabledToggle.addEventListener("change", handleVoiceToggleChange);

    // Verificar o estado inicial com verificação adicional após 1 segundo
    setTimeout(() => {
      const currentStoredValue = localStorage.getItem("voice-enabled");
      const currentChecked = voiceEnabledToggle.checked;

      console.log("[DEBUG] Verificação após 1s:", {
        valorNoLocalStorage: currentStoredValue,
        estadoChecked: currentChecked,
        consistente: (currentStoredValue !== "false") === currentChecked,
      });

      // Se houver inconsistência, forçar sincronização
      if ((currentStoredValue !== "false") !== currentChecked) {
        console.warn(
          "[INCONSISTÊNCIA] Estado do toggle não está sincronizado com localStorage!"
        );
        voiceEnabledToggle.checked = currentStoredValue !== "false";

        // Disparar evento artificialmente para sincronizar
        const event = new Event("change");
        voiceEnabledToggle.dispatchEvent(event);
      }
    }, 1000);
  }

  // Verificação periódica para garantir sincronismo entre toggle e localStorage
  function checkToggleConsistency() {
    const voiceEnabledToggle = document.getElementById("voice-enabled-toggle");
    if (!voiceEnabledToggle) return;

    const storedValue = localStorage.getItem("voice-enabled");
    const shouldBeChecked = storedValue !== "false";

    if (voiceEnabledToggle.checked !== shouldBeChecked) {
      console.warn("[INCONSISTÊNCIA] Toggle não sincronizado. Corrigindo...");
      console.log(
        `Toggle: ${voiceEnabledToggle.checked}, localStorage: ${storedValue}, deveria ser: ${shouldBeChecked}`
      );

      // Forçar o estado correto
      voiceEnabledToggle.checked = shouldBeChecked;

      // Atualizar sistema de voz
      import("../../voice/voiceSystem.js").then((voiceModule) => {
        voiceModule.setMuted(!shouldBeChecked);
      });
    }
  }

  // Verificar a cada 5 segundos
  const consistencyInterval = setInterval(checkToggleConsistency, 5000);

  // Limpar após 1 minuto para não consumir recursos desnecessários
  setTimeout(() => clearInterval(consistencyInterval), 60000);
}

// Modificação na parte do toggle de voz - adicionar após a declaração do toggle

// Configuração do toggle de voz
const voiceEnabledToggle = document.getElementById("voice-enabled-toggle");
if (voiceEnabledToggle) {
  // Atualizar o estilo do toggle para melhor resposta ao clique
  const toggleStyle = document.createElement("style");
  toggleStyle.textContent = `
    /* Melhorias no estilo do toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
      margin-left: 10px;
      cursor: pointer; /* Adicionar cursor pointer para indicar clicabilidade */
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
      left: 0;
      top: 0;
      margin: 0;
      padding: 0;
      z-index: -1; /* Manter acessível ao DOM mas invisível */
    }
    
    .toggle-slider {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
      cursor: pointer;
      z-index: 1; /* Garantir que está à frente */
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
      background-color: var(--primary, #4285f4);
    }
    
    input:focus + .toggle-slider {
      box-shadow: 0 0 1px var(--primary, #4285f4);
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }
  `;
  document.head.appendChild(toggleStyle);

  // Obter o elemento slider associado a este toggle
  const toggleSlider = voiceEnabledToggle.nextElementSibling;

  if (toggleSlider && toggleSlider.classList.contains("toggle-slider")) {
    // Adicionar evento de clique diretamente no slider
    toggleSlider.addEventListener("click", function (e) {
      // Não propagar o evento para evitar duplo processamento
      e.stopPropagation();

      // Inverter o estado do checkbox
      voiceEnabledToggle.checked = !voiceEnabledToggle.checked;

      // Disparar evento de change manualmente
      const changeEvent = new Event("change", { bubbles: true });
      voiceEnabledToggle.dispatchEvent(changeEvent);

      console.log(
        "[TOGGLE] Clique no slider detectado, mudado para:",
        voiceEnabledToggle.checked
      );
    });

    // Adicionar também um evento ao container do toggle para maior área de clique
    const toggleSwitch = voiceEnabledToggle.parentElement;
    if (toggleSwitch && toggleSwitch.classList.contains("toggle-switch")) {
      toggleSwitch.addEventListener("click", function (e) {
        // Evitar duplicação se o clique já foi no slider
        if (e.target === toggleSlider) return;

        // Inverter o estado do checkbox
        voiceEnabledToggle.checked = !voiceEnabledToggle.checked;

        // Disparar evento de change manualmente
        const changeEvent = new Event("change", { bubbles: true });
        voiceEnabledToggle.dispatchEvent(changeEvent);

        console.log(
          "[TOGGLE] Clique no switch detectado, mudado para:",
          voiceEnabledToggle.checked
        );
      });
    }
  }
}

// Modificação na função setupVoiceSelector para lidar melhor com hebraico

function setupVoiceSelector(preferredLang = null) {
  const voiceSelect = document.getElementById("voice-select");
  if (!voiceSelect) return;

  function populateVoices() {
    // Obter a lista de vozes disponíveis
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = "";

    // Filtrar vozes por idioma baseado na linguagem do usuário
    const lang =
      preferredLang ||
      document.getElementById("language-select")?.value ||
      document.documentElement.lang ||
      "pt";

    const langPrefix = lang.substring(0, 2).toLowerCase();

    console.log(`[interface.js] Filtrando vozes para o idioma: ${langPrefix}`);

    // Tratamento especial para hebraico
    if (langPrefix === "he") {
      // Vozes que podem conter hebraico - verificação mais ampla
      const hebrewVoices = voices.filter(
        (voice) =>
          voice.lang.toLowerCase().startsWith("he") ||
          voice.lang.toLowerCase().includes("hebrew") ||
          voice.lang.toLowerCase().includes("il") ||
          voice.name.toLowerCase().includes("hebrew") ||
          voice.name.toLowerCase().includes("ivrit")
      );

      if (hebrewVoices.length > 0) {
        // Encontrou vozes em hebraico, exibi-las
        console.log(
          `[interface.js] Encontradas ${hebrewVoices.length} vozes para hebraico`
        );
        hebrewVoices.forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang}) ✓`;
          voiceSelect.appendChild(option);
        });
      } else {
        // Não encontrou vozes em hebraico, usar Google TTS como fallback
        console.log(
          "[interface.js] Nenhuma voz nativa em hebraico encontrada, usando Google TTS como fallback"
        );

        // Adicionar opção para Google TTS
        const option = document.createElement("option");
        option.value = "google-hebrew-tts";
        option.textContent = "Google Translate TTS (עברית) ✓";
        option.selected = true;
        voiceSelect.appendChild(option);

        // Salvar esta opção como selecionada
        localStorage.setItem("assistant-voice", "google-hebrew-tts");

        // Adicionar mensagem explicativa
        const infoOption = document.createElement("option");
        infoOption.disabled = true;
        infoOption.textContent =
          "── Vozes nativas em hebraico não disponíveis ──";
        voiceSelect.appendChild(infoOption);

        // Adicionar vozes de outros idiomas também
        const otherVoices = voices
          .filter(
            (voice) =>
              voice.lang.toLowerCase().startsWith("en") ||
              voice.lang.toLowerCase().startsWith("es") ||
              voice.lang.toLowerCase().startsWith("pt")
          )
          .slice(0, 5); // Limitar a 5 vozes alternativas

        if (otherVoices.length > 0) {
          otherVoices.forEach((voice) => {
            const option = document.createElement("option");
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
          });
        }
      }
    } else {
      // Para outros idiomas, usar o comportamento normal
      const langVoices = voices.filter((voice) =>
        voice.lang.toLowerCase().startsWith(langPrefix)
      );

      if (langVoices.length === 0) {
        // Caso não encontre vozes para o idioma
        const option = document.createElement("option");
        option.value = "";

        const messages = {
          pt: "Nenhuma voz disponível para este idioma",
          en: "No voices available for this language",
          es: "No hay voces disponibles para este idioma",
          he: "אין קולות זמינים עבור שפה זו",
        };

        option.textContent = messages[lang] || messages.en;
        option.disabled = true;
        voiceSelect.appendChild(option);

        // Adicionar opção para outras vozes
        const anyVoiceOption = document.createElement("option");
        anyVoiceOption.value = "use-any";
        anyVoiceOption.textContent =
          messages[lang] === messages.pt
            ? "Usar outra voz disponível"
            : "Use any available voice";
        voiceSelect.appendChild(anyVoiceOption);

        // Adicionar separador
        const separator = document.createElement("option");
        separator.disabled = true;
        separator.textContent = "─────────────────────────";
        voiceSelect.appendChild(separator);

        // Mostrar todas as vozes
        populateAllVoices();
      } else {
        // Mostrar vozes do idioma atual
        langVoices.forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang}) ✓`;
          voiceSelect.appendChild(option);
        });
      }

      // Restaurar voz salva
      restoreSelectedVoice(lang, langVoices);
    }
  }

  // Função auxiliar para restaurar voz salva
  function restoreSelectedVoice(lang, langVoices) {
    const savedVoice = localStorage.getItem("assistant-voice");

    if (savedVoice) {
      const savedOption = Array.from(voiceSelect.options).find(
        (opt) => opt.value === savedVoice
      );

      if (savedOption) {
        savedOption.selected = true;
      } else if (langVoices && langVoices.length > 0) {
        voiceSelect.options[0].selected = true;
        localStorage.setItem("assistant-voice", voiceSelect.value);
      }
    } else if (langVoices && langVoices.length > 0) {
      voiceSelect.options[0].selected = true;
      localStorage.setItem("assistant-voice", voiceSelect.value);
    }
  }

  // Resto do código de setupVoiceSelector permanece o mesmo...

  // Evento de mudança
  voiceSelect.addEventListener("change", () => {
    const selectedVoice = voiceSelect.value;

    if (selectedVoice === "use-any") {
      populateAllVoices();
      return;
    }

    if (selectedVoice === "google-hebrew-tts") {
      // Caso especial para Google TTS em hebraico
      localStorage.setItem("assistant-voice", "google-hebrew-tts");
      console.log("[interface.js] Configurada voz Google TTS para hebraico");

      // Feedback visual em vez de tentar usar API do Google diretamente
      import("../../voice/hebrewVoiceSupport.js")
        .then((module) => {
          // Texto de teste em hebraico
          const testText = "הקול שונה. איך אני נשמע?"; // "A voz foi alterada. Como eu soo?"

          try {
            module.speakHebrew(testText);
          } catch (error) {
            console.error("[interface.js] Erro ao testar voz hebraica:", error);
          }
        })
        .catch((error) => {
          console.error(
            "[interface.js] Erro ao importar módulo de hebraico:",
            error
          );
        });

      return;
    }

    localStorage.setItem("assistant-voice", selectedVoice);
    console.log("[interface.js] Voz alterada para:", selectedVoice);

    // Feedback de áudio com a nova voz
    import("../../voice/voiceSystem.js")
      .then((voiceModule) => {
        try {
          voiceModule.speak(messages.system.voiceChanged());
        } catch (error) {
          console.error("[interface.js] Erro ao dar feedback de voz:", error);
        }
      })
      .catch((error) => {
        console.error("[interface.js] Erro ao importar voiceSystem:", error);
      });
  });

  // Inicializar as vozes
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  populateVoices();
}

// Adicionar esta função que está faltando no arquivo interface.js

// Função para popular todas as vozes disponíveis (faltando no código)
function populateAllVoices() {
  const voiceSelect = document.getElementById("voice-select");
  if (!voiceSelect) return;

  const voices = window.speechSynthesis.getVoices();

  // Não limpar o select aqui, pois já deve conter o cabeçalho

  // Agrupar vozes por idioma para melhor organização
  const voicesByLanguage = {};

  voices.forEach((voice) => {
    const langCode = voice.lang.substring(0, 2).toLowerCase();
    if (!voicesByLanguage[langCode]) {
      voicesByLanguage[langCode] = [];
    }
    voicesByLanguage[langCode].push(voice);
  });

  // Adicionar vozes agrupadas por idioma
  for (const langCode in voicesByLanguage) {
    // Adicionar cabeçalho de idioma
    const langHeader = document.createElement("option");
    langHeader.disabled = true;
    langHeader.textContent = `=== ${getLanguageName(
      langCode
    )} (${langCode.toUpperCase()}) ===`;
    voiceSelect.appendChild(langHeader);

    // Adicionar vozes deste idioma
    voicesByLanguage[langCode].forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });
  }
}

// Helper para obter nome do idioma a partir do código
function getLanguageName(langCode) {
  const languageNames = {
    pt: "Português",
    en: "English",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    it: "Italiano",
    he: "עברית",
    ar: "العربية",
    zh: "中文",
    ja: "日本語",
    ko: "한국어",
    ru: "Русский",
    // Adicionar mais idiomas conforme necessário
  };

  return languageNames[langCode] || langCode;
}

// Adicionar função para mostrar notificações temporárias
function showNotification(message, duration = 3000) {
  // Remover notificação existente, se houver
  const existingNotification = document.getElementById(
    "assistant-notification"
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  // Criar nova notificação
  const notification = document.createElement("div");
  notification.id = "assistant-notification";
  notification.className = "assistant-notification";
  notification.textContent = message;

  // Adicionar ao corpo do documento
  document.body.appendChild(notification);

  // Mostrar com animação
  setTimeout(() => notification.classList.add("visible"), 10);

  // Remover após o tempo especificado
  setTimeout(() => {
    notification.classList.remove("visible");
    setTimeout(() => notification.remove(), 300); // Tempo para a animação de saída
  }, duration);
}

// Adicionar estilo para as notificações
const notificationStyle = document.createElement("style");
notificationStyle.textContent = `
  .assistant-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.3s, transform 0.3s;
    z-index: 9999;
  }
  
  .assistant-notification.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

document.head.appendChild(notificationStyle);

// Adicionar esta função no arquivo interface.js

// Detectar quando o teclado é mostrado/ocultado
function setupKeyboardDetection() {
  const assistantInput = document.getElementById("assistantInput");
  if (!assistantInput) return;

  // Adicionar eventos para detectar foco
  assistantInput.addEventListener("focus", () => {
    console.log(
      "[interface.js] Input ganhou foco, teclado provavelmente visível"
    );
    document.body.classList.add("keyboard-visible");

    // Em dispositivos iOS, rolar a janela para garantir que o input esteja visível
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setTimeout(() => {
        assistantInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  });

  assistantInput.addEventListener("blur", () => {
    console.log(
      "[interface.js] Input perdeu foco, teclado provavelmente oculto"
    );
    document.body.classList.remove("keyboard-visible");

    // Restaurar a visualização após um pequeno delay
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 100);
  });
}

// Chamar esta função na inicialização
document.addEventListener("DOMContentLoaded", setupKeyboardDetection);

// Adicionar função para gerenciar tamanho e altura do assistant-messages

/**
 * Gerencia o redimensionamento do container de mensagens do assistente
 */
function setupDynamicMessagesResize() {
  // Referências principais
  const assistantMessages = document.getElementById("assistant-messages");
  const messagesArea = assistantMessages?.querySelector(".messages-area");

  if (!assistantMessages || !messagesArea) return;

  // Observer para monitorar mudanças no conteúdo
  const messagesObserver = new MutationObserver((mutations) => {
    // Quando novas mensagens são adicionadas
    updateMessagesContainerSize();
  });

  // Configuração do observer
  messagesObserver.observe(messagesArea, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Função para atualizar o tamanho do container baseado no conteúdo
  function updateMessagesContainerSize() {
    // Resetar estilos para calcular tamanho natural
    assistantMessages.style.height = "auto";

    // Verificar se tem muitas mensagens (mais de 3)
    const messageCount = messagesArea.querySelectorAll(".message").length;

    if (messageCount > 3) {
      assistantMessages.classList.add("has-many-messages");
    } else {
      assistantMessages.classList.remove("has-many-messages");

      // Para poucas mensagens, calcular altura baseada no conteúdo
      const messagesHeight = messagesArea.scrollHeight;
      const maxHeight = window.innerHeight * 1; // 80% da altura da janela

      if (messagesHeight > maxHeight) {
        assistantMessages.style.height = `${maxHeight}px`;
        assistantMessages.classList.add("has-many-messages");
      } else {
        // Altura natural + padding
        assistantMessages.style.height = `${messagesHeight + 0}px`;
      }
    }

    // Verificar tamanho da fonte
    checkFontSize();
  }

  // Função para verificar e ajustar tamanho da fonte em mensagens muito longas
  function checkFontSize() {
    const messages = messagesArea.querySelectorAll(".message");

    messages.forEach((message) => {
      const length = message.textContent.length;

      // Ajustar tamanho de fonte para mensagens muito longas
      if (length > 500) {
        message.style.fontSize = "calc(0.95em - 1px)";
      } else if (length > 300) {
        message.style.fontSize = "0.95em";
      } else {
        message.style.fontSize = ""; // Reset para o valor padrão
      }
    });
  }

  // Executar a primeira verificação
  updateMessagesContainerSize();

  // Atualizar em resize da janela
  window.addEventListener("resize", () => {
    updateMessagesContainerSize();
  });

  // Exportar função para uso em outros arquivos
  return { updateMessagesContainerSize };
}

// Modificar a função appendMessage para atualizar o tamanho após adicionar mensagem
function appendMessage(sender, message) {
  // Código existente para adicionar mensagem...

  // Após adicionar mensagem, atualizar tamanho
  if (window.assistantResizeManager) {
    setTimeout(() => {
      window.assistantResizeManager.updateMessagesContainerSize();
    }, 50);
  }

  // Resto do código existente...

  // Após adicionar a mensagem, garantir que o container se ajuste exatamente
  setTimeout(() => {
    // Remover espaços vazios
    const emptyAreas = document.querySelectorAll(
      "#assistant-messages .messages-area:empty"
    );
    emptyAreas.forEach((area) => {
      area.style.display = "none";
    });

    // Verificar se temos a função de ajuste disponível globalmente
    if (window.uiAdjustments && window.uiAdjustments.adjustNow) {
      window.uiAdjustments.adjustNow();
    }
  }, 50);
}

// Adicionar no final da função que processa mensagens do usuário

function processUserMessage(message) {
  // Código existente para processar a mensagem...

  // Adicionar este código no final
  // Disparar evento para análise de humor
  const messageEvent = new CustomEvent("user-message-sent", {
    detail: { message },
  });
  document.dispatchEvent(messageEvent);
}

// Na função que processa respostas do assistente

function processAssistantResponse(response) {
  // Código existente para processar a resposta...

  // Adicionar este código no final
  // Disparar evento para análise de humor
  const responseEvent = new CustomEvent("assistant-message-received", {
    detail: { message: response },
  });
  document.dispatchEvent(responseEvent);
}
