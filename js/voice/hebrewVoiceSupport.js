/**
 * Suporte aprimorado para vozes em hebraico utilizando Microsoft Azure Text-to-Speech
 */

// Configuração para uso da API Google Translate TTS (método gratuito)
export const googleTranslateTTS = {
  available: true,

  generateSpeechURL: function (text, lang = "he") {
    // URL da API não oficial do Google Translate TTS
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=${lang}&client=tw-ob`;
  },

  speak: function (text, lang = "he", onStart, onEnd, onError) {
    try {
      const audio = new Audio();
      audio.src = this.generateSpeechURL(text, lang);

      // Callbacks
      audio.onplay = onStart;
      audio.onended = onEnd;
      audio.onerror = onError;

      // Reproduzir áudio
      audio.play();
      return true;
    } catch (error) {
      console.error("Erro ao usar Google Translate TTS:", error);
      if (onError) onError(error);
      return false;
    }
  },

  stop: function () {
    // Encontrar e parar todos os elementos de áudio
    document.querySelectorAll("audio").forEach((audio) => {
      if (audio.src.includes("translate.google.com")) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  },
};

// Extensão para o voiceSystem
export function extendVoiceSystem(voiceSystem) {
  // Adicionar método específico para hebraico
  voiceSystem.speakHebrew = function (text) {
    console.log("Usando método especializado para hebraico:", text);

    // Status para UI
    const onStart = () => {
      const speaking = document.createElement("div");
      speaking.id = "assistant-speaking";
      speaking.className = "assistant-speaking";
      speaking.innerHTML =
        '<div class="speaking-indicator"><span></span><span></span><span></span></div>';

      const assistantDialog = document.querySelector("#assistant-dialog");
      if (assistantDialog) assistantDialog.appendChild(speaking);

      document.dispatchEvent(new CustomEvent("assistant:speaking:start"));
    };

    const onEnd = () => {
      const speaking = document.getElementById("assistant-speaking");
      if (speaking) speaking.remove();

      document.dispatchEvent(new CustomEvent("assistant:speaking:end"));
    };

    const onError = (err) => {
      console.error("Erro na síntese de voz para hebraico:", err);
      onEnd(); // Limpa indicadores de fala
    };

    // Tentar primeiro com métodos nativos
    if (this.speak(text, "he")) {
      return true;
    }

    // Fallback para Google Translate TTS
    return googleTranslateTTS.speak(text, "he", onStart, onEnd, onError);
  };

  // Sobrescrever método speak para verificar se é hebraico
  const originalSpeak = voiceSystem.speak;
  voiceSystem.speak = function (text, language, voiceId) {
    if (language === "he") {
      return this.speakHebrew(text);
    }

    return originalSpeak.call(this, text, language, voiceId);
  };

  // Sobrescrever método stop
  const originalStop = voiceSystem.stop;
  voiceSystem.stop = function () {
    originalStop.call(this);
    googleTranslateTTS.stop();
  };

  return voiceSystem;
}

// Indicador visual para síntese de voz
let speakingIndicator = null;
let currentAudio = null;

// Base64 de um tom de notificação curto
const notificationSound =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAkJCQkJCQkJCQkJCQkJCQwMDAwMDAwMDAwMDAwMDAwMD//////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/jKMQAEvwiwkAQoVgBIIQweACAQDAAAA/////p2/ZN9gAErwvxFA4QEBgaADBIAYDAgIGCQ/8J33dv3f9//+/7/oAAAAAHwQRFAgEDw/8IAAAAAAAAA//OCsKyBdJq+D6wIAL5AQCgQAEBff/9u2bZvgAACgQCAcD8fD4eeAcZLPgPPgH4B///D//Bgf4P////////8H/wP//gf//AvB+D/7//+D////fB///+D4f/yT/EPgAQP//8PCQ/AP/////LXMh9AQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/**
 * Sintetiza voz em hebraico usando abordagens alternativas
 * @param {string} text Texto em hebraico para sintetizar
 */
export function speakHebrew(text) {
  if (!text || text.trim() === "") return false;

  try {
    console.log("[hebrewVoiceSupport] Sintetizando hebraico:", text);

    // Mostrar indicador
    showSpeakingIndicator();

    // Parar qualquer reprodução anterior
    stopCurrentAudio();

    // Verificar se há uma API de Azure configurada
    if (window.AZURE_TTS_KEY && window.AZURE_TTS_REGION) {
      azureTTS(text).catch((err) => {
        console.error("[hebrewVoiceSupport] Erro na Azure TTS:", err);
        fallbackToVisualFeedback(text);
      });
      return true;
    }

    // Se temos acesso ao serviço de proxy
    if (window.PROXY_TTS_ENDPOINT) {
      return useProxyTTS(text);
    }

    // Tentar usar a Web Speech API como último recurso
    const voices = window.speechSynthesis.getVoices();
    const hebrewVoice = findHebrewVoice(voices);

    if (hebrewVoice) {
      console.log("[hebrewVoiceSupport] Usando voz nativa:", hebrewVoice.name);
      speakWithNativeVoice(text, hebrewVoice);
      return true;
    }

    // Se todas as opções falharem, mostrar feedback visual
    fallbackToVisualFeedback(text);
    return true;
  } catch (error) {
    console.error("[hebrewVoiceSupport] Erro ao sintetizar hebraico:", error);
    hideSpeakingIndicator();
    fallbackToVisualFeedback(text);
    return false;
  }
}

/**
 * Busca uma voz que possa suportar hebraico
 */
function findHebrewVoice(voices) {
  return voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith("he") ||
      v.lang.toLowerCase().includes("il-") ||
      v.name.toLowerCase().includes("hebrew") ||
      v.name.toLowerCase().includes("ivrit") ||
      v.lang.toLowerCase().includes("iw") // Código antigo para hebraico
  );
}

/**
 * Fala utilizando a API nativa de voz
 */
function speakWithNativeVoice(text, hebrewVoice) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = hebrewVoice;
  utterance.lang = "he-IL";
  utterance.rate = 0.9;

  utterance.onend = () => {
    hideSpeakingIndicator();
  };

  utterance.onerror = (error) => {
    console.error("[hebrewVoiceSupport] Erro na síntese nativa:", error);
    hideSpeakingIndicator();
    fallbackToVisualFeedback(text);
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Usa a API de Azure Text-to-Speech
 */
async function azureTTS(text) {
  const response = await fetch(
    `https://${window.AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "Ocp-Apim-Subscription-Key": window.AZURE_TTS_KEY,
      },
      body: `<speak version='1.0' xml:lang='he-IL'>
             <voice xml:lang='he-IL' name='he-IL-HilaNeural'>
               ${escapeXml(text)}
             </voice>
           </speak>`,
    }
  );

  if (!response.ok) {
    throw new Error(`Azure TTS falhou: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  playAudioFromUrl(url);
}

/**
 * Usa um serviço de proxy para síntese de voz
 */
function useProxyTTS(text) {
  const proxyUrl = window.PROXY_TTS_ENDPOINT || "/api/tts";

  // Criar URL com parâmetros
  const params = new URLSearchParams({
    text: text,
    lang: "he",
    voice: "female",
  });

  // Fetch para o endpoint do proxy
  fetch(`${proxyUrl}?${params.toString()}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Proxy TTS falhou: ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      playAudioFromUrl(url);
    })
    .catch((error) => {
      console.error("[hebrewVoiceSupport] Erro no proxy TTS:", error);
      fallbackToVisualFeedback(text);
    });

  return true;
}

