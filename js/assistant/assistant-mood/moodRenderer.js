/**
 * MoodRenderer - Gerencia a exibição visual do humor do assistente
 */

export class MoodRenderer {
  constructor() {
    this.quickActionButton = null;
    this.iconElement = null;
    this.currentImage = null;
    this.animating = false;
  }

  /**
   * Inicializa o renderizador
   */
  initialize() {
    // Aguarda o DOM estar pronto e o botão existir
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.findElements());
    } else {
      this.findElements();
    }
    this.createStyleElement();
  }

  /**
   * Encontra os elementos necessários no DOM
   */
  findElements() {
    this.quickActionButton = document.querySelector(
      ".quick-actions .action-button.primary"
    );

    if (!this.quickActionButton) {
      console.error("[MoodRenderer] Botão de ação rápida não encontrado!");
      return;
    }

    // Verificar se o ícone já existe ou criar um novo
    this.iconElement = this.quickActionButton.querySelector("img.mood-icon");

    if (!this.iconElement) {
      // Remover o ícone existente (geralmente uma tag i com font-awesome)
      const existingIcon = this.quickActionButton.querySelector("i");
      if (existingIcon) {
        existingIcon.style.display = "none";
        console.log("[MoodRenderer] Ícone <i> ocultado.");
      }

      // Criar novo elemento de imagem
      this.iconElement = document.createElement("img");
      this.iconElement.className = "mood-icon";
      this.iconElement.alt = "Assistente";
      this.iconElement.style.width = "26px";
      this.iconElement.style.height = "26px";
      this.iconElement.style.left = "1px"; // Manter alinhamento à esquerda
      this.iconElement.style.objectFit = "contain";
      this.iconElement.style.transition =
        "transform 0.3s ease, opacity 0.3s ease";

      // Adicionar ao botão
      this.quickActionButton.appendChild(this.iconElement);
      console.log(
        "[MoodRenderer] <img class='mood-icon'> adicionado ao botão."
      );
    } else {
      console.log("[MoodRenderer] <img class='mood-icon'> já existe.");
    }

    // Log para depuração
    console.log("[MoodRenderer] Elementos encontrados e configurados", {
      quickActionButton: this.quickActionButton,
      iconElement: this.iconElement,
    });
  }

  /**
   * Cria elemento de estilo para animações
   */
  createStyleElement() {
    const styleElement = document.createElement("style");
    styleElement.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .mood-icon.animate-pulse { animation: pulse 0.8s ease; }
      .mood-icon.animate-bounce { animation: bounce 0.8s ease; }
      .mood-icon.animate-spin { animation: spin 0.8s ease; }
      .quick-actions .action-button.primary {
        display: flex;
        justify-content: center;
        left: 1px;
        align-items: center;
        transition: background-color 0.3s ease;
      }
    `;
    document.head.appendChild(styleElement);
    console.log("[MoodRenderer] Estilos de animação adicionados");
  }

  /**
   * Atualiza o ícone do humor
   * @param {string} imageFile - Nome do arquivo de imagem
   * @param {string} mood - Tipo de humor
   */
  updateMoodIcon(imageFile, mood) {
    if (!this.iconElement) {
      console.error("[MoodRenderer] Elemento de ícone não inicializado");
      return;
    }

    if (
      !imageFile ||
      typeof imageFile !== "string" ||
      imageFile === "{imageFile}"
    ) {
      console.error(
        "[MoodRenderer] Nome do arquivo de imagem inválido:",
        imageFile,
        "para mood:",
        mood
      );
      return;
    }

    this.currentImage = imageFile;

    // Caminho correto para as imagens
    const imagePath = `./assets/emojis/sun_emojis/${imageFile}`;
    console.log(
      `[MoodRenderer] Atualizando ícone para: ${imagePath} (mood: ${mood})`
    );

    this.iconElement.classList.remove(
      "animate-pulse",
      "animate-bounce",
      "animate-spin"
    );

    this.iconElement.style.opacity = "0";

    setTimeout(() => {
      this.iconElement.src = imagePath;
      this.iconElement.dataset.mood = mood;
      this.iconElement.style.opacity = "1";
      this.addAnimationForMood(mood);
      console.log(
        `[MoodRenderer] Ícone atualizado para: ${imageFile} (${mood})`
      );
      // Verificar se a imagem foi carregada corretamente
      this.iconElement.onerror = () => {
        console.error(`[MoodRenderer] Falha ao carregar imagem: ${imagePath}`);
        this.iconElement.src = ""; // Limpa a imagem se não carregar
      };
      this.iconElement.onload = () => {
        console.log(
          `[MoodRenderer] Imagem carregada com sucesso: ${imagePath}`
        );
      };
    }, 300);
  }

  /**
   * Adiciona animação baseada no humor
   * @param {string} mood - Tipo de humor
   */
  addAnimationForMood(mood) {
    setTimeout(() => {
      switch (mood) {
        case "excited":
        case "surprised":
          this.iconElement.classList.add("animate-bounce");
          break;
        case "happy":
        case "love":
          this.iconElement.classList.add("animate-pulse");
          break;
        case "thinking":
          this.iconElement.classList.add("animate-spin");
          break;
        default:
          break;
      }
    }, 300);
  }
}
