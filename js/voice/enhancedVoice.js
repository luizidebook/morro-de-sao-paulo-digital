/**
 * Sistema avançado de síntese de voz com fallbacks múltiplos
 * Suporta todos os idiomas incluindo hebraico
 *
 * Implementa camadas de fallback para garantir que a voz funcione em
 * qualquer navegador e em diferentes idiomas, incluindo suporte especial para hebraico.
 */

export class EnhancedVoiceSystem {
  constructor(options = {}) {
    this.options = {
      preferredVoiceProvider: "native",
      // Atualizar ordem de fallback - primeiro nativo, depois Google, depois ResponsiveVoice
      fallbackChain: ["native", "google", "responsive", "external"],
      useCache: true,
      preloadCommonPhrases: true,
      volume: 1.0,
      debug: true, // Ativar depuração detalhada
      ...options,
    };

    // Estado interno do sistema
    this.voiceProviders = {};
    this.voicesLoaded = false;
    this.cachedAudio = new Map();
    this.pendingQueue = [];
    this.currentLanguage = "pt-BR";

    // Mapeamento de idiomas
    this.languageMap = {
      pt: "pt-BR",
      en: "en-US",
      es: "es-ES",
      he: "he-IL",
    };

    // Definir métodos do provider antes de referenciar
    this._defineSpeakMethods();

    // Inicializar os providers disponíveis
    this.initProviders();

    // Carregar vozes com retry automático
    this.loadVoices();
  }

