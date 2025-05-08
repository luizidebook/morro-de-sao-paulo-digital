/**
 * Gerencia o estado do carrossel de forma centralizada para evitar duplicações
 */

// Estado do carrossel
let carouselState = {
  active: false,
  locationName: null,
  lastRestoreTime: 0,
  processing: false,
};

// Função para salvar estado do carrossel
export function saveCarouselState(locationName) {
  if (!locationName) return;

  // Limpar o nome do local (remover texto adicional)
  const cleanName = String(locationName).split("\n")[0].trim();

  carouselState = {
    active: true,
    locationName: cleanName,
    lastRestoreTime: Date.now(),
    processing: false,
  };

  console.log("[carousel-state] Estado salvo:", carouselState);
  return carouselState;
}

// Função para limpar estado do carrossel
export function clearCarouselState() {
  carouselState = {
    active: false,
    locationName: null,
    lastRestoreTime: 0,
    processing: false,
  };

  // Também remover do localStorage para garantir que não será restaurado
  localStorage.removeItem("lastCarouselLocation");
  localStorage.removeItem("carouselActive");

  console.log(
    "[carousel-state] Estado completamente limpo (memória e localStorage)"
  );
  return carouselState;
}

// Função para restaurar o carrossel
export function restoreCarousel() {
  // Verificar se já está processando
  if (carouselState.processing) {
    console.log(
      "[carousel-state] Já está processando uma restauração, ignorando"
    );
    return false;
  }

  // Verificar se tem estado ativo
  if (!carouselState.active || !carouselState.locationName) {
    console.log("[carousel-state] Sem estado ativo para restaurar");
    return false;
  }

  // Verificar throttling (para evitar múltiplos cliques próximos)
  const now = Date.now();
  if (now - carouselState.lastRestoreTime < 500) {
    console.log("[carousel-state] Restauração muito rápida, ignorando");
    return false;
  }

  // Definir como processando
  carouselState.processing = true;

  console.log(
    "[carousel-state] Iniciando restauração de carrossel para:",
    carouselState.locationName
  );

  // Mostrar o assistente primeiro, se estiver oculto
  const assistantModal = document.getElementById("assistant-messages");
  if (assistantModal) {
    assistantModal.classList.remove("hidden");
    console.log(
      "[carousel-state] Assistente modal exibido antes da restauração"
    );

    const messagesArea = assistantModal.querySelector(".messages-area");
    if (messagesArea) {
      console.log("[carousel-state] Limpando área de mensagens");
      messagesArea.innerHTML = "";

      // Restaurar o carrossel
      import("./carousel.js").then((module) => {
        console.log(
          "[carousel-state] Chamando showCarouselInAssistant com:",
          carouselState.locationName
        );
        module.showCarouselInAssistant(carouselState.locationName);

        // Atualizar o timestamp
        carouselState.lastRestoreTime = Date.now();

        // Terminar processamento
        setTimeout(() => {
          carouselState.processing = false;
        }, 300);
      });

      return true;
    }
  }

  // Se chegou aqui, houve um erro
  carouselState.processing = false;
  return false;
}

// Função para obter o estado atual
export function getCarouselState() {
  return { ...carouselState };
}
