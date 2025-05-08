/**
 * AssistantMood - Sistema de gerenciamento de humor do assistente
 * Este módulo gerencia a exibição de diferentes emojis do sol para representar
 * o humor do assistente durante a interação com o usuário.
 */

import { MoodAnalyzer } from "./moodAnalyzer.js";
import { MoodRenderer } from "./moodRenderer.js";

// Constantes para os diferentes humores
export const MOODS = {
  NEUTRAL: "neutral", // sun_emoji_1.png
  HAPPY: "happy", // sun_emoji_2.png (padrão)
  EXCITED: "excited", // sun_emoji_3.png
  SURPRISED: "surprised", // sun_emoji_4.png
  THINKING: "thinking", // sun_emoji_5.png
  SAD: "sad", // sun_emoji_6.png
  SLEEPY: "sleepy", // sun_emoji_7.png
  COOL: "cool", // sun_emoji_8.png
  LOVE: "love", // sun_emoji_9.png
};

// Mapeamento de humores para arquivos de imagem
const MOOD_IMAGES = {
  [MOODS.NEUTRAL]: "sun_emoji_1.png",
  [MOODS.HAPPY]: "sun_emoji_2.png",
  [MOODS.EXCITED]: "sun_emoji_3.png",
  [MOODS.SURPRISED]: "sun_emoji_4.png",
  [MOODS.THINKING]: "sun_emoji_5.png",
  [MOODS.SAD]: "sun_emoji_6.png",
  [MOODS.SLEEPY]: "sun_emoji_7.png",
  [MOODS.COOL]: "sun_emoji_8.png",
  [MOODS.LOVE]: "sun_emoji_9.png",
};

class AssistantMood {
  constructor() {
    this.currentMood = MOODS.HAPPY; // Humor padrão
    this.previousMood = null;
    this.moodChangeTime = Date.now();
    this.moodHistory = [];
    this.analyzer = new MoodAnalyzer();
    this.renderer = new MoodRenderer();

    // Carregar humor salvo, se existir
    this.loadSavedMood();
  }

  /**
   * Inicializa o sistema de humor
   */
  initialize() {
    console.log("[AssistantMood] Inicializando sistema de humor do assistente");
    this.renderer.initialize();
    this.setMood(this.currentMood); // Aplicar o humor inicial
    this.setupEventListeners();
    return this;
  }

  /**
   * Configura os event listeners para capturar mensagens
   */
  setupEventListeners() {
    // Escutar evento de mensagem enviada pelo usuário
    document.addEventListener("user-message-sent", (event) => {
      const message = event.detail.message;
      this.analyzeUserMessage(message);
    });

    // Escutar evento de resposta do assistente
    document.addEventListener("assistant-message-received", (event) => {
      const message = event.detail.message;
      this.analyzeAssistantResponse(message);
    });

    console.log("[AssistantMood] Event listeners configurados");
  }

  /**
   * Analisa mensagem do usuário para determinar humor
   * @param {string} message - Mensagem do usuário
   */
  analyzeUserMessage(message) {
    console.log("[AssistantMood] Analisando mensagem do usuário:", message);
    const suggestedMood = this.analyzer.analyzeUserInput(message);
    if (suggestedMood) {
      this.updateMood(suggestedMood);
    }
  }

  /**
   * Analisa resposta do assistente para determinar humor
   * @param {string} message - Resposta do assistente
   */
  analyzeAssistantResponse(message) {
    console.log("[AssistantMood] Analisando resposta do assistente");
    const suggestedMood = this.analyzer.analyzeAssistantResponse(message);
    if (suggestedMood) {
      this.updateMood(suggestedMood);
    }
  }

  /**
   * Atualiza o humor se for apropriado
   * @param {string} mood - Novo humor sugerido
   */
  updateMood(mood) {
    // Verificar tempo desde última mudança (evitar trocas muito rápidas)
    const now = Date.now();
    const timeSinceLastChange = now - this.moodChangeTime;

    // Só permitir mudança após 2 segundos da última alteração
    if (timeSinceLastChange < 2000) {
      console.log("[AssistantMood] Ignorando mudança de humor (muito rápido)");
      return;
    }

    // Não mudar para o mesmo humor atual
    if (mood === this.currentMood) {
      return;
    }

    // Salvar humor anterior
    this.previousMood = this.currentMood;
    this.currentMood = mood;
    this.moodChangeTime = now;
    this.moodHistory.push({ mood, timestamp: now });

    // Limitar histórico a 10 entradas
    if (this.moodHistory.length > 10) {
      this.moodHistory.shift();
    }

    // Aplicar o novo humor
    this.setMood(mood);

    // Salvar humor atual
    this.saveMood();

    console.log(
      `[AssistantMood] Humor atualizado: ${this.previousMood} -> ${this.currentMood}`
    );
  }

  /**
   * Define o humor atual e atualiza a interface
   * @param {string} mood - Humor a ser definido
   */
  setMood(mood) {
    if (!MOOD_IMAGES[mood]) {
      console.warn(`[AssistantMood] Humor inválido: ${mood}, usando padrão`);
      mood = MOODS.HAPPY;
    }

    const imageFile = MOOD_IMAGES[mood];

    // LOG CRÍTICO
    if (!imageFile || imageFile === "{imageFile}") {
      console.error(
        `[AssistantMood] Nome de arquivo de humor inválido:`,
        imageFile,
        "para mood:",
        mood
      );
      return; // Não tente atualizar o ícone se o arquivo não for válido!
    }

    this.renderer.updateMoodIcon(imageFile, mood);
    this.currentMood = mood;

    // Disparar evento para informar sobre mudança de humor
    const event = new CustomEvent("assistant-mood-changed", {
      detail: { mood, imageFile },
    });
    document.dispatchEvent(event);
  }

  /**
   * Força uma mudança específica de humor (para uso externo)
   * @param {string} mood - Humor a ser definido
   */
  forceSetMood(mood) {
    if (!MOODS[mood.toUpperCase()]) {
      console.warn(`[AssistantMood] Humor forçado inválido: ${mood}`);
      return false;
    }

    this.previousMood = this.currentMood;
    this.currentMood = MOODS[mood.toUpperCase()];
    this.moodChangeTime = Date.now();

    this.setMood(this.currentMood);
    this.saveMood();
    return true;
  }

  /**
   * Salva humor atual no localStorage
   */
  saveMood() {
    try {
      localStorage.setItem("assistant-mood", this.currentMood);
    } catch (err) {
      console.error("[AssistantMood] Erro ao salvar humor:", err);
    }
  }

  /**
   * Carrega humor salvo do localStorage
   */
  loadSavedMood() {
    try {
      const savedMood = localStorage.getItem("assistant-mood");
      if (savedMood && MOODS[savedMood.toUpperCase()]) {
        this.currentMood = savedMood;
      }
    } catch (err) {
      console.error("[AssistantMood] Erro ao carregar humor:", err);
    }
  }

  /**
   * Retorna ao humor anterior
   */
  revertToPreviousMood() {
    if (this.previousMood) {
      this.setMood(this.previousMood);
    }
  }

  /**
   * Obtém o humor atual
   * @return {string} Humor atual
   */
  getCurrentMood() {
    return this.currentMood;
  }
}

// Exportar instância singleton
export const assistantMood = new AssistantMood();
export default assistantMood;