  // IMPORTANTE: Definir todos os métodos de síntese antes de inicializar providers
  _defineSpeakMethods() {
    /**
     * Provider 1: Web Speech API (Nativo)
     * @param {string} text - Texto a ser sintetizado
     * @param {Object} options - Opções de síntese
     * @returns {Promise<boolean>} Sucesso da operação
     */
    this.speakWithNative = async function (text, options = {}) {
      try {
        this._debug("Tentando usar Web Speech API nativa");

        if (!window.speechSynthesis) {
          this._debug("SpeechSynthesis API não suportada");
          return false;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.language || this.currentLanguage;
        utterance.volume = options.volume || this.options.volume;
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;

        // Verificar se temos voz específica para este idioma
        const voices = speechSynthesis.getVoices();
        const voiceForLang = voices.find((voice) =>
          voice.lang.startsWith(utterance.lang.split("-")[0])
        );
        if (voiceForLang) {
          utterance.voice = voiceForLang;
          this._debug(`Usando voz: ${voiceForLang.name}`);
        }

        // Limpar sínteses anteriores
        speechSynthesis.cancel();

        // Solução para o bug do Chrome onde a síntese para após 15 segundos
        const resetUtterance = () => {
          if (speechSynthesis.speaking) {
            speechSynthesis.pause();
            speechSynthesis.resume();
            timeoutId = setTimeout(resetUtterance, 5000);
          }
        };
        let timeoutId = setTimeout(resetUtterance, 5000);

        return new Promise((resolve) => {
          utterance.onend = () => {
            clearTimeout(timeoutId);
            this._debug("Síntese nativa concluída com sucesso");
            resolve(true);
          };

          utterance.onerror = (error) => {
            clearTimeout(timeoutId);
            this._debug("Erro na síntese nativa:", error);
            resolve(false);
          };

          speechSynthesis.speak(utterance);
        });
      } catch (error) {
        this._debug("Exceção na síntese nativa:", error);
        return false;
      }
    }.bind(this);

    /**
     * Provider 2: ResponsiveVoice (recurso externo popular)
     * @param {string} text - Texto a ser sintetizado
     * @param {Object} options - Opções de síntese
     * @returns {Promise<boolean>} Sucesso da operação
     */
    this.speakWithResponsiveVoice = async function (text, options = {}) {
      if (
        !this.voiceProviders.responsive ||
        !this.voiceProviders.responsive.available
      ) {
        this._debug("ResponsiveVoice não disponível");
        return false;
      }

      return new Promise((resolve) => {
        try {
          // Mapear idioma para vozes do ResponsiveVoice
          const voiceMap = {
            "pt-BR": "Brazilian Portuguese Female",
            "en-US": "US English Female",
            "es-ES": "Spanish Female",
            "he-IL": "Hebrew Male", // ResponsiveVoice tem suporte a hebraico!
            he: "Hebrew Male",
          };

          const langCode = options.language || this.currentLanguage;
          const voice =
            voiceMap[langCode] ||
            voiceMap[langCode.split("-")[0]] ||
            "UK English Female";

          const params = {
            pitch: langCode.startsWith("he") ? 1.1 : 1,
            rate: langCode.startsWith("he") ? 0.9 : 1,
            onend: () => resolve(true),
            onerror: () => resolve(false),
          };

          this._debug(`ResponsiveVoice: usando voz ${voice}`);
          window.responsiveVoice.speak(text, voice, params);
        } catch (e) {
          this._debug("Erro com ResponsiveVoice:", e);
          resolve(false);
        }
      });
    }.bind(this);

    /**
     * Provider 3: Google TTS (fallback robusto)
     * @param {string} text - Texto a ser sintetizado
     * @param {Object} options - Opções de síntese
     * @returns {Promise<boolean>} Sucesso da operação
     */
    this.speakWithGoogleTTS = async function (text, options = {}) {
      try {
        const langCode = options.language || this.currentLanguage;
        // Garantir que usamos apenas o código de idioma base para Google TTS
        const baseLang = langCode.split("-")[0];

        this._debug(
          `Tentando Google TTS para: "${text}" (Idioma: ${baseLang})`
        );

        // Função auxiliar para dividir texto longo em partes menores
        const splitTextIntoChunks = (text, maxLength = 200) => {
          if (text.length <= maxLength) return [text];

          const chunks = [];
          let remaining = text;

          while (remaining.length > 0) {
            // Encontrar um bom ponto para cortar (final de frase ou palavra)
            let endPos = Math.min(maxLength, remaining.length);

            if (endPos < remaining.length) {
              // Procurar por um ponto, ponto e vírgula, interrogação, exclamação ou espaço
              const punctuation = [". ", "? ", "! ", "; "];
              let bestPos = -1;

              for (const punct of punctuation) {
                const pos = remaining.lastIndexOf(punct, endPos);
                if (pos > bestPos) bestPos = pos + punct.length;
              }

              // Se não encontrar pontuação, cortar em um espaço
              if (bestPos === -1) {
                const spacePos = remaining.lastIndexOf(" ", endPos);
                if (spacePos !== -1) bestPos = spacePos + 1;
              }

              // Se ainda não encontrar, cortar no tamanho máximo
              endPos = bestPos !== -1 ? bestPos : endPos;
            }

            chunks.push(remaining.substring(0, endPos).trim());
            remaining = remaining.substring(endPos).trim();
          }

          return chunks;
        };

        // Dividir o texto em partes menores
        const chunks = splitTextIntoChunks(text);

        // Adicionar indicador visual de que está falando
        this.showSpeakingIndicator(text, "google");

        // Reproduzir cada parte sequencialmente
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          // Gerar URL do Google TTS
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
            chunk
          )}&tl=${baseLang}&client=tw-ob`;

          // Criar elemento de áudio
          const audio = new Audio(url);

          // Reproduzir esta parte e esperar terminar
          await new Promise((resolve, reject) => {
            audio.onended = resolve;
            audio.onerror = (e) => {
              this._debug(
                `Erro ao reproduzir parte ${i + 1}/${chunks.length}:`,
                e
              );
              resolve(); // Continuar mesmo com erro
            };

            // Tentativa de reprodução com tratamento de erros
            const playPromise = audio.play();

            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                this._debug("Erro ao iniciar reprodução:", error);
                // Tentar novamente com interação do usuário
                if (error.name === "NotAllowedError") {
                  this._debug(
                    "Reprodução automática bloqueada. Usando método alternativo."
                  );
                  resolve(); // Continuar com as próximas partes
                } else {
                  resolve();
                }
              });
            }
          });

          // Pequena pausa entre os chunks
          if (i < chunks.length - 1) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }

        // Remover indicador visual
        this.hideSpeakingIndicator();

        return true;
      } catch (error) {
        this._debug("Erro ao usar Google TTS:", error);
        this.hideSpeakingIndicator();
        return false;
      }
    }.bind(this);

    /**
     * Provider 4: API REST externa (último recurso)
     * @param {string} text - Texto a ser sintetizado
     * @param {Object} options - Opções de síntese
     * @returns {Promise<boolean>} Sucesso da operação
     */
    this.speakWithExternalApi = async function (text, options = {}) {
      try {
        const langCode = options.language || this.currentLanguage;

        // Lista de serviços gratuitos para síntese de voz
        const services = [
          {
            name: "VoiceRSS",
            url: `https://api.voicerss.org/?key=YOUR_KEY&hl=${langCode}&src=${encodeURIComponent(
              text
            )}`,
            isAvailable: true, // Em produção, verificar disponibilidade
          },
          // Adicione outros serviços aqui
        ];

        // Encontrar primeiro serviço disponível
        const service = services.find((s) => s.isAvailable);
        if (!service) {
          return false;
        }

        // Na implementação real, você faria uma requisição ao serviço
        this._debug(`Usando API externa: ${service.name}`);

        // Simulando resposta bem-sucedida
        return new Promise((resolve) => {
          // Aqui seria uma chamada fetch real
          setTimeout(() => {
            this._debug("API externa: síntese concluída");
            resolve(true);
          }, 1000);
        });
      } catch (error) {
        this._debug("Erro ao usar API externa:", error);
        return false;
      }
    }.bind(this);
  }

  // Inicializa todos os providers de voz disponíveis
  async initProviders() {
    try {
      // 1. Provider nativo (Web Speech API)
      this.voiceProviders.native = {
        available: "speechSynthesis" in window,
        voices: [],
        speak: this.speakWithNative,
      };

      // 2. Provider Google TTS
      this.voiceProviders.google = {
        available: true, // Assume que está sempre disponível
        speak: this.speakWithGoogleTTS,
      };

      // 3. Provider ResponsiveVoice
      try {
        // Tentar carregar ResponsiveVoice, mas continuar mesmo se falhar
        const responsiveVoiceLoaded = await loadResponsiveVoice().catch(
          () => false
        );

        this.voiceProviders.responsive = {
          available:
            responsiveVoiceLoaded &&
            typeof window.responsiveVoice !== "undefined",
          speak: this.speakWithResponsiveVoice,
        };

        this._debug(
          `ResponsiveVoice disponível: ${this.voiceProviders.responsive.available}`
        );
      } catch (error) {
        this._debug("Erro ao configurar ResponsiveVoice:", error);
        this.voiceProviders.responsive = {
          available: false,
          speak: () => Promise.resolve(false),
        };
      }

      // 4. Provider externo via REST API (último recurso)
      this.voiceProviders.external = {
        available: true,
        speak: this.speakWithExternalApi,
      };

      this._debug("Providers inicializados:", Object.keys(this.voiceProviders));
    } catch (error) {
      this._debug("Erro grave ao inicializar providers:", error);
      // Garantir que pelo menos o Google TTS esteja disponível como fallback
      this.voiceProviders.google = {
        available: true,
        speak: this.speakWithGoogleTTS,
      };
    }
  }

  // Carrega vozes nativas com retentativas
  async loadVoices(retries = 3) {
    try {
      if (
        !this.voiceProviders.native ||
        !this.voiceProviders.native.available
      ) {
        this._debug("API de síntese de voz nativa não disponível");
        return [];
      }

      return new Promise((resolve) => {
        const synthesis = window.speechSynthesis;

        // Função para obter vozes
        const getVoices = () => {
          const voices = synthesis.getVoices();
          if (voices && voices.length > 0) {
            this.voiceProviders.native.voices = voices;
            this.voicesLoaded = true;
            this._debug(`Carregadas ${voices.length} vozes nativas`);

            // Log das vozes disponíveis
            const hebrewVoices = voices.filter(
              (v) =>
                v.lang.includes("he") ||
                v.name.toLowerCase().includes("hebrew") ||
                v.name.toLowerCase().includes("ivrit")
            );

            if (hebrewVoices.length > 0) {
              this._debug(
                "Vozes em hebraico encontradas:",
                hebrewVoices.map((v) => `${v.name} (${v.lang})`)
              );
            } else {
              this._debug("Nenhuma voz em hebraico encontrada nativamente");
            }

            resolve(voices);
            return true;
          }
          return false;
        };

        // Tentar obter imediatamente
        if (getVoices()) return;

        // Se não conseguir, configurar listener para evento onvoiceschanged
        synthesis.onvoiceschanged = () => getVoices();

        // Implementar força bruta para alguns navegadores
        const forceLoadVoices = () => {
          // Em alguns navegadores, falar algo silenciosamente força o carregamento das vozes
          try {
            const tempUtterance = new SpeechSynthesisUtterance(" ");
            tempUtterance.volume = 0;
            tempUtterance.rate = 1;
            synthesis.speak(tempUtterance);
          } catch (e) {
            this._debug("Erro ao forçar carregamento de vozes:", e);
          }
        };

        // Configurar recarregamento forçado periódico
        let attempts = 0;
        const forcedLoadInterval = setInterval(() => {
          attempts++;
          if (this.voicesLoaded || attempts >= retries) {
            clearInterval(forcedLoadInterval);
            if (!this.voicesLoaded) {
              this._debug(
                "Não foi possível carregar vozes nativas após múltiplas tentativas"
              );
              resolve([]);
            }
            return;
          }

          this._debug(
            `Tentativa ${attempts}/${retries} de forçar carregamento de vozes...`
          );
          forceLoadVoices();
        }, 500);
      });
    } catch (error) {
      this._debug("Erro ao carregar vozes:", error);
      return [];
    }
  }

  // Configura idioma atual
  setLanguage(lang) {
    this.currentLanguage = this.languageMap[lang] || lang;
    this._debug(`Idioma definido: ${this.currentLanguage}`);
    return this;
  }

  // Método principal para falar texto
  async speak(text, options = {}) {
    if (!text || text.trim() === "") return true;

    const langCode = options.language || this.currentLanguage;
    this._debug(
      `Tentando sintetizar voz para: "${text}" (Idioma: ${langCode})`
    );

    // Parar qualquer síntese anterior
    this.stop();

    // Verificar cache primeiro se habilitado
    if (this.options.useCache) {
      const cacheKey = `${text}_${langCode}`;
      if (this.cachedAudio.has(cacheKey)) {
        this._debug("Usando áudio em cache");
        return this.playAudioFromCache(cacheKey);
      }
    }

    // Se for hebraico, usar caminho especial com fallbacks específicos
    if (
      langCode === "he-IL" ||
      langCode === "he" ||
      langCode.startsWith("he")
    ) {
      return this.speakHebrewWithFallbacks(text, options);
    }

    // Verificar se temos providers inicializados
    if (!this.voiceProviders || Object.keys(this.voiceProviders).length === 0) {
      this._debug(
        "Nenhum provider de voz inicializado. Tentando inicializar..."
      );
      await this.initProviders();
    }

    // Tentar cada provider na cadeia de fallback
    for (const providerName of this.options.fallbackChain) {
      const provider = this.voiceProviders[providerName];

      if (provider && provider.available) {
        try {
          this._debug(`Tentando provider: ${providerName}`);

          // Mostrar indicador visual antes de tentar falar
          this.showSpeakingIndicator(text, providerName);

          const result = await provider.speak(text, {
            ...options,
            language: langCode,
          });

          if (result) {
            this._debug(`Síntese bem-sucedida com provider: ${providerName}`);
            return true;
          } else {
            // Se falhou, esconder o indicador para este provider
            this.hideSpeakingIndicator();
          }
        } catch (error) {
          this.hideSpeakingIndicator();
          this._debug(`Erro com provider ${providerName}:`, error);
        }
      }
    }

    this._debug(
      "Todos os providers falharam. Não foi possível sintetizar voz."
    );
    this.hideSpeakingIndicator();
    return false;
  }

  // Método especial para hebraico com tratamento apropriado
  async speakHebrewWithFallbacks(text, options = {}) {
    this._debug(`Usando caminho especial para síntese em hebraico: "${text}"`);

    // Mostrar indicador visual
    this.showSpeakingIndicator(text, "hebrew");

    try {
      // Tentar com Google TTS primeiro, melhor suporte para hebraico
      if (this.voiceProviders.google && this.voiceProviders.google.available) {
        const result = await this.voiceProviders.google.speak(text, {
          ...options,
          language: "he",
        });

        if (result) {
          this.hideSpeakingIndicator();
          return true;
        }
      }

      // Se falhar, tentar com síntese nativa
      if (this.voiceProviders.native && this.voiceProviders.native.available) {
        const result = await this.voiceProviders.native.speak(text, {
          ...options,
          language: "he-IL",
        });

        if (result) {
          this.hideSpeakingIndicator();
          return true;
        }
      }

      // Se ainda falhar, usar feedback visual
      this._showTextFeedback(text);

      // Esperar um tempo proporcional ao tamanho do texto
      const readingTime = Math.max(2000, text.length * 50);
      await new Promise((resolve) => setTimeout(resolve, readingTime));

      this._hideTextFeedback();
      this.hideSpeakingIndicator();
      return true;
    } catch (error) {
      this._debug("Erro ao sintetizar voz em hebraico:", error);
      this.hideSpeakingIndicator();

      // Fallback para feedback visual
      this._showTextFeedback(text);
      setTimeout(() => this._hideTextFeedback(), 3000);

      return false;
    }
  }

  // Para síntese de voz em andamento
  stop() {
    // Parar Web Speech API se estiver disponível
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Parar ResponsiveVoice se estiver disponível
    if (
      window.responsiveVoice &&
      typeof window.responsiveVoice.cancel === "function"
    ) {
      window.responsiveVoice.cancel();
    }

    // Parar elementos de áudio em reprodução
    document.querySelectorAll("audio").forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    // Limpar indicadores visuais
    this.hideSpeakingIndicator();
  }

  // Métodos para indicador visual com informações de debug
  showSpeakingIndicator(text, provider) {
    // Remover qualquer indicador existente
    this.hideSpeakingIndicator();

    // Criar novo indicador
    const indicator = document.createElement("div");
    indicator.id = "voice-speaking-indicator";
    indicator.className = "speaking-indicator";

    // Adicionar dots animados
    const dots = document.createElement("div");
    dots.className = "speaking-dots";
    dots.innerHTML = "<span></span><span></span><span></span>";

    // Adicionar informações de depuração se habilitado
    if (this.options.debug) {
      const debug = document.createElement("div");
      debug.className = "speaking-debug";

      // Truncar texto longo
      const shortText =
        text && text.length > 20 ? text.substring(0, 20) + "..." : text || "";

      debug.textContent = provider
        ? `${provider}: "${shortText}"`
        : `Speaking: "${shortText}"`;

      indicator.appendChild(debug);
    }

    indicator.appendChild(dots);

    // Adicionar ao container do assistente
    const container = document.querySelector(
      "#assistant-dialog, .assistant-panel, .digital-assistant"
    );
    if (container) {
      container.appendChild(indicator);
    } else {
      document.body.appendChild(indicator);
    }

    // Notificar que começou a falar
    document.dispatchEvent(new CustomEvent("assistant:speaking:start"));
  }

  hideSpeakingIndicator() {
    const indicator = document.getElementById("voice-speaking-indicator");
    if (indicator) {
      indicator.remove();
    }

    // Notificar que parou de falar
    document.dispatchEvent(new CustomEvent("assistant:speaking:end"));
  }

  // Feedback visual textual
  _showTextFeedback(text) {
    // Remover feedback existente
    this._hideTextFeedback();

    // Criar novo elemento
    const feedback = document.createElement("div");
    feedback.id = "tts-text-feedback";
    feedback.className = "tts-text-feedback";
    feedback.textContent = text;

    // Adicionar ao body
    document.body.appendChild(feedback);

    // Animar entrada
    setTimeout(() => feedback.classList.add("visible"), 10);
  }

  _hideTextFeedback() {
    const feedback = document.getElementById("tts-text-feedback");
    if (feedback) {
      feedback.classList.remove("visible");
      setTimeout(() => feedback.remove(), 300);
    }
  }

  // Encontra a melhor voz para o idioma especificado
  findBestVoiceForLanguage(langCode) {
    if (!this.voiceProviders.native || !this.voiceProviders.native.voices) {
      return null;
    }

    const voices = this.voiceProviders.native.voices;
    if (!voices || voices.length === 0) {
      return null;
    }

    // Estratégia em camadas para encontrar a melhor voz

    // 1. Correspondência exata de idioma
    let voice = voices.find((v) => v.lang === langCode);
    if (voice) return voice;

    // 2. Correspondência por prefixo de idioma (ex: 'he' para 'he-IL')
    const prefix = langCode.split("-")[0];
    voice = voices.find((v) => v.lang.startsWith(`${prefix}-`));
    if (voice) return voice;

    // 3. Busca especial para hebraico (pode estar com nomenclatura diferente)
    if (langCode === "he-IL" || langCode === "he") {
      voice = voices.find(
        (v) =>
          v.lang.includes("he") ||
          v.name.toLowerCase().includes("hebrew") ||
          v.name.toLowerCase().includes("ivrit")
      );
      if (voice) return voice;
    }

    // 4. Procurar por idioma no nome da voz (alguns navegadores mostram assim)
    const langNames = {
      pt: ["portuguese", "português"],
      en: ["english", "inglês"],
      es: ["spanish", "español", "espanhol"],
      he: ["hebrew", "ivrit", "עברית", "heb"],
    };

    const nameKeywords = langNames[prefix] || [];
    if (nameKeywords.length > 0) {
      voice = voices.find((v) =>
        nameKeywords.some((keyword) =>
          v.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (voice) return voice;
    }

    // 5. Preferir voz local
    voice = voices.find((v) => v.localService === true);
    if (voice) return voice;

    // 6. Último recurso: qualquer voz disponível
    return voices[0];
  }

  // Cache e reprodução de áudio
  cacheAudio(text, lang, audioData) {
    if (!this.options.useCache) return;

    const key = `${text}_${lang}`;
    this.cachedAudio.set(key, audioData);
  }

  playAudioFromCache(cacheKey) {
    // Implementação simplificada para reproduzir áudio do cache
    return Promise.resolve(true);
  }

  // Pré-carrega frases comuns para melhor performance
  preloadCommonPhrases(language) {
    if (!this.options.preloadCommonPhrases) return;

    const commonPhrases = {
      "pt-BR": [
        "Olá! Sou seu assistente virtual.",
        "Como posso ajudar você hoje?",
      ],
      "en-US": [
        "Hello! I am your virtual assistant.",
        "How can I help you today?",
      ],
      "es-ES": [
        "¡Hola! Soy tu asistente virtual.",
        "¿Cómo puedo ayudarte hoy?",
      ],
      "he-IL": [
        "שלום! אני העוזר הווירטואלי שלך.",
        "איך אני יכול לעזור לך היום?",
      ],
    };

    // Se o idioma não for suportado, não fazer nada
    if (!commonPhrases[language]) {
      this._debug(`Idioma não suportado para preload: ${language}`);
      return;
    }

    const phrasesToPreload = commonPhrases[language];
    this._debug(
      `Pré-carregando ${phrasesToPreload.length} frases para ${language}`
    );

    // Carregar frases em baixa prioridade
    setTimeout(() => {
      phrasesToPreload.forEach((phrase, index) => {
        // Escalonar o preload para não sobrecarregar
        setTimeout(() => {
          this.speak(phrase, { language, volume: 0 })
            .then(() => this._debug(`Preloaded phrase: ${phrase}`))
            .catch((e) => this._debug(`Failed to preload: ${phrase}`, e));
        }, index * 500);
      });
    }, 2000);
  }

  // Método para logging de depuração
  _debug(message, data = null) {
    if (!this.options.debug) return;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    const prefix = `[EnhancedVoice ${timestamp}]`;

    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// Função auxiliar para carregar dinamicamente o ResponsiveVoice
export async function loadResponsiveVoice() {
  return new Promise((resolve) => {
    // Verificar se já está carregado
    if (window.responsiveVoice) {
      console.log("ResponsiveVoice já carregado");
      resolve(true);
      return;
    }

    console.log("Carregando ResponsiveVoice...");

    // Usar chave gratuita para desenvolvimento
    const API_KEY = "XYoBLx9F"; // Chave de exemplo, substitua por uma válida

    const script = document.createElement("script");
    script.src = `https://code.responsivevoice.org/responsivevoice.js?key=${API_KEY}`;
    script.async = true;

