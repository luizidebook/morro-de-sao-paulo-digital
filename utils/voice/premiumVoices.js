/**
 * Módulo de vozes premium (implementação futura)
 * Este módulo fornece integração com serviços de vozes realistas
 */

/**
 * Serviços disponíveis para implementação futura:
 *
 * 1. ElevenLabs - Vozes ultra-realistas (API paga)
 * 2. Microsoft Azure Speech - Alta qualidade e suporte a hebraico (API paga)
 * 3. Amazon Polly - Vozes naturais (API paga)
 * 4. Google Cloud Text-to-Speech - Alta qualidade (API paga)
 */

// Exemplo de integração com ElevenLabs
const elevenLabsVoice = {
  available: false, // Alterar para true quando implementado
  apiKey: "", // Inserir chave da API quando disponível

  // Mapeamento de vozes disponíveis
  voices: [
    // Hebraico
    { id: "hebrew-male-1", name: "Ariel (Realista)", lang: "he" },
    { id: "hebrew-female-1", name: "Noa (Realista)", lang: "he" },

    // Português
    { id: "portuguese-male-1", name: "Rafael (Realista)", lang: "pt" },
    { id: "portuguese-female-1", name: "Ana (Realista)", lang: "pt" },

    // Inglês
    { id: "english-male-1", name: "Josh (Realista)", lang: "en" },
    { id: "english-female-1", name: "Rachel (Realista)", lang: "en" },

    // Espanhol
    { id: "spanish-male-1", name: "Carlos (Realista)", lang: "es" },
    { id: "spanish-female-1", name: "Maria (Realista)", lang: "es" },
  ],

  // Método para sintetizar voz
  speak: async function (text, lang, voiceId, onStart, onEnd, onError) {
    // Implementação futura - esta é apenas uma estrutura
    try {
      if (onStart) onStart();

      console.log("ElevenLabs TTS seria usado aqui");

      // Exemplo de código (não funcional sem API)
      /*
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      
      if (!response.ok) throw new Error('API request failed');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = onEnd;
      audio.play();
      */

      // Simulação para este exemplo
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 1000);

      return true;
    } catch (error) {
      console.error("Erro no ElevenLabs TTS:", error);
      if (onError) onError(error);
      return false;
    }
  },

  stop: function () {
    // Implementação futura
  },
};

/**
 * premiumVoices.js
 * Gerenciamento de vozes premium para o assistente virtual
 */

// Lista de vozes premium configuradas
const premiumVoices = {
  pt: [
    { name: "Google português do Brasil", quality: 9, gender: "female" },
    {
      name: "Microsoft Maria Desktop - Portuguese(Brazil)",
      quality: 8,
      gender: "female",
    },
    {
      name: "Microsoft Daniel - Portuguese(Brazil)",
      quality: 8,
      gender: "male",
    },
  ],
  en: [
    { name: "Google US English", quality: 9, gender: "female" },
    {
      name: "Microsoft Zira Desktop - English (United States)",
      quality: 8,
      gender: "female",
    },
  ],
  es: [
    { name: "Google español", quality: 9, gender: "female" },
    {
      name: "Microsoft Sabina Desktop - Spanish (Mexico)",
      quality: 8,
      gender: "female",
    },
  ],
};

/**
 * Obtém todas as vozes disponíveis
 * @returns {SpeechSynthesisVoice[]} Lista de vozes disponíveis
 */
function getAllAvailableVoices() {
  return window.speechSynthesis.getVoices();
}

/**
 * Obtém as vozes premium disponíveis para o idioma especificado
 * @param {string} lang - Código do idioma (pt, en, es)
 * @returns {Object[]} - Lista de vozes premium disponíveis
 */
export function getAvailablePremiumVoices(lang = "pt") {
  const allVoices = getAllAvailableVoices();
  const desiredVoices = premiumVoices[lang] || [];

  // Filtra apenas as vozes premium que estão disponíveis no sistema
  const available = desiredVoices.filter((premium) =>
    allVoices.some((voice) => voice.name === premium.name)
  );

  return available;
}

/**
 * Obtém a melhor voz premium disponível para o idioma
 * @param {string} lang - Código do idioma
 * @param {string} preferredGender - Gênero preferido ('male', 'female')
 * @returns {Object|null} - Melhor voz ou null se nenhuma disponível
 */
export function getBestPremiumVoice(lang = "pt", preferredGender = "female") {
  const available = getAvailablePremiumVoices(lang);

  if (available.length === 0) {
    return null;
  }

  // Primeiro tenta encontrar uma voz do gênero preferido
  const genderMatch = available.filter(
    (voice) => voice.gender === preferredGender
  );

  if (genderMatch.length > 0) {
    // Retorna a voz de maior qualidade dentro do gênero preferido
    return genderMatch.sort((a, b) => b.quality - a.quality)[0];
  }

  // Se não encontrar do gênero preferido, retorna a de maior qualidade
  return available.sort((a, b) => b.quality - a.quality)[0];
}

/**
 * Define a voz a ser usada pelo sintetizador
 * @param {string} voiceName - Nome da voz
 * @returns {boolean} - True se a voz foi encontrada e configurada
 */
export function setVoiceByName(voiceName) {
  const allVoices = getAllAvailableVoices();
  const voice = allVoices.find((v) => v.name === voiceName);

  if (voice) {
    // Armazena a voz escolhida para uso pelo sistema
    localStorage.setItem("selectedVoice", voiceName);
    return true;
  }

  return false;
}

/**
 * Inicializa o módulo de vozes premium
 */
export function initPremiumVoices() {
  // Aguarda as vozes serem carregadas
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      console.log(
        "[premiumVoices] Vozes carregadas:",
        getAllAvailableVoices().length
      );

      // Restaura a voz selecionada anteriormente, se houver
      const savedVoice = localStorage.getItem("selectedVoice");
      if (savedVoice) {
        setVoiceByName(savedVoice);
      }
    };
  }
}