/**
 * Reproduz áudio a partir de uma URL
 */
function playAudioFromUrl(url) {
  stopCurrentAudio();

  currentAudio = new Audio(url);

  currentAudio.onended = () => {
    URL.revokeObjectURL(url);
    hideSpeakingIndicator();
    currentAudio = null;
  };

  currentAudio.onerror = (error) => {
    console.error("[hebrewVoiceSupport] Erro na reprodução:", error);
    URL.revokeObjectURL(url);
    hideSpeakingIndicator();
    currentAudio = null;
  };

  currentAudio.play().catch((error) => {
    console.error("[hebrewVoiceSupport] Falha ao iniciar áudio:", error);
    URL.revokeObjectURL(url);
    hideSpeakingIndicator();
  });
}

/**
 * Para qualquer áudio em reprodução
 */
function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {
      console.warn("[hebrewVoiceSupport] Erro ao parar áudio:", e);
    }
    currentAudio = null;
  }
}

/**
 * Mostra feedback visual quando a fala falha
 */
function fallbackToVisualFeedback(text, duration = 5000) {
  // Mostrar o texto visualmente
  showTextFeedback(text, duration);

  // Reproduzir um som de notificação simples
  try {
    const notification = new Audio(notificationSound);
    notification.volume = 0.3;
    notification.play().catch(() => {});
  } catch (e) {
    // Silenciar erro se não conseguir reproduzir som
  }

  // Esconder indicador de fala após um tempo
  setTimeout(() => {
    hideSpeakingIndicator();
  }, 1000);
}