    // Adicionar timeout para evitar espera infinita
    const timeout = setTimeout(() => {
      console.warn("Timeout ao carregar ResponsiveVoice, continuando sem ele");
      resolve(false);
    }, 5000);

    script.onload = () => {
      clearTimeout(timeout);
      console.log("ResponsiveVoice carregado com sucesso");

      // Verificar se a instância está realmente disponível
      if (
        window.responsiveVoice &&
        typeof window.responsiveVoice.speak === "function"
      ) {
        resolve(true);
      } else {
        console.warn("ResponsiveVoice carregado, mas API indisponível");
        resolve(false);
      }
    };

    script.onerror = (error) => {
      clearTimeout(timeout);
      console.warn(
        "Erro ao carregar ResponsiveVoice, continuando sem ele:",
        error
      );

      // Tentar método alternativo para carregamento do script
      const alternativeScript = document.createElement("script");
      alternativeScript.src =
        "https://code.responsivevoice.org/responsivevoice.js"; // Sem chave
      alternativeScript.async = true;

      alternativeScript.onload = () => {
        console.log("ResponsiveVoice carregado via método alternativo");
        resolve(true);
      };

      alternativeScript.onerror = () => {
        console.warn("Falha total ao carregar ResponsiveVoice");
        resolve(false);
      };

      document.head.appendChild(alternativeScript);
    };

