/**
 * MoodAnalyzer - Analisa mensagens e determina o humor adequado
 */

import { MOODS } from "./assistantMood.js";

export class MoodAnalyzer {
  constructor() {
    this.initializePatterns();
  }

  /**
   * Inicializa os padrões de reconhecimento de humor
   */
  initializePatterns() {
    // Padrões para mensagens do usuário
    this.userPatterns = [
      {
        regex: /obrigad[oa]|valeu|grat[oa]|thanks|gracias/i,
        mood: MOODS.EXCITED,
      },
      { regex: /bom dia|good morning|buenos dias/i, mood: MOODS.HAPPY },
      { regex: /boa tarde|good afternoon|buenas tardes/i, mood: MOODS.HAPPY },
      { regex: /boa noite|good evening|buenas noches/i, mood: MOODS.SLEEPY },
      { regex: /praia|beach|playa|sol|sun|calor|heat/i, mood: MOODS.COOL },
      {
        regex: /triste|sad|\bsolo\b|sozinho|\bsola\b|sozinha/i,
        mood: MOODS.SAD,
      },
      {
        regex: /amor|love|namorad[oa]|casamento|wedding|romántic[oa]/i,
        mood: MOODS.LOVE,
      },
      { regex: /uau|wow|incrível|amazing|increible/i, mood: MOODS.SURPRISED },
      {
        regex: /como|what|how|por que|why|cuando|when|donde|where/i,
        mood: MOODS.THINKING,
      },
      { regex: /engraçad[oa]|divertid[oa]|funny/i, mood: MOODS.EXCITED },
      {
        regex: /dormir|sleep|descansar|rest|relax|relaxar/i,
        mood: MOODS.SLEEPY,
      },
      { regex: /\?\?\?|\?{2,}/i, mood: MOODS.SURPRISED },
    ];

    // Padrões para respostas do assistente
    this.assistantPatterns = [
      {
        regex:
          /não sei|não tenho certeza|I don't know|I'm not sure|no sé|no estoy seguro/i,
        mood: MOODS.THINKING,
      },
      { regex: /sinto muito|desculpe|sorry|lo siento/i, mood: MOODS.SAD },
      {
        regex: /que legal|que bom|incrível|amazing|maravilloso|maravilhoso/i,
        mood: MOODS.EXCITED,
      },
      { regex: /bom dia|good morning|buenos dias/i, mood: MOODS.HAPPY },
      { regex: /boa tarde|good afternoon|buenas tardes/i, mood: MOODS.HAPPY },
      { regex: /boa noite|good evening|buenas noches/i, mood: MOODS.SLEEPY },
      {
        regex: /prazer|pleasure|placer|com certeza|certainly|ciertamente/i,
        mood: MOODS.EXCITED,
      },
      { regex: /praia|beach|playa|sol|sun/i, mood: MOODS.COOL },
      { regex: /amor|love|romântic[oa]|romantic/i, mood: MOODS.LOVE },
      { regex: /surpresa|surprise|sorpresa/i, mood: MOODS.SURPRISED },
    ];

    // Padrões para contextos específicos
    this.contextPatterns = {
      weather: {
        hot: MOODS.COOL,
        cold: MOODS.NEUTRAL,
        rain: MOODS.THINKING,
      },
      time: {
        morning: MOODS.HAPPY,
        afternoon: MOODS.COOL,
        evening: MOODS.SLEEPY,
        night: MOODS.SLEEPY,
      },
    };
  }

  /**
   * Analisa entrada do usuário e sugere um humor
   * @param {string} message - Mensagem do usuário
   * @return {string|null} Humor sugerido ou null
   */
  analyzeUserInput(message) {
    if (!message || typeof message !== "string") {
      return null;
    }

    // Verificar padrões em mensagens do usuário
    for (const pattern of this.userPatterns) {
      if (pattern.regex.test(message)) {
        console.log(
          `[MoodAnalyzer] Padrão encontrado na mensagem do usuário: "${pattern.regex.source}" -> ${pattern.mood}`
        );
        return pattern.mood;
      }
    }

    // Verificar contexto da hora do dia
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return this.contextPatterns.time.morning;
    } else if (hour >= 12 && hour < 18) {
      return this.contextPatterns.time.afternoon;
    } else if (hour >= 18 && hour < 22) {
      return this.contextPatterns.time.evening;
    } else {
      return this.contextPatterns.time.night;
    }
  }

  /**
   * Analisa resposta do assistente e sugere um humor
   * @param {string} message - Resposta do assistente
   * @return {string|null} Humor sugerido ou null
   */
  analyzeAssistantResponse(message) {
    if (!message || typeof message !== "string") {
      return null;
    }

    // Verificar padrões em respostas do assistente
    for (const pattern of this.assistantPatterns) {
      if (pattern.regex.test(message)) {
        console.log(
          `[MoodAnalyzer] Padrão encontrado na resposta do assistente: "${pattern.regex.source}" -> ${pattern.mood}`
        );
        return pattern.mood;
      }
    }

    // Se não encontrou padrão específico, manter humor neutro
    return null;
  }

  /**
   * Analisa o contexto da conversa
   * @param {Array} messageHistory - Histórico de mensagens
   * @return {string|null} Humor sugerido baseado no contexto
   */
  analyzeConversationContext(messageHistory) {
    if (!messageHistory || !messageHistory.length) {
      return null;
    }

    // Análise mais avançada do contexto da conversa
    // Implementação simplificada por enquanto
    const lastThreeMessages = messageHistory.slice(-3);
    let weatherContext = false;
    let travelContext = false;

    for (const msg of lastThreeMessages) {
      if (/tempo|clima|weather|temperatura|temperature/i.test(msg)) {
        weatherContext = true;
      }
      if (/viagem|viajar|travel|trip|passeio|tour/i.test(msg)) {
        travelContext = true;
      }
    }

    if (weatherContext && travelContext) {
      return MOODS.EXCITED;
    } else if (weatherContext) {
      return MOODS.COOL;
    } else if (travelContext) {
      return MOODS.HAPPY;
    }

    return null;
  }
}