/**
 * Mostra indicador visual de fala
 */
function showSpeakingIndicator() {
  // Remover qualquer indicador existente
  hideSpeakingIndicator();

  // Criar novo indicador
  speakingIndicator = document.createElement("div");
  speakingIndicator.id = "hebrew-speaking-indicator";
  speakingIndicator.className = "speaking-indicator";
  speakingIndicator.innerHTML = `
    <div class="speaking-dots">
      <span></span><span></span><span></span>
    </div>
    <div class="speaking-label">שפה עברית</div>
  `;

  // Adicionar ao DOM
  document.body.appendChild(speakingIndicator);

  // Disparar evento
  document.dispatchEvent(new CustomEvent("assistant:speaking:start"));
}

/**
 * Esconde indicador visual de fala
 */
function hideSpeakingIndicator() {
  if (speakingIndicator) {
    speakingIndicator.remove();
    speakingIndicator = null;
  }

  // Remover indicador padrão também, se existir
  const defaultIndicator = document.getElementById("voice-speaking-indicator");
  if (defaultIndicator) {
    defaultIndicator.remove();
  }

  // Disparar evento
  document.dispatchEvent(new CustomEvent("assistant:speaking:end"));
}

/**
 * Mostra texto como feedback visual
 */
function showTextFeedback(text, duration = 3000) {
  // Remover feedback antigo se existir
  const existingFeedback = document.getElementById("hebrew-text-feedback");
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Criar novo feedback
  const feedback = document.createElement("div");
  feedback.id = "hebrew-text-feedback";
  feedback.className = "hebrew-text-feedback";
  feedback.dir = "rtl"; // Direção da direita para a esquerda para hebraico

  // Adicionar ícone de som
  const iconContainer = document.createElement("div");
  iconContainer.className = "hebrew-feedback-icon";
  iconContainer.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"></path>
    </svg>
  `;

  // Adicionar texto
  const textContainer = document.createElement("div");
  textContainer.className = "hebrew-feedback-text";
  textContainer.textContent = text;

  feedback.appendChild(iconContainer);
  feedback.appendChild(textContainer);
  document.body.appendChild(feedback);

  // Adicionar classe para animação
  setTimeout(() => {
    feedback.classList.add("visible");
  }, 10);

  // Remover após o tempo especificado
  setTimeout(() => {
    feedback.classList.add("fade-out");
    setTimeout(() => feedback.remove(), 500);
  }, duration);
}

/**
 * Função auxiliar para escapar caracteres XML
 */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Adicionar configuração global para serviço proxy (configurado no index.html ou config.js)
if (!window.PROXY_TTS_ENDPOINT) {
  window.PROXY_TTS_ENDPOINT = "/api/tts-proxy";
}

// Estilos CSS para os indicadores
const styleElement = document.createElement("style");
styleElement.textContent = `
  .speaking-indicator {
    position: fixed;
    bottom: 70px;
    right: 20px;
    background-color: rgba(0, 123, 255, 0.9);
    color: white;
    padding: 10px 15px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }
  
  .speaking-dots {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }
  
  .speaking-dots span {
    width: 8px;
    height: 8px;
    margin: 0 2px;
    background: white;
    border-radius: 50%;
    animation: pulse 1.5s infinite ease-in-out;
  }
  
  .speaking-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .speaking-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  .speaking-label {
    font-family: Arial, sans-serif;
    font-size: 14px;
  }
  
  .hebrew-text-feedback {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    font-size: 20px;
    max-width: 90%;
    z-index: 1001;
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
    transition: opacity 0.5s, transform 0.3s;
    opacity: 0;
    display: flex;
    align-items: center;
  }
  
  .hebrew-text-feedback.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  
  .hebrew-text-feedback.fade-out {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  
  .hebrew-feedback-icon {
    margin-left: 12px;
    display: flex;
    align-items: center;
    animation: pulse 1.5s infinite;
  }
  
  .hebrew-feedback-icon svg {
    stroke: #4285f4;
  }
  
  .hebrew-feedback-text {
    text-align: right;
    font-family: 'Arial Hebrew', 'Noto Sans Hebrew', Arial, sans-serif;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.1); opacity: 1; }
  }
`;

document.head.appendChild(styleElement);

export default {
  extendVoiceSystem,
  speakHebrew,
  stopCurrentAudio,
};