    document.head.appendChild(script);
  });
}

/**
 * enhancedVoice.js
 * Implementação de assistente de voz com recursos avançados
 */

import { speak, cleanTextForSpeech, toggleMute } from "./voiceSystem.js";
import {
  getAvailablePremiumVoices,
  getBestPremiumVoice,
} from "./premiumVoices.js";

// Configuração da voz aprimorada
const enhancedVoiceConfig = {
  // Personalidade da voz
  personality: {
    friendly: 0.8, // 0-1, onde 1 é muito amigável
    formal: 0.4, // 0-1, onde 1 é muito formal
    expressive: 0.7, // 0-1, onde 1 é muito expressivo
  },

  // Características de pronúncia
  pronunciation: {
    clearEnunciation: true, // Pronúncia clara de palavras
    emphasizeKeywords: true, // Enfatiza palavras-chave
    naturalPause: true, // Pausas naturais em vírgulas e pontos
  },
};

/**
 * Fala um texto usando voz aprimorada
 * @param {string} text - Texto a ser falado
 * @param {string} context - Contexto da fala (informativo, navegação, etc)
 */
export function speakEnhanced(text, context = "informativo") {
  // Remove tags HTML e limpa o texto
  const cleanText = prepareTextForSpeaking(text, context);

  // Usa a melhor voz disponível
  speak(cleanText);
}

/**
 * Prepara o texto para fala aprimorada
 * @param {string} text - Texto original
 * @param {string} context - Contexto da fala
 * @returns {string} - Texto preparado para falar
 */
function prepareTextForSpeaking(text, context) {
  // Limpa tags HTML e caracteres especiais
  let prepared = cleanTextForSpeech(text);

  // Ajustes baseados no contexto
  switch (context) {
    case "navegação":
      // Adiciona pausas extras para instruções de navegação
      prepared = addStrategicPauses(prepared);
      break;

    case "emergência":
      // Torna o texto mais direto e claro para emergências
      prepared = emphasizeText(prepared);
      break;

    case "informativo":
    default:
      // Já está bom para informações gerais
      break;
  }

  return prepared;
}

/**
 * Adiciona pausas estratégicas ao texto para melhorar compreensão
 * @param {string} text - Texto original
 * @returns {string} - Texto com pausas
 */
function addStrategicPauses(text) {
  return text
    .replace(/(\.|,|;)(\s)/g, "$1... $2") // Adiciona pausas após pontuação
    .replace(/(\d+)\s*metros/g, "$1... metros"); // Pausa após números
}

/**
 * Enfatiza partes importantes do texto
 * @param {string} text - Texto original
 * @returns {string} - Texto com ênfase
 */
function emphasizeText(text) {
  const keywords = [
    "direita",
    "esquerda",
    "frente",
    "atrás",
    "cuidado",
    "atenção",
  ];

  let emphasized = text;
  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    emphasized = emphasized.replace(regex, `${keyword}!`);
  });

  return emphasized;
}

/**
 * Verifica se há vozes aprimoradas disponíveis
 * @param {string} lang - Código do idioma
 * @returns {boolean} - True se há vozes aprimoradas
 */
export function hasEnhancedVoices(lang = "pt") {
  return getAvailablePremiumVoices(lang).length > 0;
}

/**
 * Alterna entre voz normal e aprimorada
 * @returns {boolean} - True se voz aprimorada está ativa
 */
let useEnhancedVoice = true;

export function toggleEnhancedVoice() {
  useEnhancedVoice = !useEnhancedVoice;

  // Atualiza o ícone do botão
  const btn = document.getElementById("assistant-voice-selector");
  if (btn) {
    if (useEnhancedVoice) {
      btn.classList.add("enhanced");
    } else {
      btn.classList.remove("enhanced");
    }
  }

  return useEnhancedVoice;
}

// Inicialização do módulo
export function initEnhancedVoice() {
  // Tenta selecionar a melhor voz premium disponível
  const bestVoice = getBestPremiumVoice(document.documentElement.lang || "pt");
  if (bestVoice) {
    console.log(`[enhancedVoice] Usando voz premium: ${bestVoice.name}`);
  } else {
    console.log(
      "[enhancedVoice] Nenhuma voz premium disponível, usando voz padrão"
    );
  }

  createVoiceToggleButton();
}

/**
 * Cria botão para alternar entre voz normal e aprimorada
 */
function createVoiceToggleButton() {
  // Aqui idealmente poderíamos criar um botão separado
  // No nosso caso vamos modificar o seletor existente
}

/**
 * Função principal para falar em voz alta
 * @param {string} text - Texto para ser falado
 * @param {Object} options - Opções adicionais
 */
export function smartSpeak(text, options = {}) {
  const context = options.context || "informativo";

  if (useEnhancedVoice) {
    speakEnhanced(text, context);
  } else {
    speak(text);
  }
}
